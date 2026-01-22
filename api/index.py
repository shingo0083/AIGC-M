import os
import json
import requests
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# 加载 .env 环境变量
load_dotenv()

# 初始化 FastAPI 应用
app = FastAPI()

# 配置跨域 (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_ROOT = os.path.join(BASE_DIR, "data")

def load_json(relative_path):
    """辅助函数：安全加载 JSON 文件"""
    full_path = os.path.join(DATA_ROOT, relative_path)
    if not os.path.exists(full_path): return None
    try:
        with open(full_path, "r", encoding="utf-8") as f: return json.load(f)
    except Exception as e: return None

# ==================== GET 接口 (保持不变) ====================
@app.get("/api/init")
def get_global_config(): return load_json("global.json")

@app.get("/api/styles")
def get_style_list():
    styles = []
    styles_dir = os.path.join(DATA_ROOT, "styles")
    if os.path.exists(styles_dir):
        for filename in os.listdir(styles_dir):
            if filename.endswith(".json"):
                data = load_json(os.path.join("styles", filename))
                if data: styles.append({"id": data.get("id"), "name": data.get("name"), "description": data.get("description", "")})
    return styles

@app.get("/api/styles/{style_id}")
def get_style_detail(style_id: str):
    manifest = None
    styles_dir = os.path.join(DATA_ROOT, "styles")
    if os.path.exists(styles_dir):
        for filename in os.listdir(styles_dir):
            data = load_json(os.path.join("styles", filename))
            if data and data.get("id") == style_id:
                manifest = data; break
    if not manifest: raise HTTPException(status_code=404, detail="Style not found")

    assembled_slots = {}
    slots_config = manifest.get("slots", {})
    for slot_key, config in slots_config.items():
        source_file = config.get("source")
        slot_data = { "label": config.get("label", slot_key), "disabled": False, "options": [] }
        if source_file is None: slot_data["disabled"] = True
        else:
            assets_path = os.path.join("assets", source_file)
            assets_content = load_json(assets_path)
            slot_data["options"] = assets_content if assets_content else []
        assembled_slots[slot_key] = slot_data

    return { "manifest": manifest, "slots_data": assembled_slots }

# ==================== 真实 API 对接逻辑 ====================

class GenerateRequest(BaseModel):
    prompt: str
    model: str = "gemini-3-pro-image-preview" # 默认值，也会被 .env 覆盖
    images: List[str] = []

def parse_upstream_response(result):
    """
    从上游 API 响应中提取 Base64 图片数据
    复用你提供的多重容错逻辑
    """
    image_data = None

    # 格式 1: candidates[0].content.parts[0].inline_data.data
    if 'candidates' in result:
        try:
            parts = result['candidates'][0]['content']['parts']
            for part in parts:
                if 'inline_data' in part:
                    image_data = part['inline_data']['data']
                    break
                elif 'inlineData' in part:
                    image_data = part['inlineData']['data']
                    break
        except (KeyError, IndexError):
            pass
    
    # 格式 2: 直接在根节点的 data 或 image 字段
    if not image_data and 'data' in result: image_data = result['data']
    if not image_data and 'image' in result: image_data = result['image']
    
    # 格式 3: generatedImages
    if not image_data and 'generatedImages' in result:
        try:
            image_data = result['generatedImages'][0]['data']
        except (KeyError, IndexError):
            pass

    return image_data

@app.post("/api/generate")
async def generate_image(req: GenerateRequest):
    # 1. 读取配置
    api_url = os.getenv("GEMINI_API_URL", "http://156.238.229.55:3000")
    api_key = os.getenv("GEMINI_API_KEY")
    model_name = os.getenv("GEMINI_MODEL", req.model)
    
    target_url = f"{api_url}/v1beta/models/{model_name}:generateContent"
    
    print(f"🚀 发起请求: {target_url}")
    print(f"📝 Prompt: {req.prompt[:50]}...")
    print(f"🖼️ 附带图片数: {len(req.images)}")

    # 2. 构建符合 Gemini 协议的 Payload
    # 构造 parts 数组
    parts = [{"text": req.prompt}]
    
    # 如果有上传图片，将它们作为 inline_data 添加进 parts
    for img_base64 in req.images:
        parts.append({
            "inline_data": {
                "mime_type": "image/png",
                "data": img_base64
            }
        })

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "imageConfig": {
                "aspectRatio": "1:1",
                "imageSize": "4K"
            },
            "temperature": 0.9,
            "topK": 40,
            "topP": 0.95,
            "maxOutputTokens": 8192
        }
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    try:
        # 3. 调用上游 API
        # 设置较大的 timeout (120s)，因为生图比较慢
        response = requests.post(target_url, json=payload, headers=headers, timeout=120)
        
        if response.status_code != 200:
            print(f"❌ 上游 API 报错: {response.text}")
            return {"status": "error", "message": f"API Error: {response.status_code}"}
        
        result = response.json()
        
        # 4. 解析结果
        raw_base64 = parse_upstream_response(result)
        
        if raw_base64:
            # 清理可能存在的 base64 前缀 (虽然你的脚本里写了 split，但为了保险再处理一次)
            if "base64," in raw_base64:
                raw_base64 = raw_base64.split("base64,")[1]
            
            # 拼接成前端可直接展示的 Data URL
            final_url = f"data:image/png;base64,{raw_base64}"
            
            print("✅ 图片解析成功，返回给前端")
            return {
                "status": "success",
                "url": final_url  # 前端 <el-image :src="url"> 可以直接显示这个字符串
            }
        else:
            print("❌ 无法从响应中提取图片")
            print(f"调试响应: {json.dumps(result)[:200]}...")
            return {"status": "error", "message": "无法解析返回的图片数据"}

    except Exception as e:
        print(f"❌ 请求异常: {str(e)}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
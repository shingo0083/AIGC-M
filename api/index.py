import os
import json
import requests
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
app = FastAPI()

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
    full_path = os.path.join(DATA_ROOT, relative_path)
    if not os.path.exists(full_path): return None
    try:
        with open(full_path, "r", encoding="utf-8") as f: return json.load(f)
    except: return None

# ==================== 核心逻辑：蓝图构建器 (Smart Builder) ====================
def build_blueprint(prompt: str, style_config: dict, has_images: bool):
    """
    智能蓝图构建：
    1. 动态隐藏空段落
    2. 扩充材质识别库
    3. 修复逻辑冲突
    """
    user_prompt = prompt
    lower_prompt = user_prompt.lower()
    
    role = style_config.get('role', 'You are a professional photographer.') if style_config else ""
    neg = style_config.get('negative_prompt', '') if style_config else ""

    # --- 1. 组装各个模块 ---
    
    # [A] 策略与 LOD
    lod_lines = []
    if has_images:
        lod_lines.append("IMPORTANT: Strictly maintain the facial features and identity of the source reference image.")
        
    if any(k in lower_prompt for k in ["full body", "wide shot", "far", "shoes", "feet"]):
        lod_lines.append("(Render Priority: Maintain correct head-to-body proportions. Simplify facial micro-details to prevent noise.)")
    elif any(k in lower_prompt for k in ["close-up", "portrait", "face", "eyes"]):
        lod_lines.append("(Render Priority: Focus on high-frequency skin details, pores, and eye reflections.)")
    
    # [B] 物理与材质 (扩充词库!)
    physics_notes = []
    # 针织类
    if any(k in lower_prompt for k in ["knit", "sweater", "cardigan", "wool", "fleece"]): 
        physics_notes.append("Focus on the fluffy, fuzzy texture of the knit fabric.")
    # 丝绸类
    if any(k in lower_prompt for k in ["silk", "satin", "slip dress", "viscose"]): 
        physics_notes.append("Render the liquid-like sheen and fluid drape of the material.")
    # 紧身/胶衣
    if any(k in lower_prompt for k in ["tight", "bodycon", "yoga", "latex", "leather"]): 
        physics_notes.append("Fabric should appear stretching tightly over body curves. Render distinct texture highlights.")
    # 透视/蕾丝 (新增!)
    if any(k in lower_prompt for k in ["lace", "sheer", "translucent", "tulle", "chiffon"]): 
        physics_notes.append("Render delicate transparency, intricate embroidery texture, and soft interaction between fabric and skin tone.")
    
    physics_str = " ".join(physics_notes)

    # --- 2. 动态拼接 (只拼接有内容的板块) ---
    
    blocks = []
    
    # Header: Role
    if role: blocks.append(role)
    
    blocks.append("### GENERATION BLUEPRINT")
    
    # Block 1: Strategy
    if lod_lines:
        blocks.append(f"**1. STRATEGY & LOD:**\n" + "\n".join(lod_lines))
    
    # Block 2: Physics (只有当检测到材质时才显示此标题!)
    if physics_str:
        blocks.append(f"**2. PHYSICS & MATERIAL:**\n{physics_str}")
        
    # Block 3: Action (永远显示)
    blocks.append(f"**3. SCENE & ACTION:**\n{user_prompt}")
    
    # Block 4: Negative (永远显示)
    if neg:
        blocks.append(f"**4. NEGATIVE CONSTRAINTS:**\nAvoid: {neg}")

    # 用双换行符连接所有板块，保持整洁
    return "\n\n".join(blocks)

# ==================== GET 接口 ====================
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
            content = load_json(assets_path)
            slot_data["options"] = content if content else []
        assembled_slots[slot_key] = slot_data
    return { "manifest": manifest, "slots_data": assembled_slots }

# ==================== POST 接口 ====================

class GenerateRequest(BaseModel):
    prompt: str
    model: str = "gemini-3-pro-image-preview"
    images: List[str] = []
    aspect_ratio: str = "3:4"
    style_config: Optional[dict] = None

# 🔥 新增：仅编译 Prompt，不生成图片
@app.post("/api/compile")
async def compile_prompt(req: GenerateRequest):
    blueprint = build_blueprint(req.prompt, req.style_config, bool(req.images))
    return {"status": "success", "blueprint": blueprint}

@app.post("/api/generate")
async def generate_image(req: GenerateRequest):
    api_url = os.getenv("GEMINI_API_URL", "http://156.238.229.55:3000")
    api_key = os.getenv("GEMINI_API_KEY")
    model_name = os.getenv("GEMINI_MODEL", req.model)
    target_url = f"{api_url}/v1beta/models/{model_name}:generateContent"
    
    # 调用共用的构建逻辑
    final_prompt = build_blueprint(req.prompt, req.style_config, bool(req.images))
    print(f"🧠 Prompt Executing: {final_prompt[:50]}...")

    parts = [{"text": final_prompt}]
    for img in req.images:
        parts.append({ "inline_data": { "mime_type": "image/png", "data": img } })

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "imageConfig": { "aspectRatio": req.aspect_ratio, "imageSize": "2K" },
            "temperature": 0.9
        }
    }
    headers = { "Content-Type": "application/json", "Authorization": f"Bearer {api_key}" }

    try:
        response = requests.post(target_url, json=payload, headers=headers, timeout=120)
        if response.status_code != 200:
            return {"status": "error", "message": f"API Error: {response.text}"}
            
        result = response.json()
        image_data = None
        # 简化版提取逻辑
        if 'candidates' in result:
             parts = result['candidates'][0]['content']['parts']
             for part in parts:
                 if 'inline_data' in part: image_data = part['inline_data']['data']
                 elif 'inlineData' in part: image_data = part['inlineData']['data']
        
        if not image_data and 'image' in result: image_data = result['image']

        if image_data:
            if "base64," in image_data: image_data = image_data.split("base64,")[1]
            return { "status": "success", "url": f"data:image/png;base64,{image_data}", "final_prompt": final_prompt }
        else:
            return {"status": "error", "message": "未返回图片数据"}

    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
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
    if not os.path.exists(full_path):
        return None
    try:
        with open(full_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return None


# ==================== Error Humanizer ====================


def _shorten(s: str, n: int = 800) -> str:
    s = s or ""
    return s if len(s) <= n else s[:n] + "…"


def humanize_upstream_error(status_code: int, raw_text: str) -> str:
    upstream_msg = ""
    try:
        data = json.loads(raw_text or "")
        upstream_msg = (
            (data.get("error") or {}).get("message") or data.get("message") or ""
        )
    except Exception:
        upstream_msg = ""

    # 上游返回的人话翻译
    if status_code in (401, 403):
        return (
            "鉴权失败：上游 API Key 无效或权限不足，请检查 GEMINI_API_KEY / 权限配置。"
        )
    if status_code == 404:
        return "上游接口不存在或模型名错误：请检查 GEMINI_API_URL / GEMINI_MODEL / req.model。"
    if status_code == 429:
        return "请求过于频繁或额度不足：请稍后重试，或检查上游配额/限流设置。"
    if 500 <= status_code <= 599:
        return "上游服务暂时不可用（5xx）：请稍后重试。"
    return "上游请求失败：请稍后重试或检查参数。"


def humanize_exception(e: Exception) -> str:
    # 本地异常的人话翻译
    msg = str(e).lower()
    if "timeout" in msg:
        return "请求超时：上游响应过慢，请稍后重试。"
    if "connection" in msg or "connect" in msg:
        return "网络连接失败：无法连接到上游服务，请检查网络或代理设置。"
    return "服务处理失败：请稍后重试，或查看后端日志定位原因。"


# ==================== 核心逻辑：蓝图构建器 (Smart Builder) ====================
def build_blueprint(
    prompt: str,
    style_config: dict,
    has_images: bool,
    aspect_ratio: str = None,
    disable_backend_physics: bool = False,
):
    ...
    """
    智能蓝图构建：
    1. 动态隐藏空段落
    2. 扩充材质识别库
    3. 修复逻辑冲突
    """
    user_prompt = prompt
    lower_prompt = user_prompt.lower()

    role = (style_config or {}).get("role", "You are a professional photographer.")
    neg = (style_config or {}).get("negative_prompt", "")
    # ✅ 追加光源相关 negative，防止模型偷加影棚轮廓灯
    extra_neg = "studio lighting, rim light, hard rimlight, spotlight backlight, invisible light source, fake backlight behind subject"
    if neg:
        neg = f"{neg}, {extra_neg}"
    else:
        neg = extra_neg

    has_role_in_prompt = "**role:**" in lower_prompt
    # ✅ 如果 user_prompt 已经是“结构化蓝图”，后端不要再二次包裹（避免层级冲突）
    has_blueprint_in_prompt = (
        "### generation blueprint" in lower_prompt
        or "### 1. subject description" in lower_prompt
        or "**render priority:**" in lower_prompt
    )

    # --- 1. 组装各个模块 ---

    # [A] 策略与 LOD
    lod_lines = []
    if has_images:
        lod_lines.append(
            "IMPORTANT: Strictly maintain the facial features and identity of the source reference image."
        )

    if any(
        k in lower_prompt for k in ["full body", "wide shot", "far", "shoes", "feet"]
    ):
        lod_lines.append(
            "(Render Priority: Maintain correct head-to-body proportions. Simplify facial micro-details to prevent noise.)"
        )
    elif any(k in lower_prompt for k in ["close-up", "portrait", "face", "eyes"]):
        lod_lines.append(
            "(Render Priority: Focus on high-frequency skin details, pores, and eye reflections.)"
        )
    # ✅ Problem-1 兜底：全身/远景强制防裁切（仅当后端在构建蓝图时）
    frame_integrity_lines = []
    if any(k in lower_prompt for k in ["full body", "wide shot", "establishing shot", "ultra wide", "head-to-toe"]):
        frame_integrity_lines = [
        "### FRAME INTEGRITY (FULL-BODY LOCK)",
        "- Full body must be visible from head to toe.",
        "- Entire subject must be fully inside the frame.",
        "- Feet visible, shoes visible, and ground visible under the feet.",
        "- No cropping: do not cut off head, feet, legs, arms, hands, or any body part.",
        "- Leave comfortable margin around the full figure (do not frame too tight).",
        "- Subject appears small within the environment (environment-first composition).",
    ]

    # [B] 物理与材质 (扩充词库!)
    physics_notes = []

    if not disable_backend_physics:
        # 针织类
        if any(
            k in lower_prompt for k in ["knit", "sweater", "cardigan", "wool", "fleece"]
        ):
            physics_notes.append(
                "Focus on the fluffy, fuzzy texture of the knit fabric."
            )
        # 丝绸类
        if any(k in lower_prompt for k in ["silk", "satin", "slip dress", "viscose"]):
            physics_notes.append(
                "Render the liquid-like sheen and fluid drape of the material."
            )
        # 紧身/胶衣
        if any(
            k in lower_prompt for k in ["tight", "bodycon", "yoga", "latex", "leather"]
        ):
            physics_notes.append(
                "Fabric should appear stretching tightly over body curves. Render distinct texture highlights."
            )
        # 透视/蕾丝
        if any(
            k in lower_prompt
            for k in ["lace", "sheer", "translucent", "tulle", "chiffon"]
        ):
            physics_notes.append(
                "Render delicate transparency, intricate embroidery texture, and soft interaction between fabric and skin tone."
            )

    physics_str = " ".join(physics_notes)

    # --- 2. 动态拼接 (只拼接有内容的板块) ---

    blocks = []
    # ✅ 前端已输出完整蓝图：后端只做 minimal 包装（或直接返回）
    if has_blueprint_in_prompt:
        # 仍然允许 style_config 的 negative 追加（可选）；更稳的是完全不追加，避免重复 negative
        return user_prompt

    # Header: Role（只有当 user_prompt 本身没有 Role 块时才追加）
    if role and not has_role_in_prompt:
        blocks.append(role)

    blocks.append("### GENERATION BLUEPRINT")

    # Block 1: Strategy
    if lod_lines:
        blocks.append(f"**1. STRATEGY & LOD:**\n" + "\n".join(lod_lines))
        
    if frame_integrity_lines:
        blocks.append("\n".join(frame_integrity_lines))

    # Block 2: Action（永远显示）
    blocks.append(f"**2. SCENE & ACTION:**\n{user_prompt}")
    # ✅ Problem-2 兜底：光源必须场景内合理（diegetic），禁止影棚轮廓灯
    light_legitimacy_lines = []
    is_night_hint = any(k in lower_prompt for k in ["night", "moon", "midnight", "dark"])
    if is_night_hint:
        light_legitimacy_lines = [
        "### LIGHT SOURCE LEGITIMACY (DIEGETIC LIGHTING ONLY)",
        "- All lighting must come from realistic, scene-justified sources (diegetic lighting).",
        "- No studio lighting, no invisible rim light, no artificial backlight placed behind the subject.",
        "- If a strong backlight exists, it must be explainable (visible streetlight, visible sign, visible interior lamp, etc.).",
        "- Moonlight is soft and low-intensity: it cannot create a powerful studio-like rim light.",
        "- Night city lighting should show plausible bounce/reflections and realistic intensity falloff.",
    ]

    if light_legitimacy_lines:
        blocks.append("\n".join(light_legitimacy_lines))

    # Block 3: Enhancers（只有当检测到材质时才显示）
    if physics_str:
        blocks.append(
            f"**3. REALISM ENHANCERS (PHYSICS & MATERIAL):**\n{physics_str}\n(Subtle realism enhancer only; do not dominate composition.)"
        )

    # Block 4: Negative（永远显示）
    if neg:
        blocks.append(f"**4. NEGATIVE CONSTRAINTS:**\nAvoid: {neg}")

    # 用双换行符连接所有板块，保持整洁
    return "\n\n".join(blocks)


# ==================== GET 接口 ====================
@app.get("/api/init")
def get_global_config():
    return load_json("global.json")


@app.get("/api/styles")
def get_style_list():
    styles = []
    styles_dir = os.path.join(DATA_ROOT, "styles")
    if os.path.exists(styles_dir):
        for filename in os.listdir(styles_dir):
            if filename.endswith(".json"):
                data = load_json(os.path.join("styles", filename))
                if data:
                    styles.append(
                        {
                            "id": data.get("id"),
                            "name": data.get("name"),
                            "description": data.get("description", ""),
                        }
                    )
    return styles


@app.get("/api/styles/{style_id}")
def get_style_detail(style_id: str):
    manifest = None
    styles_dir = os.path.join(DATA_ROOT, "styles")
    if os.path.exists(styles_dir):
        for filename in os.listdir(styles_dir):
            data = load_json(os.path.join("styles", filename))
            if data and data.get("id") == style_id:
                manifest = data
                break
    if not manifest:
        raise HTTPException(status_code=404, detail="Style not found")

    assembled_slots = {}
    slots_config = manifest.get("slots", {})
    for slot_key, config in slots_config.items():
        source_file = config.get("source")
        slot_data = {
            "label": config.get("label", slot_key),
            "disabled": False,
            "options": [],
        }
        if source_file is None:
            slot_data["disabled"] = True
        else:
            assets_path = os.path.join("assets", source_file)
            content = load_json(assets_path)
            slot_data["options"] = content if content else []
        assembled_slots[slot_key] = slot_data
    return {"manifest": manifest, "slots_data": assembled_slots}


# ==================== POST 接口 ====================


class GenerateRequest(BaseModel):
    prompt: str
    model: str = "gemini-3-pro-image-preview"
    images: List[str] = []
    aspect_ratio: str = "3:4"
    style_config: Optional[dict] = None
    disable_backend_physics: bool = False


# 🔥 新增：仅编译 Prompt，不生成图片
@app.post("/api/compile")
async def compile_prompt(req: GenerateRequest):
    blueprint = build_blueprint(
        req.prompt,
        req.style_config,
        bool(req.images),
        req.aspect_ratio,
        req.disable_backend_physics,
    )
    return {"status": "success", "blueprint": blueprint}


@app.post("/api/generate")
async def generate_image(req: GenerateRequest):
    api_url = os.getenv("GEMINI_API_URL", "http://156.238.229.55:3000")
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {
            "status": "error",
            "message": "后端未配置 GEMINI_API_KEY：请在环境变量中设置后再生成。",
            "detail": "Missing GEMINI_API_KEY",
        }

    model_name = os.getenv("GEMINI_MODEL", req.model)
    target_url = f"{api_url}/v1beta/models/{model_name}:generateContent"

    # 调用共用的构建逻辑
    final_prompt = build_blueprint(
        req.prompt,
        req.style_config,
        bool(req.images),
        req.aspect_ratio,
        req.disable_backend_physics,
    )
    print(f"🧠 Prompt Executing: {final_prompt[:50]}...")

    parts = [{"text": final_prompt}]
    for img in req.images or []:
        parts.append({"inline_data": {"mime_type": "image/png", "data": img}})

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "imageConfig": {"aspectRatio": req.aspect_ratio, "imageSize": "2K"},
            "temperature": 0.9,
        },
    }
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}

    try:
        response = requests.post(target_url, json=payload, headers=headers, timeout=300)
        if response.status_code != 200:
            friendly = humanize_upstream_error(response.status_code, response.text)
            return {
                "status": "error",
                "message": friendly,
                "detail": _shorten(response.text),
            }
        result = response.json()
        image_data = None

        # 简化版提取逻辑
        if "candidates" in result and result["candidates"]:
            parts = result["candidates"][0].get("content", {}).get("parts", [])
            for part in parts:
                if "inline_data" in part:
                    image_data = part["inline_data"]["data"]
                elif "inlineData" in part:
                    image_data = part["inlineData"]["data"]

        if not image_data and "image" in result:
            image_data = result["image"]

        if image_data:
            if "base64," in image_data:
                image_data = image_data.split("base64,")[1]
            return {
                "status": "success",
                "url": f"data:image/png;base64,{image_data}",
                "final_prompt": final_prompt,
            }
        else:
            return {"status": "error", "message": "未返回图片数据"}

    except Exception as e:
        return {
            "status": "error",
            "message": humanize_exception(e),
            "detail": _shorten(str(e)),
        }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)

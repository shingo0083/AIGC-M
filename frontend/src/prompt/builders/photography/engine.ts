// frontend/src/prompt/builders/photography/engine.ts
export function isNonEmpty(x: any) {
    return typeof x === "string" && x.trim().length > 0
}

/**
 * logic.js: getAdaptiveFacePrompt(originalFacePrompt, framing)
 * 纯语义 LOD 降级/升级：近景更细、远景更抽象
 */
export function getAdaptiveFacePrompt(originalFacePrompt: string, framing: string) {
    if (!originalFacePrompt) return ""
    const f = String(framing || "").toLowerCase()

    // 远景/全身：减少微细节，防噪点与脸崩
    if (f.includes("full") || f.includes("wide") || f.includes("distanced") || f.includes("far")) {
        return originalFacePrompt
            .replace(/pores|pore|skin texture|freckles|eyelash detail|micro|high-frequency|specular|eye reflections|crisp/gim, "")
            .replace(/\s+/g, " ")
            .trim()
    }

    // 近景：强化皮肤与眼睛高频细节
    if (f.includes("close") || f.includes("face") || f.includes("portrait") || f.includes("eyes")) {
        return `${originalFacePrompt}, high-frequency skin detail, pores, natural specular highlights, crisp eye reflections`
    }

    return originalFacePrompt
}

/**
 * logic.js: isGroundAction(moveText)
 * 地面动作：提示“脚可见取决于姿态和机位”
 */
export function isGroundAction(moveText: string) {
    const t = String(moveText || "").toLowerCase()
    return (
        t.includes("sitting") ||
        t.includes("kneeling") ||
        t.includes("lying") ||
        t.includes("floor") ||
        t.includes("ground")
    )
}

/**
 * logic.js: recommendLens(cameraHeight, framing, moveText)
 * 仅在 policy=auto 时真正替换基础镜头；policy=suggest 时只给建议
 */
export function recommendLens(cameraHeight: string, framing: string, moveText: string) {
    const f = String(framing || "").toLowerCase()
    const m = String(moveText || "").toLowerCase()

    // Mirror selfie / phone POV has its own optics
    if (m.includes("selfie") || m.includes("holding a phone") || m.includes("mirror")) {
        return null
    }

    if (cameraHeight === "Ground-Level") {
        return "Shot on 35mm–50mm lens (controlled perspective, avoid extreme wide-angle distortion), f/8 aperture."
    }

    if (cameraHeight === "Overhead") {
        if (f.includes("full") || f.includes("wide") || f.includes("distanced")) {
            return "Shot on 28mm–35mm lens (clean top-down geometry), f/8 aperture."
        }
        return "Shot on 35mm–50mm lens (clean top-down geometry), f/5.6 aperture."
    }

    if (cameraHeight === "Low-Angle" && f.includes("full")) {
        return "Shot on 28mm–35mm lens (mild perspective emphasis), f/8 aperture."
    }

    if (f.includes("close") || f.includes("face") || f.includes("portrait")) {
        return "Shot on 50mm–85mm prime lens (natural facial perspective), f/2.0–f/2.8 aperture."
    }

    return null
}

/**
 * logic.js: lightingNeedsAdaptation(cameraHeight, lightingText)
 * 非 Eye-Level 的 Rembrandt 光需适配透视
 */
export function lightingNeedsAdaptation(cameraHeight: string, lightingText: string) {
    if (!lightingText) return false
    if (cameraHeight === "Eye-Level") return false
    const t = lightingText.toLowerCase()
    return t.includes("rembrandt")
}

export function isMirrorPOV(moveText: string) {
    const m = String(moveText || "").toLowerCase()
    return m.includes("selfie") || m.includes("holding a phone") || m.includes("mirror")
}

export function isExtremePose(moveText: string) {
    const m = String(moveText || "")
    return (
        m.includes("Twist") ||
        m.includes("Spiral") ||
        m.includes("Split") ||
        m.includes("Arch") ||
        m.includes("Vacuum")
    )
}
/**
 * 辅助函数：判断视觉冲击力等级
 * 优化点：默认值改为 'dominant'，以配合“多样性”补丁，确保未定义的描述也能获得物理反馈
 */
function getBustImpactLevel(desc: string): "minimal" | "compact" | "moderate" | "broad" | "dominant" {
    const t = desc.toLowerCase()
    if (t.includes("small") || t.includes("faint") || t.includes("minimal") || t.includes("flat")) return "minimal"
    if (t.includes("modest")) return "compact"
    if (t.includes("medium-large") || (t.includes("large") && !t.includes("very"))) return "broad"
    if (t.includes("medium")) return "moderate"
    if (t.includes("very large") || t.includes("extremely large") || t.includes("dominates") || t.includes("voluptuous")) return "dominant"
    return "dominant"
}
/**
 * 【优化版】只返回与“尺寸”强相关的动态物理特征
 * 核心改动：移除了所有通用规则（移交主函数），只保留 Load distribution 和 Interaction
 */
export function buildBustPhysics(cupSizeDesc: string) {
    const t = String(cupSizeDesc || "").trim()
    if (!t) return ""

    const lines: string[] = []
    const impact = getBustImpactLevel(t)

    // 1. 基准描述 (Dynamic Baseline)
    lines.push(`- Baseline: ${t}`)

    // 2. 动态特征 (Dynamic Cues based on Impact)
    if (impact === "minimal" || impact === "compact") {
        lines.push(`- Load distribution: remains compact and close to the ribcage profile.`)
        lines.push(`- Interaction: smaller compression footprint, shorter drape curvature, minimal seam deviation.`)
    } else if (impact === "moderate") {
        lines.push(`- Load distribution: balanced weight presence with natural gravity response.`)
        lines.push(`- Interaction: visible underbust contact shadow, moderate fabric drape curvature.`)
    } else { // broad || dominant
        lines.push(`- Load distribution: broad tension field affecting surrounding fabric.`)
        lines.push(`- Interaction: deep underbust contact, pronounced gravity-driven drape, localized fabric compression zones.`)
        lines.push(`- Weight cues: downward load must be visible even in supported poses.`)
    }

    return lines.join("\n")
}
/**
 * 【增强版】材质物理引擎
 * 新增：Gown/Formal 识别 + Default 兜底逻辑
 */
export function buildMaterialPhysics(clothingText: string) {
    const t = String(clothingText || "").trim()
    if (!t) return ""

    const lower = t.toLowerCase()
    const lines: string[] = []
    let matchFound = false // 用于标记是否命中了特定材质

    // 1. 针织/羊毛 (Knit/Wool)
    if (["knit", "sweater", "cardigan", "wool", "fleece", "tweed"].some(k => lower.includes(k))) {
        lines.push(`- Texture: fluffy fuzzy fibers, micro texture, soft subsurface scattering, heavy drape.`)
        matchFound = true
    }

    // 2. 丝绸/缎面 (Silk/Satin)
    if (["silk", "satin", "slip dress", "viscose", "chiffon"].some(k => lower.includes(k))) {
        lines.push(`- Texture: liquid-like sheen, fluid drape, realistic specular roll-off, responding sensitively to wind.`)
        matchFound = true
    }

    // 3. 紧身/胶衣/皮革 (Tight/Latex)
    if (["latex", "leather", "tight", "bodycon", "yoga", "swimsuit", "leotard", "bikini", "spandex"].some(k => lower.includes(k))) {
        lines.push(`- Tension: realistic stretch gradients, edge compression, glossy highlights without plastic artifacts.`)
        matchFound = true
    }

    // 4. 蕾丝/透视 (Lace/Sheer)
    if (["lace", "sheer", "translucent", "tulle", "mesh"].some(k => lower.includes(k))) {
        lines.push(`- Transparency: believable skin-fabric blending, fine embroidery detail, no harsh cutout edges.`)
        matchFound = true
    }

    // 5. 【新增】礼服/正装/牛仔 (Formal/Denim/Cotton) - 针对您刚才的 Gown
    if (["gown", "dress", "suit", "blazer", "skirt", "shirt"].some(k => lower.includes(k)) && !matchFound) {
        // 如果是礼服但没命中丝绸等，给一个通用的“高级面料”质感
        lines.push(`- Texture: high-quality fabric structure, crisp folds, clean seam lines, natural interaction with body posture.`)
        matchFound = true
    }

    if (["denim", "jeans", "jacket"].some(k => lower.includes(k))) {
        lines.push(`- Texture: coarse weave visible, stiff folds, matte finish with subtle edge abrasion.`)
        matchFound = true
    }

    // 6. 【新增】绝对兜底 (Default Fallback)
    // 只要有衣服，但上面都没命中，就给这个通用物理规则
    if (!matchFound) {
        lines.push(`- Fabric Physics: respect gravity-driven folds, natural material weight, and realistic shadow occlusion.`)
    }

    return lines.join("\n")
}
//**
// 【重构核心】统一编排物理引擎
//结构：[通用宪法] + [特定部位物理] + [特定材质物理]
//彻底消除冗余，Tokens 利用率最大化
export function buildUnifiedPhysics(cupSizeDesc: string, clothingText: string) {
    const bustSpecifics = buildBustPhysics(cupSizeDesc)
    const materialSpecifics = buildMaterialPhysics(clothingText)

    // 如果两个都没内容，直接返回空，不占用 token
    if (!bustSpecifics && !materialSpecifics) return ""

    const blocks: string[] = []

    // === 1. The Physics Constitution (通用物理宪法 - 全局只写一次) ===
    // 这些是对于 Gemini 最重要的“防幻觉”核心规则
    const commonRules = [
        `- Legibility Rule: Physical attributes must be legible through interaction (contact, tension, shadow), not just implied by labels.`,
        `- Anti-Hallucination: Do not rely on exposure, cleavage depth, or purely neckline-defined volume to imply mass.`,
        `- Fabric Logic: Respect gravity, seam tension, and displacement. No floating cloth, no mannequin-smooth gradients.`,
        `- Integration: Physics cues must be present and correct, but remain subtle enhancers to photorealism, not the primary focus.`
    ].join("\n")

    blocks.push(`**Physics & Material Logic:**\n${commonRules}`)

    // === 2. Bust Dynamics (如果有) ===
    if (bustSpecifics) {
        blocks.push(`*Anatomy / Mass:*\n${bustSpecifics}`)
    }

    // === 3. Material Response (如果有) ===
    if (materialSpecifics) {
        blocks.push(`*Material Response:*\n${materialSpecifics}`)
    }

    return blocks.join("\n\n").trim()
}
/**
 * 从 camera slot 的文本里“拆出镜头信息”
 * 例：
 *  "Shot on Sony A7R IV, 85mm G Master lens, extreme sharpness..."
 *  -> cameraBody: "Sony A7R IV"
 *  -> lensHint: "85mm G Master lens"
 */
export function splitCameraAndLens(cameraText: string) {
    const raw = String(cameraText || "").trim()
    if (!raw) return { cameraBody: "", lensHint: "" }

    // 去掉常见前缀
    let t = raw.replace(/^shot on\s+/i, "").trim()

    // 先按逗号拆分（你目前 camera.json 很可能就是“机身, 镜头, 描述...”）
    const parts = t.split(",").map(s => s.trim()).filter(Boolean)

    if (parts.length === 0) return { cameraBody: "", lensHint: "" }

    const cameraBody = parts[0] || ""
    let lensHint = ""

    // 在后续片段里找包含 lens / mm / f/ 的那段作为镜头提示
    for (let i = 1; i < parts.length; i++) {
        const p = parts[i]
        const pl = p.toLowerCase()
        if (pl.includes(" lens") || pl.includes("mm") || pl.includes("f/") || pl.includes("prime") || pl.includes("zoom")) {
            lensHint = p
            break
        }
    }

    // 兜底：如果整体里有 "lens" 但没被逗号拆到，就用正则抓一段
    if (!lensHint) {
        const m = t.match(/(\b\d{2,3}\s*mm\b[^,;]*\b(?:lens|prime|zoom)\b[^,;]*)/i)
        if (m?.[1]) lensHint = m[1].trim()
    }

    return { cameraBody, lensHint }
}

/**
 * 对 Film/Color Science 做轻清洗：
 * - 去掉 "film stock" 这种冗余词
 * - 去掉开头重复的 "Kodak" 等不必要前缀（保留品牌没问题，但避免重复）
 */
export function normalizeFilmText(filmText: string) {
    const raw = String(filmText || "").trim()
    if (!raw) return ""

    let t = raw
        .replace(/\bfilm stock\b/gi, "film")
        .replace(/\s+/g, " ")
        .trim()

    // 去掉开头 "Shot on"（防止资源里也写了）
    t = t.replace(/^shot on\s+/i, "").trim()

    return t
}
// ==================== HARD CONSTRAINT MODULES ====================
export const FRAME_INTEGRITY_FULLBODY = `
### FRAME INTEGRITY (FULL-BODY LOCK)
CRITICAL FRAMING RULES:
- Full body must be visible from head to toe.
- Entire subject must be fully inside the frame.
- Feet must be visible, shoes visible, and ground/floor visible under the feet.
- No cropping: do not cut off head, feet, legs, arms, hands, or any part of the body.
- Leave comfortable margin around the full figure (do not frame too tight).
- Subject appears small within the environment (environment-first composition).
`.trim()

export const LIGHT_SOURCE_LEGITIMACY = `
### LIGHT SOURCE LEGITIMACY (DIEGETIC LIGHTING ONLY)
CRITICAL LIGHTING RULES:
- All lighting must come from realistic, scene-justified sources (diegetic lighting).
- No studio lighting, no invisible rim light, no artificial backlight placed behind the subject.
- If a strong backlight exists, it must be clearly explainable (e.g., visible interior lamp, visible signboard reflection, visible streetlight glow).
- Moonlight is soft and low-intensity: it cannot create a powerful studio-like rim light.
- Night city windows should show plausible light behavior: soft ambient bounce, subtle reflections, and realistic intensity falloff.
`.trim()

// ==================== PROMPT LINT UTILITIES ====================
/**
 * LINT-1: Sanitize lighting text when diegetic lighting is enforced
 * - Removes studio-like rim/back light language
 * - Rewrites into scene-justified descriptions
 */
export function lintLightingForDiegeticSources(
    lightingText: string,
    sceneText: string
) {
    if (!lightingText) return lightingText

    let t = lightingText

    const lowerScene = (sceneText || "").toLowerCase()
    const isNight = lowerScene.includes("night") || lowerScene.includes("city")

    // Remove explicit studio-style terms
    t = t
        .replace(/\brim light\b[^,;]*/gi, "")
        .replace(/\bstrong backlighting\b[^,;]*/gi, "")
        .replace(/\bbacklighting\b[^,;]*/gi, "")
        .replace(/\bback light\b[^,;]*/gi, "")


    // Rewrite silhouette if night scene
    if (isNight && t.match(/silhouette/gi)) {
        t = t.replace(
            /silhouette( effect)?/gi,
            "subject silhouetted against distant city lights and interior ambient reflections"
        )
    }
    // Normalize spacing
    t = t.replace(/\s*,\s*/g, ", ")
        .replace(/\s+/g, " ")
        .trim()

    // Remove leading/trailing punctuation fragments caused by deletions
    t = t
        .replace(/^[,\s]+/g, "")
        .replace(/[,\s]+$/g, "")
        .replace(/,\s*,+/g, ",")
        .trim()

    if (!t || !/[a-zA-Z]/.test(t)) return ""
    return t

}

/**
 * LINT-2: Prevent cinematic lighting from overriding realism in wide/full shots
 */
export function lintCinematicLighting(styleText: string, shotType: string) {
    if (!styleText) return styleText

    const s = shotType.toLowerCase()
    const isWide =
        s.includes("full") || s.includes("wide") || s.includes("establishing")

    if (isWide) {
        return styleText.replace(
            /\bcinematic lighting\b/gi,
            "cinematic mood with realistic lighting"
        )
    }

    return styleText
}



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
 * PHYSICS_ENGINE: 由 global.json.cup_sizes[*].value 派生
 * 输入 cupSizeDesc（就是你表单里 cup_size 的 value，长描述）
 * 输出：结构化的胸部物理与布料交互提示
 */
export function buildBustPhysics(cupSizeDesc: string) {
    const t = String(cupSizeDesc || "").trim()
    if (!t) return ""

    const lines: string[] = []

    // 1) 直接保留 global.json 的描述（这是你的“单一真相源”）
    lines.push(`- Bust physics baseline: ${t}`)

    // 2) 统一强化（不管 A~G，都是稳定加成）
    lines.push(`- Ensure consistent underbust boundary and natural shading; avoid unnatural sharp edges or plastic-looking gradients.`)
    lines.push(`- Fabric interaction: respect tension, compression, and drape; no floating cloth, no clipping into skin.`)

    // 3) 如果描述里提到重量/重力/阴影（大杯常见），强化“接触/承托/挤压”
    const lower = t.toLowerCase()
    if (lower.includes("gravitational") || lower.includes("weight") || lower.includes("underbust") || lower.includes("contact")) {
        lines.push(`- Weight & support cues: show believable load-bearing, subtle compression at contact points, and stable silhouette.`)
    }

    // 4) 如果描述里提到“subtle / faint / modest”（小杯常见），避免夸张曲线
    if (lower.includes("subtle") || lower.includes("faint") || lower.includes("modest") || lower.includes("minimal")) {
        lines.push(`- Proportion guardrail: keep curvature subtle; avoid exaggerated volume or unrealistic cleavage.`)
    }

    return lines.join("\n")
}

/**
* 材质词库（合并版）：根据 clothing 文本自动生成材质/受力/反光/透明度等提示
*/
export function buildMaterialPhysics(clothingText: string) {
    const t = String(clothingText || "").trim()
    if (!t) return ""

    const lower = t.toLowerCase()
    const lines: string[] = []

    // Knit / Wool
    if (["knit", "sweater", "cardigan", "wool", "fleece"].some(k => lower.includes(k))) {
        lines.push(`- Knit/Wool: emphasize soft fuzzy fibers, micro texture, natural pilling, and gentle subsurface softness.`)
    }

    // Silk / Satin
    if (["silk", "satin", "slip dress", "viscose"].some(k => lower.includes(k))) {
        lines.push(`- Silk/Satin: render liquid-like sheen, smooth highlights, soft folds with thin drape, and realistic specular roll-off.`)
    }

    // Latex / Leather / Tight
    if (["latex", "leather", "tight", "bodycon", "yoga"].some(k => lower.includes(k))) {
        lines.push(`- Tight/Elastic/Latex/Leather: show realistic stretch tension, edge compression, and distinct glossy highlights without plastic artifacts.`)
    }

    // Lace / Sheer
    if (["lace", "sheer", "translucent", "tulle", "chiffon"].some(k => lower.includes(k))) {
        lines.push(`- Lace/Sheer: keep believable transparency, fine embroidery detail, and soft color mixing between fabric and skin; avoid harsh cutout edges.`)
    }

    // 通用布料交互兜底（只要有衣服，就给）
    lines.push(`- Fabric interaction: respect gravity-driven folds, seam tension, and contact shadows; avoid clipping and floating fabric.`)

    return lines.join("\n")
}

/**
 * 统一 PHYSICS_ENGINE：把 cup_size（重力/胸型）与 clothing（材质）合并成一个块
 */
export function buildUnifiedPhysics(cupSizeDesc: string, clothingText: string) {
    const bust = buildBustPhysics(cupSizeDesc)
    const material = buildMaterialPhysics(clothingText)

    const blocks: string[] = []
    if (bust) blocks.push(
        `**Bust / Gravity:**\n` +
        `- Physics cues must be clearly present and physically correct, but must not become the primary visual focus.\n` +
        `- Different bust volumes must produce visibly different fabric deformation patterns (tension, drape, compression) while remaining realistic.\n` +
        `${bust}`
    )

    if (material) blocks.push(`**Material / Fabric:**\n${material}`)

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



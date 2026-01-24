import type { BuildContext, PromptBuildResult } from "../types"
import {
  getAdaptiveFacePrompt,
  isNonEmpty,
  isGroundAction,
  recommendLens,
  lightingNeedsAdaptation,
  isMirrorPOV,
  isExtremePose,
  buildUnifiedPhysics,
  splitCameraAndLens,     // ✅ 新增
  normalizeFilmText,      // ✅ 新增
  FRAME_INTEGRITY_FULLBODY, // ✅ 新增
  LIGHT_SOURCE_LEGITIMACY,  // ✅ 新增
  lintLightingForDiegeticSources, // ✅ 新增
  lintCinematicLighting,          // ✅ 新增
} from "./engine"

export const photographyBuilder = {
  id: "photography",
  version: "1.1.0",
  build(ctx: BuildContext): PromptBuildResult {
    const f = (key: string, fallback = "") => {
      const v = (ctx.form as any)?.[key]
      return v == null || v === "" ? fallback : String(v)
    }

    /* ========= 来自 photography.json / global.json 的真实字段 ========= */
    const shotType = f("shot_type", "")
    const pose = f("pose", "")
    const makeup = f("makeup", "")
    const clothing = f("clothing", "")
    const scene = f("scene", "")
    const lighting = f("lighting", "")
    const camera = f("camera", "")
    const filmType = f("film_type", "")
    const bodyType = f("body_type", "")
    const cupSize = f("cup_size", "")

    /* ========= logic.js 需要，但 UI 暂无的字段：内部兜底 ========= */
    const cameraHeight = f("camera_height", "Eye-Level")
    const cameraDirection = f("camera_direction", "Front")
    const lensPolicy = f("lens_policy", "suggest") // suggest | auto
    const baseLens = f(
      "lens",
      "Shot on 35mm–85mm lens with natural perspective, aperture adjusted for depth of field."
    )

    const identity = f("character_identity", "A female model")
    const baseFace = f("face_prompt", "Balanced facial proportions, natural skin tone, realistic human features")

    /* ========= manifest 中的摄影风格语义 ========= */
    const roleStr =
      ctx.manifest?.controller?.role ||
      "You are a professional photographer."

    let styleDesc =
      ctx.manifest?.dictionaries?.trigger_words?.value ||
      "award-winning photography, realistic optics, clean geometry"

    // ✅ LINT-2: prevent cinematic lighting from hijacking realism in wide shots
    styleDesc = lintCinematicLighting(styleDesc, shotType)

    /* ==================== Prompt 开始 ==================== */
    let prompt = `**Role:** ${roleStr}\n`
    prompt += `**Task:** Capture a photorealistic photograph. ${styleDesc}\n`
    /* ========= Hierarchy (Core first) ========= */
    prompt += `**Render Priority:** Reference identity & composition first (identity must not be altered); subject clarity next; lighting realism next; camera/film as secondary; physics/material only as subtle realism enhancers.\n`

    const shotLower = shotType.toLowerCase()
    if (shotLower.includes("full")) {
      if (isGroundAction(pose)) {
        prompt += `**Framing:** ${shotType}. Feet visible only if physically plausible.\n`
      } else {
        prompt += `**Framing:** ${shotType}. (CRITICAL: head-to-toe, do not crop feet.)\n`
      }
    } else if (isNonEmpty(shotType)) {
      prompt += `**Framing:** ${shotType}\n`
    }
    // ✅ Template rule: hard framing lock for full/wide/establishing shots
    if (shotLower.includes("full") || shotLower.includes("wide") || shotLower.includes("establishing") || shotLower.includes("ultra wide")) {
      prompt += `${FRAME_INTEGRITY_FULLBODY}\n`
    }

    /* ========= Equipment ========= */
    prompt += `\n**Equipment:**\n`

    // ✅ Camera/Lens 语义校正：把 camera slot 拆成机身 + 镜头提示
    const { cameraBody, lensHint } = splitCameraAndLens(camera)

    // Camera 行只写机身（避免把 lens 写两遍）
    if (isNonEmpty(cameraBody)) {
      prompt += `- Camera: ${cameraBody}\n`
    } else if (isNonEmpty(camera)) {
      // 兜底：拆不出来就原样
      prompt += `- Camera: ${camera}\n`
    }

    // Film 行做轻清洗
    const filmNormalized = normalizeFilmText(filmType)
    if (isNonEmpty(filmNormalized)) {
      prompt += `- Film / Color Science: ${filmNormalized}\n`
    }

    // Lens：优先用 camera 中抽到的 lensHint；否则走推荐或 baseLens
    const recommendedLens = recommendLens(cameraHeight, shotType, pose)
    const useAutoLens = lensPolicy === "auto" && typeof recommendedLens === "string" && recommendedLens.length > 0

    let lensLine = baseLens
    if (isNonEmpty(lensHint)) lensLine = lensHint
    if (useAutoLens) lensLine = recommendedLens!

    lensLine = guardLensVsFraming(shotType, lensLine)
    prompt += `- Lens: ${lensLine}\n`

    // 如果是 suggest 模式且有推荐，作为“建议”附加（不强行覆盖）
    if (lensPolicy !== "auto" && recommendedLens) {
      prompt += `- Recommended lens for this framing: ${recommendedLens}\n`
    }

    if (!isMirrorPOV(pose)) {
      prompt += `- Camera Angle: ${cameraHeight}; ${cameraDirection}\n`
    }


    /* ========= Subject ========= */
    prompt += `\n### 1. Subject Description\n`
    prompt += `(Statement: Anatomical diversity is a key requirement for photorealism in this task. Do not normalize body shapes.)\n`
    prompt += `**Identity:** ${identity}.\n`

    const adaptiveFace = getAdaptiveFacePrompt(baseFace, shotType)
    prompt += `**Face Identity (Hard Constraint):**
Preserve the reference facial identity exactly as provided.
Do not alter facial structure, feature relationships, or proportions derived from the reference.
Do not replace, idealize, beautify, or reinterpret the face.
Only allow minimal corrective adjustments strictly for anatomical plausibility.
Reference identity takes absolute priority over all inferred, aesthetic, or realism-based facial traits.
\n`

    // Physique（外观描述保持简洁）
    if (isNonEmpty(bodyType)) {
      prompt += `**Physique:** ${bodyType}\n`
    }
    const subjectDeemphasis = guardSubjectVsEstablishing(shotType, bodyType, clothing, pose)
    if (subjectDeemphasis) {
      prompt += `(${subjectDeemphasis})\n`
    }

    // Bust physics（由 global.json.cup_sizes 的 value 生成结构化物理提示）
    const physicsBlock = buildUnifiedPhysics(cupSize, clothing)

    if (isExtremePose(pose)) {
      prompt += `(Hyper-flexible anatomy:1.2), (dynamic contortion:1.1). `
      prompt += `(Maintain anatomical continuity, no broken limbs.)\n`
    }

    /* ========= Styling ========= */
    prompt += `\n### 2. Attire & Styling\n`
    if (isNonEmpty(clothing)) prompt += `**Clothing:** ${clothing}\n`

    // ✅ Step4.1：紧身/支撑类衣物 -> 强化受力与边缘张力（依赖 bustPhysics 已生成）
    const clothingLower = clothing.toLowerCase()
    const isTightCloth =
      clothingLower.includes("tight") ||
      clothingLower.includes("bodycon") ||
      clothingLower.includes("corset") ||
      clothingLower.includes("bra") ||
      clothingLower.includes("bikini") ||
      clothingLower.includes("swimsuit") ||
      clothingLower.includes("latex") ||
      clothingLower.includes("leather")

    if (isTightCloth && physicsBlock) {
      prompt += `- Tight garment physics: emphasize realistic compression, edge tension, and subtle fabric stretch gradients.\n`
    }

    if (isNonEmpty(makeup)) prompt += `**Makeup:** ${makeup}\n`
    prompt += `**Face Quality (Soft Constraint):**Maintain natural skin tone, realistic skin texture, and physically plausible lighting response.Enhance clarity without altering facial identity or structure.\n`

    if (isNonEmpty(pose)) prompt += `**Pose:** ${pose}\n`

    /* ========= Environment ========= */
    prompt += `\n### 3. Environment & Cinematography\n`
    if (isNonEmpty(scene)) prompt += `**Scene:** ${scene}\n`
    const lightingGuarded = guardLightingVsScene(scene, lighting)

    // ✅ LINT-1: sanitize lighting when diegetic lighting is enforced
    const lightingFixed = lintLightingForDiegeticSources(
      lightingGuarded,
      scene
    )
    // ✅ Template rule: diegetic lighting only (prevents fake studio rim/back lights)
    if (isNonEmpty(scene) || isNonEmpty(lightingFixed)) {
      prompt += `${LIGHT_SOURCE_LEGITIMACY}\n`
    }

    if (isNonEmpty(lightingFixed)) {
      prompt += `**Lighting:** ${lightingFixed}`
      if (lightingNeedsAdaptation(cameraHeight, lightingFixed)) {
        prompt += ` (adapt lighting geometry to camera angle while preserving contrast)`
      }
      prompt += "\n"
    }

    /* ========= Mirror Constitution ========= */
    if (isMirrorPOV(pose)) {
      prompt += `**Perspective Logic:** Mirror selfie composition. Single correct reflection only. No duplicated body parts. No warped mirror geometry.\n`
      if (shotType.toLowerCase().includes("full")) {
        prompt += `(OOTD mirror shot: shoes must be visible in reflection.)\n`
      }
    }

    /* ========= Realism Enhancers (Physics & Material) ========= */
    if (physicsBlock) {
      prompt += `\n### 3.5 Realism Enhancers (Physics & Material)\n`
      prompt += `(Physics/material cues must remain subtle; do not dominate composition or draw attention away from photography.)\n`
      prompt += `${physicsBlock}\n`
    }

    /* ========= Constraints ========= */
    prompt += `\n### 4. Constraints\n`
    prompt += `- Strict photorealism only.\n`
    prompt += `- No anime, cartoon, illustration, or 3D render style.\n`
    prompt += `- No blur, noise, distortion, extra limbs, text, watermark.\n`

    /* ========= Negative ========= */
    const baseNegative = ctx.manifest?.controller?.negative_prompt || ""
    const extraNegative = "studio lighting, rim light, hard rimlight, spotlight backlight, invisible light source, fake backlight behind subject"
    const negative = baseNegative ? `${baseNegative}, ${extraNegative}` : extraNegative

    return {
      prompt,
      negative,
      meta: {
        styleId: ctx.styleId,
        version: "1.1.0",
        debug: {
          cameraHeight,
          cameraDirection,
          lensPolicy,
          usedRecommendedLens: useAutoLens,
        },
      },
    }

    function guardLensVsFraming(shotType: string, lensLine: string) {
      const s = shotType.toLowerCase()
      const l = lensLine.toLowerCase()

      const wantsWide =
        s.includes("wide") ||
        s.includes("full") ||
        s.includes("establishing") ||
        s.includes("full-body")

      const isTeleOrStandard = l.includes("50mm") || l.includes("85mm") || l.includes("f/1.2") || l.includes("f/1.4")

      if (wantsWide && isTeleOrStandard) {
        return "A lens suitable for wide environmental coverage (avoid conflicting focal-length cues)."
      }
      return lensLine
    }

    /**
     * 【增强版】光影逻辑守卫
     * 作用：防止“夜晚”出现“太阳/日光/阴天”等不合理光源
     */
    function guardLightingVsScene(scene: string, lighting: string) {
      const sc = (scene || "").toLowerCase()
      const li = (lighting || "").toLowerCase()

      const isNight = sc.includes("night") || sc.includes("midnight") || sc.includes("dark")

      // 定义所有属于“白天”的特征词
      const isDaytimeLight =
        li.includes("golden hour") ||
        li.includes("sunlight") ||
        li.includes("low angle sun") ||
        li.includes("daylight") ||   // 新增
        li.includes("overcast") ||   // 新增
        li.includes("blue sky")      // 新增

      if (isNight && isDaytimeLight) {
        // 如果是夜晚但选了白天光，强制修正为“城市环境光”或“月光氛围”
        return "Cinematic night lighting with ambient city glow and practical light sources, maintaining the dark atmosphere."
      }
      return lighting
    }

    function guardSubjectVsEstablishing(shotType: string, bodyType: string, clothing: string, pose: string) {
      const s = shotType.toLowerCase()
      const strongSubject = `${bodyType} ${clothing} ${pose}`.toLowerCase().match(/voluptuous|sensual|attractive|curves|bodycon|tight/) != null

      if (s.includes("establishing") && strongSubject) {
        return "The subject remains visually integrated into the environment rather than dominating the frame."
      }
      return ""
    }
  },
}

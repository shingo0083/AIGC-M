import type { BuildContext, PromptBuildResult } from "../types"

/** 把空值统一成 ""，避免 undefined/null 穿透 */
function s(v: any): string {
  if (v === undefined || v === null) return ""
  const t = String(v).trim()
  return t
}

/** 只在有内容时输出片段 */
function seg(prefix: string, value: string, suffix = "."): string {
  const v = s(value)
  if (!v) return ""

  // 如果 value 已经以 . 或 。结尾，就不要重复补 suffix
  const endsWithPunct = /[.。]$/.test(v)
  const safeSuffix = endsWithPunct ? "" : suffix

  return `${prefix}${v}${safeSuffix}`
}

/** 清理模板模式下的空段落：例如 "Headwear: ." / "Weapon: ." */
function stripEmptySegments(text: string): string {
  return text
    // 通用： "X: ." 这种空段落（X 为字母/下划线）
    .replace(/\b([A-Za-z_]+)\s*:\s*(?:\.\s*|,\s*|;\s*)/g, "")
    // 兜底清理：多余空格与重复标点
    .replace(/\s+\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim()
}
/**
 * Anime Negative Cleaner:
 * 移除摄影专用的光照禁令，避免与 anime VFX / 风格冲突
 */
function cleanAnimeNegative(neg: string): string {
  if (!neg) return ""

  return neg
    .replace(/\bstudio lighting\b/gi, "")
    .replace(/\brim light\b/gi, "")
    .replace(/\bhard rimlight\b/gi, "")
    .replace(/\bspotlight backlight\b/gi, "")
    .replace(/\binvisible light source\b/gi, "")
    .replace(/\bfake backlight behind subject\b/gi, "")
    .replace(/\s*,\s*,+/g, ",")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim()
}

function cleanPrompt(s: string) {
  return (s || "")
    .replace(/\s+/g, " ")
    .replace(/,\s*\./g, ".")
    .replace(/\s([,.])/g, "$1")
    .replace(/,+/g, ",")
    .replace(/\.+/g, ".")
    .replace(/,([^\s])/g, ", $1")
    .replace(/^[\s,.\-]+|[\s,.\-]+$/g, "")
    .trim()
}

/** 模板变量替换 */
function renderTemplate(template: string, vars: Record<string, any>): string {
  const out = template
    .replace(/\{(\w+)\}/g, (_, key) => s(vars[key]))
    .replace(/\s+/g, " ")
    .trim()

  return stripEmptySegments(out)
}
/**
 * Anime Body Adapter:
 * 将全局 body_type / cup_size（可能偏写实/物理口径）映射为更二次元、概括性的形体语言。
 * 只在 anime builder 内生效，不污染 photography 的全局资产。
 */
function adaptAnimeBody(bodyTypeRaw: string, cupSizeRaw: string): string {
  const bodyType = s(bodyTypeRaw)
  const cupSize = s(cupSizeRaw)

  const parts: string[] = []

  // --- body_type：尽量转为 silhouette / proportions / line quality ---
  if (bodyType) {
    let bt = bodyType

    // 去掉明显的摄影/写实词（保守删，不做激进改写）
    bt = bt
      .replace(/\b(naturally|realistic|photorealistic)\b/gi, "")
      .replace(/\b(highly detailed|micro[-\s]?details?)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim()

    // 常见体型词汇轻量 anime 化（你后续可以继续加映射表）
    bt = bt
      .replace(/\bslender\b/gi, "slender, elegant silhouette")
      .replace(/\blean\b/gi, "lean, athletic lines")
      .replace(/\bcurvy\b/gi, "curvy, stylized proportions")
      .replace(/\bpetite\b/gi, "petite, delicate proportions")

    if (bt) parts.push(`${bt}, stylized anime body lines`)
  }

  // --- cup_size：不要写“物理接触边界/重量”，改为“轮廓与体量感” ---
  if (cupSize) {
    let cs = cupSize.toLowerCase()

    // ✅ Spicy 默认：更大胆的二次元体量语言，但避免写实物理“边界/接触/重力”论文感
    let cupDesc = ""

    if (/\b(very\s*)?(small|flat|aa|a)\b/.test(cs)) {
      cupDesc = "petite bust, subtle curves"
    } else if (/\b(b|medium)\b/.test(cs)) {
      cupDesc = "curvy bustline, noticeable volume"
    } else if (/\b(c|d|large|full)\b/.test(cs)) {
      cupDesc = "voluptuous bust, bold silhouette"
    } else if (/\b(e|f|g|very\s*large|voluminous)\b/.test(cs)) {
      cupDesc = "hyper-curvy bust, exaggerated anime proportions"
    } else {
      // 兜底：不认识就保留“二次元化短语”，并清掉写实物理词
      cupDesc = s(cupSizeRaw)
        .replace(/\b(weight|gravity|underbust|contact|boundary|torso)\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim()

      // 如果兜底还是太空泛，就给一个 spicy 的默认短语
      if (!cupDesc) cupDesc = "voluptuous curves, stylized bustline"
    }

    if (cupDesc) parts.push(cupDesc)
  }
  // 合并为一句“with ...”
  return parts.filter(Boolean).join(", ")
}

/**
 * Anime 语义润色：把说明书段落改成更自然的画师描述
 * 不改 slot key，不改 form 结构，仅重排语序与片段拼接。
 */
function buildNaturalAnimePrompt(vars: Record<string, any>): string {
  const artistTone = s(vars.artist_tone)
  const brush = s(vars.brushstroke)

  const shotType = s(vars.shot_type)
    .replace(/suitable for studio outdoor shots/gi, "suitable for clean anime illustration composition")
  const bodyType = s(vars.body_type)
  const cupSize = s(vars.cup_size)
  const animeBody = adaptAnimeBody(bodyType, cupSize)


  const pose = s(vars.pose)
  const clothing = s(vars.clothing)
  const accHead = s(vars.acc_head)
  const weapon = s(vars.weapon)
  const scene = s(vars.scene)
  const vfx = s(vars.vfx)
  const triggers = s(vars.trigger_words)

  // 1) 主句：更像画师说法
  // “Draw a ... character with ...” -> “Depict a ... character, ...”
  const subjectBits: string[] = []
  if (shotType) subjectBits.push(shotType)
  subjectBits.push("anime character") // 固定一个主体词，避免 shotType 为空时句子断裂

  const formBits: string[] = []
  if (animeBody) formBits.push(animeBody)

  const subjectLine =
    `Anime illustration. ` +
    `Depict a ${subjectBits.join(" ")}${formBits.length ? ` with ${formBits.join(", ")}` : ""}.`

  // 2) 风格：tone + brush 合并成一段
  const styleLine =
    (artistTone || brush)
      ? `Style: ${[artistTone, brush].filter(Boolean).join("; ")}.`
      : ""

  // 3) 内容块：缺哪块就不输出那句
  const contentLines = [
    seg("Pose: ", pose),
    seg("Outfit: ", clothing),
    seg("Headwear: ", accHead),
    seg("Weapon: ", weapon),
    seg("Scene: ", scene),
    seg("VFX: ", vfx),
  ].filter(Boolean)


  // 4) 触发词：放到末尾
  const tail = triggers ? `${triggers}` : ""

  return cleanPrompt(
    [subjectLine, styleLine, ...contentLines, tail]
      .filter(Boolean)
      .join(" ")
  )
}

export function buildAnimePrompt(ctx: BuildContext): PromptBuildResult {
  const manifest = ctx.manifest ?? {}
  const controller = manifest.controller ?? {}
  const template: string = manifest.template ?? ""

  // 你系统里 slot 值都在 ctx.form
  const form = ctx.form ?? {}

  // A) 先构造 vars：保持和模板 key 一致
  const vars: Record<string, any> = {
    ...form,
    // 兜底：有些 style 可能没填 trigger_words，但 anime.json 有 dictionaries
    trigger_words: form.trigger_words ?? manifest?.dictionaries?.trigger_words?.value ?? "",
  }

  // B) 两种模式：
  // 1) 如果你希望仍严格使用 manifest.template，就走 renderTemplate
  // 2) 如果希望 anime engine 自己组织语言，就走 buildNaturalAnimePrompt
  //
  // 现在你要“先看语义是否通顺”，建议直接用自然语言版：
  const prompt = buildNaturalAnimePrompt(vars)

  // 如果你要对照模板输出，临时切回这一行：
  // const prompt = renderTemplate(template, vars)

  return {
    prompt,
    negative: cleanAnimeNegative(s(controller.negative_prompt)),
    meta: {
      styleId: ctx.styleId,
      version: s(manifest.version || "0.1.0"),
    },
  }
}

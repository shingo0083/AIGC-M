import type { BuildContext, PromptBuildResult } from "../types"

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

export const templateStyleBuilder = {
  id: "template_style",
  version: "1.0.0",
  build(ctx: BuildContext): PromptBuildResult {
    const manifest = ctx.manifest || {}
    const template = manifest.template || ""
    const dictionaries = manifest.dictionaries || {}

    // ctx.form 是 App.vue 的表单
    const resolvedDict: Record<string, any> = {}
    for (const k of Object.keys(dictionaries)) {
      resolvedDict[k] = dictionaries[k]?.value ?? ""
    }

    const slotCtx = { ...(ctx.form || {}), ...resolvedDict }

    let prompt = template.replace(/\{(\w+)\}/g, (_: string, key: string) => {
      const v = slotCtx[key]
      return v == null ? "" : String(v)
    })

    prompt = cleanPrompt(prompt)

    // 重要：这里不再追加 aspect ratio（你已收敛到后端 imageConfig）
    return {
      prompt,
      negative: manifest?.controller?.negative_prompt || "",
      meta: { styleId: ctx.styleId, version: "1.0.0" }
    }
  }
}

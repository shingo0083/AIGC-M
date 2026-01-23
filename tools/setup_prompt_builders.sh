#!/usr/bin/env bash
set -euo pipefail

# 1) 创建目录
mkdir -p frontend/src/prompt/builders/photography
mkdir -p frontend/src/prompt/builders/template_style

# 2) types.ts
cat > frontend/src/prompt/builders/types.ts <<'TS'
export type PromptBuildResult = {
  prompt: string
  negative?: string
  meta?: {
    styleId: string
    version: string
    debug?: Record<string, any>
  }
}

export type BuildContext = {
  styleId: string
  form: Record<string, any>
  manifest: any
  assets: any
  hasImages: boolean
}
TS

# 3) registry.ts
cat > frontend/src/prompt/builders/registry.ts <<'TS'
import type { BuildContext, PromptBuildResult } from "./types"
import { photographyBuilder } from "./photography"
import { templateStyleBuilder } from "./template_style"

export type PromptBuilder = {
  id: string
  version: string
  build: (ctx: BuildContext) => PromptBuildResult
}

const builders: Record<string, PromptBuilder> = {
  photography: photographyBuilder,

  // 其它风格默认走 template+slots
  anime_v1: templateStyleBuilder,
  fantasy_v1: templateStyleBuilder,
}

export function getBuilder(styleId: string): PromptBuilder {
  return builders[styleId] ?? templateStyleBuilder
}
TS

# 4) template_style builder：复用你原来的 template + slots + dictionaries 机制
cat > frontend/src/prompt/builders/template_style/index.ts <<'TS'
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
TS

# 5) photography builder：先放一个“占位版”，下一步把 logic.js 的 buildPromptForModel 迁进来
cat > frontend/src/prompt/builders/photography/index.ts <<'TS'
import type { BuildContext, PromptBuildResult } from "../types"

/**
 * photographyBuilder（logic.js 移植入口）
 * 下一步：把 logic.js 的规则引擎与 prompt 生成器迁移到这里。
 */
export const photographyBuilder = {
  id: "photography",
  version: "0.1.0",
  build(ctx: BuildContext): PromptBuildResult {
    // 先用你已有 template 作为兜底（避免你迁移 logic.js 之前项目跑不起来）
    const template = ctx.manifest?.template || ""
    const dictionaries = ctx.manifest?.dictionaries || {}

    const resolvedDict: Record<string, any> = {}
    for (const k of Object.keys(dictionaries)) {
      resolvedDict[k] = dictionaries[k]?.value ?? ""
    }
    const slotCtx = { ...(ctx.form || {}), ...resolvedDict }

    const prompt = template.replace(/\{(\w+)\}/g, (_: string, key: string) => {
      const v = slotCtx[key]
      return v == null ? "" : String(v)
    })

    return {
      prompt,
      negative: ctx.manifest?.controller?.negative_prompt || "",
      meta: { styleId: ctx.styleId, version: "0.1.0", debug: { note: "placeholder, migrate logic.js here" } }
    }
  }
}
TS

echo "✅ builders scaffold created."
echo "Next: integrate into App.vue (manual step below)."

import type { BuildContext, PromptBuildResult } from "./types"
import { photographyBuilder } from "./photography"
import { templateStyleBuilder } from "./template_style"
import { animeBuilder } from "./anime"

export type PromptBuilder = {
  id: string
  version: string
  build: (ctx: BuildContext) => PromptBuildResult
}

const builders: Record<string, PromptBuilder> = {
  photography: photographyBuilder,

  // 其它风格默认走 template+slots
  anime_v1: animeBuilder,
  fantasy_v1: templateStyleBuilder,
}

export function getBuilder(styleId: string): PromptBuilder {
  return builders[styleId] ?? templateStyleBuilder
}

import type { PromptBuilder } from "../registry"
import { buildAnimePrompt } from "./engine"

export const animeBuilder: PromptBuilder = {
  id: "anime_v1",
  version: "0.1.0",
  build: buildAnimePrompt,
}

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

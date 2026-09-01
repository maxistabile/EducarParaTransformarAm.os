/// <reference types="vite/client" />

interface ImportMeta {
  readonly env: {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
  }
  readonly base: string
  readonly mode: string
  readonly prod: boolean
}

export {}
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

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
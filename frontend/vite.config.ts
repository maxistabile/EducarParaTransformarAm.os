import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Parte 3 · PWA (RNF6). La app vive bajo /app/ y comparte el index.html
// con la web. vite-plugin-pwa inyecta <link rel="manifest"> en todas las
// páginas y no tiene opción para evitarlo: este plugin lo quita, y lo
// agrega src/app/AppRoutes.tsx solo mientras se está dentro de /app/, para
// que el navegador no ofrezca instalar la app desde la web de gestión.
function manifiestoSoloEnApp(): Plugin {
  return {
    name: 'manifiesto-solo-en-app',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler: (html) => html.replace(/<link rel="manifest"[^>]*>/g, ''),
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt': una versión nueva espera a que el usuario toque
      // "Actualizar" (src/app/AvisoActualizacion.tsx). Nunca recarga sola
      // mientras se completa un formulario o se carga un comprobante.
      registerType: 'prompt',
      // El registro lo hace la app (useRegisterSW), no un script global
      injectRegister: false,
      scope: '/app/',
      manifest: {
        name: 'Educar para Transformar',
        short_name: 'Educar App',
        description: 'Cuotas, pagos e inscripciones del Centro Educativo Educar para Transformar.',
        lang: 'es-AR',
        id: '/app/',
        start_url: '/app/',
        scope: '/app/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#5B35C5',
        background_color: '#F7F6FC',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // Solo las navegaciones de la app usan el index.html del cache.
        // (?:\/|$) evita coincidir con rutas como /application.
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/app(?:\/|$)/],
        cleanupOutdatedCaches: true,
        // Sin runtimeCaching: las llamadas a Supabase van siempre a la red
      },
    }),
    manifiestoSoloEnApp(),
  ],
})

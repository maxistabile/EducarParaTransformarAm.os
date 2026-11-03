// Íconos de la PWA (RNF6). Se regeneran con `npm run iconos` a partir de
// public/logo.png y se commitean: no se generan en cada build.
// Si se consigue un logo en mayor resolución, reemplazar logo.png y correr
// el comando de nuevo (los nombres de archivo no cambian).
import { defineConfig } from '@vite-pwa/assets-generator/config'

// Blanco, igual al fondo propio de logo.png (con #F7F6FC se notaba el recuadro)
const fondo = { background: '#FFFFFF' }

export default defineConfig({
  preset: {
    transparent: { sizes: [192, 512], favicons: [] },
    maskable: { sizes: [512], resizeOptions: fondo },
    apple: { sizes: [180], resizeOptions: fondo },
  },
  images: ['public/logo.png'],
})

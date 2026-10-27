// Configuración de Cypress – TP Unidad 5 (prueba dinámica)
// Las pruebas se ejecutan contra la aplicación publicada en Vercel,
// por eso no hace falta levantar el frontend ni tener el archivo .env.
const { defineConfig } = require('cypress')
const fs = require('fs')
const path = require('path')

module.exports = defineConfig({
  e2e: {
    baseUrl: 'https://educarparatransformar.vercel.app',
    supportFile: false,
    defaultCommandTimeout: 10000,
    video: true,
    retries: { runMode: 1, openMode: 0 },
    setupNodeEvents(on) {
      // Las credenciales de los usuarios de prueba se leen desde
      // credenciales.json, que NO se sube al repositorio (.gitignore)
      on('task', {
        credenciales(rol) {
          const archivo = path.join(__dirname, 'credenciales.json')
          if (!fs.existsSync(archivo)) {
            throw new Error(
              'Falta e2e/credenciales.json: copiá credenciales.example.json y completalo.',
            )
          }
          const datos = JSON.parse(fs.readFileSync(archivo, 'utf8'))
          if (!datos[rol] || !datos[rol].email || !datos[rol].password) {
            throw new Error(`Faltan el email o la contraseña de "${rol}" en credenciales.json`)
          }
          return datos[rol]
        },
      })
    },
  },
})

// Configuración de Cypress – TP Unidad 5 (prueba dinámica)
// Las pruebas se ejecutan contra la aplicación publicada en Vercel,
// por eso no hace falta levantar el frontend ni tener el archivo .env.
const { defineConfig } = require('cypress')

// Credenciales de los usuarios de prueba. El archivo credenciales.json
// NO se sube al repositorio (.gitignore): se crea a partir de
// credenciales.example.json en cada computadora.
function leerCredenciales() {
  try {
    return require('./credenciales.json')
  } catch {
    throw new Error(
      'Falta e2e/credenciales.json: copiá credenciales.example.json y completalo.',
    )
  }
}

module.exports = defineConfig({
  e2e: {
    baseUrl: 'https://educarparatransformar.vercel.app',
    supportFile: false,
    defaultCommandTimeout: 10000,
    video: true,
    retries: { runMode: 1, openMode: 0 },
    setupNodeEvents(on) {
      on('task', {
        credenciales(rol) {
          const todas = leerCredenciales()
          const usuario = rol === 'admin' ? todas.admin : todas.tutor
          if (!usuario || !usuario.email || !usuario.password) {
            throw new Error(`Faltan el email o la contraseña de "${rol}" en credenciales.json`)
          }
          return usuario
        },
      })
    },
  },
})

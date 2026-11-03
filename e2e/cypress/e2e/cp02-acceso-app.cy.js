// CP-02 · RF10 – Acceso a la aplicación móvil (HU41, HU42 y HU45)
// Las pruebas solo leen información: inician y cierran sesión con cuentas
// existentes y no crean ni modifican datos.
// Hasta que la app esté en producción, correrlas contra el preview local:
//   npx cypress run --spec cypress/e2e/cp02-acceso-app.cy.js --config baseUrl=http://localhost:4173

function ingresarEnLaApp(rol) {
  cy.task('credenciales', rol).then(({ email, password }) => {
    cy.visit('/app/ingresar')
    cy.get('input[type="email"]').type(email)
    cy.get('input[type="password"]').type(password, { log: false })
    cy.contains('button', 'Ingresar').click()
  })
}

const MENU = 'nav[aria-label="Secciones de la app"]'

describe('CP-02 · Acceso a la app (RF10)', () => {
  it('sin sesión, una pantalla privada redirige al ingreso – HU45', () => {
    cy.visit('/app/cuotas')
    cy.location('pathname').should('eq', '/app/ingresar')
  })

  it('con credenciales incorrectas muestra un error – HU41', () => {
    cy.task('credenciales', 'tutor').then(({ email }) => {
      cy.visit('/app/ingresar')
      cy.get('input[type="email"]').type(email)
      cy.get('input[type="password"]').type('contraseña-incorrecta', { log: false })
      cy.contains('button', 'Ingresar').click()
    })
    cy.contains('Credenciales incorrectas').should('be.visible')
    cy.location('pathname').should('eq', '/app/ingresar')
  })

  it('el tutor ingresa y ve el menú del padre – HU41 y HU45', () => {
    ingresarEnLaApp('tutor')
    cy.location('pathname', { timeout: 15000 }).should('eq', '/app/')
    cy.get(MENU).within(() => {
      for (const seccion of ['Inicio', 'Cuotas', 'Pagos', 'Inscripciones', 'Perfil'])
        cy.contains(seccion).should('be.visible')
    })
  })

  it('la sesión se mantiene al recargar y al volver a abrir la app – HU41', () => {
    ingresarEnLaApp('tutor')
    cy.location('pathname', { timeout: 15000 }).should('eq', '/app/')
    cy.reload()
    cy.get(MENU, { timeout: 15000 }).should('be.visible')
    cy.location('pathname').should('eq', '/app/')
    // Abrir de nuevo la app (nueva carga del documento, como al reabrirla)
    cy.visit('/app/perfil')
    cy.contains('Mi cuenta', { timeout: 15000 }).should('be.visible')
  })

  it('al cerrar sesión vuelve al ingreso y "Atrás" no muestra pantallas privadas – HU42', () => {
    ingresarEnLaApp('tutor')
    cy.location('pathname', { timeout: 15000 }).should('eq', '/app/')
    cy.get(MENU).contains('Perfil').click()
    cy.contains('button', 'Cerrar sesión').click()
    cy.location('pathname', { timeout: 15000 }).should('eq', '/app/ingresar')
    cy.go('back')
    cy.location('pathname').should('eq', '/app/ingresar')
    cy.contains('Mi cuenta').should('not.exist')
    // Tampoco al recargar (la sesión se eliminó del dispositivo)
    cy.reload()
    cy.location('pathname', { timeout: 15000 }).should('eq', '/app/ingresar')
  })

  it('el administrador que entra a la app es redirigido a la web – HU45', () => {
    ingresarEnLaApp('admin')
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin')
    cy.contains('Bienvenido/a').should('be.visible')
  })

  describe('alumno', () => {
    // Pendiente si no hay cuenta de alumno de prueba en credenciales.json
    beforeEach(function () {
      cy.task('hayCredenciales', 'alumno').then((hay) => {
        if (!hay) this.skip()
      })
    })

    it('el alumno ve solo inicio, inscripciones y perfil – HU45', () => {
      ingresarEnLaApp('alumno')
      cy.location('pathname', { timeout: 15000 }).should('eq', '/app/')
      cy.get(MENU).within(() => {
        cy.contains('Inscripciones').should('be.visible')
        cy.contains('Cuotas').should('not.exist')
        cy.contains('Pagos').should('not.exist')
      })
    })

    it('el alumno no puede abrir la sección de pagos – HU45', () => {
      ingresarEnLaApp('alumno')
      cy.location('pathname', { timeout: 15000 }).should('eq', '/app/')
      cy.visit('/app/pagos')
      cy.location('pathname', { timeout: 15000 }).should('eq', '/app/')
    })
  })
})

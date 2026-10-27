// CP-01 · RF6.2 – Cada usuario accede únicamente a las funciones de su rol
// Las pruebas solo leen información: se pueden repetir sin modificar datos.

function iniciarSesion(rol) {
  cy.task('credenciales', rol).then(({ email, password }) => {
    cy.visit('/login')
    cy.get('input[type="email"]').type(email)
    cy.get('input[type="password"]').type(password, { log: false })
    cy.contains('button', 'Ingresar').click()
  })
}

describe('CP-01 · Acceso según el rol (RF6.2)', () => {
  it('sin sesión iniciada, /admin redirige al inicio de sesión', () => {
    cy.visit('/admin')
    cy.location('pathname').should('eq', '/login')
  })

  it('el tutor inicia sesión y es dirigido a su portal', () => {
    iniciarSesion('tutor')
    cy.location('pathname', { timeout: 15000 }).should('eq', '/portal')
    cy.contains('Salir').should('be.visible')
  })

  it('el tutor no puede acceder al panel de administración', () => {
    iniciarSesion('tutor')
    cy.location('pathname', { timeout: 15000 }).should('eq', '/portal')
    cy.visit('/admin')
    cy.contains('Sin acceso').should('be.visible')
    cy.contains('Tu usuario no tiene permisos para este panel.').should('be.visible')
  })

  it('el administrador accede al panel de administración', () => {
    iniciarSesion('admin')
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin')
    cy.contains('Bienvenido/a').should('be.visible')
  })
})

// Pruebas de regresión de la página pública.
// Verifican que funcionalidades que ya andaban sigan andando después de
// cada cambio. No envían formularios, por lo que no guardan datos.

describe('Regresión · Página de inicio', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('la imagen principal (WebP) se carga correctamente – PR #4', () => {
    cy.get('img[alt="Hero"]')
      .should('have.attr', 'src')
      .and('include', '.webp')
    cy.get('img[alt="Hero"]').should(($img) => {
      expect($img[0].naturalWidth, 'ancho de la imagen').to.be.greaterThan(0)
    })
  })

  it('la imagen de Idiomas existe y es una imagen – PR #4', () => {
    cy.request('/idiomas.webp').then((resp) => {
      expect(resp.status).to.eq(200)
      expect(resp.headers['content-type']).to.include('image')
    })
  })

  it('la preinscripción rechaza un DNI con menos de 7 dígitos – RF1.1', () => {
    cy.get('input[name="dni_aspirante"]').type('123').blur()
    cy.contains('El DNI debe tener entre 7 y 9 dígitos numéricos (sin puntos).')
      .should('be.visible')
  })

  it('la preinscripción vacía no se envía (campos obligatorios) – RNF3', () => {
    cy.contains('button', 'Enviar solicitud').click()
    cy.get('input[name="dni_aspirante"]').then(($input) => {
      expect($input[0].checkValidity(), 'DNI obligatorio').to.be.false
    })
    cy.contains('¡Solicitud enviada!').should('not.exist')
  })
})

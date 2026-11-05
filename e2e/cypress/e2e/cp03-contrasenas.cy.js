// CP-03 · RF10.3 y RF10.4 – Recuperar y cambiar la contraseña (HU43 y HU44)
// Todo lo que va a Supabase está simulado: no usa credenciales, no envía
// correos y no cambia contraseñas. Cualquier pedido que no esté simulado se
// corta antes de llegar al proyecto compartido y hace fallar la prueba.
// Hasta que esté en producción, correrla contra el preview local:
//   npx cypress run --spec cypress/e2e/cp03-contrasenas.cy.js --config baseUrl=http://localhost:4173

const SUPABASE = 'https://*.supabase.co'
const ENLACE = '/app/nueva-contrasena?token_hash=token-ficticio&type=recovery'
const CLAVE_NUEVA = 'clave-nueva-ficticia'

const cuenta = (id) => ({
  id,
  aud: 'authenticated',
  role: 'authenticated',
  email: `${id}@ejemplo.test`,
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
})

const sesion = (id) => ({
  access_token: `acceso-${id}`,
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: `renovacion-${id}`,
  user: cuenta(id),
})

const perfil = (id) => ({
  id_usuario: id,
  nombre: 'Cuenta',
  apellido: 'Ficticia',
  email: `${id}@ejemplo.test`,
  rol: 'Padre',
  activo: true,
})

let noSimulados
let orden

// Registra el orden en que llegan los pedidos simulados
const anotar = (nombre, respuesta) => (req) => {
  orden.push({ nombre, autorizacion: req.headers.authorization })
  if (typeof respuesta === 'function') respuesta(req)
  else req.reply(respuesta)
}

const simularPerfil = () => {
  cy.intercept('GET', `${SUPABASE}/rest/v1/usuarios*`, (req) => {
    const id = decodeURIComponent(req.url).match(/id_usuario=eq\.([^&]+)/)[1]
    req.reply([perfil(id)])
  })
}

const simularCierre = (respuesta = { statusCode: 204 }) => {
  cy.intercept('POST', `${SUPABASE}/auth/v1/logout*`, anotar('cierre', respuesta))
}

const simularEnlaceValido = () => {
  cy.intercept(
    'POST',
    `${SUPABASE}/auth/v1/verify*`,
    anotar('verificacion', { body: sesion('cuenta-enlace') }),
  )
}

const simularGuardado = (respuesta) => {
  cy.intercept(
    'PUT',
    `${SUPABASE}/auth/v1/user*`,
    anotar('guardado', respuesta ?? { body: cuenta('cuenta-enlace') }),
  )
}

function ingresarSimulado(id) {
  cy.intercept('POST', `${SUPABASE}/auth/v1/token*`, { body: sesion(id) })
  simularPerfil()
  cy.visit('/app/ingresar')
  cy.get('input[type="email"]').type(`${id}@ejemplo.test`)
  cy.get('input[type="password"]').type('clave-ficticia', { log: false })
  cy.contains('button', 'Ingresar').click()
  cy.location('pathname', { timeout: 15000 }).should('eq', '/app/')
}

function completarNueva(clave = CLAVE_NUEVA) {
  cy.get('input[autocomplete="new-password"]').eq(0).clear()
  cy.get('input[autocomplete="new-password"]').eq(0).type(clave, { log: false })
  cy.get('input[autocomplete="new-password"]').eq(1).clear()
  cy.get('input[autocomplete="new-password"]').eq(1).type(clave, { log: false })
  cy.contains('button', 'Guardar contraseña').click()
}

const nombres = () => orden.map((pedido) => pedido.nombre)

describe('CP-03 · Contraseñas (RF10.3 y RF10.4)', () => {
  beforeEach(() => {
    noSimulados = []
    orden = []
    // Se registra primero: los intercept posteriores tienen prioridad
    cy.intercept(`${SUPABASE}/**`, (req) => {
      if (req.method === 'OPTIONS') {
        req.reply({ statusCode: 204 })
        return
      }
      noSimulados.push(`${req.method} ${new URL(req.url).pathname}`)
      req.destroy()
    })
  })

  afterEach(() => {
    cy.then(() => {
      expect(noSimulados, 'pedidos no simulados').to.deep.equal([])
    })
  })

  describe('HU43: pedir el enlace', () => {
    it('desde el ingreso se llega a "Olvidé mi contraseña"', () => {
      cy.visit('/app/ingresar')
      cy.contains('a', '¿Olvidaste tu contraseña?').click()
      cy.location('pathname').should('eq', '/app/recuperar')
      cy.contains('h1', 'Olvidé mi contraseña').should('be.visible')
    })

    it('muestra el mensaje genérico, apunta a la pantalla correcta y bloquea el botón', () => {
      cy.intercept('POST', `${SUPABASE}/auth/v1/recover*`, { body: {} }).as('pedido')
      cy.visit('/app/recuperar')
      cy.get('input[type="email"]').type('alguien@ejemplo.test')
      cy.contains('button', 'Enviar enlace').click()
      cy.wait('@pedido').then(({ request }) => {
        const destino = new URL(request.url).searchParams.get('redirect_to')
        expect(new URL(destino).pathname).to.eq('/app/nueva-contrasena')
      })
      cy.contains('Si el correo está registrado').should('be.visible')
      cy.contains('button', 'Podés volver a pedirlo').should('be.disabled')
    })

    it('un límite de pedidos no se presenta como éxito ni habla de la cuenta', () => {
      cy.intercept('POST', `${SUPABASE}/auth/v1/recover*`, {
        statusCode: 429,
        body: { code: 429, error_code: 'over_email_send_rate_limit', msg: 'limite' },
      })
      cy.visit('/app/recuperar')
      cy.get('input[type="email"]').type('alguien@ejemplo.test')
      cy.contains('button', 'Enviar enlace').click()
      cy.contains('No pudimos procesar el pedido ahora').should('be.visible')
      cy.contains('Si el correo está registrado').should('not.exist')
    })
  })

  describe('HU43: abrir el enlace', () => {
    it('sin token no muestra el formulario y ofrece pedir otro', () => {
      cy.visit('/app/nueva-contrasena')
      cy.contains('El enlace no es válido').should('be.visible')
      cy.contains('a', 'Pedir otro enlace').should('have.attr', 'href', '/app/recuperar')
      cy.get('input[type="password"]').should('not.exist')
    })

    it('abrir el enlace no consume el token', () => {
      cy.visit(ENLACE)
      cy.contains('button', 'Guardar contraseña').should('be.visible')
      cy.then(() => {
        expect(nombres()).to.deep.equal([])
      })
    })

    it('valida la contraseña antes de enviar nada', () => {
      cy.visit(ENLACE)
      completarNueva('1234567')
      cy.contains('al menos 8 caracteres').should('be.visible')
      cy.get('input[autocomplete="new-password"]').eq(0).clear()
      cy.get('input[autocomplete="new-password"]').eq(0).type(CLAVE_NUEVA, { log: false })
      cy.get('input[autocomplete="new-password"]').eq(1).clear()
      cy.get('input[autocomplete="new-password"]').eq(1).type('otra-clave-distinta', { log: false })
      cy.contains('button', 'Guardar contraseña').click()
      cy.contains('La confirmación no coincide').should('be.visible')
    })

    it('un enlace vencido o usado pide otro enlace', () => {
      cy.intercept('POST', `${SUPABASE}/auth/v1/verify*`, {
        statusCode: 403,
        body: { code: 403, error_code: 'otp_expired', msg: 'vencido' },
      })
      cy.visit(ENLACE)
      completarNueva()
      cy.contains('El enlace venció o ya se usó').should('be.visible')
      cy.contains('a', 'Pedir otro enlace').should('be.visible')
    })
  })

  describe('HU43: guardar con la cuenta del enlace', () => {
    it('sin sesión previa: cambia, cierra la sesión y vuelve al ingreso', () => {
      simularEnlaceValido()
      simularGuardado()
      simularCierre()
      cy.visit(ENLACE)
      completarNueva()
      cy.location('pathname').should('eq', '/app/ingresar')
      cy.location('search').should('eq', '')
      cy.contains('Tu contraseña se cambió').should('be.visible')
      cy.then(() => {
        expect(nombres()).to.deep.equal(['verificacion', 'guardado', 'cierre'])
      })
    })

    for (const [caso, previo] of [
      ['del mismo usuario', 'cuenta-enlace'],
      ['de otro usuario', 'otra-cuenta'],
    ]) {
      it(`con sesión previa ${caso}: cambia la cuenta del enlace y no cierra antes de guardar`, () => {
        ingresarSimulado(previo)
        simularEnlaceValido()
        simularGuardado()
        simularCierre()
        cy.visit(ENLACE)
        completarNueva()
        cy.location('pathname').should('eq', '/app/ingresar')
        cy.then(() => {
          expect(nombres()).to.deep.equal(['verificacion', 'guardado', 'cierre'])
          expect(orden[1].autorizacion).to.eq('Bearer acceso-cuenta-enlace')
          expect(orden[2].autorizacion).to.eq('Bearer acceso-cuenta-enlace')
        })
        cy.reload()
        cy.get('input[type="email"]').should('be.visible')
      })
    }

    it('si el enlace falla, la sesión previa sigue activa', () => {
      ingresarSimulado('otra-cuenta')
      cy.intercept('POST', `${SUPABASE}/auth/v1/verify*`, {
        statusCode: 403,
        body: { code: 403, error_code: 'otp_expired', msg: 'vencido' },
      })
      cy.visit(ENLACE)
      completarNueva()
      cy.contains('El enlace venció o ya se usó').should('be.visible')
      cy.visit('/app/perfil')
      cy.contains('Mi cuenta', { timeout: 15000 }).should('be.visible')
      cy.contains('otra-cuenta@ejemplo.test').should('be.visible')
    })
  })

  describe('HU43: token ya consumido', () => {
    it('al quitar el token de la URL sigue el formulario y se reintenta sin verificar', () => {
      simularEnlaceValido()
      let intentos = 0
      simularGuardado((req) => {
        intentos += 1
        if (intentos === 1)
          req.reply({
            statusCode: 422,
            body: { code: 422, error_code: 'same_password', msg: 'igual' },
          })
        else req.reply({ body: cuenta('cuenta-enlace') })
      })
      simularCierre()
      cy.visit(ENLACE)
      completarNueva()
      cy.contains('tiene que ser distinta').should('be.visible')
      cy.location('search').should('eq', '')
      cy.contains('El enlace no es válido').should('not.exist')
      completarNueva('otra-clave-ficticia')
      cy.location('pathname').should('eq', '/app/ingresar')
      cy.then(() => {
        expect(nombres()).to.deep.equal([
          'verificacion',
          'guardado',
          'guardado',
          'cierre',
        ])
      })
    })

    it('sin conexión después de verificar no envía nada y no ofrece reutilizar el enlace', () => {
      simularEnlaceValido()
      simularGuardado({
        statusCode: 422,
        body: { code: 422, error_code: 'same_password', msg: 'igual' },
      })
      simularCierre()
      cy.visit(ENLACE)
      completarNueva()
      cy.contains('tiene que ser distinta').should('be.visible')
      cy.window().then((ventana) => {
        Object.defineProperty(ventana.navigator, 'onLine', {
          configurable: true,
          get: () => false,
        })
      })
      completarNueva('otra-clave-ficticia')
      cy.contains('El enlace ya se usó y no sirve de nuevo').should('be.visible')
      cy.then(() => {
        expect(nombres()).to.deep.equal(['verificacion', 'guardado'])
      })
    })

    it('al salir sin terminar cierra la sesión de ese proceso', () => {
      simularEnlaceValido()
      simularGuardado({
        statusCode: 422,
        body: { code: 422, error_code: 'same_password', msg: 'igual' },
      })
      simularCierre()
      cy.visit(ENLACE)
      completarNueva()
      cy.contains('tiene que ser distinta').should('be.visible')
      cy.contains('a', 'Volver al ingreso').click()
      cy.location('pathname').should('eq', '/app/ingresar')
      cy.wrap(null).should(() => {
        expect(nombres()).to.include('cierre')
      })
    })
  })

  describe('HU43: recarga después de verificar', () => {
    function verificarYRecargar() {
      simularEnlaceValido()
      simularPerfil()
      let intentos = 0
      simularGuardado((req) => {
        intentos += 1
        if (intentos === 1)
          req.reply({
            statusCode: 422,
            body: { code: 422, error_code: 'same_password', msg: 'igual' },
          })
        else req.reply({ body: cuenta('cuenta-enlace') })
      })
      simularCierre()
      cy.visit(ENLACE)
      completarNueva()
      cy.contains('tiene que ser distinta').should('be.visible')
      cy.reload()
      cy.contains('El enlace ya se validó').should('be.visible')
      cy.contains('El enlace no es válido').should('not.exist')
    }

    it('retoma el proceso y termina sin volver a verificar', () => {
      verificarYRecargar()
      completarNueva('otra-clave-ficticia')
      cy.location('pathname').should('eq', '/app/ingresar')
      cy.contains('Tu contraseña se cambió').should('be.visible')
      cy.then(() => {
        expect(nombres()).to.deep.equal([
          'verificacion',
          'guardado',
          'guardado',
          'cierre',
        ])
      })
    })

    it('cancelar cierra la sesión de recuperación y no cambia nada', () => {
      verificarYRecargar()
      cy.contains('button', 'Cancelar y cerrar sesión').click()
      cy.location('pathname').should('eq', '/app/ingresar')
      cy.then(() => {
        expect(nombres()).to.deep.equal(['verificacion', 'guardado', 'cierre'])
      })
      cy.reload()
      cy.get('input[type="email"]').should('be.visible')
    })

    it('si no se puede cerrar la sesión lo avisa y permite reintentar', () => {
      verificarYRecargar()
      simularCierre({ statusCode: 500, body: { msg: 'fallo' } })
      cy.contains('button', 'Cancelar y cerrar sesión').click()
      cy.contains('No se pudo cerrar la sesión').should('be.visible')
      cy.location('pathname').should('eq', '/app/nueva-contrasena')
      simularCierre()
      cy.contains('button', 'Cancelar y cerrar sesión').click()
      cy.location('pathname').should('eq', '/app/ingresar')
    })
  })

  describe('HU43: resultados no confirmados', () => {
    it('si se corta la conexión al guardar, no afirma ningún resultado', () => {
      simularEnlaceValido()
      simularGuardado((req) => {
        req.destroy()
      })
      cy.visit(ENLACE)
      completarNueva()
      cy.contains('No pudimos confirmar el cambio').should('be.visible')
      cy.contains('Tu contraseña se cambió').should('not.exist')
      simularCierre()
      cy.contains('a', 'Volver al ingreso').click()
    })

    it('distingue el cambio confirmado con la sesión sin cerrar', () => {
      simularEnlaceValido()
      simularGuardado()
      simularCierre({ statusCode: 500, body: { msg: 'fallo' } })
      simularPerfil()
      cy.visit(ENLACE)
      completarNueva()
      cy.contains('se cambió, pero no pudimos cerrar la sesión').should('be.visible')
      cy.contains('a', 'Ir a Mi cuenta').should('be.visible')
    })
  })

  describe('HU44: cambiar la contraseña', () => {
    function abrirFormulario() {
      ingresarSimulado('cuenta-enlace')
      cy.contains('nav a', 'Perfil').click()
      cy.contains('button', 'Cambiar contraseña').click()
    }

    function completarCambio(clave = CLAVE_NUEVA) {
      cy.get('input[autocomplete="current-password"]').type('clave-actual-ficticia', { log: false })
      cy.get('input[autocomplete="new-password"]').eq(0).type(clave, { log: false })
      cy.get('input[autocomplete="new-password"]').eq(1).type(clave, { log: false })
      cy.contains('button', 'Guardar contraseña').click()
    }

    it('valida los 8 caracteres sin enviar nada', () => {
      abrirFormulario()
      completarCambio('1234567')
      cy.contains('al menos 8 caracteres').should('be.visible')
    })

    it('con la contraseña actual incorrecta no cambia nada y sigue la sesión', () => {
      abrirFormulario()
      cy.intercept('POST', `${SUPABASE}/auth/v1/token*`, {
        statusCode: 400,
        body: { code: 400, error_code: 'invalid_credentials', msg: 'mal' },
      })
      completarCambio()
      cy.contains('La contraseña actual no es correcta').should('be.visible')
      cy.contains('Mi cuenta').should('be.visible')
      cy.get('input[autocomplete="current-password"]').should('be.visible')
    })

    it('cambia la contraseña y no cierra la sesión', () => {
      abrirFormulario()
      simularGuardado()
      completarCambio()
      cy.contains('Tu contraseña se cambió').should('be.visible')
      cy.contains('Mi cuenta').should('be.visible')
      cy.then(() => {
        expect(nombres()).to.deep.equal(['guardado'])
      })
    })

    it('si se corta la conexión al guardar, no afirma ningún resultado', () => {
      abrirFormulario()
      simularGuardado((req) => {
        req.destroy()
      })
      completarCambio()
      cy.contains('No pudimos confirmar el cambio').should('be.visible')
      cy.contains('Tu contraseña se cambió').should('not.exist')
    })

    it('sin conexión no envía nada', () => {
      abrirFormulario()
      cy.window().then((ventana) => {
        Object.defineProperty(ventana.navigator, 'onLine', {
          configurable: true,
          get: () => false,
        })
      })
      completarCambio()
      cy.contains('no se envió nada y la contraseña no cambió').should('be.visible')
    })
  })

  describe('Pantallas a 360 px', () => {
    const sinScrollHorizontal = () => {
      cy.document().then((documento) => {
        expect(documento.documentElement.scrollWidth).to.be.at.most(360)
      })
    }

    beforeEach(() => {
      cy.viewport(360, 740)
    })

    it('recuperar y contraseña nueva', () => {
      cy.visit('/app/recuperar')
      cy.contains('button', 'Enviar enlace').should('be.visible')
      sinScrollHorizontal()
      cy.visit(ENLACE)
      cy.contains('button', 'Guardar contraseña').should('be.visible')
      sinScrollHorizontal()
    })

    it('cambio de contraseña en Mi cuenta', () => {
      ingresarSimulado('cuenta-enlace')
      cy.contains('nav a', 'Perfil').click()
      cy.contains('button', 'Cambiar contraseña').click()
      cy.contains('button', 'Guardar contraseña').scrollIntoView().should('be.visible')
      sinScrollHorizontal()
    })
  })
})

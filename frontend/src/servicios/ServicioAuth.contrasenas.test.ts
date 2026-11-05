import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MENSAJES_CONTRASENA } from '../app/reglasContrasena'

// Valores ficticios: solo sirven para comprobar que no se registren
const TOKEN_ENLACE = 'token-de-prueba-enlace'
const CLAVE_ACTUAL = 'clave-actual-de-prueba'
const CLAVE_NUEVA = 'clave-nueva-de-prueba'

interface SesionSimulada {
  access_token: string
  user: { id: string; email: string }
}

const sesionDe = (id: string, access_token = `acceso-${id}`): SesionSimulada => ({
  access_token,
  user: { id, email: `${id}@ejemplo.test` },
})

// Cliente de Supabase simulado. Guarda la sesión como el cliente real:
// verifyOtp la reemplaza y signOut la borra.
const { auth, memoria, avisos } = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    updateUser: vi.fn(),
    verifyOtp: vi.fn(),
  },
  memoria: { sesion: null as SesionSimulada | null },
  avisos: { emitir: (() => {}) as (evento: string) => void },
}))
vi.mock('../lib/supabase', () => ({ supabase: { auth } }))

type Servicio = (typeof import('./ServicioAuth'))['ServicioAuth']
let ServicioAuth: Servicio

beforeEach(async () => {
  // El módulo guarda el proceso en curso: cada prueba empieza de cero
  vi.resetModules()
  ;({ ServicioAuth } = await import('./ServicioAuth'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('window', { location: { origin: 'https://demo.test' } })
  memoria.sesion = null

  auth.getSession.mockImplementation(async () => ({
    data: { session: memoria.sesion },
    error: null,
  }))
  auth.onAuthStateChange.mockImplementation(
    (alAvisar: (evento: string) => void) => {
      avisos.emitir = alAvisar
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    },
  )
  auth.signOut.mockImplementation(async () => {
    memoria.sesion = null
    return { error: null }
  })
  auth.updateUser.mockImplementation(async () => ({
    data: { user: memoria.sesion?.user ?? null },
    error: null,
  }))
  auth.verifyOtp.mockImplementation(async () => {
    memoria.sesion = sesionDe('cuenta-enlace')
    avisos.emitir('PASSWORD_RECOVERY')
    return {
      data: { session: memoria.sesion, user: memoria.sesion.user },
      error: null,
    }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Object.values(auth).forEach((simulacion) => {
    simulacion.mockReset()
  })
})

const sinConexion = () => {
  vi.stubGlobal('navigator', { onLine: false })
}

async function procesoVerificado() {
  const resultado = await ServicioAuth.verificarEnlace(TOKEN_ENLACE)
  if (resultado.estado !== 'verificado') throw new Error('no se verificó')
  return resultado.proceso
}

describe('solicitarRecuperacion (HU43)', () => {
  it('pide el enlace hacia la pantalla de la contraseña nueva', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
    expect(await ServicioAuth.solicitarRecuperacion(' ana@ejemplo.test ')).toEqual({
      ok: true,
    })
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('ana@ejemplo.test', {
      redirectTo: 'https://demo.test/app/nueva-contrasena',
    })
  })

  it('un límite de pedidos no se convierte en éxito', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { status: 429, code: 'over_email_send_rate_limit' },
    })
    expect(await ServicioAuth.solicitarRecuperacion('ana@ejemplo.test')).toEqual({
      ok: false,
      mensaje: MENSAJES_CONTRASENA.solicitudLimite,
      sinEnviar: false,
    })
  })

  it('si la promesa se rechaza avisa la falla de conexión', async () => {
    auth.resetPasswordForEmail.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(
      ServicioAuth.solicitarRecuperacion('ana@ejemplo.test'),
    ).resolves.toEqual({
      ok: false,
      mensaje: MENSAJES_CONTRASENA.errorConexion,
      sinEnviar: false,
    })
  })

  it('sin conexión no envía nada', async () => {
    sinConexion()
    expect(await ServicioAuth.solicitarRecuperacion('ana@ejemplo.test')).toEqual({
      ok: false,
      mensaje: MENSAJES_CONTRASENA.sinEnviar,
      sinEnviar: true,
    })
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })
})

describe('verificarEnlace (HU43)', () => {
  it('verifica el token de recuperación', async () => {
    expect((await ServicioAuth.verificarEnlace(TOKEN_ENLACE)).estado).toBe(
      'verificado',
    )
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: TOKEN_ENLACE,
      type: 'recovery',
    })
  })

  it('un enlace vencido deja intacta la sesión previa', async () => {
    memoria.sesion = sesionDe('otra-cuenta')
    auth.verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: { status: 403, code: 'otp_expired' },
    })
    expect(await ServicioAuth.verificarEnlace(TOKEN_ENLACE)).toEqual({
      estado: 'invalido',
      mensaje: MENSAJES_CONTRASENA.enlaceVencido,
    })
    expect(memoria.sesion?.user.id).toBe('otra-cuenta')
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it('si la promesa se rechaza el resultado es incierto', async () => {
    auth.verifyOtp.mockRejectedValue(new TypeError('Failed to fetch'))
    expect((await ServicioAuth.verificarEnlace(TOKEN_ENLACE)).estado).toBe(
      'incierto',
    )
  })

  it('sin conexión no gasta el token', async () => {
    sinConexion()
    expect((await ServicioAuth.verificarEnlace(TOKEN_ENLACE)).estado).toBe(
      'reintentar',
    )
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })
})

describe('guardarContrasenaRecuperada (HU43): la cuenta correcta', () => {
  const casos: Array<[string, SesionSimulada | null]> = [
    ['navegador sin sesión', null],
    ['sesión previa del mismo usuario', sesionDe('cuenta-enlace', 'acceso-viejo')],
    ['sesión previa de otro usuario', sesionDe('otra-cuenta')],
  ]

  it.each(casos)('%s', async (_nombre, sesionPrevia) => {
    memoria.sesion = sesionPrevia
    let cuentaAlActualizar: string | undefined
    let tokenAlActualizar: string | undefined
    auth.updateUser.mockImplementation(async () => {
      cuentaAlActualizar = memoria.sesion?.user.id
      tokenAlActualizar = memoria.sesion?.access_token
      return { data: { user: memoria.sesion?.user }, error: null }
    })

    const proceso = await procesoVerificado()
    const resultado = await ServicioAuth.guardarContrasenaRecuperada(
      proceso,
      CLAVE_NUEVA,
    )

    expect(resultado).toEqual({ estado: 'cambiada' })
    expect(cuentaAlActualizar).toBe('cuenta-enlace')
    expect(tokenAlActualizar).toBe('acceso-cuenta-enlace')
    expect(memoria.sesion).toBeNull()
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('si la sesión guardada ya no es la del enlace, no cambia nada ni la cierra', async () => {
    const proceso = await procesoVerificado()
    memoria.sesion = sesionDe('otra-cuenta')

    expect(
      await ServicioAuth.guardarContrasenaRecuperada(proceso, CLAVE_NUEVA),
    ).toEqual({
      estado: 'no-cambiada',
      mensaje: MENSAJES_CONTRASENA.sesionRecuperacionPerdida,
      pedirEnlace: true,
    })
    expect(auth.updateUser).not.toHaveBeenCalled()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(memoria.sesion.user.id).toBe('otra-cuenta')
  })
})

describe('guardarContrasenaRecuperada (HU43): token ya consumido', () => {
  it('si updateUser rechaza la contraseña, se corrige sin volver a verificar', async () => {
    auth.updateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { status: 422, code: 'same_password' },
    })
    const proceso = await procesoVerificado()

    expect(
      await ServicioAuth.guardarContrasenaRecuperada(proceso, CLAVE_NUEVA),
    ).toEqual({
      estado: 'no-cambiada',
      mensaje: MENSAJES_CONTRASENA.mismaContrasena,
      pedirEnlace: false,
    })
    expect(auth.signOut).not.toHaveBeenCalled()

    expect(
      await ServicioAuth.guardarContrasenaRecuperada(proceso, 'otra-clave-nueva'),
    ).toEqual({ estado: 'cambiada' })
    expect(auth.verifyOtp).toHaveBeenCalledOnce()
  })

  it('sin conexión no envía nada y avisa que el enlace no sirve de nuevo', async () => {
    const proceso = await procesoVerificado()
    sinConexion()

    const resultado = await ServicioAuth.guardarContrasenaRecuperada(
      proceso,
      CLAVE_NUEVA,
    )
    expect(resultado).toEqual({
      estado: 'no-cambiada',
      mensaje: MENSAJES_CONTRASENA.sinEnviarRecuperada,
      pedirEnlace: false,
    })
    expect(MENSAJES_CONTRASENA.sinEnviarRecuperada).toMatch(/no sirve de nuevo/)
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('si se perdió la sesión hay que pedir otro enlace', async () => {
    auth.updateUser.mockResolvedValue({
      data: { user: null },
      error: { status: 403, code: 'session_not_found' },
    })
    const proceso = await procesoVerificado()

    expect(
      await ServicioAuth.guardarContrasenaRecuperada(proceso, CLAVE_NUEVA),
    ).toEqual({
      estado: 'no-cambiada',
      mensaje: MENSAJES_CONTRASENA.sesionRecuperacionPerdida,
      pedirEnlace: true,
    })
    expect(
      await ServicioAuth.guardarContrasenaRecuperada(proceso, CLAVE_NUEVA),
    ).toMatchObject({ pedirEnlace: true })
    expect(auth.updateUser).toHaveBeenCalledOnce()
  })
})

describe('guardarContrasenaRecuperada (HU43): resultado confirmado', () => {
  it('distingue cambiada de cambiada sin cerrar la sesión', async () => {
    auth.signOut.mockResolvedValue({ error: { status: 500 } })
    const proceso = await procesoVerificado()

    expect(
      await ServicioAuth.guardarContrasenaRecuperada(proceso, CLAVE_NUEVA),
    ).toEqual({
      estado: 'cambiada-sin-cerrar',
      mensaje: MENSAJES_CONTRASENA.cambiadaSinCerrar,
    })
  })

  it('también si el cierre de sesión se rechaza', async () => {
    auth.signOut.mockRejectedValue(new TypeError('Failed to fetch'))
    const proceso = await procesoVerificado()

    expect(
      await ServicioAuth.guardarContrasenaRecuperada(proceso, CLAVE_NUEVA),
    ).toMatchObject({ estado: 'cambiada-sin-cerrar' })
  })

  it('si se envió y no hubo respuesta, no afirma que no cambió', async () => {
    for (const fallar of [
      () => auth.updateUser.mockRejectedValueOnce(new TypeError('Failed to fetch')),
      () =>
        auth.updateUser.mockResolvedValueOnce({
          data: { user: null },
          error: { status: 0 },
        }),
      () =>
        auth.updateUser.mockResolvedValueOnce({
          data: { user: null },
          error: { status: 504 },
        }),
    ]) {
      fallar()
      const proceso = await procesoVerificado()
      expect(
        await ServicioAuth.guardarContrasenaRecuperada(proceso, CLAVE_NUEVA),
      ).toEqual({ estado: 'incierta', mensaje: MENSAJES_CONTRASENA.incierta })
    }
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it('después de un resultado incierto se puede reintentar sin el token', async () => {
    auth.updateUser.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const proceso = await procesoVerificado()
    await ServicioAuth.guardarContrasenaRecuperada(proceso, CLAVE_NUEVA)

    expect(
      await ServicioAuth.guardarContrasenaRecuperada(proceso, CLAVE_NUEVA),
    ).toEqual({ estado: 'cambiada' })
    expect(auth.verifyOtp).toHaveBeenCalledOnce()
  })
})

describe('abandonarRecuperacion (HU43)', () => {
  it('cierra la sesión del proceso', async () => {
    const proceso = await procesoVerificado()
    await ServicioAuth.abandonarRecuperacion(proceso)
    expect(memoria.sesion).toBeNull()
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('una limpieza tardía no cierra una sesión posterior', async () => {
    const proceso = await procesoVerificado()
    memoria.sesion = sesionDe('cuenta-enlace', 'acceso-de-un-ingreso-nuevo')

    await ServicioAuth.abandonarRecuperacion(proceso)

    expect(auth.signOut).not.toHaveBeenCalled()
    expect(memoria.sesion.access_token).toBe('acceso-de-un-ingreso-nuevo')
  })

  it('no hace nada si el proceso ya terminó', async () => {
    const proceso = await procesoVerificado()
    await ServicioAuth.guardarContrasenaRecuperada(proceso, CLAVE_NUEVA)
    auth.signOut.mockClear()
    memoria.sesion = sesionDe('cuenta-enlace')

    await ServicioAuth.abandonarRecuperacion(proceso)

    expect(auth.signOut).not.toHaveBeenCalled()
    expect(memoria.sesion).not.toBeNull()
  })

  it('un proceso abandonado no se puede usar para guardar', async () => {
    const proceso = await procesoVerificado()
    await ServicioAuth.abandonarRecuperacion(proceso)

    expect(
      await ServicioAuth.guardarContrasenaRecuperada(proceso, CLAVE_NUEVA),
    ).toMatchObject({ estado: 'no-cambiada', pedirEnlace: true })
    expect(auth.updateUser).not.toHaveBeenCalled()
  })
})

describe('recarga después de verificar (HU43)', () => {
  // La marca vive en esta pestaña; el proceso en memoria se pierde al recargar
  let marcas: Map<string, string>

  beforeEach(() => {
    marcas = new Map()
    vi.stubGlobal('sessionStorage', {
      getItem: (clave: string) => marcas.get(clave) ?? null,
      setItem: (clave: string, valor: string) => {
        marcas.set(clave, valor)
      },
      removeItem: (clave: string) => {
        marcas.delete(clave)
      },
    })
  })

  async function recargar() {
    vi.resetModules()
    ;({ ServicioAuth } = await import('./ServicioAuth'))
  }

  it('la marca guarda solo el id de la cuenta', async () => {
    await procesoVerificado()
    expect([...marcas.values()]).toEqual(['cuenta-enlace'])
    expect(JSON.stringify([...marcas])).not.toContain(TOKEN_ENLACE)
    expect(JSON.stringify([...marcas])).not.toContain('acceso-')
  })

  it('retoma el proceso y termina sin volver a verificar', async () => {
    await procesoVerificado()
    await recargar()

    expect(ServicioAuth.hayRecuperacionPendiente()).toBe(true)
    const proceso = await ServicioAuth.retomarRecuperacion()
    if (!proceso) throw new Error('no se retomó')

    expect(
      await ServicioAuth.guardarContrasenaRecuperada(proceso, CLAVE_NUEVA),
    ).toEqual({ estado: 'cambiada' })
    expect(auth.verifyOtp).toHaveBeenCalledOnce()
    expect(memoria.sesion).toBeNull()
    expect(ServicioAuth.hayRecuperacionPendiente()).toBe(false)
  })

  it('cancelar cierra la sesión de recuperación sin cambiar nada', async () => {
    await procesoVerificado()
    await recargar()
    const proceso = await ServicioAuth.retomarRecuperacion()
    if (!proceso) throw new Error('no se retomó')

    expect(await ServicioAuth.abandonarRecuperacion(proceso)).toEqual({
      ok: true,
    })
    expect(auth.updateUser).not.toHaveBeenCalled()
    expect(memoria.sesion).toBeNull()
    expect(ServicioAuth.hayRecuperacionPendiente()).toBe(false)
  })

  it('si no se puede cerrar, lo avisa y el proceso sigue para reintentar', async () => {
    const proceso = await procesoVerificado()
    auth.signOut.mockResolvedValueOnce({ error: { status: 500 } })

    expect(await ServicioAuth.abandonarRecuperacion(proceso)).toMatchObject({
      ok: false,
    })
    expect(ServicioAuth.hayRecuperacionPendiente()).toBe(true)

    expect(await ServicioAuth.abandonarRecuperacion(proceso)).toEqual({
      ok: true,
    })
    expect(memoria.sesion).toBeNull()
  })

  it('no retoma si la sesión guardada es de otra cuenta, y no la cierra', async () => {
    await procesoVerificado()
    await recargar()
    memoria.sesion = sesionDe('otra-cuenta')

    expect(await ServicioAuth.retomarRecuperacion()).toBeNull()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(memoria.sesion.user.id).toBe('otra-cuenta')
    expect(ServicioAuth.hayRecuperacionPendiente()).toBe(false)
  })

  it('no retoma si ya no hay sesión', async () => {
    await procesoVerificado()
    await recargar()
    memoria.sesion = null

    expect(await ServicioAuth.retomarRecuperacion()).toBeNull()
    expect(ServicioAuth.hayRecuperacionPendiente()).toBe(false)
  })

  it('sin marca no hay nada que retomar', async () => {
    memoria.sesion = sesionDe('ana')
    expect(ServicioAuth.hayRecuperacionPendiente()).toBe(false)
    expect(await ServicioAuth.retomarRecuperacion()).toBeNull()
  })

  it('un cierre de sesión borra la marca', async () => {
    ServicioAuth.escucharCambios(vi.fn())
    await procesoVerificado()
    expect(ServicioAuth.hayRecuperacionPendiente()).toBe(true)

    avisos.emitir('SIGNED_OUT')
    expect(ServicioAuth.hayRecuperacionPendiente()).toBe(false)
  })
})

describe('APIs del navegador ausentes o bloqueadas', () => {
  it('sin sessionStorage el proceso funciona y no registra errores', async () => {
    vi.stubGlobal('sessionStorage', undefined)

    const proceso = await procesoVerificado()
    expect(ServicioAuth.hayRecuperacionPendiente()).toBe(false)
    expect(
      await ServicioAuth.guardarContrasenaRecuperada(proceso, CLAVE_NUEVA),
    ).toEqual({ estado: 'cambiada' })
    expect(console.error).not.toHaveBeenCalled()
  })

  it('si sessionStorage está bloqueado, conserva el manejo del error', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new DOMException('bloqueado', 'SecurityError')
      },
      setItem: () => {
        throw new DOMException('bloqueado', 'SecurityError')
      },
      removeItem: () => {
        throw new DOMException('bloqueado', 'SecurityError')
      },
    })

    const proceso = await procesoVerificado()
    expect(ServicioAuth.hayRecuperacionPendiente()).toBe(false)
    expect(console.error).toHaveBeenCalledWith(
      '[ServicioAuth] guardarMarca:',
      expect.objectContaining({ nombre: 'SecurityError' }),
    )
    expect(
      await ServicioAuth.guardarContrasenaRecuperada(proceso, CLAVE_NUEVA),
    ).toEqual({ estado: 'cambiada' })
  })

  it('sin navigator no da por perdida la conexión', async () => {
    vi.stubGlobal('navigator', undefined)
    expect((await ServicioAuth.verificarEnlace(TOKEN_ENLACE)).estado).toBe(
      'verificado',
    )
    expect(auth.verifyOtp).toHaveBeenCalledOnce()
  })

  it('con navigator.onLine en true envía normalmente', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    expect((await ServicioAuth.verificarEnlace(TOKEN_ENLACE)).estado).toBe(
      'verificado',
    )
  })
})

describe('escucharCambios: eventos de la recuperación', () => {
  it('PASSWORD_RECOVERY olvida al usuario anterior sin llamar a signOut', async () => {
    const alCambiar = vi.fn()
    ServicioAuth.escucharCambios(alCambiar)

    const proceso = await procesoVerificado()

    expect(alCambiar).toHaveBeenCalledWith('recuperacion')
    expect(alCambiar).not.toHaveBeenCalledWith('salio')
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(memoria.sesion?.user.id).toBe('cuenta-enlace')

    // La sesión sigue disponible para guardar la contraseña
    expect(
      await ServicioAuth.guardarContrasenaRecuperada(proceso, CLAVE_NUEVA),
    ).toEqual({ estado: 'cambiada' })
  })

  it('con un proceso abierto ignora SIGNED_IN; al abandonarlo deja de ignorarlo', async () => {
    const alCambiar = vi.fn()
    ServicioAuth.escucharCambios(alCambiar)
    const proceso = await procesoVerificado()
    alCambiar.mockClear()

    avisos.emitir('SIGNED_IN')
    expect(alCambiar).not.toHaveBeenCalled()

    await ServicioAuth.abandonarRecuperacion(proceso)
    avisos.emitir('SIGNED_IN')
    expect(alCambiar).toHaveBeenCalledWith('entro')
  })
})

describe('cambiarContrasena (HU44)', () => {
  beforeEach(() => {
    memoria.sesion = sesionDe('ana')
    auth.signInWithPassword.mockImplementation(async () => {
      avisos.emitir('SIGNED_IN')
      return { data: { user: { id: 'ana' } }, error: null }
    })
  })

  it('valida con el correo de la sesión y cambia la contraseña', async () => {
    expect(
      await ServicioAuth.cambiarContrasena(CLAVE_ACTUAL, CLAVE_NUEVA),
    ).toEqual({ estado: 'cambiada' })
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@ejemplo.test',
      password: CLAVE_ACTUAL,
    })
    expect(auth.updateUser).toHaveBeenCalledWith({ password: CLAVE_NUEVA })
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(memoria.sesion?.user.id).toBe('ana')
  })

  it('con la actual incorrecta no cambia nada y la sesión sigue igual', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { status: 400, code: 'invalid_credentials' },
    })
    expect(
      await ServicioAuth.cambiarContrasena(CLAVE_ACTUAL, CLAVE_NUEVA),
    ).toEqual({
      estado: 'no-cambiada',
      mensaje: MENSAJES_CONTRASENA.actualIncorrecta,
      pedirEnlace: false,
    })
    expect(auth.updateUser).not.toHaveBeenCalled()
    expect(memoria.sesion?.user.id).toBe('ana')
  })

  it('si la verificación devuelve otra cuenta, no cambia nada', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'otra-cuenta' } },
      error: null,
    })
    expect(
      await ServicioAuth.cambiarContrasena(CLAVE_ACTUAL, CLAVE_NUEVA),
    ).toMatchObject({ estado: 'no-cambiada' })
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('sin sesión no intenta verificar', async () => {
    memoria.sesion = null
    expect(
      await ServicioAuth.cambiarContrasena(CLAVE_ACTUAL, CLAVE_NUEVA),
    ).toMatchObject({
      estado: 'no-cambiada',
      mensaje: MENSAJES_CONTRASENA.sesionNoDisponible,
    })
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('sin conexión no envía nada', async () => {
    sinConexion()
    expect(
      await ServicioAuth.cambiarContrasena(CLAVE_ACTUAL, CLAVE_NUEVA),
    ).toMatchObject({
      estado: 'no-cambiada',
      mensaje: MENSAJES_CONTRASENA.sinEnviarCambio,
    })
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('si falla la red en la verificación, la contraseña no cambió', async () => {
    auth.signInWithPassword.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(
      await ServicioAuth.cambiarContrasena(CLAVE_ACTUAL, CLAVE_NUEVA),
    ).toMatchObject({
      estado: 'no-cambiada',
      mensaje: MENSAJES_CONTRASENA.actualNoVerificada,
    })
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('si falla la red al actualizar, el resultado es incierto', async () => {
    auth.updateUser.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(
      await ServicioAuth.cambiarContrasena(CLAVE_ACTUAL, CLAVE_NUEVA),
    ).toEqual({ estado: 'incierta', mensaje: MENSAJES_CONTRASENA.incierta })
  })
})

describe('marca de reautenticación (HU44)', () => {
  async function revisarMarca(preparar: () => void) {
    memoria.sesion = sesionDe('ana')
    const alCambiar = vi.fn()
    ServicioAuth.escucharCambios(alCambiar)
    preparar()

    await ServicioAuth.cambiarContrasena(CLAVE_ACTUAL, CLAVE_NUEVA)
    expect(alCambiar).not.toHaveBeenCalledWith('entro')

    // Pasada la operación, un ingreso real se vuelve a escuchar
    avisos.emitir('SIGNED_IN')
    expect(alCambiar).toHaveBeenCalledWith('entro')
  }

  it('se limpia al validar correctamente', async () => {
    await revisarMarca(() => {
      auth.signInWithPassword.mockImplementation(async () => {
        avisos.emitir('SIGNED_IN')
        return { data: { user: { id: 'ana' } }, error: null }
      })
    })
  })

  it('se limpia si la contraseña actual es incorrecta', async () => {
    await revisarMarca(() => {
      auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { status: 400 },
      })
    })
  })

  it('se limpia si la promesa se rechaza', async () => {
    await revisarMarca(() => {
      auth.signInWithPassword.mockRejectedValue(new TypeError('Failed to fetch'))
    })
  })

  it('se limpia aunque después falle la actualización', async () => {
    await revisarMarca(() => {
      auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'ana' } },
        error: null,
      })
      auth.updateUser.mockRejectedValue(new TypeError('Failed to fetch'))
    })
  })
})

describe('registros en la consola', () => {
  it('nunca incluyen contraseñas, tokens ni enlaces', async () => {
    const causa = Object.assign(
      new Error(`falló ${TOKEN_ENLACE} ${CLAVE_NUEVA} ${CLAVE_ACTUAL}`),
      { status: 500 },
    )
    auth.verifyOtp.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: causa,
    })
    await ServicioAuth.verificarEnlace(TOKEN_ENLACE)

    auth.updateUser.mockRejectedValue(causa)
    await ServicioAuth.guardarContrasenaRecuperada(
      await procesoVerificado(),
      CLAVE_NUEVA,
    )

    memoria.sesion = sesionDe('ana')
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: causa,
    })
    await ServicioAuth.cambiarContrasena(CLAVE_ACTUAL, CLAVE_NUEVA)

    auth.resetPasswordForEmail.mockResolvedValue({ data: null, error: causa })
    await ServicioAuth.solicitarRecuperacion('ana@ejemplo.test')

    const registrado = JSON.stringify(vi.mocked(console.error).mock.calls)
    expect(vi.mocked(console.error)).toHaveBeenCalled()
    for (const secreto of [
      TOKEN_ENLACE,
      CLAVE_NUEVA,
      CLAVE_ACTUAL,
      'acceso-cuenta-enlace',
      'token_hash',
    ]) {
      expect(registrado).not.toContain(secreto)
    }
  })
})

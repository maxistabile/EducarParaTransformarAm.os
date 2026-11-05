import { describe, it, expect } from 'vitest'
import {
  LARGO_MINIMO,
  MENSAJES_CONTRASENA,
  clasificarErrorActualizacion,
  clasificarErrorEnlace,
  leerTokenEnlace,
  mensajeErrorActual,
  mensajeErrorSolicitud,
  resumenError,
  validarContrasenaNueva,
} from './reglasContrasena'

describe('validarContrasenaNueva (HU43 y HU44)', () => {
  const nueva = 'clave-nueva'

  it('acepta una contraseña de al menos 8 caracteres que coincide', () => {
    expect(LARGO_MINIMO).toBe(8)
    expect(
      validarContrasenaNueva({ nueva: '12345678', confirmacion: '12345678' }),
    ).toBeNull()
  })

  it('rechaza menos de 8 caracteres', () => {
    expect(
      validarContrasenaNueva({ nueva: '1234567', confirmacion: '1234567' }),
    ).toMatch(/al menos 8/)
  })

  it('rechaza una confirmación distinta', () => {
    expect(
      validarContrasenaNueva({ nueva, confirmacion: 'otra-clave' }),
    ).toMatch(/confirmación/)
  })

  it('rechaza que la nueva sea igual a la actual (HU44)', () => {
    expect(
      validarContrasenaNueva({ nueva, confirmacion: nueva, actual: nueva }),
    ).toBe(MENSAJES_CONTRASENA.mismaContrasena)
  })
})

describe('leerTokenEnlace (HU43)', () => {
  it('devuelve el token de un enlace de recuperación', () => {
    const parametros = new URLSearchParams('token_hash=abc&type=recovery')
    expect(leerTokenEnlace(parametros)).toBe('abc')
  })

  it('rechaza un enlace sin token o de otro tipo', () => {
    expect(leerTokenEnlace(new URLSearchParams(''))).toBeNull()
    expect(leerTokenEnlace(new URLSearchParams('type=recovery'))).toBeNull()
    expect(
      leerTokenEnlace(new URLSearchParams('token_hash=&type=recovery')),
    ).toBeNull()
    expect(
      leerTokenEnlace(new URLSearchParams('token_hash=abc&type=signup')),
    ).toBeNull()
  })
})

describe('mensajeErrorSolicitud (HU43)', () => {
  it('no convierte los errores en éxito', () => {
    for (const error of [
      { status: 429 },
      { status: 400, code: 'validation_failed' },
      { status: 400, code: 'email_address_not_authorized' },
      { status: 500 },
    ]) {
      expect(mensajeErrorSolicitud(error)).not.toBe(
        MENSAJES_CONTRASENA.solicitudEnviada,
      )
    }
  })

  it('un límite de pedidos no habla de la cuenta', () => {
    const mensaje = mensajeErrorSolicitud({
      status: 429,
      code: 'over_email_send_rate_limit',
    })
    expect(mensaje).toBe(MENSAJES_CONTRASENA.solicitudLimite)
    expect(mensaje).not.toMatch(/cuenta|registrad/i)
  })

  it('distingue la falta de conexión y el correo mal escrito', () => {
    expect(mensajeErrorSolicitud({ status: 0 })).toBe(
      MENSAJES_CONTRASENA.errorConexion,
    )
    expect(mensajeErrorSolicitud({ status: 503 })).toBe(
      MENSAJES_CONTRASENA.errorConexion,
    )
    expect(
      mensajeErrorSolicitud({ status: 400, code: 'email_address_invalid' }),
    ).toBe(MENSAJES_CONTRASENA.correoInvalido)
  })

  it('una falla de configuración da un mensaje neutro', () => {
    expect(
      mensajeErrorSolicitud({
        status: 400,
        code: 'email_address_not_authorized',
      }),
    ).toBe(MENSAJES_CONTRASENA.solicitudFallo)
  })
})

describe('clasificarErrorEnlace (HU43)', () => {
  it('un enlace vencido o usado pide otro enlace', () => {
    expect(
      clasificarErrorEnlace({ status: 403, code: 'otp_expired' }),
    ).toEqual({ tipo: 'invalido', mensaje: MENSAJES_CONTRASENA.enlaceVencido })
  })

  it('sin respuesta no afirma que el enlace venció', () => {
    expect(clasificarErrorEnlace({ status: 0 }).tipo).toBe('incierto')
    expect(clasificarErrorEnlace({ status: 502 }).tipo).toBe('incierto')
  })

  it('con un límite de pedidos se puede reintentar', () => {
    expect(clasificarErrorEnlace({ status: 429 }).tipo).toBe('reintentar')
  })
})

describe('mensajeErrorActual (HU44)', () => {
  it('un 400 dice que la contraseña actual es incorrecta', () => {
    expect(mensajeErrorActual({ status: 400 })).toBe(
      MENSAJES_CONTRASENA.actualIncorrecta,
    )
  })

  it('sin conexión no culpa a la contraseña', () => {
    expect(mensajeErrorActual({ status: 0 })).toBe(
      MENSAJES_CONTRASENA.actualNoVerificada,
    )
  })
})

describe('clasificarErrorActualizacion (HU43 y HU44)', () => {
  it('sin respuesta confirmada el resultado es incierto', () => {
    for (const error of [{}, { status: 0 }, { status: 500 }, { status: 504 }]) {
      expect(clasificarErrorActualizacion(error).estado).toBe('incierta')
    }
  })

  it('una respuesta definitiva es no-cambiada y se puede corregir', () => {
    expect(
      clasificarErrorActualizacion({ status: 422, code: 'same_password' }),
    ).toEqual({
      estado: 'no-cambiada',
      mensaje: MENSAJES_CONTRASENA.mismaContrasena,
      pedirEnlace: false,
    })
    expect(
      clasificarErrorActualizacion({ status: 422, code: 'weak_password' }),
    ).toEqual({
      estado: 'no-cambiada',
      mensaje: MENSAJES_CONTRASENA.contrasenaDebil,
      pedirEnlace: false,
    })
  })

  it('si se perdió la sesión hay que pedir otro enlace', () => {
    for (const error of [
      { status: 403, code: 'session_not_found' },
      { status: 401 },
    ]) {
      expect(clasificarErrorActualizacion(error)).toMatchObject({
        estado: 'no-cambiada',
        pedirEnlace: true,
      })
    }
  })

  it('una reautenticación requerida no se presenta como cambio', () => {
    expect(
      clasificarErrorActualizacion({
        status: 400,
        code: 'reauthentication_needed',
      }),
    ).toMatchObject({
      estado: 'no-cambiada',
      mensaje: MENSAJES_CONTRASENA.reautenticacion,
    })
  })
})

describe('resumenError', () => {
  it('conserva solo nombre, status y código', () => {
    const causa = Object.assign(new Error('token_hash=secreto clave=secreta'), {
      name: 'AuthApiError',
      status: 403,
      code: 'otp_expired',
    })
    const resumen = resumenError(causa)
    expect(resumen).toEqual({
      nombre: 'AuthApiError',
      status: 403,
      code: 'otp_expired',
    })
    expect(JSON.stringify(resumen)).not.toContain('secret')
  })

  it('tolera valores que no son errores', () => {
    expect(resumenError('token_hash=secreto')).toEqual({
      nombre: 'desconocido',
    })
    expect(resumenError(null)).toEqual({ nombre: 'desconocido' })
  })
})

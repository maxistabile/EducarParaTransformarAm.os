// ═══════════════════════════════════════════════════════════════
//  REGLAS DE CONTRASEÑA — RF10 (HU43 y HU44)
// ═══════════════════════════════════════════════════════════════
// Lógica pura (sin Supabase) para poder probarla con Vitest.
// ServicioAuth le pasa los errores de Supabase y las pantallas usan los
// resultados: ninguna pantalla interpreta errores por su cuenta.

/** Mínimo de estos formularios. No cambia el ajuste global de Supabase Auth. */
export const LARGO_MINIMO = 8

/** Espera entre pedidos del enlace; es la misma exista o no la cuenta. */
export const ESPERA_SOLICITUD_SEG = 60

export const MENSAJES_CONTRASENA = {
  solicitudEnviada:
    'Si el correo está registrado, vas a recibir un enlace para definir una contraseña nueva. Revisá también el correo no deseado.',
  solicitudLimite:
    'No pudimos procesar el pedido ahora. Esperá unos minutos e intentá de nuevo.',
  correoInvalido: 'Revisá que el correo esté bien escrito.',
  solicitudFallo:
    'No pudimos procesar el pedido. Intentá de nuevo más tarde.',
  sinEnviar:
    'No tenés conexión: no se envió nada. Intentá de nuevo cuando vuelva.',
  errorConexion:
    'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.',

  enlaceInvalido: 'El enlace no es válido. Pedí uno nuevo.',
  enlaceVencido: 'El enlace venció o ya se usó. Pedí uno nuevo.',
  enlaceIncierto:
    'No pudimos confirmar el enlace. Intentá de nuevo; si dice que venció o ya se usó, pedí uno nuevo.',
  sesionRecuperacionPerdida:
    'Se perdió la validación del enlace y este enlace ya no se puede volver a usar. Pedí uno nuevo.',
  recuperacionRetomada:
    'El enlace ya se validó y no se cambió la contraseña. Podés definirla ahora o cancelar para cerrar esta sesión.',

  sinEnviarRecuperada:
    'No tenés conexión: la contraseña no se cambió. No cierres esta pantalla y reintentá cuando vuelva. El enlace ya se usó y no sirve de nuevo.',
  sinEnviarCambio:
    'No tenés conexión: no se envió nada y la contraseña no cambió.',
  actualIncorrecta: 'La contraseña actual no es correcta.',
  actualNoVerificada:
    'No pudimos verificar tu contraseña actual, así que no se cambió nada. Revisá tu conexión e intentá de nuevo.',
  sesionNoDisponible:
    'No pudimos identificar tu sesión, así que no se cambió nada. Cerrá sesión e ingresá de nuevo.',
  mismaContrasena: 'La contraseña nueva tiene que ser distinta de la actual.',
  contrasenaDebil:
    'Esa contraseña no cumple los requisitos de seguridad. Probá con otra.',
  demasiadosIntentos:
    'Hiciste demasiados intentos, así que no se cambió nada. Esperá unos minutos y volvé a probar.',
  reautenticacion:
    'Por seguridad, cerrá sesión, ingresá de nuevo y volvé a intentarlo. La contraseña no se cambió.',
  sesionVencida: 'Tu sesión venció, así que no se cambió nada. Ingresá de nuevo.',
  noCambiada: 'No pudimos cambiar la contraseña. Intentá de nuevo más tarde.',
  incierta:
    'No pudimos confirmar el cambio. Probá ingresar con la contraseña nueva; si no funciona, usá la anterior o pedí un enlace para definir otra.',
  cambiadaSinCerrar:
    'La contraseña se cambió, pero no pudimos cerrar la sesión en este dispositivo. Entrá a Mi cuenta y cerrala.',
  recuperada: 'Tu contraseña se cambió. Ya podés ingresar.',
  cambiada: 'Tu contraseña se cambió.',
}

/** Validación de los formularios: devuelve el mensaje de error, o null. */
export function validarContrasenaNueva(datos: {
  nueva: string
  confirmacion: string
  actual?: string
}): string | null {
  if (datos.nueva.length < LARGO_MINIMO)
    return `La contraseña nueva tiene que tener al menos ${LARGO_MINIMO} caracteres.`
  if (datos.nueva !== datos.confirmacion)
    return 'La confirmación no coincide con la contraseña nueva.'
  if (datos.actual !== undefined && datos.actual === datos.nueva)
    return MENSAJES_CONTRASENA.mismaContrasena
  return null
}

/** Token del enlace de recuperación, o null si el enlace no es válido. */
export function leerTokenEnlace(parametros: URLSearchParams): string | null {
  if (parametros.get('type') !== 'recovery') return null
  return parametros.get('token_hash') || null
}

// ── Resultados ────────────────────────────────────────────────
// Distinguen lo que está confirmado de lo que no. Una pantalla no puede
// decir "se cambió" salvo con 'cambiada' o 'cambiada-sin-cerrar'.
export type ResultadoContrasena =
  /** Supabase confirmó el cambio. */
  | { estado: 'cambiada' }
  /** Confirmado, pero la sesión de recuperación sigue abierta (HU43). */
  | { estado: 'cambiada-sin-cerrar'; mensaje: string }
  /** Respuesta definitiva del servidor, o no se llegó a enviar. */
  | { estado: 'no-cambiada'; mensaje: string; pedirEnlace: boolean }
  /** Se envió y no hubo respuesta: pudo haberse cambiado o no. */
  | { estado: 'incierta'; mensaje: string }

export interface ErrorAuth {
  status?: number
  code?: string
}

/** Sin respuesta confirmada del servidor: sin status, status 0 o 5xx. */
function sinRespuestaConfirmada(error: ErrorAuth): boolean {
  return !error.status || error.status >= 500
}

/**
 * Pedido del enlace (HU43). Ningún mensaje habla de la cuenta. El éxito no
 * pasa por acá: tiene su propio mensaje genérico.
 */
export function mensajeErrorSolicitud(error: ErrorAuth): string {
  if (sinRespuestaConfirmada(error)) return MENSAJES_CONTRASENA.errorConexion
  if (error.status === 429) return MENSAJES_CONTRASENA.solicitudLimite
  if (error.code === 'email_address_invalid' || error.code === 'validation_failed')
    return MENSAJES_CONTRASENA.correoInvalido
  return MENSAJES_CONTRASENA.solicitudFallo
}

export type ErrorEnlace =
  /** El token no se consumió: se puede reintentar con el mismo enlace. */
  | { tipo: 'reintentar'; mensaje: string }
  /** El enlace no sirve: hay que pedir otro. */
  | { tipo: 'invalido'; mensaje: string }
  /** Sin respuesta: no se sabe si el token se consumió. */
  | { tipo: 'incierto'; mensaje: string }

/** Verificación del enlace (HU43). */
export function clasificarErrorEnlace(error: ErrorAuth): ErrorEnlace {
  if (sinRespuestaConfirmada(error))
    return { tipo: 'incierto', mensaje: MENSAJES_CONTRASENA.enlaceIncierto }
  if (error.status === 429)
    return { tipo: 'reintentar', mensaje: MENSAJES_CONTRASENA.solicitudLimite }
  if (error.code === 'otp_expired')
    return { tipo: 'invalido', mensaje: MENSAJES_CONTRASENA.enlaceVencido }
  return { tipo: 'invalido', mensaje: MENSAJES_CONTRASENA.enlaceInvalido }
}

/** Validación de la contraseña actual (HU44). Nunca llegó a cambiar nada. */
export function mensajeErrorActual(error: ErrorAuth): string {
  if (error.status === 400) return MENSAJES_CONTRASENA.actualIncorrecta
  if (error.status === 429) return MENSAJES_CONTRASENA.demasiadosIntentos
  return MENSAJES_CONTRASENA.actualNoVerificada
}

function noCambiada(mensaje: string, pedirEnlace = false): ResultadoContrasena {
  return { estado: 'no-cambiada', mensaje, pedirEnlace }
}

/** Error de updateUser (HU43 y HU44). */
export function clasificarErrorActualizacion(
  error: ErrorAuth,
): ResultadoContrasena {
  if (sinRespuestaConfirmada(error))
    return { estado: 'incierta', mensaje: MENSAJES_CONTRASENA.incierta }
  if (error.status === 429)
    return noCambiada(MENSAJES_CONTRASENA.demasiadosIntentos)
  switch (error.code) {
    case 'same_password':
      return noCambiada(MENSAJES_CONTRASENA.mismaContrasena)
    case 'weak_password':
      return noCambiada(MENSAJES_CONTRASENA.contrasenaDebil)
    case 'reauthentication_needed':
    case 'reauthentication_not_valid':
      return noCambiada(MENSAJES_CONTRASENA.reautenticacion)
    case 'session_not_found':
    case 'session_expired':
    case 'bad_jwt':
      return noCambiada(MENSAJES_CONTRASENA.sesionVencida, true)
    default:
      return error.status === 401
        ? noCambiada(MENSAJES_CONTRASENA.sesionVencida, true)
        : noCambiada(MENSAJES_CONTRASENA.noCambiada)
  }
}

/**
 * Datos de un error que se pueden registrar en la consola. Solo nombre,
 * status y código: nunca contraseñas, tokens ni enlaces.
 */
export function resumenError(causa: unknown): {
  nombre: string
  status?: number
  code?: string
} {
  if (typeof causa !== 'object' || causa === null)
    return { nombre: 'desconocido' }
  const { name, status, code } = causa as {
    name?: unknown
    status?: unknown
    code?: unknown
  }
  return {
    nombre: typeof name === 'string' ? name : 'desconocido',
    status: typeof status === 'number' ? status : undefined,
    code: typeof code === 'string' ? code : undefined,
  }
}

// ═══════════════════════════════════════════════════════════════
//  ServicioAuth — patrón Facade (RF10)
// ═══════════════════════════════════════════════════════════════
// Único punto por el que las pantallas de la app usan Supabase Auth y la
// tabla `usuarios`. Las pantallas no consultan tablas directamente.
// Usa la instancia única del cliente (Singleton, src/lib/supabase.ts).
//
// Manejo de errores: lo que usan las pantallas (iniciarSesion,
// cerrarSesion, validarSesion) nunca rechaza; devuelve un Resultado o un
// EstadoSesion con el mensaje para mostrar, y la causa queda registrada en
// la consola. obtenerIdSesion y cargarPerfil sí lanzan, porque solo los usa
// resolverSesion, que convierte cada error en un estado (reglasAuthApp.ts).
//
// Contraseñas (HU43 y HU44): se usan ResultadoContrasena y resumenError, de
// reglasContrasena.ts. Nunca se registran contraseñas, tokens ni enlaces.
import { supabase } from '../lib/supabase'
import {
  ErrorSesionInvalida,
  MENSAJES_ACCESO,
  mensajeErrorIngreso,
  resolverSesion,
} from '../app/reglasAuthApp'
import type {
  EstadoSesion,
  PerfilUsuario,
  Resultado,
} from '../app/reglasAuthApp'
import {
  MENSAJES_CONTRASENA,
  clasificarErrorActualizacion,
  clasificarErrorEnlace,
  mensajeErrorActual,
  mensajeErrorSolicitud,
  resumenError,
} from '../app/reglasContrasena'
import type { ResultadoContrasena } from '../app/reglasContrasena'

/**
 * Recuperación verificada y todavía sin terminar (HU43). verifyOtp ya
 * consumió el token: el proceso existe mientras dure la sesión de
 * recuperación, y el token no se puede volver a usar.
 */
export interface ProcesoRecuperacion {
  readonly idUsuario: string
  readonly tokenAcceso: string
}

export type ResultadoEnlace =
  | { estado: 'verificado'; proceso: ProcesoRecuperacion }
  | { estado: 'reintentar' | 'invalido' | 'incierto'; mensaje: string }

export type ResultadoSolicitud =
  | { ok: true }
  /** sinEnviar: no se llegó a hacer el pedido, no hace falta la espera. */
  | { ok: false; mensaje: string; sinEnviar: boolean }

export type CambioSesion = 'entro' | 'salio' | 'recuperacion'

let procesoActivo: ProcesoRecuperacion | null = null
// Mientras se valida la contraseña actual (HU44) se ignora el SIGNED_IN
// propio: la sesión es de la misma cuenta y no hace falta revalidar el perfil.
let reautenticando = false

// Si se recarga después de verificar, el proceso en memoria se pierde pero
// la sesión de recuperación sigue guardada. Esta marca (solo el id de la
// cuenta y solo en esta pestaña) permite retomarlo o cerrarlo.
const MARCA_RECUPERACION = 'recuperacion-en-curso'

/** null si no existe, como en Node. Acceder puede lanzar: usar dentro de try. */
function almacenSesion(): Storage | null {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage
}

function leerMarca(): string | null {
  try {
    return almacenSesion()?.getItem(MARCA_RECUPERACION) ?? null
  } catch (causa) {
    registrar('leerMarca', causa)
    return null
  }
}

function guardarMarca(idUsuario: string) {
  try {
    almacenSesion()?.setItem(MARCA_RECUPERACION, idUsuario)
  } catch (causa) {
    registrar('guardarMarca', causa)
  }
}

function borrarMarca() {
  try {
    almacenSesion()?.removeItem(MARCA_RECUPERACION)
  } catch (causa) {
    registrar('borrarMarca', causa)
  }
}

async function obtenerIdSesion(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session?.user.id ?? null
}

async function cargarPerfil(idUsuario: string): Promise<PerfilUsuario | null> {
  const { data, error, status } = await supabase
    .from('usuarios')
    .select('id_usuario, nombre, apellido, email, rol, activo')
    .eq('id_usuario', idUsuario)
    .maybeSingle()
  // 401: el servidor no acepta el token guardado (vencido o revocado)
  if (status === 401) throw new ErrorSesionInvalida()
  if (error) throw error
  return data as PerfilUsuario | null
}

/**
 * Una operación falló: se registra la causa (para diagnosticar) y se
 * devuelve el mensaje que la pantalla le muestra al usuario.
 */
function fallo(operacion: string, mensaje: string, causa: unknown): Resultado {
  console.error(`[ServicioAuth] ${operacion}:`, causa)
  return { ok: false, mensaje }
}

/**
 * Cierra la sesión solo en este dispositivo (HU42).
 * Contempla los dos casos de falla de signOut: que devuelva un error
 * (por ejemplo, el servidor no respondió bien) o que la promesa se
 * rechace (por ejemplo, sin conexión). En ambos se registra la causa y se
 * devuelve el mensaje; la promesa resultante no se rechaza.
 */
function cerrarSesion(): Promise<Resultado> {
  return supabase.auth.signOut({ scope: 'local' }).then(
    ({ error }): Resultado =>
      error
        ? fallo('cerrarSesion', MENSAJES_ACCESO.errorCierre, error)
        : { ok: true },
    (causa: unknown) =>
      fallo('cerrarSesion', MENSAJES_ACCESO.errorCierre, causa),
  )
}

function registrar(operacion: string, causa: unknown) {
  console.error(`[ServicioAuth] ${operacion}:`, resumenError(causa))
}

/** navigator.onLine === false asegura que no se puede enviar nada. */
function sinConexion(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function noCambiada(mensaje: string, pedirEnlace = false): ResultadoContrasena {
  return { estado: 'no-cambiada', mensaje, pedirEnlace }
}

/** Solo devuelve 'cambiada' si Supabase confirmó el cambio. */
function actualizarContrasena(
  operacion: string,
  nueva: string,
): Promise<ResultadoContrasena> {
  const sinConfirmar = (causa: unknown): ResultadoContrasena => {
    registrar(operacion, causa)
    return { estado: 'incierta', mensaje: MENSAJES_CONTRASENA.incierta }
  }
  return supabase.auth.updateUser({ password: nueva }).then(
    ({ data, error }): ResultadoContrasena => {
      if (error) {
        registrar(operacion, error)
        return clasificarErrorActualizacion(error)
      }
      return data.user
        ? { estado: 'cambiada' }
        : sinConfirmar('respuesta sin usuario')
    },
    sinConfirmar,
  )
}

/** Valida la contraseña actual; la marca se limpia en todos los caminos. */
function reautenticar(email: string, password: string) {
  reautenticando = true
  return supabase.auth.signInWithPassword({ email, password }).finally(() => {
    reautenticando = false
  })
}

/** Después del cambio confirmado, cierra la sesión de recuperación. */
function cerrarRecuperacion(
  proceso: ProcesoRecuperacion,
): Promise<ResultadoContrasena> {
  const sinCerrar: ResultadoContrasena = {
    estado: 'cambiada-sin-cerrar',
    mensaje: MENSAJES_CONTRASENA.cambiadaSinCerrar,
  }
  if (procesoActivo !== proceso) return Promise.resolve(sinCerrar)
  procesoActivo = null
  borrarMarca()
  return cerrarSesion().then(
    (cierre): ResultadoContrasena =>
      cierre.ok ? { estado: 'cambiada' } : sinCerrar,
  )
}

export const ServicioAuth = {
  /**
   * HU41. Solo valida las credenciales: el perfil, el rol y el estado
   * activo los valida `validarSesion`, que corre al cambiar la sesión.
   * Igual que cerrarSesion, contempla el error devuelto y el rechazo.
   */
  iniciarSesion(email: string, password: string): Promise<Resultado> {
    return supabase.auth
      .signInWithPassword({ email: email.trim(), password })
      .then(
        ({ data, error }): Resultado => {
          if (error)
            return fallo('iniciarSesion', mensajeErrorIngreso(error), error)
          if (!data.user)
            return fallo(
              'iniciarSesion',
              MENSAJES_ACCESO.sinConexion,
              'respuesta sin usuario',
            )
          return { ok: true }
        },
        // Falla de red antes de recibir respuesta
        (causa: unknown) =>
          fallo('iniciarSesion', MENSAJES_ACCESO.sinConexion, causa),
      )
  },

  /** Valida la sesión guardada: perfil, rol y estado activo. */
  validarSesion(): Promise<EstadoSesion> {
    return resolverSesion({ obtenerIdSesion, cargarPerfil, cerrarSesion })
  },

  cerrarSesion,

  /**
   * HU43. Pide el enlace de recuperación. Supabase responde sin error
   * exista o no la cuenta, y ese caso da el mismo mensaje genérico.
   */
  solicitarRecuperacion(email: string): Promise<ResultadoSolicitud> {
    if (sinConexion())
      return Promise.resolve({
        ok: false,
        mensaje: MENSAJES_CONTRASENA.sinEnviar,
        sinEnviar: true,
      })
    return supabase.auth
      .resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/app/nueva-contrasena`,
      })
      .then(
        ({ error }): ResultadoSolicitud => {
          if (!error) return { ok: true }
          registrar('solicitarRecuperacion', error)
          return {
            ok: false,
            mensaje: mensajeErrorSolicitud(error),
            sinEnviar: false,
          }
        },
        (causa: unknown): ResultadoSolicitud => {
          registrar('solicitarRecuperacion', causa)
          return {
            ok: false,
            mensaje: MENSAJES_CONTRASENA.errorConexion,
            sinEnviar: false,
          }
        },
      )
  },

  /**
   * HU43. Verifica el enlace y abre la sesión de recuperación, que
   * reemplaza a cualquier sesión previa de este navegador. Si falla, la
   * sesión previa queda intacta. Se llama al guardar, no al abrir el enlace,
   * para que abrirlo no consuma el token.
   */
  verificarEnlace(tokenHash: string): Promise<ResultadoEnlace> {
    if (sinConexion())
      return Promise.resolve({
        estado: 'reintentar',
        mensaje: MENSAJES_CONTRASENA.sinEnviar,
      })
    return supabase.auth
      .verifyOtp({ token_hash: tokenHash, type: 'recovery' })
      .then(
        ({ data, error }): ResultadoEnlace => {
          if (error) {
            registrar('verificarEnlace', error)
            const { tipo, mensaje } = clasificarErrorEnlace(error)
            return { estado: tipo, mensaje }
          }
          if (!data.session || !data.user) {
            registrar('verificarEnlace', 'respuesta sin sesión')
            return {
              estado: 'invalido',
              mensaje: MENSAJES_CONTRASENA.enlaceInvalido,
            }
          }
          procesoActivo = {
            idUsuario: data.user.id,
            tokenAcceso: data.session.access_token,
          }
          guardarMarca(data.user.id)
          return { estado: 'verificado', proceso: procesoActivo }
        },
        (causa: unknown): ResultadoEnlace => {
          registrar('verificarEnlace', causa)
          return {
            estado: 'incierto',
            mensaje: MENSAJES_CONTRASENA.enlaceIncierto,
          }
        },
      )
  },

  /**
   * HU43. Guarda la contraseña de la cuenta del enlace y cierra la sesión
   * de recuperación. Solo cambia la contraseña si la sesión guardada sigue
   * siendo la de esa cuenta. Se puede reintentar sin volver a verificar.
   */
  guardarContrasenaRecuperada(
    proceso: ProcesoRecuperacion,
    nueva: string,
  ): Promise<ResultadoContrasena> {
    const operacion = 'guardarContrasenaRecuperada'
    const perdida = noCambiada(
      MENSAJES_CONTRASENA.sesionRecuperacionPerdida,
      true,
    )
    if (proceso !== procesoActivo) return Promise.resolve(perdida)
    if (sinConexion())
      return Promise.resolve(
        noCambiada(MENSAJES_CONTRASENA.sinEnviarRecuperada),
      )
    return supabase.auth.getSession().then(
      ({ data, error }): ResultadoContrasena | Promise<ResultadoContrasena> => {
        if (error || data.session?.user.id !== proceso.idUsuario) {
          registrar(operacion, error ?? 'sesión distinta de la del enlace')
          procesoActivo = null
          borrarMarca()
          return perdida
        }
        return actualizarContrasena(operacion, nueva).then((resultado) => {
          if (resultado.estado === 'cambiada')
            return cerrarRecuperacion(proceso)
          if (resultado.estado !== 'no-cambiada' || !resultado.pedirEnlace)
            return resultado
          // La sesión de recuperación ya no sirve
          procesoActivo = null
          borrarMarca()
          return cerrarSesion().then(() => perdida)
        })
      },
      (causa: unknown) => {
        registrar(operacion, causa)
        return noCambiada(MENSAJES_CONTRASENA.noCambiada)
      },
    )
  },

  /** HU43. Hay un proceso interrumpido por una recarga en esta pestaña. */
  hayRecuperacionPendiente(): boolean {
    return leerMarca() !== null
  },

  /**
   * HU43. Retoma el proceso después de una recarga, si la sesión guardada
   * sigue siendo la de esa cuenta. No vuelve a verificar: el token ya se
   * consumió. Si no se puede retomar, borra la marca y devuelve null.
   */
  retomarRecuperacion(): Promise<ProcesoRecuperacion | null> {
    const idUsuario = leerMarca()
    if (!idUsuario) return Promise.resolve(null)
    if (procesoActivo?.idUsuario === idUsuario)
      return Promise.resolve(procesoActivo)
    return supabase.auth.getSession().then(
      ({ data }) => {
        if (data.session?.user.id !== idUsuario) {
          borrarMarca()
          return null
        }
        procesoActivo = { idUsuario, tokenAcceso: data.session.access_token }
        return procesoActivo
      },
      (causa: unknown) => {
        registrar('retomarRecuperacion', causa)
        return null
      },
    )
  },

  /**
   * HU43. Cancela el proceso o se salió de la pantalla sin terminar: cierra
   * la sesión de ese proceso. Si ya terminó o si la sesión guardada es otra
   * (por ejemplo, se ingresó después), no toca nada. Si el cierre falla, el
   * proceso sigue abierto para poder reintentarlo.
   */
  abandonarRecuperacion(proceso: ProcesoRecuperacion): Promise<Resultado> {
    if (proceso !== procesoActivo) return Promise.resolve({ ok: true })
    procesoActivo = null
    borrarMarca()
    const noSeCerro = (): Resultado => {
      procesoActivo = proceso
      guardarMarca(proceso.idUsuario)
      return { ok: false, mensaje: MENSAJES_ACCESO.errorCierre }
    }
    return supabase.auth.getSession().then(
      ({ data }): Resultado | Promise<Resultado> => {
        if (data.session?.access_token !== proceso.tokenAcceso)
          return { ok: true }
        return cerrarSesion().then((cierre) =>
          cierre.ok ? cierre : noSeCerro(),
        )
      },
      (causa: unknown) => {
        registrar('abandonarRecuperacion', causa)
        return noSeCerro()
      },
    )
  },

  /**
   * HU44. Valida la contraseña actual con el correo de la sesión y después
   * la cambia. Si algo falla, la sesión queda como estaba.
   */
  cambiarContrasena(
    actual: string,
    nueva: string,
  ): Promise<ResultadoContrasena> {
    const operacion = 'cambiarContrasena'
    if (sinConexion())
      return Promise.resolve(noCambiada(MENSAJES_CONTRASENA.sinEnviarCambio))
    const sinVerificar = (causa: unknown) => {
      registrar(operacion, causa)
      return noCambiada(MENSAJES_CONTRASENA.actualNoVerificada)
    }
    return supabase.auth.getSession().then(({ data, error }) => {
      const usuario = data.session?.user
      if (error || !usuario?.email) {
        registrar(operacion, error ?? 'sin sesión')
        return noCambiada(MENSAJES_CONTRASENA.sesionNoDisponible)
      }
      return reautenticar(usuario.email, actual).then(
        ({ data: verificado, error: errorActual }) => {
          if (errorActual) {
            registrar(operacion, errorActual)
            return noCambiada(mensajeErrorActual(errorActual))
          }
          if (verificado.user?.id !== usuario.id) {
            registrar(operacion, 'usuario distinto al verificar')
            return noCambiada(MENSAJES_CONTRASENA.sesionNoDisponible)
          }
          return actualizarContrasena(operacion, nueva)
        },
        sinVerificar,
      )
    }, sinVerificar)
  },

  /**
   * Avisa cuando la sesión se abre, se cierra o se restaura.
   * Supabase recomienda no llamar a otros métodos de Supabase dentro del
   * callback: quien escucha debe diferir la validación (setTimeout).
   * 'recuperacion' avisa que la sesión guardada pasó a ser la del enlace:
   * quien escucha debe olvidar al usuario anterior, pero la sesión sigue
   * activa porque hace falta para guardar la contraseña.
   */
  escucharCambios(alCambiar: (cambio: CambioSesion) => void) {
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_OUT') {
        // Sin sesión ya no hay nada que retomar, salvo que el cierre falle
        // en un abandono, que vuelve a guardar la marca.
        borrarMarca()
        alCambiar('salio')
      }
      if (evento === 'PASSWORD_RECOVERY') alCambiar('recuperacion')
      if (evento === 'INITIAL_SESSION') alCambiar('entro')
      // Con un proceso abierto o una reautenticación no hay un ingreso nuevo
      if (evento === 'SIGNED_IN' && !reautenticando && !procesoActivo)
        alCambiar('entro')
    })
    return () => {
      data.subscription.unsubscribe()
    }
  },
}

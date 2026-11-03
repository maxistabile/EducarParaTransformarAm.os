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
   * Avisa cuando la sesión se abre, se cierra o se restaura.
   * Supabase recomienda no llamar a otros métodos de Supabase dentro del
   * callback: quien escucha debe diferir la validación (setTimeout).
   */
  escucharCambios(alCambiar: (hayCambio: 'entro' | 'salio') => void) {
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_OUT') alCambiar('salio')
      if (evento === 'SIGNED_IN' || evento === 'INITIAL_SESSION')
        alCambiar('entro')
    })
    return () => {
      data.subscription.unsubscribe()
    }
  },
}

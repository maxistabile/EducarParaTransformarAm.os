// ═══════════════════════════════════════════════════════════════
//  ServicioAuth — patrón Facade (RF10)
// ═══════════════════════════════════════════════════════════════
// Único punto por el que las pantallas de la app usan Supabase Auth y la
// tabla `usuarios`. Las pantallas no consultan tablas directamente.
// Usa la instancia única del cliente (Singleton, src/lib/supabase.ts).
import { supabase } from '../lib/supabase'
import {
  ErrorSesionInvalida,
  MENSAJES_ACCESO,
  resolverSesion,
} from '../app/reglasAuthApp'
import type { EstadoSesion, PerfilUsuario } from '../app/reglasAuthApp'

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

/** Cierra la sesión solo en este dispositivo (HU42). */
async function cerrarSesion(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw error
}

export const ServicioAuth = {
  /**
   * HU41. Solo valida las credenciales: el perfil, el rol y el estado
   * activo los valida `validarSesion`, que corre al cambiar la sesión.
   */
  async iniciarSesion(
    email: string,
    password: string,
  ): Promise<{ ok: true } | { ok: false; mensaje: string }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error || !data.user)
      return { ok: false, mensaje: MENSAJES_ACCESO.credenciales }
    return { ok: true }
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

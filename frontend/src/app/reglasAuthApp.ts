// ═══════════════════════════════════════════════════════════════
//  REGLAS DE ACCESO A LA APP — RF10 (HU41, HU42, HU45)
// ═══════════════════════════════════════════════════════════════
// Lógica pura (sin Supabase) para poder probarla con Vitest.
// ServicioAuth le pasa las funciones reales que leen la sesión y el perfil.

export type RolApp = 'Padre' | 'Alumno'

/** Roles de gestión: usan la web (/admin), no la app. */
export const ROLES_GESTION = ['Admin', 'Directivo', 'Docente']

export interface PerfilUsuario {
  id_usuario: string
  nombre: string | null
  apellido: string | null
  email: string | null
  rol: string | null
  activo: boolean | null
}

export const MENSAJES_ACCESO = {
  credenciales: 'Credenciales incorrectas. Verificá tu email y contraseña.',
  sinPerfil:
    'No encontramos tu perfil en el sistema. Contactá a la institución.',
  inactivo: 'Tu usuario está desactivado. Contactá a la institución.',
  rolDesconocido:
    'Tu usuario no tiene acceso a la app. Contactá a la institución.',
  errorValidacion:
    'No pudimos verificar tu sesión. Revisá tu conexión e intentá de nuevo.',
  sesionVencida: 'Tu sesión venció. Ingresá de nuevo.',
}

/** El servidor rechazó la sesión guardada (token vencido o revocado). */
export class ErrorSesionInvalida extends Error {}

export type Destino =
  | { tipo: 'app'; rol: RolApp }
  | { tipo: 'web' }
  | { tipo: 'rechazado'; mensaje: string }

/**
 * A dónde va un usuario según su fila en `usuarios`.
 * Igual que la web, solo `activo === false` cuenta como desactivado.
 */
export function destinoSegunPerfil(perfil: PerfilUsuario | null): Destino {
  if (!perfil) return { tipo: 'rechazado', mensaje: MENSAJES_ACCESO.sinPerfil }
  if (perfil.activo === false)
    return { tipo: 'rechazado', mensaje: MENSAJES_ACCESO.inactivo }
  if (perfil.rol && ROLES_GESTION.includes(perfil.rol)) return { tipo: 'web' }
  if (perfil.rol === 'Padre' || perfil.rol === 'Alumno')
    return { tipo: 'app', rol: perfil.rol }
  return { tipo: 'rechazado', mensaje: MENSAJES_ACCESO.rolDesconocido }
}

// ── Estado de la sesión en la app ─────────────────────────────
export type EstadoSesion =
  | { estado: 'cargando' }
  | { estado: 'sin-sesion'; aviso: string | null }
  | { estado: 'app'; rol: RolApp; perfil: PerfilUsuario }
  | { estado: 'web' }
  | { estado: 'error'; mensaje: string }

export interface DependenciasSesion {
  /** id del usuario con sesión guardada, o null si no hay sesión. */
  obtenerIdSesion: () => Promise<string | null>
  /**
   * Fila de `usuarios`; null si no existe. Lanza ErrorSesionInvalida si el
   * servidor rechaza la sesión, y cualquier otro error si falla la consulta.
   */
  cargarPerfil: (idUsuario: string) => Promise<PerfilUsuario | null>
  cerrarSesion: () => Promise<void>
}

/**
 * Valida la sesión guardada (al abrir la app o después de iniciar sesión).
 * Las pantallas privadas se habilitan solo con estado 'app'.
 * - Sin perfil, inactivo, rol desconocido o sesión rechazada por el
 *   servidor: se cierra la sesión y se avisa en el ingreso.
 * - Si la consulta falla por otro motivo (por ejemplo, sin conexión), la
 *   sesión no se cierra, pero tampoco se habilita nada: estado 'error'.
 */
export async function resolverSesion(
  deps: DependenciasSesion,
): Promise<EstadoSesion> {
  let idUsuario: string | null
  let perfil: PerfilUsuario | null
  try {
    idUsuario = await deps.obtenerIdSesion()
    if (!idUsuario) return { estado: 'sin-sesion', aviso: null }
    perfil = await deps.cargarPerfil(idUsuario)
  } catch (e) {
    if (e instanceof ErrorSesionInvalida)
      return rechazar(deps, MENSAJES_ACCESO.sesionVencida)
    return { estado: 'error', mensaje: MENSAJES_ACCESO.errorValidacion }
  }

  const destino = destinoSegunPerfil(perfil)
  if (destino.tipo === 'web') return { estado: 'web' }
  if (destino.tipo === 'app' && perfil)
    return { estado: 'app', rol: destino.rol, perfil }
  return rechazar(
    deps,
    destino.tipo === 'rechazado' ? destino.mensaje : MENSAJES_ACCESO.sinPerfil,
  )
}

async function rechazar(
  deps: DependenciasSesion,
  aviso: string,
): Promise<EstadoSesion> {
  try {
    await deps.cerrarSesion()
  } catch {
    // Aunque falle el cierre remoto, no se habilitan las pantallas privadas
  }
  return { estado: 'sin-sesion', aviso }
}

// ── Menú por rol (HU45) ───────────────────────────────────────
export type Seccion = 'inicio' | 'cuotas' | 'pagos' | 'inscripciones' | 'perfil'

const SECCIONES_POR_ROL: Record<RolApp, Seccion[]> = {
  // El padre ve cuotas, pagos e inscripciones de sus hijos
  Padre: ['inicio', 'cuotas', 'pagos', 'inscripciones', 'perfil'],
  // El alumno ve solo sus inscripciones (no ve pagos)
  Alumno: ['inicio', 'inscripciones', 'perfil'],
}

export function seccionesSegunRol(rol: RolApp): Seccion[] {
  return SECCIONES_POR_ROL[rol]
}

export function puedeVerSeccion(rol: RolApp, seccion: Seccion): boolean {
  return SECCIONES_POR_ROL[rol].includes(seccion)
}

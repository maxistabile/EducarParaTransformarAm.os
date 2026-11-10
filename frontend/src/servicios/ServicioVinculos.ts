// ═══════════════════════════════════════════════════════════════
//  ServicioVinculos — patrón Facade (HU7, HU11, HU20 y acceso de HU41)
// ═══════════════════════════════════════════════════════════════
// Único punto por el que las pantallas de Usuarios, Alumnos y Docentes
// consultan y cambian los vínculos entre cuentas y legajos. Usa la
// instancia única del cliente (Singleton, src/lib/supabase.ts).
//
// - Las lecturas se hacen al abrir los vínculos de UN registro (no por fila).
// - Los cambios pasan por las funciones de etapa23, que comprueban en la
//   base quién opera (Admin o Directivo) y el rol de cada cuenta.
// - Las cuentas nuevas se crean con la Edge Function crear-usuario, que
//   valida la sesión y el rol del operador, guarda el perfil y deshace un
//   alta incompleta; antes se busca el correo para no duplicar la cuenta
//   ante un reintento ni tocar una cuenta existente.
// - Nunca se leen ni se muestran contraseñas.
// No rechaza: devuelve el dato o el mensaje para mostrar.
import { supabase } from '../lib/supabase'
import { resumenError } from '../app/reglasContrasena'
import { mensajeErrorAlta, mensajeErrorVinculo, planCuentaNueva } from '../reglasVinculos'
import type { RolCuenta, UsuarioBasico } from '../reglasVinculos'

export type Resultado<T> = { ok: true; dato: T } | { ok: false; mensaje: string }

export interface LegajoAlumno {
  id_alumno: number
  nombre: string
  apellido: string
  dni: string | null
  legajo: string | null
}

export interface LegajoDocente {
  id_docente: number
  dni: string | null
  legajo: string | null
  especialidad: string | null
}

export interface DatosLegajoAlumno {
  nombre: string
  apellido: string
  dni: string
  fecha_nacimiento: string
  id_curso: string
  obra_social?: string
  direccion?: string
  telefono?: string
  email?: string
}

export interface DatosCuenta {
  email: string
  password: string
  nombre: string
  apellido: string
  rol: string
  telefono?: string
  docente?: { dni: string; especialidad: string; titulo?: string }
}

export type Vinculos =
  | { tipo: 'Padre'; hijos: LegajoAlumno[] }
  | { tipo: 'Alumno'; legajo: LegajoAlumno | null }
  | { tipo: 'Docente'; legajo: LegajoDocente | null }
  | { tipo: 'Gestion' }

const COLUMNAS_USUARIO = 'id_usuario, nombre, apellido, email, rol, activo'
const COLUMNAS_LEGAJO = 'id_alumno, nombre, apellido, dni, legajo'

function fallo<T>(operacion: string, causa: unknown, mensaje?: string): Resultado<T> {
  const { code, status } = resumenError(causa)
  console.error(`[ServicioVinculos] ${operacion}:`, { code, status })
  return { ok: false, mensaje: mensaje ?? mensajeErrorVinculo(causa as { code?: string; message?: string }) }
}

function rpc(operacion: string, fn: string, args: Record<string, unknown>): Promise<Resultado<Record<string, unknown>>> {
  return Promise.resolve(supabase.rpc(fn, args)).then(
    ({ data, error }) =>
      error ? fallo<Record<string, unknown>>(operacion, error) : { ok: true as const, dato: (data ?? {}) as Record<string, unknown> },
    (error: unknown) => fallo<Record<string, unknown>>(operacion, error, 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.'),
  )
}

const ERROR_RED = 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.'

/** Código y estado de reversión que devuelve crear-usuario en un error HTTP. */
async function cuerpoDeError(error: unknown): Promise<{ codigo?: string; revertido?: boolean }> {
  const contexto = typeof error === 'object' && error !== null ? (error as { context?: unknown }).context : undefined
  if (!(contexto instanceof Response)) return {}
  try {
    const cuerpo = (await contexto.clone().json()) as { codigo?: unknown; revertido?: unknown }
    return {
      codigo: typeof cuerpo.codigo === 'string' ? cuerpo.codigo : undefined,
      revertido: typeof cuerpo.revertido === 'boolean' ? cuerpo.revertido : undefined,
    }
  } catch {
    return { codigo: contexto.status === 401 ? 'USR_SIN_SESION' : undefined }
  }
}

async function buscarPorCorreo(email: string): Promise<{ usuario: UsuarioBasico | null; error: unknown }> {
  const { data, error } = await supabase
    .from('usuarios')
    .select(COLUMNAS_USUARIO)
    .eq('email', email.trim())
    .maybeSingle()
  return { usuario: (data as UsuarioBasico | null) ?? null, error }
}

async function tieneLegajo(rol: RolCuenta, idUsuario: string): Promise<{ ocupada: boolean; error: unknown }> {
  if (rol === 'Padre') return { ocupada: false, error: null }
  const tabla = rol === 'Alumno' ? 'alumnos' : 'docentes'
  const { data, error } = await supabase.from(tabla).select('id_usuario').eq('id_usuario', idUsuario).limit(1)
  return { ocupada: Array.isArray(data) && data.length > 0, error }
}

export const ServicioVinculos = {
  /** Tutor y cuenta propia de un alumno (una sola consulta, al abrir sus vínculos). */
  async vinculosAlumno(a: {
    id_usuario?: string | null
    id_usuario_padre?: string | null
  }): Promise<Resultado<{ tutor: UsuarioBasico | null; cuenta: UsuarioBasico | null }>> {
    const ids = [a.id_usuario, a.id_usuario_padre].filter((x): x is string => Boolean(x))
    if (ids.length === 0) return { ok: true, dato: { tutor: null, cuenta: null } }
    try {
      const { data, error } = await supabase.from('usuarios').select(COLUMNAS_USUARIO).in('id_usuario', ids)
      if (error) return fallo('vinculosAlumno', error, 'No se pudieron leer los vínculos del alumno.')
      const filas = (data ?? []) as UsuarioBasico[]
      return {
        ok: true,
        dato: {
          tutor: filas.find((u) => u.id_usuario === a.id_usuario_padre) ?? null,
          cuenta: filas.find((u) => u.id_usuario === a.id_usuario) ?? null,
        },
      }
    } catch (error) {
      return fallo('vinculosAlumno', error, ERROR_RED)
    }
  },

  /** Hijos (Padre) o legajo (Alumno y Docente) de una cuenta. */
  async vinculosUsuario(u: { id_usuario: string; rol: string }): Promise<Resultado<Vinculos>> {
    try {
      if (u.rol === 'Padre') {
        const { data, error } = await supabase
          .from('alumnos').select(COLUMNAS_LEGAJO).eq('id_usuario_padre', u.id_usuario).order('apellido')
        if (error) return fallo('vinculosUsuario', error, 'No se pudieron leer los hijos asociados.')
        return { ok: true, dato: { tipo: 'Padre', hijos: (data ?? []) as LegajoAlumno[] } }
      }
      if (u.rol === 'Alumno') {
        const { data, error } = await supabase
          .from('alumnos').select(COLUMNAS_LEGAJO).eq('id_usuario', u.id_usuario).maybeSingle()
        if (error) return fallo('vinculosUsuario', error, 'No se pudo leer el legajo.')
        return { ok: true, dato: { tipo: 'Alumno', legajo: (data as LegajoAlumno | null) ?? null } }
      }
      if (u.rol === 'Docente') {
        const { data, error } = await supabase
          .from('docentes').select('id_docente, dni, legajo, especialidad').eq('id_usuario', u.id_usuario).maybeSingle()
        if (error) return fallo('vinculosUsuario', error, 'No se pudo leer el legajo.')
        return { ok: true, dato: { tipo: 'Docente', legajo: (data as LegajoDocente | null) ?? null } }
      }
      return { ok: true, dato: { tipo: 'Gestion' } }
    } catch (error) {
      return fallo('vinculosUsuario', error, ERROR_RED)
    }
  },

  /** Cuentas de un rol (para elegir un tutor o una cuenta disponible). */
  async usuariosPorRol(rol: RolCuenta): Promise<Resultado<UsuarioBasico[]>> {
    try {
      const { data, error } = await supabase.from('usuarios').select(COLUMNAS_USUARIO).eq('rol', rol).order('apellido')
      if (error) return fallo('usuariosPorRol', error, 'No se pudieron leer las cuentas.')
      return { ok: true, dato: (data ?? []) as UsuarioBasico[] }
    } catch (error) {
      return fallo('usuariosPorRol', error, ERROR_RED)
    }
  },

  /** Ids de las cuentas que ya tienen legajo (alumnos o docentes). */
  async cuentasConLegajo(tabla: 'alumnos' | 'docentes'): Promise<Resultado<Set<string>>> {
    try {
      const { data, error } = await supabase.from(tabla).select('id_usuario').not('id_usuario', 'is', null)
      if (error) return fallo('cuentasConLegajo', error, 'No se pudieron leer los legajos.')
      return { ok: true, dato: new Set(((data ?? []) as Array<{ id_usuario: string }>).map((f) => f.id_usuario)) }
    } catch (error) {
      return fallo('cuentasConLegajo', error, ERROR_RED)
    }
  },

  /** Legajos de alumnos sin cuenta de acceso. */
  async alumnosSinCuenta(): Promise<Resultado<LegajoAlumno[]>> {
    try {
      const { data, error } = await supabase
        .from('alumnos').select(COLUMNAS_LEGAJO).is('id_usuario', null).order('apellido')
      if (error) return fallo('alumnosSinCuenta', error, 'No se pudieron leer los legajos.')
      return { ok: true, dato: (data ?? []) as LegajoAlumno[] }
    } catch (error) {
      return fallo('alumnosSinCuenta', error, ERROR_RED)
    }
  },

  /** Legajos de docentes sin cuenta de acceso. */
  async docentesSinCuenta(): Promise<Resultado<LegajoDocente[]>> {
    try {
      const { data, error } = await supabase
        .from('docentes').select('id_docente, dni, legajo, especialidad').is('id_usuario', null).order('id_docente')
      if (error) return fallo('docentesSinCuenta', error, 'No se pudieron leer los legajos.')
      return { ok: true, dato: (data ?? []) as LegajoDocente[] }
    } catch (error) {
      return fallo('docentesSinCuenta', error, ERROR_RED)
    }
  },

  vincularTutor(idAlumno: number, idPadre: string, reemplazar: boolean) {
    return rpc('vincularTutor', 'fn_vincular_tutor', { p_id_alumno: idAlumno, p_id_padre: idPadre, p_reemplazar: reemplazar })
  },

  vincularCuentaAlumno(idAlumno: number, idUsuario: string) {
    return rpc('vincularCuentaAlumno', 'fn_vincular_cuenta_alumno', { p_id_alumno: idAlumno, p_id_usuario: idUsuario })
  },

  vincularCuentaDocente(idDocente: number, idUsuario: string) {
    return rpc('vincularCuentaDocente', 'fn_vincular_cuenta_docente', { p_id_docente: idDocente, p_id_usuario: idUsuario })
  },

  /** Alta del legajo con su cuenta y su tutor opcionales (sin duplicar ante un reintento). */
  async crearLegajoAlumno(
    datos: DatosLegajoAlumno,
    idUsuario: string | null,
    idPadre: string | null,
  ): Promise<Resultado<{ id_alumno: number; legajo: string | null; existente: boolean }>> {
    const r = await rpc('crearLegajoAlumno', 'fn_crear_legajo_alumno', {
      p_datos: datos, p_id_usuario: idUsuario, p_id_padre: idPadre,
    })
    if (!r.ok) return r
    return {
      ok: true,
      dato: {
        id_alumno: Number(r.dato.id_alumno),
        legajo: typeof r.dato.legajo === 'string' ? r.dato.legajo : null,
        existente: r.dato.existente === true,
      },
    }
  },

  /**
   * Alta directa con crear-usuario (Usuarios → Nuevo usuario). La función
   * valida al operador, guarda el perfil y, si se mandan, los datos del
   * docente; ante un fallo deshace lo que creó. Devuelve el id nuevo.
   */
  async altaCuenta(datos: DatosCuenta): Promise<Resultado<{ id_usuario: string }>> {
    try {
      const { data, error } = await supabase.functions.invoke('crear-usuario', {
        body: { ...datos, email: datos.email.trim(), nombre: datos.nombre.trim(), apellido: datos.apellido.trim() },
      })
      if (error) {
        const { codigo, revertido } = await cuerpoDeError(error)
        console.error('[ServicioVinculos] altaCuenta:', { codigo, revertido })
        return { ok: false, mensaje: mensajeErrorAlta(codigo, revertido) }
      }
      const id = (data as { id_usuario?: unknown } | null)?.id_usuario
      if (typeof id !== 'string') return { ok: false, mensaje: mensajeErrorAlta('USR_ALTA_FALLIDA') }
      return { ok: true, dato: { id_usuario: id } }
    } catch (error) {
      return fallo('altaCuenta', error, ERROR_RED)
    }
  },

  /**
   * Crea una cuenta con crear-usuario, o devuelve la que ya existe con ese
   * correo si es del mismo rol y no tiene legajo (reintento). Nunca cambia
   * los datos ni las credenciales de una cuenta existente.
   */
  async crearCuenta(c: {
    email: string
    password: string
    nombre: string
    apellido: string
    rol: RolCuenta
  }): Promise<Resultado<{ id_usuario: string; existente: boolean }>> {
    try {
      const previa = await buscarPorCorreo(c.email)
      if (previa.error) return fallo('crearCuenta', previa.error, 'No se pudo comprobar si el correo ya existe.')
      const legajo = previa.usuario ? await tieneLegajo(c.rol, previa.usuario.id_usuario) : { ocupada: false, error: null }
      if (legajo.error) return fallo('crearCuenta', legajo.error, 'No se pudo comprobar si la cuenta ya tiene legajo.')
      const plan = planCuentaNueva(previa.usuario, c.rol, legajo.ocupada)
      if (plan.accion === 'error') return { ok: false, mensaje: plan.mensaje }
      if (plan.accion === 'vincular') return { ok: true, dato: { id_usuario: plan.usuario.id_usuario, existente: true } }

      // crear-usuario guarda nombre, apellido y rol, o deshace el alta
      const alta = await ServicioVinculos.altaCuenta(c)
      if (!alta.ok) return alta
      return { ok: true, dato: { id_usuario: alta.dato.id_usuario, existente: false } }
    } catch (error) {
      return fallo('crearCuenta', error, ERROR_RED)
    }
  },
}

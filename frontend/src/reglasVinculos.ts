// ═══════════════════════════════════════════════════════════════
//  Reglas de altas y vínculos de cuentas y legajos
//  (HU7, HU11, HU20 y acceso de HU41)
// ═══════════════════════════════════════════════════════════════
// Lógica pura (sin base), como reportes.ts: la usan las pantallas de
// Usuarios, Alumnos y Docentes y se prueba con Vitest. Los controles
// definitivos (rol de quien opera, rol de la cuenta, una cuenta por
// legajo) están en la base: etapa23_vinculos_cuentas.sql.
import { RX_EMAIL } from './validacionesAlumno'

export const ESTADO_VINCULO = {
  sinTutor: 'Sin tutor asociado',
  sinCuenta: 'Sin cuenta de acceso',
  sinLegajo: 'Sin legajo vinculado',
} as const

/** Mínimo para las contraseñas que se cargan en estas altas (igual que la app). */
export const LARGO_MINIMO_CONTRASENA = 8

export interface UsuarioBasico {
  id_usuario: string
  nombre: string | null
  apellido: string | null
  email: string | null
  rol: string | null
  activo: boolean | null
}

export type RolCuenta = 'Alumno' | 'Padre' | 'Docente'

/** "Apellido, Nombre" o, si faltan, el correo. */
export function nombreUsuario(u: Pick<UsuarioBasico, 'nombre' | 'apellido' | 'email'>): string {
  const nombre = [u.apellido, u.nombre].filter((x) => x && x.trim()).join(', ')
  return nombre || u.email || 'Sin nombre'
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * Tutores activos que coinciden con el texto (correo, nombre o apellido).
 * No elige ninguno: la pantalla muestra la lista y quien opera confirma
 * cuál (una coincidencia ambigua nunca se vincula sola).
 */
export function buscarTutores(usuarios: readonly UsuarioBasico[], texto: string, maximo = 8): UsuarioBasico[] {
  const t = normalizar(texto)
  if (t.length < 2) return []
  return usuarios
    .filter((u) => u.rol === 'Padre' && u.activo !== false)
    .filter((u) => [u.email, u.nombre, u.apellido].some((c) => c && normalizar(c).includes(t)))
    .slice(0, maximo)
}

/** Cuentas de un rol que todavía no tienen legajo. */
export function cuentasDisponibles(
  usuarios: readonly UsuarioBasico[],
  rol: 'Alumno' | 'Docente',
  ocupadas: ReadonlySet<string>,
): UsuarioBasico[] {
  return usuarios.filter((u) => u.rol === rol && !ocupadas.has(u.id_usuario))
}

export type PlanCuenta =
  | { accion: 'crear' }
  | { accion: 'vincular'; usuario: UsuarioBasico }
  | { accion: 'error'; mensaje: string }

/**
 * Qué hacer con el correo de una cuenta nueva. Si ya hay una cuenta con ese
 * correo, NO se crea otra ni se cambian sus datos o credenciales:
 *  - del mismo rol y sin legajo (por ejemplo, un intento anterior que no
 *    terminó): se vincula esa;
 *  - de otro rol, ya vinculada, o un tutor existente: se informa.
 */
export function planCuentaNueva(
  existente: UsuarioBasico | null,
  rolEsperado: RolCuenta,
  ocupada: boolean,
): PlanCuenta {
  if (!existente) return { accion: 'crear' }
  if (existente.rol !== rolEsperado)
    return {
      accion: 'error',
      mensaje: `Ya existe una cuenta con ese correo y rol ${existente.rol ?? 'sin rol'}. No se modifica: usá otro correo.`,
    }
  if (rolEsperado === 'Padre')
    return {
      accion: 'error',
      mensaje: 'Ya existe un tutor con ese correo. Elegilo como tutor existente: no se crea otro ni se cambian sus datos.',
    }
  if (ocupada)
    return { accion: 'error', mensaje: 'Ya existe una cuenta con ese correo y está vinculada a otro legajo.' }
  return { accion: 'vincular', usuario: existente }
}

export function validarCuentaNueva(c: { email: string; password: string }): string | null {
  if (!RX_EMAIL.test(c.email.trim())) return 'Ingresá un correo válido para la cuenta.'
  if (c.password.length < LARGO_MINIMO_CONTRASENA)
    return `La contraseña inicial debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`
  return null
}

/** Correo de acceso que ya usa el sistema para los alumnos (DNI@alumno.local). */
export function correoSugeridoAlumno(dni: string): string {
  const d = dni.trim()
  return /^\d{7,9}$/.test(d) ? `${d}@alumno.local` : ''
}

/** Pregunta de confirmación si se reemplaza el tutor actual; null si no hace falta. */
export function confirmacionReemplazoTutor(
  actual: UsuarioBasico | null,
  nuevo: UsuarioBasico,
): string | null {
  if (!actual || actual.id_usuario === nuevo.id_usuario) return null
  return `El alumno ya tiene como tutor a ${nombreUsuario(actual)}. ¿Reemplazarlo por ${nombreUsuario(nuevo)}?`
}

/** Vínculos que le faltan a un legajo de alumno (para mostrarlos por separado). */
export function faltantesAlumno(a: { id_usuario?: string | null; id_usuario_padre?: string | null }): string[] {
  const faltan: string[] = []
  if (!a.id_usuario_padre) faltan.push(ESTADO_VINCULO.sinTutor)
  if (!a.id_usuario) faltan.push(ESTADO_VINCULO.sinCuenta)
  return faltan
}

const MENSAJES_VINCULO: ReadonlyMap<string, string> = new Map([
  ['VIN_SIN_PERMISO', 'Solo Admin o Directivo pueden hacer esta operación.'],
  ['VIN_ROL_INVALIDO', 'La cuenta elegida no tiene el rol que corresponde.'],
  ['VIN_ALUMNO_INEXISTENTE', 'El alumno ya no existe. Recargá la lista.'],
  ['VIN_DOCENTE_INEXISTENTE', 'El docente ya no existe. Recargá la lista.'],
  ['VIN_TUTOR_EXISTENTE', 'El alumno ya tiene otro tutor: confirmá el reemplazo.'],
  ['VIN_ALUMNO_CON_CUENTA', 'El alumno ya tiene una cuenta de acceso.'],
  ['VIN_DOCENTE_CON_CUENTA', 'El docente ya tiene una cuenta de acceso.'],
  ['VIN_CUENTA_OCUPADA', 'Esa cuenta ya está vinculada a otro legajo.'],
  ['VIN_DNI_EXISTENTE', 'Ya existe un legajo con ese DNI. Vinculá ese legajo en lugar de crear otro.'],
  ['VIN_DATOS_INCOMPLETOS', 'Faltan datos del legajo: nombre, apellido, DNI, fecha de nacimiento y curso.'],
])

const MENSAJES_ALTA: ReadonlyMap<string, string> = new Map([
  ['USR_SIN_SESION', 'Tu sesión venció. Ingresá de nuevo.'],
  ['USR_SIN_PERMISO', 'Solo Admin o Directivo activos pueden crear cuentas.'],
  ['USR_ROL_NO_PERMITIDO', 'No podés crear cuentas con ese rol (las cuentas Admin y Directivo las crea un Admin).'],
  ['USR_DATOS_INVALIDOS', 'Revisá los datos de la cuenta: correo, contraseña (6 a 72 caracteres), nombre, apellido y rol.'],
  ['USR_CORREO_EXISTE', 'Ya existe una cuenta con ese correo. No se modificó: elegila o usá otro correo.'],
  ['USR_DNI_DOCENTE_EXISTE', 'Ya existe un docente con ese DNI. Vinculale la cuenta desde Docentes en lugar de crear otro.'],
  ['USR_PERFIL_FALLIDO', 'No se pudo guardar el perfil de la cuenta. Se deshizo el alta: intentá de nuevo.'],
  ['USR_DOCENTE_FALLIDO', 'No se pudo registrar el docente. Se deshizo el alta: intentá de nuevo.'],
  ['USR_ALTA_FALLIDA', 'No se pudo crear la cuenta. Intentá de nuevo.'],
])

/** Mensaje para el código que devuelve crear-usuario (o el de red). */
export function mensajeErrorAlta(codigo: string | null | undefined, revertido?: boolean): string {
  const base = MENSAJES_ALTA.get(codigo ?? '') ?? 'No se pudo crear la cuenta. Intentá de nuevo.'
  return revertido === false ? `${base} Atención: el alta no se pudo deshacer por completo; revisá la cuenta en Usuarios.` : base
}

/** Traduce el error de la base (código antes del "|") a un mensaje claro. */
export function mensajeErrorVinculo(error: { code?: string; message?: string } | null | undefined): string {
  if (error?.code === 'PGRST202' || error?.code === '42883')
    return 'Falta ejecutar etapa23_vinculos_cuentas.sql en la base. Avisá al equipo.'
  const codigo = (error?.message ?? '').split('|')[0].trim()
  return MENSAJES_VINCULO.get(codigo) ?? 'No se pudo completar la operación. Intentá de nuevo.'
}

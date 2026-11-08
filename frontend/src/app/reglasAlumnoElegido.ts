// ═══════════════════════════════════════════════════════════════
//  ALUMNO ELEGIDO EN LA APP (HU59; lo reutilizan HU51 a HU53)
// ═══════════════════════════════════════════════════════════════
// Lógica pura para poder probarla con Vitest. El padre elige uno de sus
// hijos; el alumno solo se tiene a sí mismo. Solo se acepta un alumno de
// la lista obtenida para la sesión actual.

export interface AlumnoApp {
  id_alumno: number
  nombre: string
  apellido: string
  curso: string | null
}

/** Prefijo de las selecciones guardadas en sessionStorage. */
export const PREFIJO_SELECCION = 'app.alumnoElegido.'

/** La clave incluye el usuario: otra cuenta no reutiliza la selección. */
export function claveSeleccion(idUsuario: string): string {
  return `${PREFIJO_SELECCION}${idUsuario}`
}

/** Texto guardado → id de alumno, o null si no es un entero positivo. */
export function leerIdGuardado(texto: string | null): number | null {
  if (texto === null || !/^\d+$/.test(texto)) return null
  const id = Number(texto)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/**
 * Alumno a mostrar: el guardado solo si está en la lista de la sesión
 * actual; si no, el primero. Sin alumnos, ninguno.
 */
export function resolverElegido(
  lista: readonly AlumnoApp[],
  idGuardado: number | null,
): number | null {
  if (lista.length === 0) return null
  if (idGuardado !== null && lista.some((a) => a.id_alumno === idGuardado))
    return idGuardado
  return lista[0].id_alumno
}

/**
 * Una respuesta solo se muestra si corresponde a la misma cuenta y al
 * mismo alumno que están elegidos ahora (descarta respuestas atrasadas).
 */
export function esRespuestaVigente(
  respuesta: { cuenta: string; idAlumno: number },
  actual: { cuenta: string | null; idAlumno: number | null },
): boolean {
  return respuesta.cuenta === actual.cuenta && respuesta.idAlumno === actual.idAlumno
}

export function nombreAlumno(a: Pick<AlumnoApp, 'nombre' | 'apellido'>): string {
  return [a.nombre, a.apellido].filter(Boolean).join(' ')
}

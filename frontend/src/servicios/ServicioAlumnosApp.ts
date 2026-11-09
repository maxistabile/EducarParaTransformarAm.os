// ═══════════════════════════════════════════════════════════════
//  ServicioAlumnosApp — patrón Facade (HU59; base de HU51 a HU53)
// ═══════════════════════════════════════════════════════════════
// Único punto por el que la app obtiene los alumnos de la sesión: los
// hijos del padre (alumnos.id_usuario_padre) o el propio alumno
// (alumnos.id_usuario), igual que el portal web. El usuario sale siempre
// de la sesión validada, nunca de la URL.
// Limitación aceptada (CLAUDE.md 3.1): sin RLS, este filtro no impide
// consultas directas a la API.
import { supabase } from '../lib/supabase'
import { resumenError } from '../app/reglasContrasena'
import { textoCurso } from '../reglasServicios'
import type { RolApp } from '../app/reglasAuthApp'
import type { AlumnoApp } from '../app/reglasAlumnoElegido'

export type ResultadoAlumnos = { ok: true; alumnos: AlumnoApp[] } | { ok: false; mensaje: string }

export const MENSAJE_ERROR_ALUMNOS =
  'No pudimos cargar los alumnos de tu cuenta. Revisá tu conexión e intentá de nuevo.'

function fallo(causa: unknown): { ok: false; mensaje: string } {
  const { code, status } = resumenError(causa)
  console.error('[ServicioAlumnosApp] misAlumnos:', { code, status })
  return { ok: false, mensaje: MENSAJE_ERROR_ALUMNOS }
}

interface FilaAlumno {
  id_alumno: number
  nombre: string | null
  apellido: string | null
  cursos: { nivel: string; grado_anio: string; division: string } | null
}

export const ServicioAlumnosApp = {
  /** Hijos del padre o el propio alumno, ordenados por apellido y nombre. */
  misAlumnos(idUsuario: string, rol: RolApp): Promise<ResultadoAlumnos> {
    const columna = rol === 'Padre' ? 'id_usuario_padre' : 'id_usuario'
    return Promise.resolve(
      supabase
        .from('alumnos')
        .select('id_alumno, nombre, apellido, cursos(nivel, grado_anio, division)')
        .eq(columna, idUsuario)
        .order('apellido')
        .order('nombre'),
    ).then(
      ({ data, error }): ResultadoAlumnos => {
        if (error) return fallo(error)
        return {
          ok: true,
          alumnos: ((data ?? []) as unknown as FilaAlumno[]).map((a) => ({
            id_alumno: Number(a.id_alumno),
            nombre: a.nombre ?? '',
            apellido: a.apellido ?? '',
            curso: a.cursos ? textoCurso(a.cursos) : null,
          })),
        }
      },
      (causa: unknown) => fallo(causa),
    )
  },
}

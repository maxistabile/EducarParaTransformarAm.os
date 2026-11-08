// ═══════════════════════════════════════════════════════════════
//  ServicioInscripciones — patrón Facade (RF13.3, HU59)
// ═══════════════════════════════════════════════════════════════
// Consulta de solo lectura de las inscripciones activas de un alumno:
// deportes (con horario y profesor), transporte y comedor. Usa las mismas
// tablas y reglas que la web (etapa14): una inscripción activa tiene
// activo = true; una baja queda inactiva con su fecha_baja.
// Solo consulta alumnos que la sesión tiene permitidos (los que devolvió
// ServicioAlumnosApp); un id ajeno da error sin consultar.
import { supabase } from '../lib/supabase'
import { resumenError } from '../app/reglasContrasena'
import { textoHorario } from '../reglasServicios'

export interface DeporteInscripto {
  id_inscripcion: number
  deporte: string
  nivel: string
  horario: string
  profesor: string | null
  desde: string // fecha_alta (timestamptz)
}

export interface InscripcionesAlumno {
  deportes: DeporteInscripto[]
  transporte: { recorrido: string; descripcion: string | null; desde: string } | null
  comedor: { desde: string } | null
}

export type ResultadoInscripciones =
  | { ok: true; inscripciones: InscripcionesAlumno }
  | { ok: false; mensaje: string }

export const MENSAJES_INSCRIPCIONES = {
  ajeno: 'No tenés acceso a las inscripciones de ese alumno.',
  error: 'No pudimos cargar las inscripciones. Revisá tu conexión e intentá de nuevo.',
}

function fallo(causa: unknown): { ok: false; mensaje: string } {
  const { code, status } = resumenError(causa)
  console.error('[ServicioInscripciones] deAlumno:', { code, status })
  return { ok: false, mensaje: MENSAJES_INSCRIPCIONES.error }
}

type Persona = { nombre: string | null; apellido: string | null } | null

interface FilaDeporte {
  id_inscripcion_dep: number
  fecha_alta: string
  grupos_deportivos: {
    nivel: string
    dias: string[]
    hora_inicio: string
    hora_fin: string
    actividades_extracurriculares: { nombre: string } | null
    docentes: { usuarios: Persona } | null
  } | null
}

interface FilaTransporte {
  fecha_alta: string
  recorridos: { numero: number; nombre: string; descripcion: string | null } | null
}

const nombrePersona = (p: Persona) =>
  p ? [p.nombre, p.apellido].filter(Boolean).join(' ') || null : null

function aDeporte(f: FilaDeporte): DeporteInscripto {
  const g = f.grupos_deportivos
  return {
    id_inscripcion: f.id_inscripcion_dep,
    deporte: g?.actividades_extracurriculares?.nombre ?? 'Deporte',
    nivel: g?.nivel ?? '',
    horario: g ? textoHorario(g) : '',
    profesor: nombrePersona(g?.docentes?.usuarios ?? null),
    desde: f.fecha_alta,
  }
}

export const ServicioInscripciones = {
  /** Inscripciones activas de un alumno permitido para la sesión. */
  deAlumno(
    idAlumno: number,
    permitidos: readonly number[],
  ): Promise<ResultadoInscripciones> {
    if (!permitidos.includes(idAlumno))
      return Promise.resolve({ ok: false, mensaje: MENSAJES_INSCRIPCIONES.ajeno })

    return Promise.all([
      supabase
        .from('inscripciones_deportivas')
        .select(
          'id_inscripcion_dep, fecha_alta, grupos_deportivos(nivel, dias, hora_inicio, hora_fin, actividades_extracurriculares(nombre), docentes(usuarios(nombre, apellido)))',
        )
        .eq('id_alumno', idAlumno)
        .eq('activo', true)
        .order('fecha_alta'),
      supabase
        .from('inscripciones_transporte')
        .select('fecha_alta, recorridos(numero, nombre, descripcion)')
        .eq('id_alumno', idAlumno)
        .eq('activo', true)
        .maybeSingle(),
      supabase
        .from('inscripciones_comedor')
        .select('fecha_alta')
        .eq('id_alumno', idAlumno)
        .eq('activo', true)
        .maybeSingle(),
    ]).then(
      ([dep, tra, com]): ResultadoInscripciones => {
        const error = dep.error ?? tra.error ?? com.error
        if (error) return fallo(error)
        const deportes = ((dep.data ?? []) as unknown as FilaDeporte[])
          .map(aDeporte)
          .sort((a, b) => a.deporte.localeCompare(b.deporte))
        const t = tra.data as unknown as FilaTransporte | null
        const c = com.data as unknown as { fecha_alta: string } | null
        return {
          ok: true,
          inscripciones: {
            deportes,
            transporte: t
              ? {
                  recorrido: t.recorridos
                    ? `Recorrido ${t.recorridos.numero} — ${t.recorridos.nombre}`
                    : 'Transporte',
                  descripcion: t.recorridos?.descripcion ?? null,
                  desde: t.fecha_alta,
                }
              : null,
            comedor: c ? { desde: c.fecha_alta } : null,
          },
        }
      },
      (causa: unknown) => fallo(causa),
    )
  },
}

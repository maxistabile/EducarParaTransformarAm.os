// ═══════════════════════════════════════════════════════════════
//  TP METODOLOGÍA II · RF7 / RF8 — Consultas y reportes de la Dirección
//  Funciones puras: reciben los datos ya cargados y arman cada reporte.
//  No consultan la base, por eso se pueden probar de forma aislada.
// ═══════════════════════════════════════════════════════════════
import { DIAS_DEPORTE, textoHorario } from './reglasServicios'

type Persona = { nombre: string; apellido: string } | null
type CursoBase = { nivel: string; grado_anio: string; division: string }

export interface CursoR extends CursoBase {
  id_curso: number
}
export interface AlumnoR {
  id_alumno: number
  legajo: string | null
  nombre: string
  apellido: string
  id_curso: number | null
  cursos: CursoBase | null
}
export interface AsignacionR {
  id_asignacion: number
  id_docente: number | null
  id_materia: number | null
  id_curso: number | null
  materias: { nombre: string } | null
  docentes: { usuarios: Persona } | null
  cursos: CursoBase | null
}
export interface HorarioR {
  id_asignacion: number | null
  dia_semana: string
  hora_inicio: string
  hora_fin: string
}
export interface DocenteR {
  id_docente: number
  usuarios: Persona
}
export interface MateriaR {
  id_materia: number
  nombre: string
}
export interface GrupoR {
  id_grupo: number
  id_actividad: number
  nivel: string
  id_docente: number
  dias: string[]
  hora_inicio: string
  hora_fin: string
  actividades_extracurriculares: { nombre: string } | null
  docentes: { usuarios: Persona } | null
}
export interface RecorridoR {
  id_recorrido: number
  numero: number
  nombre: string
}
export interface DatosReportes {
  alumnos: AlumnoR[]
  cursos: CursoR[]
  materias: MateriaR[]
  asignaciones: AsignacionR[]
  horarios: HorarioR[]
  docentes: DocenteR[]
  grupos: GrupoR[]
  inscDeportivas: { id_alumno: number; id_grupo: number }[]
  transporte: { id_alumno: number; id_recorrido: number }[]
  recorridos: RecorridoR[]
}

export type TipoReporte =
  | 'docente'
  | 'curso'
  | 'materia'
  | 'docentes_nivel'
  | 'deporte'
  | 'recorrido'

export interface FiltrosReporte {
  id_docente?: string
  id_curso?: string
  id_materia?: string
  nivel?: string
  id_actividad?: string
  id_grupo?: string
  id_recorrido?: string
}

export interface TablaReporte {
  columnas: string[]
  filas: string[][]
}

const NIVELES = ['Inicial', 'Primario', 'Secundario']
const cmp = (a: string, b: string) =>
  a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
const ordenNivel = (n: string) => {
  const i = NIVELES.indexOf(n)
  return i === -1 ? 99 : i
}

export const nombrePersona = (p: Persona | undefined) =>
  p ? `${p.apellido}, ${p.nombre}` : '—'
export const textoCursoCorto = (c: CursoBase | null | undefined) =>
  c ? `${c.grado_anio} "${c.division}"` : '—'
export const compararCursos = (
  a: CursoBase | null | undefined,
  b: CursoBase | null | undefined,
) =>
  ordenNivel(a?.nivel ?? '') - ordenNivel(b?.nivel ?? '') ||
  cmp(a?.grado_anio ?? '', b?.grado_anio ?? '') ||
  cmp(a?.division ?? '', b?.division ?? '')
const compararAlumnos = (a: AlumnoR, b: AlumnoR) =>
  cmp(a.apellido, b.apellido) || cmp(a.nombre, b.nombre)

// "Lunes 08:00 a 09:00 · Miércoles 10:00 a 11:00"
export function horariosDeAsignacion(horarios: HorarioR[], idAsignacion: number) {
  const propios = horarios
    .filter((h) => h.id_asignacion === idAsignacion)
    .sort(
      (a, b) =>
        DIAS_DEPORTE.indexOf(a.dia_semana) - DIAS_DEPORTE.indexOf(b.dia_semana) ||
        a.hora_inicio.localeCompare(b.hora_inicio),
    )
  return propios.length
    ? propios
        .map(
          (h) =>
            `${h.dia_semana} ${h.hora_inicio.slice(0, 5)} a ${h.hora_fin.slice(0, 5)}`,
        )
        .join(' · ')
    : 'Sin horario cargado'
}

// Materias de un curso con su profesor y horarios (portal y ficha integral)
export function materiasConProfesor(
  asignaciones: Pick<AsignacionR, 'id_asignacion' | 'materias' | 'docentes'>[],
  horarios: HorarioR[],
) {
  return asignaciones
    .map((a) => ({
      materia: a.materias?.nombre ?? '—',
      profesor: nombrePersona(a.docentes?.usuarios),
      horarios: horariosDeAsignacion(horarios, a.id_asignacion),
    }))
    .sort((x, y) => cmp(x.materia, y.materia))
}

const unicos = (xs: string[]) => [...new Set(xs)].sort(cmp)

export function construirReporte(
  tipo: TipoReporte,
  d: DatosReportes,
  f: FiltrosReporte,
): TablaReporte {
  const alumnoPorId = new Map(d.alumnos.map((a) => [a.id_alumno, a]))
  const grupoPorId = new Map(d.grupos.map((g) => [g.id_grupo, g]))

  switch (tipo) {
    // RF8.2 — Por docente: cursos a cargo por nivel y horarios de cada curso
    case 'docente': {
      if (!f.id_docente) return { columnas: [], filas: [] }
      const idDoc = Number(f.id_docente)
      const clases = d.asignaciones
        .filter((a) => a.id_docente === idDoc)
        .sort(
          (a, b) =>
            compararCursos(a.cursos, b.cursos) ||
            cmp(a.materias?.nombre ?? '', b.materias?.nombre ?? ''),
        )
        .map((a) => [
          a.cursos?.nivel ?? '—',
          textoCursoCorto(a.cursos),
          a.materias?.nombre ?? '—',
          horariosDeAsignacion(d.horarios, a.id_asignacion),
        ])
      const deportes = d.grupos
        .filter((g) => g.id_docente === idDoc)
        .sort((a, b) => ordenNivel(a.nivel) - ordenNivel(b.nivel))
        .map((g) => [
          g.nivel,
          'Grupo deportivo',
          `${g.actividades_extracurriculares?.nombre ?? 'Deporte'} (deporte)`,
          textoHorario(g),
        ])
      return {
        columnas: ['Nivel', 'Curso', 'Materia', 'Horarios'],
        filas: [...clases, ...deportes],
      }
    }

    // RF8.3 — Alumnos por curso
    case 'curso': {
      const filas = d.alumnos
        .filter((a) => !f.id_curso || a.id_curso === Number(f.id_curso))
        .sort((a, b) => compararCursos(a.cursos, b.cursos) || compararAlumnos(a, b))
        .map((a) => [
          a.cursos?.nivel ?? 'Sin curso',
          textoCursoCorto(a.cursos),
          a.legajo ?? '—',
          a.apellido,
          a.nombre,
        ])
      return { columnas: ['Nivel educativo', 'Curso', 'Legajo', 'Apellido', 'Nombre'], filas }
    }

    // RF8.4 — Alumnos por materia
    case 'materia': {
      const filas: string[][] = []
      d.asignaciones
        .filter(
          (a) =>
            (!f.id_materia || a.id_materia === Number(f.id_materia)) &&
            (!f.id_curso || a.id_curso === Number(f.id_curso)),
        )
        .sort(
          (a, b) =>
            cmp(a.materias?.nombre ?? '', b.materias?.nombre ?? '') ||
            compararCursos(a.cursos, b.cursos),
        )
        .forEach((a) =>
          d.alumnos
            .filter((al) => al.id_curso === a.id_curso)
            .sort(compararAlumnos)
            .forEach((al) =>
              filas.push([
                a.cursos?.nivel ?? '—',
                textoCursoCorto(a.cursos),
                a.materias?.nombre ?? '—',
                nombrePersona(a.docentes?.usuarios),
                `${al.apellido}, ${al.nombre}`,
                al.legajo ?? '—',
              ]),
            ),
        )
      return {
        columnas: ['Nivel educativo', 'Curso', 'Materia', 'Profesor a cargo', 'Alumno', 'Legajo'],
        filas,
      }
    }

    // RF8.5 — Docentes por nivel educativo
    case 'docentes_nivel': {
      const filas: string[][] = []
      NIVELES.filter((n) => !f.nivel || n === f.nivel).forEach((nivel) =>
        [...d.docentes]
          .sort((a, b) => nombrePersona(a.usuarios).localeCompare(nombrePersona(b.usuarios)))
          .forEach((doc) => {
            const suyas = d.asignaciones.filter(
              (a) => a.id_docente === doc.id_docente && a.cursos?.nivel === nivel,
            )
            if (suyas.length === 0) return
            filas.push([
              nivel,
              nombrePersona(doc.usuarios),
              unicos(suyas.map((a) => a.materias?.nombre ?? '—')).join(', '),
              unicos(suyas.map((a) => textoCursoCorto(a.cursos))).join(', '),
            ])
          }),
      )
      return { columnas: ['Nivel educativo', 'Profesor', 'Materias a cargo', 'Cursos'], filas }
    }

    // RF8.6 — Alumnos por deporte, por nivel, por horario y por profesor a cargo
    case 'deporte': {
      const filas = d.inscDeportivas
        .map((i) => ({ i, g: grupoPorId.get(i.id_grupo), al: alumnoPorId.get(i.id_alumno) }))
        .filter(
          (x): x is { i: (typeof d.inscDeportivas)[number]; g: GrupoR; al: AlumnoR } =>
            !!x.g &&
            !!x.al &&
            (!f.id_actividad || x.g.id_actividad === Number(f.id_actividad)) &&
            (!f.nivel || x.g.nivel === f.nivel) &&
            (!f.id_grupo || x.g.id_grupo === Number(f.id_grupo)),
        )
        .sort(
          (a, b) =>
            cmp(
              a.g.actividades_extracurriculares?.nombre ?? '',
              b.g.actividades_extracurriculares?.nombre ?? '',
            ) ||
            ordenNivel(a.g.nivel) - ordenNivel(b.g.nivel) ||
            a.g.id_grupo - b.g.id_grupo ||
            compararAlumnos(a.al, b.al),
        )
        .map(({ g, al }) => [
          g.actividades_extracurriculares?.nombre ?? '—',
          g.nivel,
          textoHorario(g),
          nombrePersona(g.docentes?.usuarios),
          `${al.apellido}, ${al.nombre}`,
          al.legajo ?? '—',
          textoCursoCorto(al.cursos),
        ])
      return {
        columnas: ['Deporte', 'Nivel educativo', 'Días y horario', 'Profesor a cargo', 'Alumno', 'Legajo', 'Curso'],
        filas,
      }
    }

    // RF8.7 — Alumnos por recorrido del servicio de transporte
    case 'recorrido': {
      const recPorId = new Map(d.recorridos.map((r) => [r.id_recorrido, r]))
      const filas = d.transporte
        .map((t) => ({ r: recPorId.get(t.id_recorrido), al: alumnoPorId.get(t.id_alumno) }))
        .filter(
          (x): x is { r: RecorridoR; al: AlumnoR } =>
            !!x.r && !!x.al && (!f.id_recorrido || x.r.id_recorrido === Number(f.id_recorrido)),
        )
        .sort((a, b) => a.r.numero - b.r.numero || compararAlumnos(a.al, b.al))
        .map(({ r, al }) => [
          r.nombre,
          al.legajo ?? '—',
          `${al.apellido}, ${al.nombre}`,
          al.cursos?.nivel ?? '—',
          textoCursoCorto(al.cursos),
        ])
      return { columnas: ['Recorrido', 'Legajo', 'Alumno', 'Nivel educativo', 'Curso'], filas }
    }
  }
}

// CSV para abrir con Excel (separador ; y BOM para que respete las tildes)
export function tablaACSV(t: TablaReporte): string {
  const celda = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return (
    '﻿' +
    [t.columnas, ...t.filas].map((fila) => fila.map(celda).join(';')).join('\r\n')
  )
}

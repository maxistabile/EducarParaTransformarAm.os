// ═══════════════════════════════════════════════════════════════
//  TP METODOLOGÍA II · RF4 / RF5 — Deportes, transporte y comedor
//  Reglas y textos compartidos por el panel de gestión y el portal.
//  Las reglas de negocio las controla la base de datos (etapa 14);
//  acá se traducen sus mensajes a un texto claro para el usuario.
// ═══════════════════════════════════════════════════════════════

// Los deportes pueden entrenar también los sábados
export const DIAS_DEPORTE = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]

export const ordenarDias = (dias: string[]) =>
  [...dias].sort((a, b) => DIAS_DEPORTE.indexOf(a) - DIAS_DEPORTE.indexOf(b))

// ['Miércoles', 'Lunes'] → 'Lunes y Miércoles'
export const textoDias = (dias: string[]) => {
  const d = ordenarDias(dias)
  return d.length <= 1
    ? d.join('')
    : `${d.slice(0, -1).join(', ')} y ${d[d.length - 1]}`
}

export const textoHorario = (g: {
  dias: string[]
  hora_inicio: string
  hora_fin: string
}) =>
  `${textoDias(g.dias)} · ${g.hora_inicio.slice(0, 5)} a ${g.hora_fin.slice(0, 5)}`

export const textoCurso = (
  c: { nivel: string; grado_anio: string; division: string } | null | undefined,
) => (c ? `${c.nivel} · ${c.grado_anio} "${c.division}"` : 'Sin curso')

export function mensajeErrorServicios(raw: string): string {
  const m = raw.match(/^([A-Z][A-Z0-9_]+)(?:\|(.*))?$/)
  if (m) {
    const p = (m[2] ?? '').split('|')
    switch (m[1]) {
      case 'ALU_INACTIVO':
        return `${p[0]} está inactivo: no se puede inscribir.`
      case 'ALU_SIN_CURSO':
        return `${p[0]} no tiene curso asignado, por eso no se puede saber su nivel.`
      case 'DEP_INACTIVO':
        return `${p[0]}: el deporte o el grupo no está activo.`
      case 'DEP_NIVEL':
        return `Ese grupo es para el nivel ${p[0]} y el alumno es de nivel ${p[1]}.`
      case 'DEP_REPETIDO':
        return `El alumno ya está inscripto en ${p[0]}.`
      case 'DEP_MAX2':
        return `El alumno ya participa en dos deportes (${p[0]}), que es el máximo permitido.`
      case 'DEP_CHOQUE':
        return `El horario se superpone con ${p[0]} (${textoDias((p[1] ?? '').split(', '))} de ${p[2]} a ${p[3]}).`
      case 'DEP_CUPO':
        return `No quedan cupos en ese grupo de ${p[0]}.`
      case 'GRP_NO_DEPORTE':
        return 'La actividad elegida no es un deporte.'
      case 'GRP_DOCENTE_INACTIVO':
        return 'Elegí un profesor responsable que esté activo.'
      case 'GRP_CON_INSCRIPTOS':
        return `El grupo tiene ${p[0]} alumno(s) inscripto(s): para cambiar el deporte o el nivel, o para desactivarlo, primero hay que darlos de baja.`
      case 'GRP_CUPO_MENOR':
        return `El cupo no puede ser menor a los ${p[0]} alumnos inscriptos.`
      case 'GRP_CHOQUE_ALUMNO':
        return `Con ese horario, ${p[0]} quedaría superpuesto con ${p[1]}.`
      case 'ACT_DEPORTE_POR_GRUPO':
        return 'Los deportes se inscriben por grupo, desde la sección Deportes.'
      case 'TRA_RECORRIDO_INACTIVO':
        return `El recorrido "${p[0]}" no está activo.`
      case 'TRA_CON_INSCRIPTOS':
        return `El recorrido tiene ${p[0]} alumno(s) inscripto(s): no se puede desactivar.`
    }
  }
  if (/uq_insc_dep_alumno_grupo/i.test(raw))
    return 'El alumno ya está inscripto en ese grupo.'
  if (/uq_transporte_alumno_activo/i.test(raw))
    return 'El alumno ya tiene un recorrido de transporte asignado.'
  if (/uq_comedor_alumno_activo/i.test(raw))
    return 'El alumno ya está inscripto en el comedor.'
  if (/uq_actividades_tipo_nombre/i.test(raw))
    return 'Ya existe un deporte con ese nombre.'
  if (/uq_recorridos_nombre/i.test(raw))
    return 'Ya existe un recorrido con ese nombre.'
  if (/recorridos_numero_(key|check)/i.test(raw))
    return 'Solo existen los recorridos 1 a 4.'
  if (/chk_grupo_horario/i.test(raw))
    return 'La hora de fin tiene que ser posterior a la de inicio.'
  if (/chk_grupo_dias/i.test(raw))
    return 'Elegí al menos un día, de lunes a sábado.'
  if (/chk_grupo_cupo/i.test(raw)) return 'El cupo debe estar entre 1 y 200.'
  if (
    /(grupos_deportivos|inscripciones_deportivas|recorridos|inscripciones_transporte|inscripciones_comedor).*(does not exist|schema cache)/i.test(
      raw,
    )
  )
    return 'Falta correr la migración etapa14_deportes_servicios.sql en Supabase.'
  return 'Error: ' + raw
}

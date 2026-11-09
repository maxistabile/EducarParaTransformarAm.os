// ═══════════════════════════════════════════════════════════════
//  TP METODOLOGÍA II · Parte 3 · RF15 — Listados de pagos (HU62 a HU66)
//  Funciones puras: reciben los datos ya cargados (ServicioListadosPagos)
//  y arman cada listado. No consultan la base: se prueban aisladas.
//
//  Criterios (comunes):
//   - Solo datos HISTÓRICOS de lo facturado: alumno y curso copiados en la
//     factura al emitir, y el deporte o recorrido de cada ítem. No se
//     reconstruye lo facturado con las inscripciones actuales.
//   - Ingresos (HU62): solo lo ACREDITADO. Un comprobante cuenta cuando
//     está Aprobado (fecha: su aprobación); En revisión y Rechazado no.
//     Los pagos que registró la administración ("Registrar pagos") se
//     conservan identificados como "Registro administrativo" (fecha: la de
//     pago registrada). Una cuota pagada con un comprobante aprobado
//     también figura Pagada en cuotas: se cuenta UNA sola vez (como
//     comprobante). Sin cargo (neto 0) no es dinero cobrado.
//   - Facturas completas e incompletas (HU63 y HU64): "Año del pago" es
//     el año del período facturado (al que corresponde el pago); "Año de
//     cursado" sale del curso copiado en la factura (nivel y año, sin la
//     división). Las facturas Sin cargo (total 0) no son completas ni
//     incompletas: se informan aparte.
//   - Deportes (HU65): el grupo (nivel, horario y profesor) es el de la
//     inscripción del alumno VIGENTE en ese mes a ese deporte (por sus
//     fechas de alta y baja, aunque hoy esté dada de baja). Nivel, días,
//     horario y profesor son los datos actuales de ese grupo.
//   - Recorridos (HU66): el recorrido es el del ítem facturado; el ítem
//     solo existe si el alumno estaba inscripto al transporte ese mes.
// ═══════════════════════════════════════════════════════════════
import { netoCuota } from './reglasCuotas'
import { nombrePeriodo, numeroFactura, pesos } from './reglasFacturacion'
import type { EstadoPagoItem, Periodo } from './reglasFacturacion'
import { textoHorario } from './reglasServicios'
import type { TablaReporte } from './reportes'

type Numero = number | string
type Persona = { nombre: string; apellido: string } | null
const num = (v: Numero | null | undefined) => Number(v ?? 0)
const centavos = (n: number) => Math.round(n * 100) / 100
const cmp = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
const clavePeriodo = (p: Periodo) => p.anio * 12 + p.mes
const periodoTexto = (p: Periodo) => {
  const t = nombrePeriodo(p)
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// ── Datos que carga el servicio ────────────────────────────────
export interface FacturaL {
  id_factura: number
  id_alumno: number
  anio: number
  mes: number
  alumno_nombre: string
  curso: string | null
  fecha_vencimiento: string
  total: Numero
  cobrado: Numero
  saldo: Numero
  en_revision: Numero | null
}
export interface ItemL {
  id_item: number
  id_factura: number
  concepto: 'Cuota' | 'Deporte' | 'Recorrido' | 'Comedor'
  id_cuota: number | null
  id_actividad: number | null
  id_recorrido: number | null
  descripcion: string
  neto: Numero
  saldo: Numero
  estado_pago: EstadoPagoItem
  fecha_pago: string | null
  id_pago: number | null
}
export interface PagoL {
  id_pago: number
  id_factura: number
  estado: 'En revision' | 'Aprobado' | 'Rechazado'
  monto_pagado: Numero
  fecha_revision: string | null
  metodo_pago: string | null
  pago_items: Array<{ id_item: number; importe: Numero; activo: boolean }> | null
}
export interface CuotaL {
  id_cuota: number
  id_alumno: number
  anio: number
  mes: number
  monto_base: Numero
  recargo: Numero | null
  descuento: Numero | null
  estado: string
  fecha_pago: string | null
  metodo_pago: string | null
}
export interface AlumnoL {
  id_alumno: number
  nombre: string
  apellido: string
}
export interface InscripcionDepL {
  id_alumno: number
  id_grupo: number
  fecha_alta: string
  fecha_baja: string | null
}
export interface GrupoL {
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
export interface RecorridoL {
  id_recorrido: number
  numero: number
  nombre: string
}
export interface DatosListados {
  facturas: FacturaL[]
  items: ItemL[]
  pagos: PagoL[]
  cuotas: CuotaL[]
  alumnos: AlumnoL[]
  inscDeportivas: InscripcionDepL[]
  grupos: GrupoL[]
  recorridos: RecorridoL[]
}

// ── Fechas y períodos ──────────────────────────────────────────
/** 'AAAA-MM-DD' en Argentina de un timestamptz (o de una fecha). */
export function diaArgentina(valor: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(valor))
}

const MES = /^(\d{4})-(\d{2})$/
/** 'AAAA-MM' → período, o null si no es válido. */
export function periodoDeTexto(texto: string): Periodo | null {
  const m = MES.exec(texto)
  if (!m) return null
  const [, a, me] = m
  const anio = Number(a)
  const mes = Number(me)
  return mes >= 1 && mes <= 12 ? { anio, mes } : null
}

export const MENSAJES_LISTADOS = {
  periodoInvertido: 'El período "desde" no puede ser posterior al período "hasta".',
  periodoInvalido: 'Elegí un período válido (mes y año).',
  fechaInvertida: 'La fecha "desde" no puede ser posterior a la fecha "hasta".',
  fechaInvalida: 'Elegí fechas válidas.',
}

/** null si el rango de meses sirve; si no, el motivo. */
export function validarRangoMeses(desde: string, hasta: string): string | null {
  const d = periodoDeTexto(desde)
  const h = periodoDeTexto(hasta)
  if (!d || !h) return MENSAJES_LISTADOS.periodoInvalido
  return clavePeriodo(d) > clavePeriodo(h) ? MENSAJES_LISTADOS.periodoInvertido : null
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/
/** null si el rango de días sirve; si no, el motivo. */
export function validarRangoDias(desde: string, hasta: string): string | null {
  if (!FECHA.test(desde) || !FECHA.test(hasta)) return MENSAJES_LISTADOS.fechaInvalida
  return desde > hasta ? MENSAJES_LISTADOS.fechaInvertida : null
}

function enRangoMeses(p: Periodo, desde: string, hasta: string): boolean {
  const d = periodoDeTexto(desde)
  const h = periodoDeTexto(hasta)
  if (!d || !h) return false
  const k = clavePeriodo(p)
  return k >= clavePeriodo(d) && k <= clavePeriodo(h)
}

// ── Estados de los ítems ───────────────────────────────────────
export type EstadoListado = 'Pagado' | 'Registro administrativo' | 'En revisión' | 'Pendiente' | 'Sin cargo'

function pagoAprobado(d: DatosListados): Set<number> {
  return new Set(d.pagos.filter((p) => p.estado === 'Aprobado').map((p) => p.id_pago))
}

function estadoItem(i: ItemL, aprobados: Set<number>): EstadoListado {
  if (num(i.neto) <= 0) return 'Sin cargo'
  if (i.estado_pago === 'En revision') return 'En revisión'
  if (i.estado_pago !== 'Pagado') return 'Pendiente'
  return i.id_pago != null && aprobados.has(i.id_pago) ? 'Pagado' : 'Registro administrativo'
}
const cobrado = (e: EstadoListado) => e === 'Pagado' || e === 'Registro administrativo'

// ── HU62: ingresos por período ─────────────────────────────────
export interface FiltrosIngresos {
  desde: string // 'AAAA-MM-DD'
  hasta: string
  origen?: '' | 'Comprobante' | 'Registro administrativo'
}
export interface FilaIngreso {
  clave: string
  fecha: string
  alumno: string
  referencia: string
  conceptos: string
  origen: 'Comprobante' | 'Registro administrativo'
  metodo: string
  importe: number
}
export interface ListadoIngresos {
  filas: FilaIngreso[]
  total: number
  porOrigen: { comprobantes: number; administrativos: number }
  /** Registros administrativos sin fecha de pago: no se pueden ubicar en un período. */
  sinFecha: number
}

export function listadoIngresos(d: DatosListados, f: FiltrosIngresos): ListadoIngresos {
  const facturaPorId = new Map(d.facturas.map((x) => [x.id_factura, x]))
  const itemPorId = new Map(d.items.map((x) => [x.id_item, x]))
  const itemDeCuota = new Map(d.items.flatMap((x) => (x.id_cuota === null ? [] : [[x.id_cuota, x] as const])))
  const alumnoPorId = new Map(d.alumnos.map((x) => [x.id_alumno, x]))
  const aprobados = pagoAprobado(d)

  // Comprobantes aprobados: uno por pago, por su monto
  const comprobantes: FilaIngreso[] = d.pagos
    .filter((p) => p.estado === 'Aprobado' && p.fecha_revision)
    .map((p) => {
      const fac = facturaPorId.get(p.id_factura)
      const conceptos = (p.pago_items ?? [])
        .filter((pi) => pi.activo)
        .map((pi) => itemPorId.get(pi.id_item)?.descripcion ?? 'Concepto')
      return {
        clave: `pago-${p.id_pago}`,
        fecha: diaArgentina(String(p.fecha_revision)),
        alumno: fac?.alumno_nombre ?? 'Alumno',
        referencia: fac ? `Factura ${numeroFactura(fac.id_factura)} · ${periodoTexto(fac)}` : 'Factura',
        conceptos: conceptos.join(', '),
        origen: 'Comprobante' as const,
        metodo: p.metodo_pago ?? 'Transferencia',
        importe: num(p.monto_pagado),
      }
    })

  // Registros administrativos: cuotas Pagadas con importe que NO pagó un comprobante aprobado
  let sinFecha = 0
  const administrativos: FilaIngreso[] = []
  for (const c of d.cuotas) {
    if (c.estado !== 'Pagada') continue
    const item = itemDeCuota.get(c.id_cuota)
    if (item && item.id_pago != null && aprobados.has(item.id_pago)) continue
    const importe = item ? num(item.neto) : netoCuota(c)
    if (importe <= 0) continue // Sin cargo: no es dinero cobrado
    if (!c.fecha_pago) {
      sinFecha++
      continue
    }
    const fac = item ? facturaPorId.get(item.id_factura) : undefined
    const al = alumnoPorId.get(c.id_alumno)
    administrativos.push({
      clave: `cuota-${c.id_cuota}`,
      fecha: diaArgentina(c.fecha_pago),
      alumno: fac?.alumno_nombre ?? (al ? `${al.apellido}, ${al.nombre}` : 'Alumno'),
      referencia: fac
        ? `Factura ${numeroFactura(fac.id_factura)} · ${periodoTexto(fac)}`
        : `Cuota de ${periodoTexto(c)} (sin factura)`,
      conceptos: 'Cuota mensual',
      origen: 'Registro administrativo',
      metodo: c.metodo_pago ?? 'Método no registrado',
      importe,
    })
  }

  const filas = [...comprobantes, ...administrativos]
    .filter((x) => x.fecha >= f.desde && x.fecha <= f.hasta && (!f.origen || x.origen === f.origen))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || cmp(a.alumno, b.alumno) || a.clave.localeCompare(b.clave))
  const suma = (o: FilaIngreso['origen']) => centavos(filas.filter((x) => x.origen === o).reduce((s, x) => s + x.importe, 0))
  return {
    filas,
    total: centavos(filas.reduce((s, x) => s + x.importe, 0)),
    porOrigen: { comprobantes: suma('Comprobante'), administrativos: suma('Registro administrativo') },
    sinFecha,
  }
}

// ── HU63 y HU64: facturas completas e incompletas ──────────────
/** "Año de cursado" a partir del curso copiado en la factura: nivel y año, sin la división. */
export function anioDeCursado(curso: string | null): string {
  if (!curso) return 'Sin curso'
  const partes = curso.trim().split(/\s+/)
  // 'Primario 3 A' → 'Primario 3'. La división es la última palabra corta.
  if (partes.length >= 3 && (partes.at(-1)?.length ?? 0) <= 2) return partes.slice(0, -1).join(' ')
  return partes.join(' ')
}

export interface FiltrosFacturas {
  desde: string // 'AAAA-MM'
  hasta: string
  anioPago?: string // año del período facturado
  anioCursado?: string
}
export interface FilaFactura {
  id_factura: number
  numero: string
  periodo: Periodo
  anioPago: number
  alumno: string
  curso: string
  anioCursado: string
  total: number
  pagado: number
  enRevision: number
  saldo: number
  estado: 'Pago completo' | 'Pago parcial' | 'Sin pago'
  vencida: boolean
  /** Completas: la última fecha de pago acreditado de sus ítems. */
  fechaPagoCompleto: string | null
}
export interface GrupoFacturas {
  clave: string
  anioPago: number
  anioCursado: string
  filas: FilaFactura[]
  total: number
  pagado: number
  saldo: number
}
export interface ListadoFacturas {
  grupos: GrupoFacturas[]
  filas: FilaFactura[]
  totales: { facturas: number; total: number; pagado: number; enRevision: number; saldo: number }
  /** Facturas del período con total 0: no son completas ni incompletas. */
  sinCargo: number
  opciones: { aniosPago: number[]; aniosCursado: string[] }
}

export function listadoFacturas(
  d: DatosListados,
  tipo: 'completas' | 'incompletas',
  f: FiltrosFacturas,
  hoy: string,
): ListadoFacturas {
  const itemsPorFactura = new Map<number, ItemL[]>()
  for (const i of d.items) itemsPorFactura.set(i.id_factura, [...(itemsPorFactura.get(i.id_factura) ?? []), i])

  const delPeriodo = d.facturas.filter((x) => enRangoMeses(x, f.desde, f.hasta))
  const sinCargo = delPeriodo.filter((x) => num(x.total) <= 0).length
  const candidatas = delPeriodo
    .filter((x) => num(x.total) > 0)
    .filter((x) => (tipo === 'completas' ? num(x.saldo) <= 0 : num(x.saldo) > 0))
    .map((x): FilaFactura => {
      const pagado = num(x.cobrado)
      const fechas = (itemsPorFactura.get(x.id_factura) ?? [])
        .filter((i) => i.estado_pago === 'Pagado' && i.fecha_pago)
        .map((i) => diaArgentina(String(i.fecha_pago)))
        .sort()
      return {
        id_factura: x.id_factura,
        numero: numeroFactura(x.id_factura),
        periodo: { anio: x.anio, mes: x.mes },
        anioPago: x.anio,
        alumno: x.alumno_nombre,
        curso: x.curso ?? 'Sin curso',
        anioCursado: anioDeCursado(x.curso),
        total: num(x.total),
        pagado,
        enRevision: num(x.en_revision),
        saldo: num(x.saldo),
        estado: num(x.saldo) <= 0 ? 'Pago completo' : pagado > 0 ? 'Pago parcial' : 'Sin pago',
        vencida: num(x.saldo) > 0 && x.fecha_vencimiento.slice(0, 10) < hoy,
        fechaPagoCompleto: num(x.saldo) <= 0 ? (fechas.at(-1) ?? null) : null,
      }
    })

  const opciones = {
    aniosPago: [...new Set(candidatas.map((x) => x.anioPago))].sort((a, b) => a - b),
    aniosCursado: [...new Set(candidatas.map((x) => x.anioCursado))].sort(cmp),
  }
  const filas = candidatas
    .filter((x) => (!f.anioPago || x.anioPago === Number(f.anioPago)) && (!f.anioCursado || x.anioCursado === f.anioCursado))
    .sort(
      (a, b) =>
        a.anioPago - b.anioPago ||
        cmp(a.anioCursado, b.anioCursado) ||
        clavePeriodo(a.periodo) - clavePeriodo(b.periodo) ||
        cmp(a.alumno, b.alumno),
    )

  const grupos = new Map<string, GrupoFacturas>()
  for (const x of filas) {
    const clave = `${x.anioPago}|${x.anioCursado}`
    const g = grupos.get(clave) ?? { clave, anioPago: x.anioPago, anioCursado: x.anioCursado, filas: [], total: 0, pagado: 0, saldo: 0 }
    g.filas.push(x)
    g.total = centavos(g.total + x.total)
    g.pagado = centavos(g.pagado + x.pagado)
    g.saldo = centavos(g.saldo + x.saldo)
    grupos.set(clave, g)
  }
  const sumar = (valor: (x: FilaFactura) => number) => centavos(filas.reduce((s, x) => s + valor(x), 0))
  return {
    grupos: [...grupos.values()],
    filas,
    totales: {
      facturas: filas.length,
      total: sumar((x) => x.total),
      pagado: sumar((x) => x.pagado),
      enRevision: sumar((x) => x.enRevision),
      saldo: sumar((x) => x.saldo),
    },
    sinCargo,
    opciones,
  }
}

// ── HU65 y HU66: pagos por ítem (deporte o recorrido) ──────────
export interface FilaItem {
  id_item: number
  periodo: Periodo
  alumno: string
  factura: string
  detalle: string
  nivel: string
  horario: string
  profesor: string
  id_grupo: number | null
  id_docente: number | null
  importe: number
  estado: EstadoListado
  saldo: number
}
export interface ListadoItems {
  filas: FilaItem[]
  totales: { importe: number; cobrado: number; enRevision: number; saldo: number }
}

function totalesItems(filas: FilaItem[]): ListadoItems['totales'] {
  const s = (pred: (x: FilaItem) => boolean, valor: (x: FilaItem) => number) =>
    centavos(filas.filter(pred).reduce((t, x) => t + valor(x), 0))
  return {
    importe: s(() => true, (x) => x.importe),
    cobrado: s((x) => cobrado(x.estado), (x) => x.importe),
    enRevision: s((x) => x.estado === 'En revisión', (x) => x.saldo),
    saldo: s(() => true, (x) => x.saldo),
  }
}

/** Grupo de la inscripción del alumno al deporte vigente en ese mes (por fechas). */
function grupoDelMes(
  d: DatosListados,
  idAlumno: number,
  idActividad: number | null,
  p: Periodo,
  grupoPorId: Map<number, GrupoL>,
): GrupoL | null {
  const primero = `${p.anio}-${String(p.mes).padStart(2, '0')}-01`
  const ultimo = new Date(Date.UTC(p.anio, p.mes, 0)).toISOString().slice(0, 10)
  const vigentes = d.inscDeportivas
    .filter((i) => i.id_alumno === idAlumno)
    .map((i) => ({ i, g: grupoPorId.get(i.id_grupo) }))
    .filter((x): x is { i: InscripcionDepL; g: GrupoL } => !!x.g && x.g.id_actividad === idActividad)
    .filter(
      ({ i }) =>
        diaArgentina(i.fecha_alta) <= ultimo && (!i.fecha_baja || diaArgentina(i.fecha_baja) >= primero),
    )
    .sort((a, b) => b.i.fecha_alta.localeCompare(a.i.fecha_alta))
  return vigentes.at(0)?.g ?? null
}

export interface FiltrosDeportes {
  desde: string // 'AAAA-MM'
  hasta: string
  id_actividad?: string
  nivel?: string
  id_grupo?: string
  id_docente?: string
  estado?: string
}

export const SIN_INSCRIPCION = 'Sin inscripción en ese mes'

export function listadoDeportes(d: DatosListados, f: FiltrosDeportes): ListadoItems {
  const facturaPorId = new Map(d.facturas.map((x) => [x.id_factura, x]))
  const grupoPorId = new Map(d.grupos.map((g) => [g.id_grupo, g]))
  const aprobados = pagoAprobado(d)
  const filas = d.items
    .filter((i) => i.concepto === 'Deporte')
    .flatMap((i): FilaItem[] => {
      const fac = facturaPorId.get(i.id_factura)
      if (!fac || !enRangoMeses(fac, f.desde, f.hasta)) return []
      if (f.id_actividad && i.id_actividad !== Number(f.id_actividad)) return []
      const g = grupoDelMes(d, fac.id_alumno, i.id_actividad, fac, grupoPorId)
      const usuario = g?.docentes?.usuarios ?? null
      return [
        {
          id_item: i.id_item,
          periodo: { anio: fac.anio, mes: fac.mes },
          alumno: fac.alumno_nombre,
          factura: numeroFactura(fac.id_factura),
          detalle: i.descripcion.replace(/^Deporte:\s*/, ''),
          nivel: g?.nivel ?? SIN_INSCRIPCION,
          horario: g ? textoHorario(g) : SIN_INSCRIPCION,
          profesor: usuario ? `${usuario.apellido}, ${usuario.nombre}` : g ? '—' : SIN_INSCRIPCION,
          id_grupo: g?.id_grupo ?? null,
          id_docente: g?.id_docente ?? null,
          importe: num(i.neto),
          estado: estadoItem(i, aprobados),
          saldo: num(i.saldo),
        },
      ]
    })
    .filter(
      (x) =>
        (!f.nivel || x.nivel === f.nivel) &&
        (!f.id_grupo || x.id_grupo === Number(f.id_grupo)) &&
        (!f.id_docente || x.id_docente === Number(f.id_docente)) &&
        (!f.estado || x.estado === f.estado),
    )
    .sort(
      (a, b) =>
        cmp(a.detalle, b.detalle) ||
        cmp(a.nivel, b.nivel) ||
        clavePeriodo(a.periodo) - clavePeriodo(b.periodo) ||
        cmp(a.alumno, b.alumno),
    )
  return { filas, totales: totalesItems(filas) }
}

export interface FiltrosRecorridos {
  desde: string // 'AAAA-MM'
  hasta: string
  id_recorrido?: string
  estado?: string
}

export function listadoRecorridos(d: DatosListados, f: FiltrosRecorridos): ListadoItems {
  const facturaPorId = new Map(d.facturas.map((x) => [x.id_factura, x]))
  const recorridoPorId = new Map(d.recorridos.map((r) => [r.id_recorrido, r]))
  const aprobados = pagoAprobado(d)
  const filas = d.items
    .filter((i) => i.concepto === 'Recorrido')
    .flatMap((i): FilaItem[] => {
      const fac = facturaPorId.get(i.id_factura)
      if (!fac || !enRangoMeses(fac, f.desde, f.hasta)) return []
      if (f.id_recorrido && i.id_recorrido !== Number(f.id_recorrido)) return []
      const r = i.id_recorrido === null ? undefined : recorridoPorId.get(i.id_recorrido)
      return [
        {
          id_item: i.id_item,
          periodo: { anio: fac.anio, mes: fac.mes },
          alumno: fac.alumno_nombre,
          factura: numeroFactura(fac.id_factura),
          detalle: r?.nombre ?? i.descripcion.replace(/^Transporte:\s*/, ''),
          nivel: '',
          horario: '',
          profesor: '',
          id_grupo: null,
          id_docente: null,
          importe: num(i.neto),
          estado: estadoItem(i, aprobados),
          saldo: num(i.saldo),
        },
      ]
    })
    .filter((x) => !f.estado || x.estado === f.estado)
    .sort(
      (a, b) =>
        cmp(a.detalle, b.detalle) || clavePeriodo(a.periodo) - clavePeriodo(b.periodo) || cmp(a.alumno, b.alumno),
    )
  return { filas, totales: totalesItems(filas) }
}

// ── Tablas para exportar (CSV con tablaACSV de reportes.ts) ────
export function tablaIngresos(l: ListadoIngresos): TablaReporte {
  return {
    columnas: ['Fecha de acreditación', 'Alumno', 'Referencia', 'Conceptos', 'Origen', 'Método', 'Importe'],
    filas: [
      ...l.filas.map((x) => [x.fecha.split('-').reverse().join('/'), x.alumno, x.referencia, x.conceptos, x.origen, x.metodo, pesos(x.importe)]),
      ['', '', '', '', '', 'Total', pesos(l.total)],
    ],
  }
}

export function tablaFacturas(l: ListadoFacturas): TablaReporte {
  return {
    columnas: ['Año del pago (período)', 'Año de cursado', 'Período', 'Factura', 'Alumno', 'Curso', 'Total', 'Pagado', 'En revisión', 'Saldo', 'Estado'],
    filas: [
      ...l.filas.map((x) => [
        String(x.anioPago), x.anioCursado, periodoTexto(x.periodo), x.numero, x.alumno, x.curso,
        pesos(x.total), pesos(x.pagado), pesos(x.enRevision), pesos(x.saldo), `${x.estado}${x.vencida ? ' (vencida)' : ''}`,
      ]),
      ['', '', '', '', '', 'Total', pesos(l.totales.total), pesos(l.totales.pagado), pesos(l.totales.enRevision), pesos(l.totales.saldo), ''],
    ],
  }
}

export function tablaItems(l: ListadoItems, tipo: 'deporte' | 'recorrido'): TablaReporte {
  const base = (x: FilaItem) => [periodoTexto(x.periodo), x.alumno, x.factura]
  const fin = (x: FilaItem) => [pesos(x.importe), x.estado, pesos(x.saldo)]
  if (tipo === 'deporte')
    return {
      columnas: ['Período', 'Alumno', 'Factura', 'Deporte', 'Nivel', 'Días y horario', 'Profesor', 'Importe', 'Estado de pago', 'Saldo'],
      filas: [
        ...l.filas.map((x) => [...base(x), x.detalle, x.nivel, x.horario, x.profesor, ...fin(x)]),
        ['', '', '', '', '', '', 'Total', pesos(l.totales.importe), '', pesos(l.totales.saldo)],
      ],
    }
  return {
    columnas: ['Período', 'Alumno', 'Factura', 'Recorrido', 'Importe', 'Estado de pago', 'Saldo'],
    filas: [
      ...l.filas.map((x) => [...base(x), x.detalle, ...fin(x)]),
      ['', '', '', 'Total', pesos(l.totales.importe), '', pesos(l.totales.saldo)],
    ],
  }
}

export { periodoTexto as textoPeriodo }

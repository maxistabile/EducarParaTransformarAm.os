// ═══════════════════════════════════════════════════════════════
//  FACTURAS POR PERÍODO (HU57) Y DEUDA POR ÍTEM (HU58) — lógica pura
// ═══════════════════════════════════════════════════════════════
// Se arma con la misma lectura de la cuenta del alumno que usan Cuotas y
// Pagos (lecturaCuentaAlumno): vistas de saldo de etapa17/etapa18,
// cuotas y comprobantes. Reglas:
//   - HU57: el período filtra por FECHA DE EMISIÓN de la factura,
//     incluyendo los dos días. "Desde" no puede ser posterior a "hasta".
//     Cada factura lista todos sus conceptos y todos sus comprobantes
//     (En revisión, Aprobado y Rechazado).
//   - HU58: por concepto (cuota, cada deporte, cada recorrido y comedor)
//     y por mes, con su saldo. El total es la suma de los saldos
//     pendientes. Un comprobante En revisión no acredita: su ítem sigue
//     en el saldo. Las cuotas heredadas (sin factura) se cuentan una sola
//     vez; los conceptos Sin cargo (neto 0) no son deuda.
import { ESTADOS_IMPAGOS, netoCuota } from '../reglasCuotas'
import { numeroFactura } from '../reglasFacturacion'
import type { EstadoCobro, EstadoPagoItem, Periodo } from '../reglasFacturacion'
import type {
  EstadoComprobante,
  FilaCuota,
  FilaFacturaSaldo,
  FilaItemSaldo,
  LecturaCuenta,
} from './reglasCuentaAlumno'

type Numero = number | string
const num = (v: Numero | null | undefined) => Number(v ?? 0)
const centavos = (n: number) => Math.round(n * 100) / 100
const clavePeriodo = (p: Periodo) => p.anio * 12 + p.mes
const dia = (fecha: string) => fecha.slice(0, 10)

// ── HU57: rango de fechas ──────────────────────────────────────
const FECHA = /^\d{4}-\d{2}-\d{2}$/

/** ¿'AAAA-MM-DD' es una fecha real? (rechaza 2026-02-30). */
export function esFechaValida(texto: string): boolean {
  if (!FECHA.test(texto)) return false
  const [a, m, d] = texto.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d))
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d
}

export const MENSAJES_RANGO = {
  faltaDesde: 'Elegí la fecha "desde".',
  faltaHasta: 'Elegí la fecha "hasta".',
  invalida: 'La fecha no es válida.',
  invertido: 'La fecha "desde" no puede ser posterior a la fecha "hasta".',
}

/** null si el rango sirve; si no, el motivo. */
export function validarRango(desde: string, hasta: string): string | null {
  if (!desde) return MENSAJES_RANGO.faltaDesde
  if (!hasta) return MENSAJES_RANGO.faltaHasta
  if (!esFechaValida(desde) || !esFechaValida(hasta)) return MENSAJES_RANGO.invalida
  if (desde > hasta) return MENSAJES_RANGO.invertido
  return null
}

/** Rango inicial: del 1 de enero del año de hoy hasta hoy (fechas locales). */
export function rangoInicial(hoy: string): { desde: string; hasta: string } {
  return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy }
}

// ── HU57: facturas con conceptos y comprobantes ────────────────
export interface ConceptoDetalle {
  id_item: number
  descripcion: string
  neto: number
  saldo: number
  /** 'Sin cargo' para neto 0. */
  estado: EstadoPagoItem | 'Sin cargo'
  cubiertaPorBeca: boolean
  /** Pagado sin comprobante aprobado: lo registró la administración. */
  registroAdministrativo: boolean
}

export interface ComprobanteFactura {
  idPago: number
  estado: EstadoComprobante
  importe: number
  fechaCarga: string
  fechaRevision: string | null
  motivo: string | null
  conceptos: Array<{ descripcion: string; importe: number }>
}

export interface FacturaDetalle {
  id_factura: number
  numero: string
  periodo: Periodo
  emision: string
  vencimiento: string
  total: number
  pagado: number
  saldo: number
  enRevision: number
  estado: EstadoCobro
  conceptos: ConceptoDetalle[]
  comprobantes: ComprobanteFactura[]
}

/** Todas las facturas del alumno, con conceptos y comprobantes; más recientes primero. */
export function armarFacturas(lectura: LecturaCuenta): FacturaDetalle[] {
  const { facturas, items, pagos } = lectura
  const aprobados = new Set(pagos.filter((p) => p.estado === 'Aprobado').map((p) => p.id_pago))
  const itemPorId = new Map(items.map((i) => [i.id_item, i]))

  return facturas
    .map((f): FacturaDetalle => ({
      id_factura: f.id_factura,
      numero: numeroFactura(f.id_factura),
      periodo: { anio: f.anio, mes: f.mes },
      emision: dia(f.fecha_emision),
      vencimiento: dia(f.fecha_vencimiento),
      total: num(f.total),
      pagado: num(f.cobrado),
      saldo: num(f.saldo),
      enRevision: num(f.en_revision),
      estado: f.estado_cobro,
      conceptos: items
        .filter((i) => i.id_factura === f.id_factura)
        .map((i) => {
          const neto = num(i.neto)
          return {
            id_item: i.id_item,
            descripcion: i.descripcion,
            neto,
            saldo: num(i.saldo),
            estado: neto === 0 ? 'Sin cargo' : i.estado_pago,
            cubiertaPorBeca: Boolean(i.cubierta_por_beca) || num(i.porcentaje_beca) === 100,
            registroAdministrativo:
              neto > 0 &&
              i.estado_pago === 'Pagado' &&
              !(i.id_pago != null && aprobados.has(i.id_pago)),
          }
        }),
      comprobantes: pagos
        .filter((p) => p.id_factura === f.id_factura)
        .map((p) => ({
          idPago: p.id_pago,
          estado: p.estado,
          importe: num(p.monto_pagado),
          fechaCarga: p.fecha_pago,
          fechaRevision: p.fecha_revision,
          motivo: p.motivo_rechazo,
          conceptos: (p.pago_items ?? []).map((pi) => ({
            descripcion: itemPorId.get(pi.id_item)?.descripcion ?? 'Concepto',
            importe: num(pi.importe),
          })),
        }))
        .sort((a, b) => Date.parse(b.fechaCarga) - Date.parse(a.fechaCarga)),
    }))
    .sort((a, b) => b.emision.localeCompare(a.emision) || b.id_factura - a.id_factura)
}

/** Facturas emitidas entre `desde` y `hasta`, incluidos los dos días. */
export function filtrarPorEmision(
  facturas: readonly FacturaDetalle[],
  desde: string,
  hasta: string,
): FacturaDetalle[] {
  return facturas.filter((f) => f.emision >= desde && f.emision <= hasta)
}

// ── HU58: deuda por ítem y mes ─────────────────────────────────
export type EstadoDeuda = 'Pendiente' | 'Vencida' | 'En revision' | 'Pagado'

export interface RenglonDeuda {
  clave: string
  periodo: Periodo
  /** Número de factura, o null si es una cuota heredada (sin factura). */
  factura: string | null
  neto: number
  saldo: number
  estado: EstadoDeuda
}

export interface GrupoDeuda {
  clave: string
  concepto: FilaItemSaldo['concepto']
  descripcion: string
  renglones: RenglonDeuda[]
  /** Suma de los saldos del grupo. */
  saldo: number
}

export interface DeudaPorItem {
  grupos: GrupoDeuda[]
  /** Suma de los saldos de todos los renglones (= ítems pendientes). */
  total: number
  /** Parte del total con un comprobante en revisión (todavía no acreditada). */
  enRevision: number
  /** Conceptos de neto 0 que no se cuentan como deuda. */
  sinCargo: number
}

const ORDEN_CONCEPTO: ReadonlyMap<string, number> = new Map([
  ['Cuota', 0],
  ['Deporte', 1],
  ['Recorrido', 2],
  ['Comedor', 3],
])

function estadoItem(i: FilaItemSaldo, f: FilaFacturaSaldo | undefined): EstadoDeuda {
  if (i.estado_pago === 'Pagado') return 'Pagado'
  if (i.estado_pago === 'En revision') return 'En revision'
  return f?.estado_cobro === 'Vencida' ? 'Vencida' : 'Pendiente'
}

function cuotaHeredadaVencida(c: FilaCuota, hoy: string): boolean {
  if (c.estado === 'Vencida' || c.estado === 'En mora') return true
  return c.fecha_vencimiento !== null && dia(c.fecha_vencimiento) < hoy
}

export function armarDeudaPorItem(lectura: LecturaCuenta, hoy: string): DeudaPorItem {
  const { facturas, items, cuotas } = lectura
  const facturaPorId = new Map(facturas.map((f) => [f.id_factura, f]))
  const facturadas = new Set(items.flatMap((i) => (i.id_cuota === null ? [] : [i.id_cuota])))
  const grupos = new Map<string, GrupoDeuda>()

  const agregar = (
    concepto: GrupoDeuda['concepto'],
    descripcion: string,
    renglon: RenglonDeuda,
  ) => {
    // Cuota y Comedor son un solo grupo; cada deporte y cada recorrido, uno propio
    const clave = concepto === 'Deporte' || concepto === 'Recorrido' ? `${concepto}|${descripcion}` : concepto
    const grupo = grupos.get(clave) ?? { clave, concepto, descripcion, renglones: [], saldo: 0 }
    grupo.renglones.push(renglon)
    grupo.saldo = centavos(grupo.saldo + renglon.saldo)
    grupos.set(clave, grupo)
  }

  let sinCargo = 0
  for (const i of items) {
    if (num(i.neto) <= 0) {
      sinCargo += 1
      continue
    }
    agregar(i.concepto, i.concepto === 'Cuota' ? 'Cuota mensual' : i.descripcion, {
      clave: `item-${i.id_item}`,
      periodo: { anio: i.anio, mes: i.mes },
      factura: numeroFactura(i.id_factura),
      neto: num(i.neto),
      saldo: num(i.saldo),
      estado: estadoItem(i, facturaPorId.get(i.id_factura)),
    })
  }

  // Cuotas heredadas: solo las que no están dentro de una factura
  for (const c of cuotas) {
    if (facturadas.has(c.id_cuota)) continue
    const neto = netoCuota(c)
    if (neto <= 0) {
      sinCargo += 1
      continue
    }
    const impaga = ESTADOS_IMPAGOS.includes(c.estado)
    if (!impaga && c.estado !== 'Pagada') continue
    agregar('Cuota', 'Cuota mensual', {
      clave: `cuota-${c.id_cuota}`,
      periodo: { anio: c.anio, mes: c.mes },
      factura: null,
      neto,
      saldo: impaga ? neto : 0,
      estado: !impaga ? 'Pagado' : cuotaHeredadaVencida(c, hoy) ? 'Vencida' : 'Pendiente',
    })
  }

  const lista = [...grupos.values()]
    .map((g) => ({
      ...g,
      renglones: [...g.renglones].sort(
        (a, b) => clavePeriodo(a.periodo) - clavePeriodo(b.periodo) || a.clave.localeCompare(b.clave),
      ),
    }))
    .sort(
      (a, b) =>
        (ORDEN_CONCEPTO.get(a.concepto) ?? 9) - (ORDEN_CONCEPTO.get(b.concepto) ?? 9) ||
        a.descripcion.localeCompare(b.descripcion),
    )

  const renglones = lista.flatMap((g) => g.renglones)
  return {
    grupos: lista,
    total: centavos(renglones.reduce((s, r) => s + r.saldo, 0)),
    enRevision: centavos(
      renglones.filter((r) => r.estado === 'En revision').reduce((s, r) => s + r.saldo, 0),
    ),
    sinCargo,
  }
}

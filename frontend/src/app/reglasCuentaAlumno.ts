// ═══════════════════════════════════════════════════════════════
//  CUENTA DEL ALUMNO EN LA APP (HU51 a HU56)
// ═══════════════════════════════════════════════════════════════
// Lógica pura (sin Supabase) para probarla con Vitest. Arma lo que ve el
// padre a partir de cuatro lecturas del mismo alumno:
//   - v_facturas_saldo y v_factura_items_saldo (etapa17 y etapa18):
//     total emitido, saldo, estado y detalle de los períodos con factura;
//   - cuotas: las heredadas, sin factura, y los pagos registrados por la
//     administración (fecha y método);
//   - pagos (etapa18): los comprobantes de transferencia cargados por el
//     padre, con sus ítems.
// Reglas:
//   - Una cuota con factura se lee de su ítem Cuota (id_cuota): no se
//     suma otra vez por fuera de la factura.
//   - Neto 0 es "Sin cargo": no es deuda ni dinero cobrado. "Cubierta por
//     beca" solo si el dato lo dice (cubierta_por_beca o el porcentaje
//     copiado en el ítem); no se deduce de la beca actual.
//   - Cargar un comprobante no acredita: el ítem queda "En revision" y
//     sigue en el saldo hasta que se aprueba.
//   - Un pago aprobado muestra su fecha de aprobación y su comprobante de
//     pago. Los pagos registrados por la administración (cuota Pagada sin
//     comprobante aprobado) se muestran como tales, con la fecha de pago
//     registrada: no se les inventa comprobante ni aprobación.
import { ESTADOS_IMPAGOS, netoCuota } from '../reglasCuotas'
import { nombrePeriodo, numeroFactura } from '../reglasFacturacion'
import type { EstadoCobro, EstadoPagoItem, Periodo } from '../reglasFacturacion'

// ── Filas que devuelve la base ─────────────────────────────────
type Numero = number | string

export interface FilaFacturaSaldo {
  id_factura: number
  anio: number
  mes: number
  fecha_emision: string
  fecha_vencimiento: string
  total: Numero
  cobrado: Numero
  saldo: Numero
  estado_cobro: EstadoCobro
  en_revision?: Numero | null
}

export interface FilaItemSaldo {
  id_item: number
  id_factura: number
  anio: number
  mes: number
  concepto: 'Cuota' | 'Deporte' | 'Recorrido' | 'Comedor'
  id_cuota: number | null
  descripcion: string
  porcentaje_beca: Numero | null
  neto: Numero
  cubierta_por_beca: boolean | null
  estado_pago: EstadoPagoItem
  fecha_pago: string | null
  saldo: Numero
  id_pago?: number | null
}

export interface FilaCuota {
  id_cuota: number
  anio: number
  mes: number
  monto_base: Numero
  recargo: Numero | null
  descuento: Numero | null
  fecha_vencimiento: string | null
  estado: string
  fecha_pago: string | null
  metodo_pago: string | null
  cubierta_por_beca: boolean | null
}

export type EstadoComprobante = 'En revision' | 'Aprobado' | 'Rechazado'

export interface FilaPago {
  id_pago: number
  id_factura: number
  estado: EstadoComprobante
  monto_pagado: Numero
  fecha_pago: string // fecha de carga
  fecha_revision: string | null
  motivo_rechazo: string | null
  pago_items: Array<{ id_item: number; importe: Numero; activo: boolean }> | null
}

export interface LecturaCuenta {
  facturas: FilaFacturaSaldo[]
  items: FilaItemSaldo[]
  cuotas: FilaCuota[]
  pagos: FilaPago[]
}

// ── Lo que muestra la app ──────────────────────────────────────
export interface ConceptoFactura {
  id_item: number
  concepto: FilaItemSaldo['concepto']
  descripcion: string
  neto: number
  saldo: number
  estado: EstadoPagoItem
  /** Porcentaje de beca copiado en el ítem al emitir (beca parcial). */
  beca: number | null
  /** Se puede elegir en un comprobante nuevo (Pendiente y con saldo). */
  seleccionable: boolean
}

export interface FacturaPendiente {
  id_factura: number
  numero: string
  periodo: Periodo
  emision: string
  vencimiento: string
  totalEmitido: number
  pagado: number
  saldo: number
  /** Parte del saldo con un comprobante en revisión (no acreditado). */
  enRevision: number
  estado: EstadoCobro
  vencida: boolean
  /** Conceptos con importe (los de neto 0 van a "Sin cargo"). */
  conceptos: ConceptoFactura[]
}

export interface CuotaHeredada {
  id_cuota: number
  periodo: Periodo
  vencimiento: string | null
  importe: number
  estado: string
  vencida: boolean
}

export interface CuotaPagada {
  clave: string
  periodo: Periodo
  importe: number
  /** 'Comprobante': aprobado en la app; 'Registro administrativo': cargado por la administración. */
  origen: 'Comprobante' | 'Registro administrativo'
  /** Comprobante: fecha de aprobación. Registro administrativo: fecha de pago registrada (o null). */
  fecha: string | null
  metodo: string | null
  /** Número de la factura del período, o null si es una cuota heredada. */
  factura: string | null
  /** Comprobante aprobado: su id, para descargar el comprobante de pago. */
  idPago: number | null
}

export interface ConceptoSinCargo {
  clave: string
  periodo: Periodo
  descripcion: string
  cubiertaPorBeca: boolean
  factura: string | null
}

export interface EstadoDeCuenta {
  facturasPendientes: FacturaPendiente[]
  cuotasHeredadas: CuotaHeredada[]
  /** Saldo de las facturas + importe de las cuotas heredadas impagas. */
  saldoPendiente: number
  /** Parte del saldo pendiente con comprobantes en revisión. */
  enRevision: number
  pagadas: CuotaPagada[]
  sinCargo: ConceptoSinCargo[]
}

export type MovimientoPago =
  | {
      tipo: 'comprobante'
      clave: string
      idPago: number
      estado: EstadoComprobante
      importe: number
      fechaCarga: string
      fechaRevision: string | null
      motivo: string | null
      factura: string
      periodo: Periodo | null
      conceptos: string[]
    }
  | {
      tipo: 'administrativo'
      clave: string
      origen: 'Registro administrativo'
      importe: number
      fecha: string | null
      metodo: string | null
      factura: string | null
      periodo: Periodo
    }

// ── Ayudas ─────────────────────────────────────────────────────
const num = (v: Numero | null | undefined) => Number(v ?? 0)
const centavos = (n: number) => Math.round(n * 100) / 100
const clavePeriodo = (p: Periodo) => p.anio * 12 + p.mes

/** 'Diciembre 2026' */
export function periodoTexto(p: Periodo): string {
  const t = nombrePeriodo(p)
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Fecha local 'AAAA-MM-DD' (no UTC: evita correrse de día a la noche). */
export function hoyLocal(fecha = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`
}

/** Cuotas que ya están dentro de una factura (por su ítem Cuota). */
function cuotasFacturadas(items: readonly FilaItemSaldo[]): Map<number, FilaItemSaldo> {
  const mapa = new Map<number, FilaItemSaldo>()
  for (const i of items) if (i.id_cuota !== null) mapa.set(i.id_cuota, i)
  return mapa
}

/** Ids de los comprobantes aprobados. */
const aprobados = (pagos: readonly FilaPago[]) =>
  new Set(pagos.filter((p) => p.estado === 'Aprobado').map((p) => p.id_pago))

/** Ítem pagado con un comprobante aprobado. */
const pagadoConComprobante = (i: FilaItemSaldo, ok: Set<number>) =>
  i.estado_pago === 'Pagado' && i.id_pago != null && ok.has(i.id_pago)

/** Impaga y con fecha de vencimiento anterior a hoy, o marcada así. */
function cuotaVencida(c: FilaCuota, hoy: string): boolean {
  if (c.estado === 'Vencida' || c.estado === 'En mora') return true
  return c.fecha_vencimiento !== null && c.fecha_vencimiento.slice(0, 10) < hoy
}

const becaCompleta = (i: FilaItemSaldo) =>
  Boolean(i.cubierta_por_beca) || num(i.porcentaje_beca) === 100

// ── Estado de cuenta (HU51 y HU52) ─────────────────────────────
export function armarEstadoDeCuenta(
  lectura: LecturaCuenta,
  hoy: string = hoyLocal(),
): EstadoDeCuenta {
  const { facturas, items, cuotas, pagos } = lectura
  const facturadas = cuotasFacturadas(items)
  const cuotaPorId = new Map(cuotas.map((c) => [c.id_cuota, c]))
  const heredadas = cuotas.filter((c) => !facturadas.has(c.id_cuota))
  const ok = aprobados(pagos)

  // HU51: facturas con saldo, con el detalle de sus conceptos con importe
  const facturasPendientes = facturas
    .filter((f) => num(f.saldo) > 0)
    .map(
      (f): FacturaPendiente => ({
        id_factura: f.id_factura,
        numero: numeroFactura(f.id_factura),
        periodo: { anio: f.anio, mes: f.mes },
        emision: f.fecha_emision,
        vencimiento: f.fecha_vencimiento,
        totalEmitido: num(f.total),
        pagado: num(f.cobrado),
        saldo: num(f.saldo),
        enRevision: num(f.en_revision),
        estado: f.estado_cobro,
        vencida: f.estado_cobro === 'Vencida',
        conceptos: items
          .filter((i) => i.id_factura === f.id_factura && num(i.neto) > 0)
          .map((i) => ({
            id_item: i.id_item,
            concepto: i.concepto,
            descripcion: i.descripcion,
            neto: num(i.neto),
            saldo: num(i.saldo),
            estado: i.estado_pago,
            beca: i.porcentaje_beca === null ? null : num(i.porcentaje_beca),
            seleccionable: i.estado_pago === 'Pendiente' && num(i.saldo) > 0,
          })),
      }),
    )
    .sort((a, b) => clavePeriodo(a.periodo) - clavePeriodo(b.periodo))

  // HU51: cuotas heredadas, sin factura, impagas y con importe
  const cuotasHeredadas = heredadas
    .filter((c) => ESTADOS_IMPAGOS.includes(c.estado) && netoCuota(c) > 0)
    .map((c): CuotaHeredada => {
      const vencida = cuotaVencida(c, hoy)
      return {
        id_cuota: c.id_cuota,
        periodo: { anio: c.anio, mes: c.mes },
        vencimiento: c.fecha_vencimiento,
        importe: netoCuota(c),
        estado: vencida && c.estado === 'Pendiente' ? 'Vencida' : c.estado,
        vencida,
      }
    })
    .sort((a, b) => clavePeriodo(a.periodo) - clavePeriodo(b.periodo))

  // HU52: cuotas pagadas (ítem Cuota pagado o cuota heredada pagada)
  const pagadasFactura = items
    .filter((i) => i.concepto === 'Cuota' && i.estado_pago === 'Pagado')
    .map((i): CuotaPagada => {
      const conComprobante = pagadoConComprobante(i, ok)
      const cuota = i.id_cuota !== null ? cuotaPorId.get(i.id_cuota) : undefined
      return {
        clave: `item-${i.id_item}`,
        periodo: { anio: i.anio, mes: i.mes },
        importe: num(i.neto),
        origen: conComprobante ? 'Comprobante' : 'Registro administrativo',
        fecha: i.fecha_pago,
        metodo: cuota?.metodo_pago ?? null,
        factura: numeroFactura(i.id_factura),
        idPago: conComprobante ? (i.id_pago ?? null) : null,
      }
    })
  const pagadasHeredadas = heredadas
    .filter((c) => c.estado === 'Pagada' && netoCuota(c) > 0)
    .map(
      (c): CuotaPagada => ({
        clave: `cuota-${c.id_cuota}`,
        periodo: { anio: c.anio, mes: c.mes },
        importe: netoCuota(c),
        origen: 'Registro administrativo',
        fecha: c.fecha_pago,
        metodo: c.metodo_pago,
        factura: null,
        idPago: null,
      }),
    )
  const pagadas = [...pagadasFactura, ...pagadasHeredadas].sort(
    (a, b) => clavePeriodo(b.periodo) - clavePeriodo(a.periodo),
  )

  // Sin cargo: ítems de neto 0 y cuotas heredadas de neto 0
  const sinCargo = [
    ...items
      .filter((i) => num(i.neto) === 0)
      .map(
        (i): ConceptoSinCargo => ({
          clave: `item-${i.id_item}`,
          periodo: { anio: i.anio, mes: i.mes },
          descripcion: i.descripcion,
          cubiertaPorBeca: becaCompleta(i),
          factura: numeroFactura(i.id_factura),
        }),
      ),
    ...heredadas
      .filter((c) => netoCuota(c) <= 0)
      .map(
        (c): ConceptoSinCargo => ({
          clave: `cuota-${c.id_cuota}`,
          periodo: { anio: c.anio, mes: c.mes },
          descripcion: 'Cuota',
          cubiertaPorBeca: Boolean(c.cubierta_por_beca),
          factura: null,
        }),
      ),
  ].sort((a, b) => clavePeriodo(b.periodo) - clavePeriodo(a.periodo))

  const saldoPendiente = centavos(
    facturasPendientes.reduce((s, f) => s + f.saldo, 0) +
      cuotasHeredadas.reduce((s, c) => s + c.importe, 0),
  )
  const enRevision = centavos(facturasPendientes.reduce((s, f) => s + f.enRevision, 0))

  return { facturasPendientes, cuotasHeredadas, saldoPendiente, enRevision, pagadas, sinCargo }
}

// ── Historial de pagos (HU53) ──────────────────────────────────
// Comprobantes cargados en la app (En revision, Aprobado o Rechazado) y
// pagos registrados por la administración. Una cuota pagada con un
// comprobante aprobado aparece una sola vez: como comprobante. Las
// cubiertas por beca no son pagos. Más recientes primero.
export function armarHistorialPagos(lectura: LecturaCuenta): MovimientoPago[] {
  const { items, cuotas, pagos, facturas } = lectura
  const ok = aprobados(pagos)
  const facturadas = cuotasFacturadas(items)
  const itemPorId = new Map(items.map((i) => [i.id_item, i]))
  const facturaPorId = new Map(facturas.map((f) => [f.id_factura, f]))

  const comprobantes = pagos.map((p): MovimientoPago => {
    const f = facturaPorId.get(p.id_factura)
    return {
      tipo: 'comprobante',
      clave: `pago-${p.id_pago}`,
      idPago: p.id_pago,
      estado: p.estado,
      importe: num(p.monto_pagado),
      fechaCarga: p.fecha_pago,
      fechaRevision: p.fecha_revision,
      motivo: p.motivo_rechazo,
      factura: numeroFactura(p.id_factura),
      periodo: f ? { anio: f.anio, mes: f.mes } : null,
      conceptos: (p.pago_items ?? []).map(
        (pi) => itemPorId.get(pi.id_item)?.descripcion ?? 'Concepto',
      ),
    }
  })

  const administrativos = cuotas
    .filter((c) => c.estado === 'Pagada' && netoCuota(c) > 0)
    .filter((c) => {
      const item = facturadas.get(c.id_cuota)
      return !(item && pagadoConComprobante(item, ok))
    })
    .map((c): MovimientoPago => {
      const item = facturadas.get(c.id_cuota)
      return {
        tipo: 'administrativo',
        clave: `cuota-${c.id_cuota}`,
        origen: 'Registro administrativo',
        importe: netoCuota(c),
        fecha: c.fecha_pago,
        metodo: c.metodo_pago,
        factura: item ? numeroFactura(item.id_factura) : null,
        periodo: { anio: c.anio, mes: c.mes },
      }
    })

  const momento = (m: MovimientoPago): number => {
    const f = m.tipo === 'comprobante' ? (m.fechaRevision ?? m.fechaCarga) : m.fecha
    return f ? Date.parse(f) : Number.NEGATIVE_INFINITY
  }
  // Sin fecha registrada, al final (sin restar infinitos)
  return [...comprobantes, ...administrativos].sort((a, b) => {
    const x = momento(a)
    const y = momento(b)
    if (x === y) return 0
    return y > x ? 1 : -1
  })
}

// ═══════════════════════════════════════════════════════════════
//  CUENTA DEL ALUMNO EN LA APP (HU51, HU52 parcial y HU53 parcial)
// ═══════════════════════════════════════════════════════════════
// Lógica pura (sin Supabase) para probarla con Vitest. Arma lo que ve el
// padre a partir de tres lecturas del mismo alumno:
//   - v_facturas_saldo y v_factura_items_saldo (contrato de etapa17):
//     total emitido, saldo, estado y detalle de los períodos con factura;
//   - cuotas: solo para las cuotas heredadas, sin factura, y para la
//     fecha y el método de los pagos registrados por la administración.
// Reglas:
//   - Una cuota con factura se lee de su ítem Cuota (id_cuota): no se
//     suma otra vez por fuera de la factura.
//   - Neto 0 es "Sin cargo": no es deuda ni dinero cobrado. "Cubierta por
//     beca" solo si el dato lo dice (cubierta_por_beca o el porcentaje
//     copiado en el ítem); no se deduce de la beca actual.
//   - Hasta HU54 a HU56 no hay comprobantes: los pagos son registros
//     administrativos (cuotas.estado = 'Pagada'), con la fecha de pago
//     registrada, que no es una fecha de aprobación.
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

export interface LecturaCuenta {
  facturas: FilaFacturaSaldo[]
  items: FilaItemSaldo[]
  cuotas: FilaCuota[]
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
  /** Fecha de pago registrada por la administración; null si falta. */
  fechaPago: string | null
  metodo: string | null
  /** Número de la factura del período, o null si es una cuota heredada. */
  factura: string | null
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
  pagadas: CuotaPagada[]
  sinCargo: ConceptoSinCargo[]
}

export interface PagoRegistrado {
  clave: string
  periodo: Periodo
  importe: number
  fecha: string | null
  metodo: string | null
  factura: string | null
  origen: 'Registro administrativo'
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
function cuotasFacturadas(items: readonly FilaItemSaldo[]): Map<number, number> {
  const mapa = new Map<number, number>()
  for (const i of items) if (i.id_cuota !== null) mapa.set(i.id_cuota, i.id_factura)
  return mapa
}

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
  const { facturas, items, cuotas } = lectura
  const facturadas = cuotasFacturadas(items)
  const cuotaPorId = new Map(cuotas.map((c) => [c.id_cuota, c]))
  const heredadas = cuotas.filter((c) => !facturadas.has(c.id_cuota))

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
    .map(
      (i): CuotaPagada => ({
        clave: `item-${i.id_item}`,
        periodo: { anio: i.anio, mes: i.mes },
        importe: num(i.neto),
        fechaPago: i.fecha_pago,
        metodo: (i.id_cuota !== null ? cuotaPorId.get(i.id_cuota)?.metodo_pago : null) ?? null,
        factura: numeroFactura(i.id_factura),
      }),
    )
  const pagadasHeredadas = heredadas
    .filter((c) => c.estado === 'Pagada' && netoCuota(c) > 0)
    .map(
      (c): CuotaPagada => ({
        clave: `cuota-${c.id_cuota}`,
        periodo: { anio: c.anio, mes: c.mes },
        importe: netoCuota(c),
        fechaPago: c.fecha_pago,
        metodo: c.metodo_pago,
        factura: null,
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

  return { facturasPendientes, cuotasHeredadas, saldoPendiente, pagadas, sinCargo }
}

// ── Historial de pagos (HU53, parcial) ─────────────────────────
// Solo los pagos registrados por la administración: cada cuota pagada
// con importe. Las cubiertas por beca no son pagos. Más recientes
// primero; los que no tienen fecha registrada, al final.
export function armarHistorialPagos(lectura: LecturaCuenta): PagoRegistrado[] {
  const facturadas = cuotasFacturadas(lectura.items)
  return lectura.cuotas
    .filter((c) => c.estado === 'Pagada' && netoCuota(c) > 0)
    .map((c): PagoRegistrado => {
      const idFactura = facturadas.get(c.id_cuota)
      return {
        clave: `cuota-${c.id_cuota}`,
        periodo: { anio: c.anio, mes: c.mes },
        importe: netoCuota(c),
        fecha: c.fecha_pago,
        metodo: c.metodo_pago,
        factura: idFactura === undefined ? null : numeroFactura(idFactura),
        origen: 'Registro administrativo',
      }
    })
    .sort((a, b) => {
      if (a.fecha !== b.fecha) {
        if (a.fecha === null) return 1
        if (b.fecha === null) return -1
        return b.fecha.localeCompare(a.fecha)
      }
      return clavePeriodo(b.periodo) - clavePeriodo(a.periodo)
    })
}

import { describe, it, expect } from 'vitest'
import { armarEstadoDeCuenta, armarHistorialPagos, hoyLocal, periodoTexto } from './reglasCuentaAlumno'
import type {
  FilaCuota,
  FilaFacturaSaldo,
  FilaItemSaldo,
  FilaPago,
  LecturaCuenta,
} from './reglasCuentaAlumno'

const HOY = '2026-11-08'

const factura = (f: Partial<FilaFacturaSaldo> & { id_factura: number; mes: number }): FilaFacturaSaldo => ({
  anio: 2026,
  fecha_emision: '2026-10-30',
  fecha_vencimiento: `2026-${String(f.mes).padStart(2, '0')}-10`,
  total: 0,
  cobrado: 0,
  saldo: 0,
  estado_cobro: 'Pendiente',
  en_revision: 0,
  ...f,
})

const item = (i: Partial<FilaItemSaldo> & { id_item: number; id_factura: number; mes: number }): FilaItemSaldo => ({
  anio: 2026,
  concepto: 'Cuota',
  id_cuota: null,
  descripcion: 'Cuota',
  porcentaje_beca: null,
  neto: 0,
  cubierta_por_beca: false,
  estado_pago: 'Pendiente',
  fecha_pago: null,
  saldo: 0,
  id_pago: null,
  ...i,
})

const cuota = (c: Partial<FilaCuota> & { id_cuota: number; mes: number }): FilaCuota => ({
  anio: 2026,
  monto_base: 10000,
  recargo: 0,
  descuento: 0,
  fecha_vencimiento: `2026-${String(c.mes).padStart(2, '0')}-10`,
  estado: 'Pendiente',
  fecha_pago: null,
  metodo_pago: null,
  cubierta_por_beca: false,
  ...c,
})

const pago = (p: Partial<FilaPago> & { id_pago: number; id_factura: number }): FilaPago => ({
  estado: 'En revision',
  monto_pagado: 0,
  fecha_pago: '2026-12-02T15:00:00-03:00',
  fecha_revision: null,
  motivo_rechazo: null,
  pago_items: [],
  ...p,
})

const sinPagos = (l: Omit<LecturaCuenta, 'pagos'>): LecturaCuenta => ({ ...l, pagos: [] })

// Diciembre facturado: cuota pagada por la administración, deporte y
// comedor pendientes. Noviembre facturado con beca del 100 % en la cuota.
// Septiembre y octubre: cuotas heredadas sin factura (una pagada sin
// fecha, otra vencida). Agosto: cuota heredada con neto 0 sin marca.
const lectura: LecturaCuenta = sinPagos({
  facturas: [
    factura({ id_factura: 12, mes: 12, total: '25000.00', cobrado: '10000.00', saldo: '15000.00', estado_cobro: 'Parcial' }),
    factura({ id_factura: 11, mes: 11, total: 8000, cobrado: 0, saldo: 8000, estado_cobro: 'Vencida' }),
  ],
  items: [
    item({ id_item: 1, id_factura: 12, mes: 12, id_cuota: 40, neto: '10000.00', estado_pago: 'Pagado', fecha_pago: '2026-12-03' }),
    item({ id_item: 2, id_factura: 12, mes: 12, concepto: 'Deporte', descripcion: 'Vóley', neto: 9000, saldo: 9000 }),
    item({ id_item: 3, id_factura: 12, mes: 12, concepto: 'Comedor', descripcion: 'Comedor', neto: 6000, saldo: 6000 }),
    item({ id_item: 4, id_factura: 11, mes: 11, id_cuota: 39, porcentaje_beca: '100.00', neto: 0, cubierta_por_beca: true, estado_pago: 'Sin cargo' }),
    item({ id_item: 5, id_factura: 11, mes: 11, concepto: 'Recorrido', descripcion: 'Recorrido 2', neto: 8000, saldo: 8000 }),
  ],
  cuotas: [
    cuota({ id_cuota: 36, mes: 8, monto_base: 10000, descuento: 10000 }),
    cuota({ id_cuota: 37, mes: 9, estado: 'Pagada', fecha_pago: null, metodo_pago: 'Efectivo' }),
    cuota({ id_cuota: 38, mes: 10, monto_base: 9500 }),
    cuota({ id_cuota: 39, mes: 11, descuento: 10000, estado: 'Pagada', cubierta_por_beca: true }),
    cuota({ id_cuota: 40, mes: 12, estado: 'Pagada', fecha_pago: '2026-12-03', metodo_pago: 'Transferencia' }),
  ],
})

describe('armarEstadoDeCuenta (HU51 y HU52)', () => {
  const cuenta = armarEstadoDeCuenta(lectura, HOY)

  it('lista las facturas con saldo, ordenadas por período, con total emitido, pagado y saldo', () => {
    expect(
      cuenta.facturasPendientes.map((f) => [f.numero, f.totalEmitido, f.pagado, f.saldo, f.estado, f.vencida]),
    ).toEqual([
      ['F-000011', 8000, 0, 8000, 'Vencida', true],
      ['F-000012', 25000, 10000, 15000, 'Parcial', false],
    ])
  })

  it('el detalle por concepto excluye los de neto 0; solo los pendientes se pueden elegir', () => {
    const dic = cuenta.facturasPendientes.find((f) => f.id_factura === 12)
    expect(dic?.conceptos.map((c) => [c.descripcion, c.neto, c.saldo, c.estado, c.seleccionable])).toEqual([
      ['Cuota', 10000, 0, 'Pagado', false],
      ['Vóley', 9000, 9000, 'Pendiente', true],
      ['Comedor', 6000, 6000, 'Pendiente', true],
    ])
    const nov = cuenta.facturasPendientes.find((f) => f.id_factura === 11)
    expect(nov?.conceptos.map((c) => c.descripcion)).toEqual(['Recorrido 2'])
  })

  it('las cuotas heredadas impagas van aparte y no repiten las que tienen factura', () => {
    expect(cuenta.cuotasHeredadas.map((c) => [c.id_cuota, c.importe, c.estado, c.vencida])).toEqual([
      [38, 9500, 'Vencida', true],
    ])
  })

  it('el saldo pendiente suma el saldo de las facturas y las heredadas, sin contar la cuota dos veces', () => {
    expect(cuenta.saldoPendiente).toBe(8000 + 15000 + 9500)
    expect(cuenta.enRevision).toBe(0)
  })

  it('una cuota heredada que todavía no venció no se destaca', () => {
    const r = armarEstadoDeCuenta(
      sinPagos({ facturas: [], items: [], cuotas: [cuota({ id_cuota: 50, mes: 11, fecha_vencimiento: '2026-11-10' })] }),
      HOY,
    )
    expect(r.cuotasHeredadas).toEqual([
      { id_cuota: 50, periodo: { anio: 2026, mes: 11 }, vencimiento: '2026-11-10', importe: 10000, estado: 'Pendiente', vencida: false },
    ])
  })

  it('pagadas sin comprobante: registro administrativo con la fecha registrada, sin duplicar', () => {
    expect(cuenta.pagadas).toEqual([
      {
        clave: 'item-1',
        periodo: { anio: 2026, mes: 12 },
        importe: 10000,
        origen: 'Registro administrativo',
        fecha: '2026-12-03',
        metodo: 'Transferencia',
        factura: 'F-000012',
        idPago: null,
      },
      {
        clave: 'cuota-37',
        periodo: { anio: 2026, mes: 9 },
        importe: 10000,
        origen: 'Registro administrativo',
        fecha: null,
        metodo: 'Efectivo',
        factura: null,
        idPago: null,
      },
    ])
  })

  it('la cubierta por beca no figura como pagada ni como deuda: va a Sin cargo', () => {
    expect(cuenta.pagadas.some((p) => p.periodo.mes === 11)).toBe(false)
    expect(cuenta.sinCargo).toEqual([
      { clave: 'item-4', periodo: { anio: 2026, mes: 11 }, descripcion: 'Cuota', cubiertaPorBeca: true, factura: 'F-000011' },
      { clave: 'cuota-36', periodo: { anio: 2026, mes: 8 }, descripcion: 'Cuota', cubiertaPorBeca: false, factura: null },
    ])
  })

  it('"Cubierta por beca" solo con el dato: neto 0 sin marca queda como sin cargo a secas', () => {
    const r = armarEstadoDeCuenta(
      sinPagos({
        facturas: [],
        items: [item({ id_item: 9, id_factura: 20, mes: 12, id_cuota: 60, porcentaje_beca: null, neto: 0, cubierta_por_beca: false, estado_pago: 'Sin cargo' })],
        cuotas: [cuota({ id_cuota: 60, mes: 12, descuento: 10000 })],
      }),
      HOY,
    )
    expect(r.sinCargo.map((s) => s.cubiertaPorBeca)).toEqual([false])
    expect(r.cuotasHeredadas).toEqual([])
    expect(r.saldoPendiente).toBe(0)
  })

  it('una factura sin saldo no aparece en pendientes', () => {
    const r = armarEstadoDeCuenta(
      sinPagos({
        facturas: [factura({ id_factura: 30, mes: 12, total: 10000, cobrado: 10000, saldo: 0, estado_cobro: 'Pagada' })],
        items: [],
        cuotas: [],
      }),
      HOY,
    )
    expect(r.facturasPendientes).toEqual([])
  })

  it('sin datos devuelve todo vacío', () => {
    expect(armarEstadoDeCuenta({ facturas: [], items: [], cuotas: [], pagos: [] }, HOY)).toEqual({
      facturasPendientes: [],
      cuotasHeredadas: [],
      saldoPendiente: 0,
      enRevision: 0,
      pagadas: [],
      sinCargo: [],
    })
  })
})

// Enero 2027: comprobante 7 aprobado (cuota), comprobante 8 en revisión
// (comedor) y comprobante 9 rechazado (deporte, que vuelve a Pendiente).
const conComprobantes: LecturaCuenta = {
  facturas: [factura({ id_factura: 30, anio: 2027, mes: 1, total: 25000, cobrado: 10000, saldo: 15000, estado_cobro: 'Parcial', en_revision: 6000 })],
  items: [
    item({ id_item: 31, id_factura: 30, anio: 2027, mes: 1, id_cuota: 70, neto: 10000, estado_pago: 'Pagado', fecha_pago: '2027-01-05', id_pago: 7 }),
    item({ id_item: 32, id_factura: 30, anio: 2027, mes: 1, concepto: 'Comedor', descripcion: 'Comedor', neto: 6000, saldo: 6000, estado_pago: 'En revision', id_pago: 8 }),
    item({ id_item: 33, id_factura: 30, anio: 2027, mes: 1, concepto: 'Deporte', descripcion: 'Vóley', neto: 9000, saldo: 9000 }),
  ],
  cuotas: [cuota({ id_cuota: 70, anio: 2027, mes: 1, estado: 'Pagada', fecha_pago: '2027-01-05', metodo_pago: 'Transferencia' })],
  pagos: [
    pago({ id_pago: 7, id_factura: 30, estado: 'Aprobado', monto_pagado: '10000.00', fecha_pago: '2027-01-03T10:00:00-03:00', fecha_revision: '2027-01-05T09:00:00-03:00', pago_items: [{ id_item: 31, importe: 10000, activo: true }] }),
    pago({ id_pago: 8, id_factura: 30, estado: 'En revision', monto_pagado: 6000, fecha_pago: '2027-01-06T10:00:00-03:00', pago_items: [{ id_item: 32, importe: 6000, activo: true }] }),
    pago({ id_pago: 9, id_factura: 30, estado: 'Rechazado', monto_pagado: 9000, fecha_pago: '2027-01-02T10:00:00-03:00', fecha_revision: '2027-01-04T11:00:00-03:00', motivo_rechazo: 'El importe no coincide', pago_items: [{ id_item: 33, importe: 9000, activo: false }] }),
  ],
}

describe('con comprobantes (HU54 a HU56)', () => {
  const cuenta = armarEstadoDeCuenta(conComprobantes, '2027-01-07')

  it('un concepto En revisión sigue en el saldo y no se puede elegir otra vez', () => {
    const f = cuenta.facturasPendientes[0]
    expect(f.saldo).toBe(15000)
    expect(f.enRevision).toBe(6000)
    expect(cuenta.enRevision).toBe(6000)
    expect(f.conceptos.map((c) => [c.descripcion, c.estado, c.seleccionable])).toEqual([
      ['Cuota', 'Pagado', false],
      ['Comedor', 'En revision', false],
      ['Vóley', 'Pendiente', true],
    ])
  })

  it('la cuota pagada con comprobante aprobado muestra la fecha de aprobación y su comprobante', () => {
    expect(cuenta.pagadas).toEqual([
      {
        clave: 'item-31',
        periodo: { anio: 2027, mes: 1 },
        importe: 10000,
        origen: 'Comprobante',
        fecha: '2027-01-05',
        metodo: 'Transferencia',
        factura: 'F-000030',
        idPago: 7,
      },
    ])
  })

  it('el historial muestra los tres estados, el motivo del rechazo y no duplica la cuota aprobada', () => {
    const h = armarHistorialPagos(conComprobantes)
    expect(h.map((m) => [m.clave, m.tipo === 'comprobante' ? m.estado : m.origen])).toEqual([
      ['pago-8', 'En revision'],
      ['pago-7', 'Aprobado'],
      ['pago-9', 'Rechazado'],
    ])
    const rechazado = h.find((m) => m.clave === 'pago-9')
    expect(rechazado).toMatchObject({ motivo: 'El importe no coincide', conceptos: ['Vóley'], importe: 9000, factura: 'F-000030' })
    expect(h.find((m) => m.clave === 'pago-7')).toMatchObject({ periodo: { anio: 2027, mes: 1 }, conceptos: ['Cuota'] })
  })
})

describe('armarHistorialPagos: registros administrativos', () => {
  it('los identifica como tales, con factura cuando existe, y los sin fecha al final', () => {
    expect(armarHistorialPagos(lectura)).toEqual([
      {
        tipo: 'administrativo',
        clave: 'cuota-40',
        origen: 'Registro administrativo',
        importe: 10000,
        fecha: '2026-12-03',
        metodo: 'Transferencia',
        factura: 'F-000012',
        periodo: { anio: 2026, mes: 12 },
      },
      {
        tipo: 'administrativo',
        clave: 'cuota-37',
        origen: 'Registro administrativo',
        importe: 10000,
        fecha: null,
        metodo: 'Efectivo',
        factura: null,
        periodo: { anio: 2026, mes: 9 },
      },
    ])
  })

  it('ordena por fecha, la más reciente primero, y no incluye las impagas ni las de beca', () => {
    const r = armarHistorialPagos(
      sinPagos({
        facturas: [],
        items: [],
        cuotas: [
          cuota({ id_cuota: 1, mes: 3, estado: 'Pagada', fecha_pago: '2026-03-05' }),
          cuota({ id_cuota: 2, mes: 4, estado: 'Pagada', fecha_pago: '2026-04-02' }),
          cuota({ id_cuota: 3, mes: 5, estado: 'Pendiente' }),
          cuota({ id_cuota: 4, mes: 6, estado: 'Pagada', descuento: 10000, cubierta_por_beca: true }),
        ],
      }),
    )
    expect(r.map((p) => p.clave)).toEqual(['cuota-2', 'cuota-1'])
  })
})

describe('ayudas', () => {
  it('hoyLocal usa la fecha local, no la UTC', () => {
    expect(hoyLocal(new Date(2026, 10, 8, 23, 30))).toBe('2026-11-08')
  })
  it('periodoTexto', () => {
    expect(periodoTexto({ anio: 2026, mes: 12 })).toBe('Diciembre 2026')
  })
})

import { describe, it, expect } from 'vitest'
import { armarEstadoDeCuenta } from './reglasCuentaAlumno'
import type {
  FilaCuota,
  FilaFacturaSaldo,
  FilaItemSaldo,
  FilaPago,
  LecturaCuenta,
} from './reglasCuentaAlumno'
import {
  MENSAJES_RANGO,
  armarDeudaPorItem,
  armarFacturas,
  esFechaValida,
  filtrarPorEmision,
  rangoInicial,
  validarRango,
} from './reglasFacturasDeuda'

const HOY = '2026-11-09'

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
  descripcion: 'Cuota mensual',
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

// Diciembre (F-12, emitida el 30/11): cuota pagada por comprobante aprobado,
// Fútbol en revisión, Recorrido 2 pendiente y comedor pendiente.
// Noviembre (F-11, emitida el 31/10, vencida): cuota pagada por la
// administración, Vóley pendiente y comedor sin cargo.
// Octubre: cuota heredada (sin factura) vencida. Septiembre: heredada pagada.
// Agosto: heredada de neto 0 (beca).
const lectura: LecturaCuenta = {
  facturas: [
    factura({ id_factura: 12, mes: 12, fecha_emision: '2026-11-30', total: 23000, cobrado: 10000, saldo: 13000, estado_cobro: 'Parcial', en_revision: 1000 }),
    factura({ id_factura: 11, mes: 11, fecha_emision: '2026-10-31', total: 19000, cobrado: 10000, saldo: 9000, estado_cobro: 'Vencida' }),
  ],
  items: [
    item({ id_item: 1, id_factura: 12, mes: 12, id_cuota: 40, neto: '10000.00', estado_pago: 'Pagado', fecha_pago: '2026-12-03', id_pago: 7 }),
    item({ id_item: 2, id_factura: 12, mes: 12, concepto: 'Deporte', descripcion: 'Deporte: Fútbol', neto: 1000, saldo: 1000, estado_pago: 'En revision', id_pago: 8 }),
    item({ id_item: 3, id_factura: 12, mes: 12, concepto: 'Recorrido', descripcion: 'Transporte: Recorrido 2', neto: 7000, saldo: 7000 }),
    item({ id_item: 4, id_factura: 12, mes: 12, concepto: 'Comedor', descripcion: 'Comedor', neto: 5000, saldo: 5000 }),
    item({ id_item: 5, id_factura: 11, mes: 11, id_cuota: 39, neto: 10000, estado_pago: 'Pagado', fecha_pago: '2026-11-05' }),
    item({ id_item: 6, id_factura: 11, mes: 11, concepto: 'Deporte', descripcion: 'Deporte: Vóley', neto: '9000.00', saldo: '9000.00' }),
    item({ id_item: 7, id_factura: 11, mes: 11, concepto: 'Comedor', descripcion: 'Comedor', neto: 0, estado_pago: 'Sin cargo', cubierta_por_beca: true }),
  ],
  cuotas: [
    cuota({ id_cuota: 40, mes: 12, estado: 'Pagada' }),
    cuota({ id_cuota: 39, mes: 11, estado: 'Pagada', fecha_pago: '2026-11-05', metodo_pago: 'Transferencia' }),
    cuota({ id_cuota: 38, mes: 10, estado: 'Vencida', monto_base: 9500 }),
    cuota({ id_cuota: 37, mes: 9, estado: 'Pagada', monto_base: 9500 }),
    cuota({ id_cuota: 36, mes: 8, estado: 'Pendiente', monto_base: 9500, descuento: 9500, cubierta_por_beca: true }),
  ],
  pagos: [
    pago({ id_pago: 7, id_factura: 12, estado: 'Aprobado', monto_pagado: 10000, fecha_pago: '2026-12-01T10:00:00-03:00', fecha_revision: '2026-12-03T09:00:00-03:00', pago_items: [{ id_item: 1, importe: '10000.00', activo: true }] }),
    pago({ id_pago: 8, id_factura: 12, estado: 'En revision', monto_pagado: 1000, fecha_pago: '2026-12-04T10:00:00-03:00', pago_items: [{ id_item: 2, importe: 1000, activo: true }] }),
    pago({ id_pago: 6, id_factura: 12, estado: 'Rechazado', monto_pagado: 5000, fecha_pago: '2026-12-01T08:00:00-03:00', fecha_revision: '2026-12-01T12:00:00-03:00', motivo_rechazo: 'No se ve el importe', pago_items: [{ id_item: 4, importe: 5000, activo: false }] }),
  ],
}

describe('rango de fechas (HU57)', () => {
  it('desde no puede ser posterior a hasta; el mismo día sí sirve', () => {
    expect(validarRango('2026-11-10', '2026-11-09')).toBe(MENSAJES_RANGO.invertido)
    expect(validarRango('2026-11-09', '2026-11-09')).toBeNull()
    expect(validarRango('2026-01-01', '2026-12-31')).toBeNull()
  })

  it('faltan fechas o son inválidas', () => {
    expect(validarRango('', '2026-11-09')).toBe(MENSAJES_RANGO.faltaDesde)
    expect(validarRango('2026-11-09', '')).toBe(MENSAJES_RANGO.faltaHasta)
    expect(validarRango('2026-02-30', '2026-03-01')).toBe(MENSAJES_RANGO.invalida)
    expect(validarRango('09/11/2026', '2026-11-10')).toBe(MENSAJES_RANGO.invalida)
    expect(esFechaValida('2028-02-29')).toBe(true)
    expect(esFechaValida('2026-02-29')).toBe(false)
  })

  it('el rango inicial va del 1 de enero hasta hoy', () => {
    expect(rangoInicial(HOY)).toEqual({ desde: '2026-01-01', hasta: HOY })
  })

  it('filtra por fecha de emisión incluyendo los dos días', () => {
    const facturas = armarFacturas(lectura)
    const ids = (d: string, h: string) => filtrarPorEmision(facturas, d, h).map((f) => f.id_factura)
    expect(ids('2026-10-31', '2026-11-30')).toEqual([12, 11])
    expect(ids('2026-11-01', '2026-11-30')).toEqual([12])
    expect(ids('2026-10-31', '2026-10-31')).toEqual([11])
    expect(ids('2026-10-01', '2026-10-30')).toEqual([])
    // No filtra por el período facturado: diciembre se emitió en noviembre
    expect(ids('2026-12-01', '2026-12-31')).toEqual([])
  })
})

describe('facturas con conceptos y comprobantes (HU57)', () => {
  const facturas = armarFacturas(lectura)
  const dic = facturas.find((f) => f.id_factura === 12)
  const nov = facturas.find((f) => f.id_factura === 11)

  it('lista las facturas más recientes primero con sus importes', () => {
    expect(facturas.map((f) => f.numero)).toEqual(['F-000012', 'F-000011'])
    expect(dic).toMatchObject({ total: 23000, pagado: 10000, saldo: 13000, enRevision: 1000, estado: 'Parcial', emision: '2026-11-30', vencimiento: '2026-12-10' })
  })

  it('muestra todos los conceptos con su estado; neto 0 como Sin cargo', () => {
    expect(dic?.conceptos.map((c) => [c.descripcion, c.neto, c.estado])).toEqual([
      ['Cuota mensual', 10000, 'Pagado'],
      ['Deporte: Fútbol', 1000, 'En revision'],
      ['Transporte: Recorrido 2', 7000, 'Pendiente'],
      ['Comedor', 5000, 'Pendiente'],
    ])
    expect(nov?.conceptos.find((c) => c.id_item === 7)).toMatchObject({ estado: 'Sin cargo', cubiertaPorBeca: true })
  })

  it('distingue lo pagado por comprobante de lo registrado por la administración', () => {
    expect(dic?.conceptos.find((c) => c.id_item === 1)?.registroAdministrativo).toBe(false)
    expect(nov?.conceptos.find((c) => c.id_item === 5)?.registroAdministrativo).toBe(true)
  })

  it('lista todos los comprobantes de la factura, con estado, importes y motivo', () => {
    expect(dic?.comprobantes.map((c) => [c.idPago, c.estado])).toEqual([
      [8, 'En revision'],
      [7, 'Aprobado'],
      [6, 'Rechazado'],
    ])
    expect(dic?.comprobantes.find((c) => c.idPago === 6)).toMatchObject({
      motivo: 'No se ve el importe',
      conceptos: [{ descripcion: 'Comedor', importe: 5000 }],
    })
    expect(nov?.comprobantes).toEqual([])
  })
})

describe('deuda por ítem y mes (HU58)', () => {
  const deuda = armarDeudaPorItem(lectura, HOY)

  it('agrupa la cuota, cada deporte, cada recorrido y el comedor', () => {
    expect(deuda.grupos.map((g) => g.descripcion)).toEqual([
      'Cuota mensual',
      'Deporte: Fútbol',
      'Deporte: Vóley',
      'Transporte: Recorrido 2',
      'Comedor',
    ])
  })

  it('muestra cada mes con su saldo; la cuota heredada se cuenta una sola vez', () => {
    const cuotas = deuda.grupos.find((g) => g.concepto === 'Cuota')
    expect(cuotas?.renglones.map((r) => [r.periodo.mes, r.factura, r.saldo, r.estado])).toEqual([
      [9, null, 0, 'Pagado'],
      [10, null, 9500, 'Vencida'],
      [11, 'F-000011', 0, 'Pagado'],
      [12, 'F-000012', 0, 'Pagado'],
    ])
    expect(cuotas?.saldo).toBe(9500)
  })

  it('un comprobante en revisión no acredita: sigue en el total', () => {
    const futbol = deuda.grupos.find((g) => g.descripcion === 'Deporte: Fútbol')
    expect(futbol?.renglones[0]).toMatchObject({ saldo: 1000, estado: 'En revision' })
    expect(deuda.enRevision).toBe(1000)
  })

  it('los ítems de una factura vencida figuran como Vencida', () => {
    const voley = deuda.grupos.find((g) => g.descripcion === 'Deporte: Vóley')
    expect(voley?.renglones[0]).toMatchObject({ saldo: 9000, estado: 'Vencida' })
  })

  it('sin cargo no es deuda', () => {
    const comedor = deuda.grupos.find((g) => g.concepto === 'Comedor')
    expect(comedor?.renglones.map((r) => r.periodo.mes)).toEqual([12])
    expect(deuda.sinCargo).toBe(2) // comedor de noviembre y cuota heredada de agosto
  })

  it('el total coincide con la suma de los ítems pendientes y con el saldo de Cuotas', () => {
    const pendientes = deuda.grupos.flatMap((g) => g.renglones).filter((r) => r.estado !== 'Pagado')
    expect(deuda.total).toBe(pendientes.reduce((s, r) => s + r.saldo, 0))
    expect(deuda.total).toBe(1000 + 7000 + 5000 + 9000 + 9500)
    expect(deuda.total).toBe(armarEstadoDeCuenta(lectura, HOY).saldoPendiente)
  })

  it('sin facturas ni cuotas no hay grupos ni deuda', () => {
    expect(armarDeudaPorItem({ facturas: [], items: [], cuotas: [], pagos: [] }, HOY)).toEqual({
      grupos: [],
      total: 0,
      enRevision: 0,
      sinCargo: 0,
    })
  })
})

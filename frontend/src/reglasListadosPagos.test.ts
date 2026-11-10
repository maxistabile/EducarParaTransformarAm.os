import { describe, it, expect } from 'vitest'
import {
  MENSAJES_LISTADOS,
  SIN_DATO_GRUPO,
  SIN_FECHA,
  SIN_INSCRIPCION,
  SIN_PAGOS,
  anioDeCursado,
  diaArgentina,
  listadoDeportes,
  listadoFacturas,
  listadoIngresos,
  listadoRecorridos,
  tablaFacturas,
  tablaIngresos,
  tablaItems,
  validarRangoDias,
  validarRangoMeses,
} from './reglasListadosPagos'
import type { DatosListados, FacturaL, ItemL } from './reglasListadosPagos'

const fac = (f: Partial<FacturaL> & { id_factura: number; id_alumno: number; mes: number }): FacturaL => ({
  anio: 2026,
  alumno_nombre: 'Alumno',
  curso: 'Primario 3 A',
  fecha_vencimiento: `2026-${String(f.mes).padStart(2, '0')}-10`,
  total: 0,
  cobrado: 0,
  saldo: 0,
  en_revision: 0,
  ...f,
})
const item = (i: Partial<ItemL> & { id_item: number; id_factura: number }): ItemL => ({
  concepto: 'Cuota',
  id_cuota: null,
  id_actividad: null,
  id_recorrido: null,
  descripcion: 'Cuota mensual',
  neto: 0,
  saldo: 0,
  estado_pago: 'Pendiente',
  fecha_pago: null,
  id_pago: null,
  ...i,
})
const persona = (nombre: string, apellido: string) => ({ usuarios: { nombre, apellido } })

// Noviembre: Ana pagó todo con el comprobante 7 (aprobado el 30/11 a la noche en
// Argentina, 01/12 en UTC); Beto pagó la cuota por administración y tiene el
// deporte En revisión y el recorrido pendiente. Diciembre: Caro sin pagar
// (cuota, recorrido y un deporte sin inscripción); Dani con beca del 100 %;
// Ana pagó el deporte con el comprobante 9, ya en otro grupo.
const datos: DatosListados = {
  facturas: [
    fac({ id_factura: 1, id_alumno: 1, mes: 11, alumno_nombre: 'Uno, Ana', curso: 'Primario 3 A', total: 16000, cobrado: 16000, saldo: 0 }),
    fac({ id_factura: 2, id_alumno: 2, mes: 11, alumno_nombre: 'Dos, Beto', curso: 'Secundario 1 B', total: 12000, cobrado: 10000, saldo: 2000, en_revision: 1000 }),
    fac({ id_factura: 3, id_alumno: 3, mes: 12, alumno_nombre: 'Tres, Caro', curso: 'Primario 3 B', total: 12000, cobrado: 0, saldo: 12000 }),
    fac({ id_factura: 4, id_alumno: 4, mes: 12, alumno_nombre: 'Cuatro, Dani', total: 0, cobrado: 0, saldo: 0 }),
    fac({ id_factura: 5, id_alumno: 1, mes: 12, alumno_nombre: 'Uno, Ana', curso: 'Primario 3 A', total: 1000, cobrado: 1000, saldo: 0 }),
  ],
  items: [
    item({ id_item: 11, id_factura: 1, id_cuota: 101, neto: 10000, estado_pago: 'Pagado', fecha_pago: '2026-11-30', id_pago: 7 }),
    item({ id_item: 12, id_factura: 1, concepto: 'Deporte', id_actividad: 1, descripcion: 'Deporte: Futbol', neto: 1000, estado_pago: 'Pagado', fecha_pago: '2026-11-30', id_pago: 7 }),
    item({ id_item: 13, id_factura: 1, concepto: 'Comedor', descripcion: 'Comedor', neto: 5000, estado_pago: 'Pagado', fecha_pago: '2026-11-30', id_pago: 7 }),
    item({ id_item: 21, id_factura: 2, id_cuota: 102, neto: 10000, estado_pago: 'Pagado', fecha_pago: '2026-11-05' }),
    item({ id_item: 22, id_factura: 2, concepto: 'Deporte', id_actividad: 1, descripcion: 'Deporte: Futbol', neto: 1000, saldo: 1000, estado_pago: 'En revision', id_pago: 8 }),
    item({ id_item: 23, id_factura: 2, concepto: 'Recorrido', id_recorrido: 1, descripcion: 'Transporte: Recorrido Norte', neto: 1000, saldo: 1000 }),
    item({ id_item: 31, id_factura: 3, id_cuota: 103, neto: 10000, saldo: 10000 }),
    item({ id_item: 32, id_factura: 3, concepto: 'Recorrido', id_recorrido: 2, descripcion: 'Transporte: Recorrido Sur', neto: 1000, saldo: 1000 }),
    item({ id_item: 33, id_factura: 3, concepto: 'Deporte', id_actividad: 1, descripcion: 'Deporte: Futbol', neto: 1000, saldo: 1000 }),
    item({ id_item: 41, id_factura: 4, id_cuota: 104, neto: 0, estado_pago: 'Sin cargo' }),
    item({ id_item: 51, id_factura: 5, concepto: 'Deporte', id_actividad: 1, descripcion: 'Deporte: Futbol', neto: 1000, estado_pago: 'Pagado', fecha_pago: '2026-12-15', id_pago: 9 }),
  ],
  pagos: [
    { id_pago: 7, id_factura: 1, estado: 'Aprobado', monto_pagado: '16000.00', fecha_revision: '2026-12-01T01:30:00Z', metodo_pago: 'Transferencia',
      pago_items: [{ id_item: 11, importe: 10000, activo: true }, { id_item: 12, importe: 1000, activo: true }, { id_item: 13, importe: 5000, activo: true }] },
    { id_pago: 8, id_factura: 2, estado: 'En revision', monto_pagado: 1000, fecha_revision: null, metodo_pago: 'Transferencia',
      pago_items: [{ id_item: 22, importe: 1000, activo: true }] },
    { id_pago: 6, id_factura: 1, estado: 'Rechazado', monto_pagado: 5000, fecha_revision: '2026-11-20T15:00:00-03:00', metodo_pago: 'Transferencia',
      pago_items: [{ id_item: 13, importe: 5000, activo: false }] },
    { id_pago: 9, id_factura: 5, estado: 'Aprobado', monto_pagado: 1000, fecha_revision: '2026-12-15T12:00:00-03:00', metodo_pago: 'Transferencia',
      pago_items: [{ id_item: 51, importe: 1000, activo: true }] },
  ],
  cuotas: [
    // Pagada por el comprobante 7: también figura Pagada acá, no se cuenta dos veces
    { id_cuota: 101, id_alumno: 1, anio: 2026, mes: 11, monto_base: 10000, recargo: 0, descuento: 0, estado: 'Pagada', fecha_pago: '2026-11-30', metodo_pago: 'Transferencia' },
    { id_cuota: 102, id_alumno: 2, anio: 2026, mes: 11, monto_base: 10000, recargo: 0, descuento: 0, estado: 'Pagada', fecha_pago: '2026-11-05', metodo_pago: 'Transferencia' },
    { id_cuota: 103, id_alumno: 3, anio: 2026, mes: 12, monto_base: 10000, recargo: 0, descuento: 0, estado: 'Pendiente', fecha_pago: null, metodo_pago: null },
    // Beca del 100 %: aunque figure Pagada, no es dinero cobrado
    { id_cuota: 104, id_alumno: 4, anio: 2026, mes: 12, monto_base: 10000, recargo: 0, descuento: 10000, estado: 'Pagada', fecha_pago: '2026-12-02', metodo_pago: 'Transferencia' },
    // Heredadas (sin factura): una en efectivo con fecha y otra sin fecha registrada
    { id_cuota: 90, id_alumno: 3, anio: 2026, mes: 6, monto_base: 9500, recargo: 0, descuento: 0, estado: 'Pagada', fecha_pago: '2026-06-15', metodo_pago: 'Efectivo' },
    { id_cuota: 91, id_alumno: 3, anio: 2026, mes: 7, monto_base: 9500, recargo: 0, descuento: 0, estado: 'Pagada', fecha_pago: null, metodo_pago: null },
  ],
  alumnos: [{ id_alumno: 3, nombre: 'Caro', apellido: 'Tres' }],
  inscDeportivas: [
    // Ana: grupo 1 hasta noviembre (hoy dada de baja) y grupo 2 desde diciembre
    { id_alumno: 1, id_grupo: 1, fecha_alta: '2026-03-01T12:00:00-03:00', fecha_baja: '2026-11-30T12:00:00-03:00' },
    { id_alumno: 1, id_grupo: 2, fecha_alta: '2026-12-01T09:00:00-03:00', fecha_baja: null },
    { id_alumno: 2, id_grupo: 1, fecha_alta: '2026-03-01T12:00:00-03:00', fecha_baja: null },
  ],
  grupos: [
    { id_grupo: 1, id_actividad: 1, nivel: 'Primario', id_docente: 1, dias: ['Lunes'], hora_inicio: '17:00:00', hora_fin: '18:00:00',
      actividades_extracurriculares: { nombre: 'Futbol' }, docentes: persona('Juan', 'Perez') },
    { id_grupo: 2, id_actividad: 1, nivel: 'Secundario', id_docente: 2, dias: ['Miercoles'], hora_inicio: '18:00:00', hora_fin: '19:00:00',
      actividades_extracurriculares: { nombre: 'Futbol' }, docentes: persona('Ana', 'Gomez') },
  ],
  recorridos: [
    { id_recorrido: 1, numero: 1, nombre: 'Recorrido Norte' },
    { id_recorrido: 2, numero: 2, nombre: 'Recorrido Sur' },
  ],
}

describe('rangos', () => {
  it('meses: desde no puede ser posterior a hasta; el mismo mes sirve', () => {
    expect(validarRangoMeses('2026-12', '2026-11')).toBe(MENSAJES_LISTADOS.periodoInvertido)
    expect(validarRangoMeses('2026-11', '2026-11')).toBeNull()
    expect(validarRangoMeses('2026-13', '2026-12')).toBe(MENSAJES_LISTADOS.periodoInvalido)
  })
  it('días', () => {
    expect(validarRangoDias('2026-12-02', '2026-12-01')).toBe(MENSAJES_LISTADOS.fechaInvertida)
    expect(validarRangoDias('2026-12-01', '2026-12-01')).toBeNull()
    expect(validarRangoDias('01/12/2026', '2026-12-01')).toBe(MENSAJES_LISTADOS.fechaInvalida)
  })
  it('la fecha de un timestamptz se toma en Argentina', () => {
    expect(diaArgentina('2026-12-01T01:30:00Z')).toBe('2026-11-30')
    expect(diaArgentina('2026-11-05')).toBe('2026-11-05')
  })
})

describe('HU62: ingresos por período', () => {
  it('solo lo acreditado de noviembre, sin duplicar la cuota pagada con el comprobante', () => {
    const l = listadoIngresos(datos, { desde: '2026-11-01', hasta: '2026-11-30' })
    expect(l.filas.map((x) => [x.clave, x.fecha, x.origen, x.importe])).toEqual([
      ['cuota-102', '2026-11-05', 'Registro administrativo', 10000],
      ['pago-7', '2026-11-30', 'Comprobante', 16000],
    ])
    expect(l.total).toBe(26000)
    // ni el rechazado (6), ni el en revisión (8), ni la cuota 101 otra vez
    expect(l.filas.some((x) => ['pago-6', 'pago-8', 'cuota-101'].includes(x.clave))).toBe(false)
  })

  it('el comprobante aprobado a la noche del 30/11 no cae en diciembre', () => {
    const l = listadoIngresos(datos, { desde: '2026-12-01', hasta: '2026-12-31' })
    expect(l.filas.map((x) => x.clave)).toEqual(['pago-9'])
    expect(l.total).toBe(1000) // la beca del 100 % (cuota 104) no suma
  })

  it('identifica los registros administrativos históricos y separa los totales por origen', () => {
    const l = listadoIngresos(datos, { desde: '2026-01-01', hasta: '2026-12-31' })
    const heredada = l.filas.find((x) => x.clave === 'cuota-90')
    expect(heredada).toMatchObject({ origen: 'Registro administrativo', metodo: 'Efectivo', referencia: 'Cuota de Junio 2026 (sin factura)', alumno: 'Tres, Caro', importe: 9500 })
    expect(l.porOrigen).toEqual({ comprobantes: 17000, administrativos: 19500 })
    expect(l.total).toBe(36500)
    expect(l.sinFecha).toBe(1)
    expect(new Set(l.filas.map((x) => x.clave)).size).toBe(l.filas.length)
  })

  it('filtra por origen y exporta con el total', () => {
    const l = listadoIngresos(datos, { desde: '2026-01-01', hasta: '2026-12-31', origen: 'Comprobante' })
    expect(l.filas.every((x) => x.origen === 'Comprobante')).toBe(true)
    expect(l.total).toBe(17000)
    const t = tablaIngresos(l)
    expect(t.filas.at(-1)?.at(-2)).toBe('Total')
  })
})

describe('HU63 y HU64: facturas completas e incompletas', () => {
  it('año de cursado desde el curso copiado en la factura', () => {
    expect(anioDeCursado('Primario 3 A')).toBe('Primario 3')
    expect(anioDeCursado('Secundario 1° año B')).toBe('Secundario 1° año')
    expect(anioDeCursado(null)).toBe('Sin curso')
  })

  it('completas: solo las pagadas del todo, con su última acreditación; Sin cargo aparte', () => {
    const l = listadoFacturas(datos, 'completas', { desde: '2026-11', hasta: '2026-12' }, '2026-12-20')
    // F-000001: el comprobante se aprobó la noche del 30/11 en Argentina (01/12 en UTC)
    expect(l.filas.map((x) => [x.numero, x.estado, x.ultimaAcreditacion, x.anioAcreditacion])).toEqual([
      ['F-000001', 'Pago completo', '2026-11-30', '2026'],
      ['F-000005', 'Pago completo', '2026-12-15', '2026'],
    ])
    expect(l.sinCargo).toBe(1)
    expect(l.totales).toMatchObject({ facturas: 2, total: 17000, pagado: 17000, saldo: 0 })
  })

  it('incompletas: pago parcial y sin pago, con saldo; En revisión no es pagado', () => {
    const l = listadoFacturas(datos, 'incompletas', { desde: '2026-11', hasta: '2026-12' }, '2026-12-20')
    expect(l.filas.map((x) => [x.numero, x.estado, x.pagado, x.enRevision, x.saldo, x.vencida, x.anioAcreditacion])).toEqual([
      // la cuota la registró la administración el 05/11
      ['F-000002', 'Pago parcial', 10000, 1000, 2000, true, '2026'],
      ['F-000003', 'Sin pago', 0, 0, 12000, true, SIN_PAGOS],
    ])
    expect(l.grupos.map((g) => [g.anioAcreditacion, g.anioCursado, g.filas.length, g.saldo])).toEqual([
      ['2026', 'Secundario 1', 1, 2000],
      [SIN_PAGOS, 'Primario 3', 1, 12000],
    ])
    expect(l.totales.saldo).toBe(14000)
  })

  it('filtra por año de última acreditación y por año de cursado, y ofrece las opciones', () => {
    const base = { desde: '2026-01', hasta: '2026-12' }
    expect(listadoFacturas(datos, 'incompletas', { ...base, anioCursado: 'Primario 3' }, '2026-12-20').filas.map((x) => x.numero)).toEqual(['F-000003'])
    expect(listadoFacturas(datos, 'incompletas', { ...base, anioAcreditacion: '2027' }, '2026-12-20').filas).toEqual([])
    expect(listadoFacturas(datos, 'incompletas', { ...base, anioAcreditacion: SIN_PAGOS }, '2026-12-20').filas.map((x) => x.numero)).toEqual(['F-000003'])
    expect(listadoFacturas(datos, 'incompletas', base, '2026-12-20').opciones).toEqual({ aniosAcreditacion: ['2026', SIN_PAGOS], aniosCursado: ['Primario 3', 'Secundario 1'] })
    // el período filtra por mes facturado
    expect(listadoFacturas(datos, 'incompletas', { desde: '2026-11', hasta: '2026-11' }, '2026-12-20').filas.map((x) => x.numero)).toEqual(['F-000002'])
  })
})

describe('HU63 y HU64: año de última acreditación (fechas reales, no el período)', () => {
  // Todas son facturas de DICIEMBRE 2026 (período facturado); los pagos se
  // acreditan en fechas distintas.
  const dic = (id: number, total: number, cobrado: number) =>
    fac({ id_factura: id, id_alumno: id, mes: 12, alumno_nombre: `Alumno ${id}`, total, cobrado, saldo: total - cobrado })
  const pago = (id: number, idFactura: number, items: number[], fecha: string) => ({
    id_pago: id, id_factura: idFactura, estado: 'Aprobado' as const, monto_pagado: 0, fecha_revision: fecha, metodo_pago: 'Transferencia',
    pago_items: items.map((i) => ({ id_item: i, importe: 0, activo: true })),
  })
  const anios: DatosListados = {
    facturas: [dic(10, 10000, 10000), dic(11, 10000, 8000), dic(12, 10000, 0), dic(13, 10000, 10000), dic(14, 10000, 6000), dic(15, 10000, 10000)],
    items: [
      // F10: diciembre pagada en ENERO
      item({ id_item: 101, id_factura: 10, neto: 10000, estado_pago: 'Pagado', id_pago: 20 }),
      // F11: pagos parciales en DOS años y un concepto pendiente
      item({ id_item: 111, id_factura: 11, concepto: 'Comedor', descripcion: 'Comedor', neto: 5000, estado_pago: 'Pagado', id_pago: 21 }),
      item({ id_item: 112, id_factura: 11, concepto: 'Deporte', id_actividad: 1, descripcion: 'Deporte: Futbol', neto: 3000, estado_pago: 'Pagado', id_pago: 22 }),
      item({ id_item: 113, id_factura: 11, concepto: 'Recorrido', id_recorrido: 1, descripcion: 'Transporte: Recorrido Norte', neto: 2000, saldo: 2000 }),
      // F12: sin pagos
      item({ id_item: 121, id_factura: 12, neto: 10000, saldo: 10000 }),
      // F13: registro administrativo SIN fecha
      item({ id_item: 131, id_factura: 13, id_cuota: 913, neto: 10000, estado_pago: 'Pagado' }),
      // F14: un pago con fecha y otro sin fecha, y saldo pendiente
      item({ id_item: 141, id_factura: 14, concepto: 'Comedor', descripcion: 'Comedor', neto: 3000, estado_pago: 'Pagado', id_pago: 23 }),
      item({ id_item: 142, id_factura: 14, id_cuota: 914, neto: 3000, estado_pago: 'Pagado' }),
      item({ id_item: 143, id_factura: 14, concepto: 'Deporte', id_actividad: 1, descripcion: 'Deporte: Futbol', neto: 4000, saldo: 4000 }),
      // F15: aprobado el 31/12 a la noche en Argentina (01/01 en UTC)
      item({ id_item: 151, id_factura: 15, neto: 10000, estado_pago: 'Pagado', id_pago: 24 }),
    ],
    pagos: [
      pago(20, 10, [101], '2027-01-08T10:00:00-03:00'),
      pago(21, 11, [111], '2026-12-20T12:00:00-03:00'),
      pago(22, 11, [112], '2027-01-15T12:00:00-03:00'),
      pago(23, 14, [141], '2026-12-28T12:00:00-03:00'),
      pago(24, 15, [151], '2027-01-01T02:00:00Z'),
    ],
    cuotas: [
      { id_cuota: 913, id_alumno: 13, anio: 2026, mes: 12, monto_base: 10000, recargo: 0, descuento: 0, estado: 'Pagada', fecha_pago: null, metodo_pago: null },
      { id_cuota: 914, id_alumno: 14, anio: 2026, mes: 12, monto_base: 3000, recargo: 0, descuento: 0, estado: 'Pagada', fecha_pago: null, metodo_pago: null },
    ],
    alumnos: [],
    inscDeportivas: [],
    grupos: [],
    // El recorrido 1 hoy se llama distinto de como se facturó
    recorridos: [{ id_recorrido: 1, numero: 1, nombre: 'Recorrido Norte Ampliado' }],
  }
  const dicOnly = { desde: '2026-12', hasta: '2026-12' }

  it('diciembre pagada en enero: queda en el año en que se saldó, con su período aparte', () => {
    const l = listadoFacturas(anios, 'completas', { ...dicOnly, anioAcreditacion: '2027' }, '2027-01-20')
    expect(l.filas.map((x) => [x.numero, x.periodo.mes, x.periodo.anio, x.ultimaAcreditacion, x.anioAcreditacion])).toEqual([
      ['F-000010', 12, 2026, '2027-01-08', '2027'],
    ])
  })

  it('aprobado la noche del 31/12 en Argentina cuenta en 2026, aunque en UTC sea 01/01', () => {
    const l = listadoFacturas(anios, 'completas', dicOnly, '2027-01-20')
    expect(l.filas.find((x) => x.numero === 'F-000015')).toMatchObject({ ultimaAcreditacion: '2026-12-31', anioAcreditacion: '2026' })
  })

  it('pagos parciales en distintos años: una sola fila, sin duplicar importes', () => {
    const l = listadoFacturas(anios, 'incompletas', dicOnly, '2027-01-20')
    const f11 = l.filas.filter((x) => x.numero === 'F-000011')
    expect(f11).toHaveLength(1)
    expect(f11.at(0)).toMatchObject({ pagado: 8000, saldo: 2000, ultimaAcreditacion: '2027-01-15', anioAcreditacion: '2027', estado: 'Pago parcial' })
    expect(l.totales.facturas).toBe(l.filas.length)
    expect(l.totales.pagado).toBe(8000 + 0 + 6000)
  })

  it('sin pagos y fecha desconocida: categorías explícitas, sin inferir el año del período', () => {
    const inc = listadoFacturas(anios, 'incompletas', dicOnly, '2027-01-20')
    expect(inc.filas.map((x) => [x.numero, x.anioAcreditacion, x.ultimaAcreditacion])).toEqual([
      ['F-000011', '2027', '2027-01-15'],
      ['F-000014', SIN_FECHA, null], // un pago con fecha y otro sin fecha: no se sabe cuál fue el último
      ['F-000012', SIN_PAGOS, null],
    ])
    const comp = listadoFacturas(anios, 'completas', dicOnly, '2027-01-20')
    expect(comp.filas.find((x) => x.numero === 'F-000013')).toMatchObject({ anioAcreditacion: SIN_FECHA, ultimaAcreditacion: null })
    expect(comp.opciones.aniosAcreditacion).toEqual(['2026', '2027', SIN_FECHA])
    expect(inc.opciones.aniosAcreditacion).toEqual(['2027', SIN_FECHA, SIN_PAGOS])
  })

  it('el CSV usa las etiquetas del criterio real', () => {
    const t = tablaFacturas(listadoFacturas(anios, 'completas', dicOnly, '2027-01-20'))
    expect(t.columnas.slice(0, 4)).toEqual(['Año de última acreditación', 'Última acreditación', 'Año de cursado', 'Período facturado'])
    expect(t.filas.find((fila) => fila.includes('F-000010'))?.slice(0, 2)).toEqual(['2027', '08/01/2027'])
    expect(t.filas.find((fila) => fila.includes('F-000013'))?.slice(0, 2)).toEqual([SIN_FECHA, '—'])
  })

  it('HU66: un recorrido renombrado se muestra como figura en la factura y se filtra por su identificador', () => {
    const l = listadoRecorridos(anios, { ...dicOnly, id_recorrido: '1' })
    expect(l.filas.map((x) => x.detalle)).toEqual(['Recorrido Norte'])
    expect(tablaItems(l, 'recorrido').columnas).toContain('Recorrido (como se facturó)')
  })
})

describe('HU65: pagos por deporte, nivel, horario y profesor', () => {
  const todo = { desde: '2026-11', hasta: '2026-12' }

  it('el grupo es el de la inscripción vigente en ese mes, aunque hoy esté dada de baja', () => {
    const l = listadoDeportes(datos, todo)
    const ana = l.filas.filter((x) => x.alumno === 'Uno, Ana').map((x) => [x.periodo.mes, x.nivel, x.profesor, x.estado])
    expect(ana).toEqual([
      [11, 'Primario', 'Perez, Juan', 'Pagado'],
      [12, 'Secundario', 'Gomez, Ana', 'Pagado'],
    ])
    expect(l.filas.find((x) => x.alumno === 'Tres, Caro')).toMatchObject({ nivel: SIN_INSCRIPCION, horario: SIN_INSCRIPCION, estado: 'Pendiente' })
    expect(l.filas.find((x) => x.alumno === 'Dos, Beto')).toMatchObject({ horario: 'Lunes · 17:00 a 18:00', estado: 'En revisión' })
  })

  it('nivel, horario y profesor se rotulan como datos actuales del grupo, y un dato faltante no se inventa', () => {
    const columnas = tablaItems(listadoDeportes(datos, todo), 'deporte').columnas
    expect(columnas).toEqual(expect.arrayContaining(['Nivel (grupo actual)', 'Días y horario (grupo actual)', 'Profesor (grupo actual)']))
    const sinProfesor: DatosListados = { ...datos, grupos: datos.grupos.map((g) => (g.id_grupo === 1 ? { ...g, docentes: null } : g)) }
    expect(listadoDeportes(sinProfesor, todo).filas.find((x) => x.alumno === 'Dos, Beto')?.profesor).toBe(SIN_DATO_GRUPO)
  })

  it('totales: lo en revisión no es cobrado', () => {
    expect(listadoDeportes(datos, todo).totales).toEqual({ importe: 4000, cobrado: 2000, enRevision: 1000, saldo: 2000 })
  })

  it('los filtros se aplican solos o combinados', () => {
    const ids = (f: Record<string, string>) => listadoDeportes(datos, { ...todo, ...f }).filas.map((x) => x.id_item)
    expect(ids({ id_docente: '2' })).toEqual([51])
    expect(ids({ nivel: 'Primario' })).toEqual([22, 12])
    expect(ids({ id_grupo: '1', estado: 'Pagado' })).toEqual([12])
    expect(ids({ id_actividad: '1', nivel: 'Primario', id_docente: '1' })).toEqual([22, 12])
    expect(ids({ id_actividad: '9' })).toEqual([])
  })
})

describe('HU66: pagos por recorrido', () => {
  it('recorrido, alumno, importe y estado, por mes facturado', () => {
    const l = listadoRecorridos(datos, { desde: '2026-11', hasta: '2026-12' })
    expect(l.filas.map((x) => [x.detalle, x.alumno, x.periodo.mes, x.importe, x.estado])).toEqual([
      ['Recorrido Norte', 'Dos, Beto', 11, 1000, 'Pendiente'],
      ['Recorrido Sur', 'Tres, Caro', 12, 1000, 'Pendiente'],
    ])
    expect(l.totales).toEqual({ importe: 2000, cobrado: 0, enRevision: 0, saldo: 2000 })
  })

  it('filtra por recorrido, mes y estado', () => {
    expect(listadoRecorridos(datos, { desde: '2026-11', hasta: '2026-12', id_recorrido: '2' }).filas.map((x) => x.alumno)).toEqual(['Tres, Caro'])
    expect(listadoRecorridos(datos, { desde: '2026-12', hasta: '2026-12' }).filas.map((x) => x.alumno)).toEqual(['Tres, Caro'])
    expect(listadoRecorridos(datos, { desde: '2026-11', hasta: '2026-12', estado: 'Pagado' }).filas).toEqual([])
  })
})

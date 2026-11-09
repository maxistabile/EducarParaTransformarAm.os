import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

// Cliente supabase simulado: registra cada llamada y resuelve con la
// respuesta programada para esa tabla o vista.
interface Llamada {
  tabla: string
  metodos: Array<[string, unknown[]]>
}

const { estado } = vi.hoisted(() => ({
  estado: {
    llamadas: [] as Llamada[],
    respuestas: [] as Array<{ tabla: string; respuesta: unknown; rechazo?: Error }>,
  },
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from(tabla: string) {
      const llamada: Llamada = { tabla, metodos: [] }
      estado.llamadas.push(llamada)
      const i = estado.respuestas.findIndex((r) => r.tabla === tabla)
      const programada = i >= 0 ? estado.respuestas.splice(i, 1)[0] : undefined
      const rechazo = programada?.rechazo
      const registrar =
        (metodo: string) =>
        (...args: unknown[]) => {
          llamada.metodos.push([metodo, args])
          return q
        }
      const q = {
        select: registrar('select'),
        eq: registrar('eq'),
        order: registrar('order'),
        then: (ok: (v: unknown) => unknown, mal: (e: unknown) => unknown) =>
          (rechazo instanceof Error
            ? Promise.reject(rechazo)
            : Promise.resolve(programada?.respuesta ?? { data: [], error: null })
          ).then(ok, mal),
      }
      return q
    },
  },
}))

import { ServicioCuotas, MENSAJE_ERROR_CUOTAS } from './ServicioCuotas'
import { ServicioPagos, MENSAJE_ERROR_PAGOS } from './ServicioPagos'
import { MENSAJES_CUENTA } from './lecturaCuentaAlumno'

const TABLAS = ['v_facturas_saldo', 'v_factura_items_saldo', 'cuotas']

const responder = (tabla: string, respuesta: unknown) => {
  estado.respuestas.push({ tabla, respuesta })
}
const argumentos = (tabla: string, metodo: string) =>
  estado.llamadas
    .filter((l) => l.tabla === tabla)
    .flatMap((l) => l.metodos.filter(([m]) => m === metodo).map(([, a]) => a))

beforeEach(() => {
  estado.llamadas = []
  estado.respuestas = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('acceso a cuotas y pagos (HU51 a HU53)', () => {
  it('un alumno que no es de la sesión da error sin consultar', async () => {
    expect(await ServicioCuotas.estadoDeCuenta(9, [3, 7], 'Padre')).toEqual({
      ok: false,
      mensaje: MENSAJES_CUENTA.ajeno,
    })
    expect(await ServicioPagos.historial(9, [3, 7], 'Padre')).toEqual({
      ok: false,
      mensaje: MENSAJES_CUENTA.ajeno,
    })
    expect(estado.llamadas).toHaveLength(0)
  })

  it('el rol Alumno no consulta cuotas ni pagos, aunque sea su propio legajo', async () => {
    expect(await ServicioCuotas.estadoDeCuenta(5, [5], 'Alumno')).toEqual({
      ok: false,
      mensaje: MENSAJES_CUENTA.soloPadre,
    })
    expect(await ServicioPagos.historial(5, [5], 'Alumno')).toEqual({
      ok: false,
      mensaje: MENSAJES_CUENTA.soloPadre,
    })
    expect(await ServicioCuotas.estadoDeCuenta(5, [5], null)).toMatchObject({ ok: false })
    expect(estado.llamadas).toHaveLength(0)
  })
})

describe('ServicioCuotas.estadoDeCuenta (HU51 y HU52)', () => {
  it('filtra las tres lecturas por el alumno elegido, también la de los vínculos de cuotas', async () => {
    await ServicioCuotas.estadoDeCuenta(7, [3, 7], 'Padre')
    expect(estado.llamadas.map((l) => l.tabla).sort()).toEqual([...TABLAS].sort())
    for (const tabla of TABLAS) expect(argumentos(tabla, 'eq')).toEqual([['id_alumno', 7]])
  })

  it('arma el estado de cuenta con la factura y la cuota heredada, sin duplicar la cuota facturada', async () => {
    responder('v_facturas_saldo', {
      data: [
        {
          id_factura: 4,
          anio: 2026,
          mes: 12,
          fecha_emision: '2026-11-30',
          fecha_vencimiento: '2026-12-10',
          total: '16000.00',
          cobrado: '0.00',
          saldo: '16000.00',
          estado_cobro: 'Pendiente',
        },
      ],
      error: null,
    })
    responder('v_factura_items_saldo', {
      data: [
        {
          id_item: 1,
          id_factura: 4,
          anio: 2026,
          mes: 12,
          concepto: 'Cuota',
          id_cuota: 21,
          descripcion: 'Cuota',
          porcentaje_beca: null,
          neto: '10000.00',
          cubierta_por_beca: false,
          estado_pago: 'Pendiente',
          fecha_pago: null,
          saldo: '10000.00',
        },
        {
          id_item: 2,
          id_factura: 4,
          anio: 2026,
          mes: 12,
          concepto: 'Comedor',
          id_cuota: null,
          descripcion: 'Comedor',
          porcentaje_beca: null,
          neto: '6000.00',
          cubierta_por_beca: false,
          estado_pago: 'Pendiente',
          fecha_pago: null,
          saldo: '6000.00',
        },
      ],
      error: null,
    })
    responder('cuotas', {
      data: [
        { id_cuota: 20, anio: 2026, mes: 11, monto_base: 9000, recargo: 0, descuento: 0, fecha_vencimiento: '2099-11-10', estado: 'Pendiente', fecha_pago: null, metodo_pago: null, cubierta_por_beca: false },
        { id_cuota: 21, anio: 2026, mes: 12, monto_base: 10000, recargo: 0, descuento: 0, fecha_vencimiento: '2026-12-10', estado: 'Pendiente', fecha_pago: null, metodo_pago: null, cubierta_por_beca: false },
      ],
      error: null,
    })

    const r = await ServicioCuotas.estadoDeCuenta(7, [7], 'Padre')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.cuenta.facturasPendientes.map((f) => [f.numero, f.saldo])).toEqual([['F-000004', 16000]])
    expect(r.cuenta.cuotasHeredadas.map((c) => c.id_cuota)).toEqual([20])
    expect(r.cuenta.saldoPendiente).toBe(25000)
  })

  it('un error de la base da un mensaje claro y solo el código en la consola', async () => {
    responder('v_factura_items_saldo', { data: null, error: { code: '42501', message: 'permiso' } })
    expect(await ServicioCuotas.estadoDeCuenta(7, [7], 'Padre')).toEqual({
      ok: false,
      mensaje: MENSAJE_ERROR_CUOTAS,
    })
    expect(console.error).toHaveBeenCalledWith('[ServicioCuotas]', { code: '42501', status: undefined })
  })

  it('si la promesa se rechaza, no rechaza y avisa', async () => {
    estado.respuestas.push({ tabla: 'cuotas', respuesta: null, rechazo: new TypeError('Failed to fetch') })
    await expect(ServicioCuotas.estadoDeCuenta(7, [7], 'Padre')).resolves.toEqual({
      ok: false,
      mensaje: MENSAJE_ERROR_CUOTAS,
    })
  })
})

describe('ServicioPagos.historial (HU53 parcial)', () => {
  it('devuelve los pagos registrados por la administración, sin leer la tabla pagos', async () => {
    responder('cuotas', {
      data: [
        { id_cuota: 21, anio: 2026, mes: 10, monto_base: 10000, recargo: 0, descuento: 0, fecha_vencimiento: '2026-10-10', estado: 'Pagada', fecha_pago: '2026-10-04', metodo_pago: 'Transferencia', cubierta_por_beca: false },
      ],
      error: null,
    })
    const r = await ServicioPagos.historial(7, [7], 'Padre')
    expect(r).toEqual({
      ok: true,
      pagos: [
        {
          clave: 'cuota-21',
          periodo: { anio: 2026, mes: 10 },
          importe: 10000,
          fecha: '2026-10-04',
          metodo: 'Transferencia',
          factura: null,
          origen: 'Registro administrativo',
        },
      ],
    })
    expect(estado.llamadas.some((l) => l.tabla === 'pagos')).toBe(false)
    for (const tabla of TABLAS) expect(argumentos(tabla, 'eq')).toEqual([['id_alumno', 7]])
  })

  it('un error de la base da el mensaje de pagos', async () => {
    responder('v_facturas_saldo', { data: null, error: { code: 'PGRST301' } })
    expect(await ServicioPagos.historial(7, [7], 'Padre')).toEqual({
      ok: false,
      mensaje: MENSAJE_ERROR_PAGOS,
    })
  })
})

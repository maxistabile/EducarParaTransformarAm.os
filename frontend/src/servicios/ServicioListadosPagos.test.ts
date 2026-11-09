import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

// Cliente simulado: cada tabla devuelve sus filas por páginas (range) y
// registra los filtros usados.
const { estado } = vi.hoisted(() => ({
  estado: {
    filas: new Map<string, unknown[]>(),
    error: new Map<string, unknown>(),
    llamadas: [] as Array<{ tabla: string; metodo: string; args: unknown[] }>,
  },
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from(tabla: string) {
      const q = {
        select(...args: unknown[]) {
          estado.llamadas.push({ tabla, metodo: 'select', args })
          return q
        },
        order(...args: unknown[]) {
          estado.llamadas.push({ tabla, metodo: 'order', args })
          return q
        },
        eq(...args: unknown[]) {
          estado.llamadas.push({ tabla, metodo: 'eq', args })
          return q
        },
        not(...args: unknown[]) {
          estado.llamadas.push({ tabla, metodo: 'not', args })
          return q
        },
        range(desde: number, hasta: number) {
          estado.llamadas.push({ tabla, metodo: 'range', args: [desde, hasta] })
          const error = estado.error.get(tabla)
          if (error) return Promise.resolve({ data: null, error })
          return Promise.resolve({ data: (estado.filas.get(tabla) ?? []).slice(desde, hasta + 1), error: null })
        },
      }
      return q
    },
  },
}))

import { PAGINA, ServicioListadosPagos, MENSAJE_ERROR_LISTADOS } from './ServicioListadosPagos'

beforeEach(() => {
  estado.filas = new Map()
  estado.error = new Map()
  estado.llamadas = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

const args = (tabla: string, metodo: string) =>
  estado.llamadas.filter((l) => l.tabla === tabla && l.metodo === metodo).map((l) => l.args)

describe('ServicioListadosPagos.cargar', () => {
  it('lee todas las páginas: más de 1000 filas no se pierden', async () => {
    const items = Array.from({ length: 2 * PAGINA + 5 }, (_, n) => ({
      id_item: n + 1, id_factura: 1, concepto: 'Deporte', id_cuota: null, id_actividad: 1, id_recorrido: null, descripcion: 'Deporte: Futbol', neto: 1000,
    }))
    estado.filas.set('factura_items', items)
    const r = await ServicioListadosPagos.cargar()
    expect(r.ok && r.datos.items.length).toBe(2 * PAGINA + 5)
    expect(args('factura_items', 'range')).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
    // Cada página repite la consulta con el mismo orden estable
    expect(args('factura_items', 'order')).toEqual([['id_item'], ['id_item'], ['id_item']])
  })

  it('une el estado y el saldo de cada ítem; sin datos de saldo queda Pendiente', async () => {
    estado.filas.set('factura_items', [
      { id_item: 1, id_factura: 1, concepto: 'Cuota', id_cuota: 9, id_actividad: null, id_recorrido: null, descripcion: 'Cuota mensual', neto: '10000.00' },
      { id_item: 2, id_factura: 1, concepto: 'Comedor', id_cuota: null, id_actividad: null, id_recorrido: null, descripcion: 'Comedor', neto: 5000 },
    ])
    estado.filas.set('v_factura_items_saldo', [{ id_item: 1, estado_pago: 'Pagado', saldo: 0, fecha_pago: '2026-11-05', id_pago: null }])
    const r = await ServicioListadosPagos.cargar()
    expect(r.ok && r.datos.items.map((i) => [i.id_item, i.estado_pago, i.saldo, i.fecha_pago])).toEqual([
      [1, 'Pagado', 0, '2026-11-05'],
      [2, 'Pendiente', 0, null],
    ])
  })

  it('pide solo comprobantes aprobados con factura, cuotas pagadas y todas las inscripciones', async () => {
    await ServicioListadosPagos.cargar()
    expect(args('pagos', 'eq')).toEqual([['estado', 'Aprobado']])
    expect(args('pagos', 'not')).toEqual([['id_factura', 'is', null]])
    expect(args('cuotas', 'eq')).toEqual([['estado', 'Pagada']])
    // inscripciones: también las dadas de baja (sin filtrar por activo)
    expect(args('inscripciones_deportivas', 'eq')).toEqual([])
    expect(args('inscripciones_deportivas', 'select')).toEqual([['id_alumno, id_grupo, fecha_alta, fecha_baja']])
  })

  it('un error de cualquier lectura da el mensaje y no rechaza', async () => {
    estado.error.set('v_facturas_saldo', { code: '42P01', message: 'no existe' })
    expect(await ServicioListadosPagos.cargar()).toEqual({ ok: false, mensaje: MENSAJE_ERROR_LISTADOS })
    expect(console.error).toHaveBeenCalledWith('[ServicioListadosPagos] cargar:', expect.objectContaining({ code: '42P01' }))
  })
})

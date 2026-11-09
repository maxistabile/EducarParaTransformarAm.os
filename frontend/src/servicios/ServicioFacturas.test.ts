import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

// Cliente supabase simulado: registra cada llamada y resuelve con la
// respuesta programada para esa tabla, vista o función.
interface Llamada {
  destino: string
  metodos: Array<[string, unknown[]]>
}

const { estado } = vi.hoisted(() => ({
  estado: {
    llamadas: [] as Llamada[],
    respuestas: [] as Array<{ destino: string; respuesta: unknown; rechazo?: Error }>,
  },
}))

vi.mock('../lib/supabase', () => {
  const consulta = (destino: string, metodoInicial?: [string, unknown[]]) => {
    const llamada: Llamada = { destino, metodos: metodoInicial ? [metodoInicial] : [] }
    estado.llamadas.push(llamada)
    const i = estado.respuestas.findIndex((r) => r.destino === destino)
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
          : Promise.resolve(programada?.respuesta ?? { data: null, error: null })
        ).then(ok, mal),
    }
    return q
  }
  return {
    supabase: {
      from: (tabla: string) => consulta(tabla),
      rpc: (fn: string, args: unknown) => consulta(fn, ['rpc', [args]]),
    },
  }
})

import { ServicioFacturas } from './ServicioFacturas'

const responder = (destino: string, respuesta: unknown) => {
  estado.respuestas.push({ destino, respuesta })
}
const llamada = (n: number): Llamada => {
  const encontrada = estado.llamadas.at(n)
  if (!encontrada) throw new Error(`No hubo una llamada número ${n}`)
  return encontrada
}
const argumentos = (n: number, metodo: string) =>
  llamada(n)
    .metodos.filter(([m]) => m === metodo)
    .map(([, a]) => a)

const noviembre = new Date(2026, 10, 8)

beforeEach(() => {
  estado.llamadas = []
  estado.respuestas = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ServicioFacturas.generarPeriodo (HU50)', () => {
  it('llama a fn_generar_facturas_gestion con el período y devuelve el resumen en números', async () => {
    responder('fn_generar_facturas_gestion', {
      data: { periodo: '2026-12', nuevas: 6, ya_emitidas: 0, cuotas_previas: 1, total: '112700.00' },
      error: null,
    })

    const resultado = await ServicioFacturas.generarPeriodo({ anio: 2026, mes: 12 }, noviembre)

    expect(argumentos(0, 'rpc')).toEqual([[{ p_anio: 2026, p_mes: 12 }]])
    expect(resultado).toEqual({
      ok: true,
      resumen: { periodo: '2026-12', nuevas: 6, ya_emitidas: 0, cuotas_previas: 1, total: 112700 },
    })
  })

  it('un período anterior al actual no llega a la base', async () => {
    const resultado = await ServicioFacturas.generarPeriodo({ anio: 2026, mes: 10 }, noviembre)
    expect(resultado).toMatchObject({ ok: false })
    expect(estado.llamadas).toHaveLength(0)
  })

  it('si falta un valor, muestra cuál y que no se emitió nada', async () => {
    responder('fn_generar_facturas_gestion', {
      data: null,
      error: { code: 'P0001', message: 'FAC_SIN_VALOR|01/12/2026|Deporte: Handball' },
    })
    const resultado = await ServicioFacturas.generarPeriodo({ anio: 2026, mes: 12 }, noviembre)
    expect(resultado).toEqual({
      ok: false,
      mensaje:
        'Falta el valor vigente al 01/12/2026 de: Deporte: Handball. Cargalo en Valores con esa fecha o una anterior. No se emitió ninguna factura.',
    })
    // En la consola queda solo el código, no el mensaje con datos
    expect(console.error).toHaveBeenCalledWith('[ServicioFacturas] generarPeriodo:', {
      code: 'P0001',
      status: undefined,
    })
  })

  it('si la función no existe, avisa que falta la migración (etapa21)', async () => {
    responder('fn_generar_facturas_gestion', { data: null, error: { code: 'PGRST202', message: 'x' } })
    const resultado = await ServicioFacturas.generarPeriodo({ anio: 2026, mes: 12 }, noviembre)
    expect(resultado).toMatchObject({ ok: false })
    if (!resultado.ok) expect(resultado.mensaje).toMatch(/etapa21/)
  })

  it('una sesión que no es Admin ni Directivo recibe un mensaje claro', async () => {
    responder('fn_generar_facturas_gestion', { data: null, error: { code: 'P0001', message: 'PAG_SIN_PERMISO' } })
    expect(await ServicioFacturas.generarPeriodo({ anio: 2026, mes: 12 }, noviembre)).toEqual({
      ok: false,
      mensaje: 'Solo Admin o Directivo pueden generar facturas.',
    })
  })

  it('si la promesa se rechaza, no rechaza y avisa', async () => {
    estado.respuestas.push({
      destino: 'fn_generar_facturas_gestion',
      respuesta: null,
      rechazo: new TypeError('Failed to fetch'),
    })
    await expect(
      ServicioFacturas.generarPeriodo({ anio: 2026, mes: 12 }, noviembre),
    ).resolves.toMatchObject({ ok: false })
  })
})

describe('ServicioFacturas.listarPeriodo', () => {
  it('total emitido y saldo son distintos: cuota pagada de $10.000 + comedor de $5.000', async () => {
    responder('v_facturas_saldo', {
      data: [
        {
          id_factura: 7,
          id_alumno: 1,
          alumno_nombre: 'Uno, Ana',
          dni: '40000001',
          curso: 'Primaria 3 A',
          fecha_emision: '2026-11-30',
          fecha_vencimiento: '2026-12-10',
          total: '15000.00',
          cobrado: '10000.00',
          saldo: '5000.00',
          estado_cobro: 'Parcial',
          origen: 'Manual',
        },
      ],
      error: null,
    })
    responder('v_factura_items_saldo', {
      data: [
        {
          id_item: 1,
          id_factura: 7,
          concepto: 'Cuota',
          descripcion: 'Cuota mensual',
          importe: '10000.00',
          porcentaje_beca: null,
          descuento: '0.00',
          neto: '10000.00',
          estado_pago: 'Pagado',
          saldo: '0.00',
          cuota_preexistente: true,
          cubierta_por_beca: false,
        },
        {
          id_item: 2,
          id_factura: 7,
          concepto: 'Comedor',
          descripcion: 'Comedor',
          importe: '5000.00',
          porcentaje_beca: null,
          descuento: '0.00',
          neto: '5000.00',
          estado_pago: 'Pendiente',
          saldo: '5000.00',
          cuota_preexistente: false,
          cubierta_por_beca: false,
        },
      ],
      error: null,
    })

    const resultado = await ServicioFacturas.listarPeriodo({ anio: 2026, mes: 12 })

    expect(argumentos(0, 'eq')).toEqual([
      ['anio', 2026],
      ['mes', 12],
    ])
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    const [factura] = resultado.facturas
    expect(factura).toMatchObject({ total: 15000, cobrado: 10000, saldo: 5000, estado_cobro: 'Parcial' })
    expect(factura.items.map((i) => [i.concepto, i.neto, i.estado_pago, i.saldo])).toEqual([
      ['Cuota', 10000, 'Pagado', 0],
      ['Comedor', 5000, 'Pendiente', 5000],
    ])
    // La cuota no se suma por fuera de los ítems
    expect(factura.items.reduce((s, i) => s + i.saldo, 0)).toBe(factura.saldo)
  })

  it('un período sin facturas devuelve una lista vacía', async () => {
    responder('v_facturas_saldo', { data: [], error: null })
    responder('v_factura_items_saldo', { data: [], error: null })
    expect(await ServicioFacturas.listarPeriodo({ anio: 2027, mes: 1 })).toEqual({
      ok: true,
      facturas: [],
    })
  })

  it('si falta la vista, avisa que hay que ejecutar la migración', async () => {
    responder('v_facturas_saldo', { data: null, error: { code: 'PGRST205', message: 'x' } })
    const resultado = await ServicioFacturas.listarPeriodo({ anio: 2026, mes: 12 })
    expect(resultado).toMatchObject({ ok: false })
    if (!resultado.ok) expect(resultado.mensaje).toMatch(/etapa17/)
  })
})

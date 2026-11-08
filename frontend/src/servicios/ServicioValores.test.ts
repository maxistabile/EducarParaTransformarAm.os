import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

// Consulta simulada de supabase-js: registra cada método encadenado y
// resuelve con la respuesta programada para esa tabla.
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
      // Cada método registra la llamada y devuelve la misma consulta
      const registrar =
        (metodo: string) =>
        (...args: unknown[]) => {
          llamada.metodos.push([metodo, args])
          return consulta
        }
      const consulta = {
        select: registrar('select'),
        eq: registrar('eq'),
        is: registrar('is'),
        order: registrar('order'),
        maybeSingle: registrar('maybeSingle'),
        insert: registrar('insert'),
        update: registrar('update'),
        then: (ok: (v: unknown) => unknown, mal: (e: unknown) => unknown) =>
          (programada?.rechazo
            ? Promise.reject(programada.rechazo)
            : Promise.resolve(programada?.respuesta ?? { data: null, error: null })
          ).then(ok, mal),
      }
      return consulta
    },
  },
}))

import { ServicioValores } from './ServicioValores'

const responder = (tabla: string, respuesta: unknown) => {
  estado.respuestas.push({ tabla, respuesta })
}

/** Llamada número n a supabase.from(); falla la prueba si no existe. */
const llamada = (n: number): Llamada => {
  const encontrada = estado.llamadas.at(n)
  if (!encontrada) throw new Error(`No hubo una llamada número ${n}`)
  return encontrada
}
const metodos = (n: number) => llamada(n).metodos.map(([m]) => m)
const argumentos = (n: number, metodo: string) =>
  llamada(n)
    .metodos.filter(([m]) => m === metodo)
    .map(([, a]) => a)

beforeEach(() => {
  estado.llamadas = []
  estado.respuestas = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ServicioValores.guardar (HU46 a HU49)', () => {
  const cuota = { concepto: 'Cuota' as const, idReferencia: null }

  it('si no hay valor con esa fecha, lo agrega con su referencia', async () => {
    responder('valores_servicio', { data: null, error: null })
    responder('valores_servicio', { data: null, error: null })

    const resultado = await ServicioValores.guardar({
      clave: { concepto: 'Deporte', idReferencia: 3 },
      monto: '4500,50',
      vigenteDesde: '2026-12-01',
    })

    expect(resultado).toEqual({ ok: true })
    // Busca por concepto, fecha y la referencia que corresponde
    expect(argumentos(0, 'eq')).toEqual([
      ['concepto', 'Deporte'],
      ['vigente_desde', '2026-12-01'],
      ['id_actividad', 3],
    ])
    expect(argumentos(0, 'is')).toEqual([['id_recorrido', null]])
    expect(argumentos(1, 'insert')).toEqual([
      [
        {
          concepto: 'Deporte',
          id_actividad: 3,
          id_recorrido: null,
          monto: 4500.5,
          vigente_desde: '2026-12-01',
        },
      ],
    ])
  })

  it('con la misma fecha reemplaza el valor existente (corrección)', async () => {
    responder('valores_servicio', { data: { id_valor: 9 }, error: null })
    responder('valores_servicio', { data: null, error: null })

    const resultado = await ServicioValores.guardar({
      clave: cuota,
      monto: '16000',
      vigenteDesde: '2026-11-01',
    })

    expect(resultado).toEqual({ ok: true })
    expect(argumentos(0, 'is')).toEqual([
      ['id_actividad', null],
      ['id_recorrido', null],
    ])
    expect(metodos(1)).toContain('update')
    expect(metodos(1)).not.toContain('insert')
    expect(argumentos(1, 'eq')).toEqual([['id_valor', 9]])
    expect(argumentos(1, 'update')[0][0]).toMatchObject({ monto: 16000 })
  })

  it('con un importe inválido no consulta la base', async () => {
    expect(
      await ServicioValores.guardar({
        clave: cuota,
        monto: '0',
        vigenteDesde: '2026-11-01',
      }),
    ).toMatchObject({ ok: false })
    expect(estado.llamadas).toHaveLength(0)
  })

  it('un error devuelto por la base se informa con un mensaje claro', async () => {
    responder('valores_servicio', { data: null, error: null })
    responder('valores_servicio', {
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    })

    expect(
      await ServicioValores.guardar({
        clave: cuota,
        monto: '100',
        vigenteDesde: '2026-11-01',
      }),
    ).toEqual({
      ok: false,
      mensaje: 'Ya hay un valor con esa fecha. Recargá la página y volvé a intentar.',
    })
  })

  it('si la promesa se rechaza, no rechaza y avisa', async () => {
    estado.respuestas.push({
      tabla: 'valores_servicio',
      respuesta: null,
      rechazo: new TypeError('Failed to fetch'),
    })
    await expect(
      ServicioValores.guardar({
        clave: cuota,
        monto: '100',
        vigenteDesde: '2026-11-01',
      }),
    ).resolves.toMatchObject({ ok: false })
  })
})

describe('ServicioValores.cargar', () => {
  it('trae solo deportes activos y convierte el monto a número', async () => {
    responder('actividades_extracurriculares', {
      data: [{ id_actividad: 1, nombre: 'Fútbol' }],
      error: null,
    })
    responder('recorridos', {
      data: [{ id_recorrido: 1, numero: 1, nombre: 'Recorrido 1' }],
      error: null,
    })
    responder('valores_servicio', {
      data: [
        {
          id_valor: 1,
          concepto: 'Cuota',
          id_actividad: null,
          id_recorrido: null,
          monto: '15000.00',
          vigente_desde: '2026-11-01',
        },
      ],
      error: null,
    })

    const resultado = await ServicioValores.cargar()

    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.datos.valores[0].monto).toBe(15000)
    expect(argumentos(0, 'eq')).toEqual([
      ['tipo', 'Deporte'],
      ['activo', true],
    ])
  })

  it('si falta la tabla, avisa que hay que ejecutar la migración', async () => {
    responder('valores_servicio', {
      data: null,
      error: { code: 'PGRST205', message: 'not found' },
    })
    const resultado = await ServicioValores.cargar()
    expect(resultado).toMatchObject({ ok: false })
    if (!resultado.ok) expect(resultado.mensaje).toMatch(/etapa16/)
  })
})

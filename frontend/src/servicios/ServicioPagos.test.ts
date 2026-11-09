import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'

// Cliente supabase simulado: functions.invoke programable, consultas de
// tabla registradas y canales de Realtime.
const { estado } = vi.hoisted(() => ({
  estado: {
    invocaciones: [] as Array<{ nombre: string; body: unknown }>,
    respuesta: null as unknown,
    rechazo: null as Error | null,
    consulta: [] as Array<[string, unknown[]]>,
    filas: { data: [] as unknown, error: null as unknown },
    canales: [] as Array<{ nombre: string; config: Record<string, unknown>; cb: () => void }>,
    quitados: 0,
    quitarFalla: false,
  },
}))

vi.mock('../lib/supabase', () => {
  // Consulta encadenable con métodos explícitos: registra cada llamada
  const q = {
    select(...args: unknown[]) {
      estado.consulta.push(['select', args])
      return q
    },
    eq(...args: unknown[]) {
      estado.consulta.push(['eq', args])
      return q
    },
    not(...args: unknown[]) {
      estado.consulta.push(['not', args])
      return q
    },
    order(...args: unknown[]) {
      estado.consulta.push(['order', args])
      return q
    },
    then(ok: (v: unknown) => unknown, mal: (e: unknown) => unknown) {
      return Promise.resolve(estado.filas).then(ok, mal)
    },
  }
  return {
    supabase: {
      functions: {
        invoke: (nombre: string, opciones: { body: unknown }) => {
          estado.invocaciones.push({ nombre, body: opciones.body })
          const rechazo = estado.rechazo
          if (rechazo instanceof Error) return Promise.reject(rechazo)
          return Promise.resolve(estado.respuesta)
        },
      },
      from: (tabla: string) => {
        estado.consulta.push(['from', [tabla]])
        return q
      },
      channel: (nombre: string) => {
        const canal = {
          on: (_tipo: string, config: Record<string, unknown>, cb: () => void) => {
            estado.canales.push({ nombre, config, cb })
            return canal
          },
          subscribe: () => canal,
        }
        return canal
      },
      removeChannel: () => {
        estado.quitados++
        const falla = new Error('canal')
        return estado.quitarFalla ? Promise.reject(falla) : Promise.resolve('ok')
      },
    },
  }
})

import { ServicioPagos } from './ServicioPagos'

beforeEach(() => {
  estado.invocaciones = []
  estado.respuesta = { data: { ok: true }, error: null }
  estado.rechazo = null
  estado.consulta = []
  estado.filas = { data: [], error: null }
  estado.canales = []
  estado.quitados = 0
  estado.quitarFalla = false
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

const archivo = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], 'transf.pdf', { type: 'application/pdf' })

describe('registrarComprobante (HU54)', () => {
  it('envía la clave, la factura, los ítems y el archivo; nunca un importe', async () => {
    estado.respuesta = { data: { ok: true, id_pago: 9, estado_pago: 'En revision', ya_existia: false }, error: null }
    const r = await ServicioPagos.registrarComprobante({ clave: 'k-1', idFactura: 30, items: [31, 33], archivo: archivo() })
    expect(r).toEqual({ ok: true, idPago: 9, estado: 'En revision', yaExistia: false })
    const { nombre, body } = estado.invocaciones[0]
    expect(nombre).toBe('pagos')
    const form = body as FormData
    expect(form.get('accion')).toBe('subir')
    expect(form.get('clave')).toBe('k-1')
    expect(form.get('id_factura')).toBe('30')
    expect(form.get('items')).toBe('[31,33]')
    expect((form.get('archivo') as File).name).toBe('transf.pdf')
    expect([...form.keys()].some((k) => /importe|monto|total/.test(k))).toBe(false)
  })

  it('un reintento que ya había llegado devuelve el mismo comprobante', async () => {
    estado.respuesta = { data: { ok: true, id_pago: 9, estado_pago: 'En revision', ya_existia: true }, error: null }
    expect(await ServicioPagos.registrarComprobante({ clave: 'k-1', idFactura: 30, items: [31], archivo: archivo() }))
      .toMatchObject({ ok: true, idPago: 9, yaExistia: true })
  })

  it('un error de negocio llega con su código y su mensaje, y no es reintentable', async () => {
    estado.respuesta = { data: { ok: false, codigo: 'PAG_ITEM_NO_DISPONIBLE', detalle: 'Comedor' }, error: null }
    expect(await ServicioPagos.registrarComprobante({ clave: 'k-1', idFactura: 30, items: [31], archivo: archivo() }))
      .toEqual({
        ok: false,
        codigo: 'PAG_ITEM_NO_DISPONIBLE',
        mensaje: '"Comedor" ya está pagado o tiene un comprobante en revisión. Actualizá la pantalla.',
        reintentable: false,
      })
  })

  const enviar = () => ServicioPagos.registrarComprobante({ clave: 'k-1', idFactura: 30, items: [31], archivo: archivo() })
  const http = (status: number, cuerpo: string) =>
    new FunctionsHttpError(new Response(cuerpo, { status, headers: { 'Content-Type': 'application/json' } }))

  it('un error HTTP con cuerpo usa el código del cuerpo', async () => {
    estado.respuesta = { data: null, error: http(401, JSON.stringify({ ok: false, codigo: 'PAG_SIN_SESION' })) }
    expect(await enviar()).toMatchObject({ ok: false, codigo: 'PAG_SIN_SESION', reintentable: false })
    estado.respuesta = { data: null, error: http(502, JSON.stringify({ ok: false, codigo: 'PAG_SUBIDA' })) }
    expect(await enviar()).toMatchObject({ ok: false, codigo: 'PAG_SUBIDA', reintentable: true })
  })

  it('un error HTTP sin JSON: 401 es sesión vencida; otro estado, error reintentable', async () => {
    estado.respuesta = { data: null, error: http(401, 'Invalid JWT') }
    expect(await enviar()).toMatchObject({ ok: false, codigo: 'PAG_SIN_SESION', reintentable: false })
    estado.respuesta = { data: null, error: http(500, '<html>error</html>') }
    expect(await enviar()).toMatchObject({ ok: false, codigo: 'PAG_ERROR', reintentable: true })
    estado.respuesta = { data: null, error: http(500, JSON.stringify({ code: 500 })) }
    expect(await enviar()).toMatchObject({ ok: false, codigo: 'PAG_ERROR', reintentable: true })
    expect(console.error).toHaveBeenCalled()
  })

  it('leerCuerpoError: si json() rechaza (JSON inválido o cuerpo ya leído), registra y devuelve un Fallo', async () => {
    // JSON inválido: json() rechaza con SyntaxError
    estado.respuesta = { data: null, error: http(503, '{"codigo":') }
    await expect(enviar()).resolves.toMatchObject({ ok: false, codigo: 'PAG_ERROR', reintentable: true })
    expect(console.error).toHaveBeenCalledWith(
      '[ServicioPagos] cuerpo de error sin JSON:',
      expect.objectContaining({ status: 503, nombre: 'SyntaxError' }),
    )
    // Cuerpo ya consumido: json() rechaza con TypeError, aunque fuera JSON válido
    const usada = new Response(JSON.stringify({ ok: false, codigo: 'PAG_SIN_PERMISO' }), { status: 403 })
    await usada.text()
    estado.respuesta = { data: null, error: new FunctionsHttpError(usada) }
    await expect(enviar()).resolves.toMatchObject({ ok: false, codigo: 'PAG_ERROR', reintentable: true })
    expect(console.error).toHaveBeenCalledWith(
      '[ServicioPagos] cuerpo de error sin JSON:',
      expect.objectContaining({ status: 403, nombre: 'TypeError' }),
    )
  })

  it('sin respuesta (red) es reintentable con la misma clave y no rechaza', async () => {
    // FunctionsFetchError trae el error de red como contexto
    estado.respuesta = { data: null, error: new FunctionsFetchError(new TypeError('Failed to fetch')) }
    expect(await enviar()).toMatchObject({ ok: false, codigo: 'PAG_RED', reintentable: true })
    // si invoke llegara a rechazar, tampoco rechaza el servicio
    estado.rechazo = new TypeError('Failed to fetch')
    expect(await enviar()).toMatchObject({ ok: false, codigo: 'PAG_RED', reintentable: true })
  })

  it('error del relay o respuestas inesperadas: error reintentable, sin rechazar', async () => {
    estado.respuesta = { data: null, error: new FunctionsRelayError(new Response('', { status: 502 })) }
    expect(await enviar()).toMatchObject({ ok: false, codigo: 'PAG_ERROR', reintentable: true })
    for (const data of [null, 'texto', [1, 2], { ok: 'si' }, { ok: false }]) {
      estado.respuesta = { data, error: null }
      expect(await enviar()).toMatchObject({ ok: false, codigo: 'PAG_ERROR', reintentable: true })
    }
    estado.respuesta = { data: { ok: false, codigo: 7 }, error: null }
    expect(await enviar()).toMatchObject({ ok: false, codigo: 'PAG_ERROR' })
  })
})

describe('estadoClave, archivos y revisión', () => {
  it('estadoClave consulta por la clave', async () => {
    estado.respuesta = { data: { ok: true, existe: true, estado_pago: 'Rechazado', motivo_rechazo: 'Monto' }, error: null }
    expect(await ServicioPagos.estadoClave('k-1')).toEqual({ ok: true, existe: true, estado: 'Rechazado', motivo: 'Monto' })
    expect(estado.invocaciones[0].body).toEqual({ accion: 'estado_clave', clave: 'k-1' })
  })

  it('urlArchivo y urlRecibo piden una URL firmada por id', async () => {
    estado.respuesta = { data: { ok: true, url: 'https://x/firmada' }, error: null }
    expect(await ServicioPagos.urlArchivo(4)).toEqual({ ok: true, url: 'https://x/firmada' })
    expect(await ServicioPagos.urlRecibo(4)).toEqual({ ok: true, url: 'https://x/firmada' })
    expect(estado.invocaciones.map((i) => i.body)).toEqual([
      { accion: 'archivo', id_pago: 4 },
      { accion: 'recibo', id_pago: 4 },
    ])
  })

  it('urlFactura pide el PDF de la factura por su id (no el comprobante de pago)', async () => {
    estado.respuesta = { data: { ok: true, url: 'https://x/facturas/4.pdf?token=t' }, error: null }
    expect(await ServicioPagos.urlFactura(4)).toEqual({ ok: true, url: 'https://x/facturas/4.pdf?token=t' })
    expect(estado.invocaciones[0].body).toEqual({ accion: 'factura', id_factura: 4 })
  })

  it('urlFactura de una factura ajena o inexistente da un mensaje claro y no rechaza', async () => {
    estado.respuesta = { data: { ok: false, codigo: 'PAG_FACTURA_AJENA' }, error: null }
    expect(await ServicioPagos.urlFactura(4)).toMatchObject({
      ok: false,
      mensaje: 'Esa factura no corresponde a un hijo asociado a tu cuenta.',
    })
    estado.respuesta = { data: { ok: false, codigo: 'PAG_FACTURA_NO_EXISTE' }, error: null }
    expect(await ServicioPagos.urlFactura(4)).toMatchObject({ ok: false, mensaje: 'La factura no existe.' })
    estado.respuesta = { data: { ok: false, codigo: 'PAG_FACTURA_PENDIENTE' }, error: null }
    expect(await ServicioPagos.urlFactura(4)).toMatchObject({ ok: false, reintentable: false })
  })

  it('revisar informa si el comprobante de pago quedó pendiente', async () => {
    estado.respuesta = { data: { ok: true, estado_pago: 'Aprobado', ya_revisado: false, recibo: 'pendiente' }, error: null }
    expect(await ServicioPagos.revisar(4, true, null)).toEqual({ ok: true, estado: 'Aprobado', yaRevisado: false, recibo: 'pendiente' })
    expect(estado.invocaciones[0].body).toEqual({ accion: 'revisar', id_pago: 4, aprobar: true, motivo: null })
  })

  it('revisar un comprobante ya revisado por otra persona da un mensaje claro', async () => {
    estado.respuesta = { data: { ok: false, codigo: 'PAG_YA_REVISADO', detalle: 'Aprobado' }, error: null }
    expect(await ServicioPagos.revisar(4, false, 'Motivo largo')).toMatchObject({
      ok: false,
      mensaje: 'El comprobante ya fue revisado por otra persona. Actualizá la lista.',
    })
  })
})

describe('comprobantes (bandeja de la web, HU55)', () => {
  it('lee solo comprobantes del estado pedido, los más antiguos primero', async () => {
    estado.filas = {
      data: [
        {
          id_pago: 4, estado: 'En revision', monto_pagado: '16000.00', fecha_pago: '2026-11-04T10:00:00-03:00',
          fecha_revision: null, motivo_rechazo: null, recibo_path: null, id_factura: 3,
          facturas: { anio: 2026, mes: 12, alumno_nombre: 'Uno, Ana', curso: 'Primaria 3 A' },
          pago_items: [{ importe: '10000.00', factura_items: { descripcion: 'Cuota' } }, { importe: 6000, factura_items: { descripcion: 'Comedor' } }],
        },
      ],
      error: null,
    }
    const r = await ServicioPagos.comprobantes('En revision')
    expect(r).toEqual({
      ok: true,
      comprobantes: [
        {
          id_pago: 4, estado: 'En revision', importe: 16000, fechaCarga: '2026-11-04T10:00:00-03:00',
          fechaRevision: null, motivo: null, tieneRecibo: false, alumno: 'Uno, Ana', curso: 'Primaria 3 A',
          factura: 3, periodo: { anio: 2026, mes: 12 },
          conceptos: [{ descripcion: 'Cuota', importe: 10000 }, { descripcion: 'Comedor', importe: 6000 }],
        },
      ],
    })
    expect(estado.consulta).toContainEqual(['from', ['pagos']])
    expect(estado.consulta).toContainEqual(['not', ['id_factura', 'is', null]])
    expect(estado.consulta).toContainEqual(['eq', ['estado', 'En revision']])
    expect(estado.consulta).toContainEqual(['order', ['fecha_pago', { ascending: true }]])
  })

  it('un error de la base da un mensaje y no rechaza', async () => {
    estado.filas = { data: null, error: { code: '42703', message: 'no existe la columna' } }
    expect(await ServicioPagos.comprobantes('Aprobado')).toEqual({
      ok: false,
      mensaje: 'No pudimos cargar los comprobantes. Intentá de nuevo.',
    })
  })
})

describe('escucharCambios (Observer, Realtime)', () => {
  it('el padre escucha solo los comprobantes de su alumno y se desuscribe', () => {
    let avisos = 0
    const cortar = ServicioPagos.escucharCambios({ idAlumno: 7 }, () => avisos++)
    expect(estado.canales[0].config).toEqual({ event: '*', schema: 'public', table: 'pagos', filter: 'id_alumno=eq.7' })
    expect(estado.canales[0].nombre).toMatch(/^pagos-7-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    estado.canales[0].cb()
    expect(avisos).toBe(1)
    cortar()
    expect(estado.quitados).toBe(1)
  })

  it('la bandeja de la web escucha todos los comprobantes', () => {
    ServicioPagos.escucharCambios({}, () => {})
    expect(estado.canales[0].config).toEqual({ event: '*', schema: 'public', table: 'pagos' })
    expect(estado.canales[0].nombre).toMatch(/^pagos-gestion-/)
  })

  it('cada suscripción usa un canal propio', () => {
    ServicioPagos.escucharCambios({ idAlumno: 7 }, () => {})
    ServicioPagos.escucharCambios({ idAlumno: 7 }, () => {})
    expect(estado.canales[0].nombre).not.toBe(estado.canales[1].nombre)
  })

  it('si quitar el canal falla, se registra sin rechazar', async () => {
    estado.quitarFalla = true
    const cortar = ServicioPagos.escucharCambios({ idAlumno: 7 }, () => {})
    expect(() => {
      cortar()
    }).not.toThrow()
    await new Promise((listo) => setTimeout(listo, 0))
    expect(estado.quitados).toBe(1)
    expect(console.error).toHaveBeenCalledWith('[ServicioPagos] quitar canal:', expect.objectContaining({ nombre: 'Error' }))
  })
})

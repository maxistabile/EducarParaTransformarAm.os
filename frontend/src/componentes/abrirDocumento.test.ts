import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MENSAJE_DOCUMENTO, abrirDocumento, validarUrlDocumento } from './abrirDocumento'
import type { PestanaDocumento } from './abrirDocumento'

const SUPABASE = 'https://proyecto.supabase.co'
const TOKEN = 'token-de-prueba.inventado.firma_-x' // no es un token real
const VALIDA = `${SUPABASE}/storage/v1/object/sign/pagos/comprobantes/30/11111111-2222-4333-8444-555555555555/abc.pdf?token=${TOKEN}`
const RECIBO = `${SUPABASE}/storage/v1/object/sign/pagos/recibos/4.pdf?token=${TOKEN}&download=R-000004.pdf`

describe('validarUrlDocumento', () => {
  it('acepta la URL firmada del bucket pagos y la deja igual (token y parámetros)', () => {
    expect(validarUrlDocumento(VALIDA, SUPABASE)?.href).toBe(VALIDA)
    const recibo = validarUrlDocumento(RECIBO, `${SUPABASE}/`)
    expect(recibo?.href).toBe(RECIBO)
    expect(recibo?.searchParams.get('token')).toBe(TOKEN)
    expect(recibo?.searchParams.get('download')).toBe('R-000004.pdf')
  })

  it('rechaza javascript:, data: y otros esquemas', () => {
    expect(validarUrlDocumento('javascript:alert(1)', SUPABASE)).toBeNull()
    // data: con contenido en base64 (un script), sin HTML literal en la prueba
    expect(validarUrlDocumento('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', SUPABASE)).toBeNull()
    expect(validarUrlDocumento(VALIDA.replace('https:', 'http:'), SUPABASE)).toBeNull()
  })

  it('rechaza otro origen, aunque se parezca', () => {
    expect(validarUrlDocumento(VALIDA.replace('proyecto.supabase.co', 'otro.supabase.co'), SUPABASE)).toBeNull()
    expect(validarUrlDocumento(VALIDA.replace('proyecto.supabase.co', 'proyecto.supabase.co.ataque.com'), SUPABASE)).toBeNull()
    expect(validarUrlDocumento(VALIDA.replace('proyecto.supabase.co', 'proyecto.supabase.co:8443'), SUPABASE)).toBeNull()
  })

  it('rechaza credenciales incrustadas', () => {
    expect(validarUrlDocumento(VALIDA.replace('https://', 'https://usuario:clave@'), SUPABASE)).toBeNull()
    expect(validarUrlDocumento(VALIDA.replace('https://', 'https://usuario@'), SUPABASE)).toBeNull()
  })

  it('rechaza otra ruta, otro bucket, salir del bucket con .. y la falta de token', () => {
    expect(validarUrlDocumento(`${SUPABASE}/storage/v1/object/public/pagos/a.pdf?token=${TOKEN}`, SUPABASE)).toBeNull()
    expect(validarUrlDocumento(`${SUPABASE}/storage/v1/object/sign/otro/a.pdf?token=${TOKEN}`, SUPABASE)).toBeNull()
    expect(validarUrlDocumento(`${SUPABASE}/storage/v1/object/sign/pagos/../otro/a.pdf?token=${TOKEN}`, SUPABASE)).toBeNull()
    expect(validarUrlDocumento(`${SUPABASE}/storage/v1/object/sign/pagos/%2e%2e/otro/a.pdf?token=${TOKEN}`, SUPABASE)).toBeNull()
    expect(validarUrlDocumento(`${SUPABASE}/storage/v1/object/sign/pagos/?token=${TOKEN}`, SUPABASE)).toBeNull()
    expect(validarUrlDocumento(VALIDA.split('?')[0], SUPABASE)).toBeNull()
  })

  it('rechaza URLs malformadas y un Supabase sin configurar', () => {
    expect(validarUrlDocumento('no es una url', SUPABASE)).toBeNull()
    expect(validarUrlDocumento('', SUPABASE)).toBeNull()
    expect(validarUrlDocumento(VALIDA, '')).toBeNull()
  })
})

describe('abrirDocumento', () => {
  const pestana = () => {
    const p = {
      opener: {} as unknown,
      destino: null as string | null,
      cerrada: false,
      location: {
        replace: (url: string) => {
          p.destino = url
        },
      },
      close: () => {
        p.cerrada = true
      },
    }
    return p satisfies PestanaDocumento
  }
  let aqui: string[]
  const entorno = (p: PestanaDocumento | null) => ({
    pestana: p,
    navegarAqui: (url: string) => {
      aqui.push(url)
    },
    urlSupabase: SUPABASE,
  })

  beforeEach(() => {
    aqui = []
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('URL válida: corta la relación con esta ventana y navega la pestaña nueva', async () => {
    const p = pestana()
    const error = await abrirDocumento(() => Promise.resolve({ ok: true, url: VALIDA }), entorno(p))
    expect(error).toBeNull()
    expect(p.opener).toBeNull()
    expect(p.destino).toBe(VALIDA)
    expect(p.cerrada).toBe(false)
    expect(aqui).toEqual([])
  })

  it('si el navegador bloqueó la pestaña, abre el documento en esta ventana', async () => {
    expect(await abrirDocumento(() => Promise.resolve({ ok: true, url: RECIBO }), entorno(null))).toBeNull()
    expect(aqui).toEqual([RECIBO])
  })

  it('URL inválida (javascript:, data:, otro origen o malformada): cierra la pestaña y no navega', async () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,hola', VALIDA.replace('proyecto', 'otro'), 'http//mal']) {
      const p = pestana()
      expect(await abrirDocumento(() => Promise.resolve({ ok: true, url }), entorno(p))).toBe(MENSAJE_DOCUMENTO)
      expect(p.cerrada).toBe(true)
      expect(p.destino).toBeNull()
    }
    expect(await abrirDocumento(() => Promise.resolve({ ok: true, url: 'javascript:alert(1)' }), entorno(null))).toBe(MENSAJE_DOCUMENTO)
    expect(aqui).toEqual([])
    // No se registra la URL (puede traer un token)
    const registrado = JSON.stringify(vi.mocked(console.error).mock.calls)
    expect(registrado).not.toContain('alert')
  })

  it('el servicio informa un error: cierra la pestaña y muestra su mensaje', async () => {
    const p = pestana()
    const error = await abrirDocumento(() => Promise.resolve({ ok: false, mensaje: 'No tenés permiso.' }), entorno(p))
    expect(error).toBe('No tenés permiso.')
    expect(p.cerrada).toBe(true)
  })

  it('una promesa rechazada inesperadamente: cierra la pestaña y muestra un error', async () => {
    const p = pestana()
    const causa = new TypeError('Failed to fetch')
    const error = await abrirDocumento(() => Promise.reject(causa), entorno(p))
    expect(error).toBe(MENSAJE_DOCUMENTO)
    expect(p.cerrada).toBe(true)
    expect(p.destino).toBeNull()
  })
})

import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import {
  PREFIJO_INTENTO,
  claveIntento,
  decidirIntento,
  leerIntento,
  mismaSolicitud,
  resolverIntento,
} from './reglasIntentoPago'
import type { ArchivoIntento, IntentoPago } from './reglasIntentoPago'
import { borrarIntento, borrarIntentos, guardarIntento, leerIntentoGuardado } from './sesion/intentoPago'

const CLAVE = '11111111-2222-4333-8444-555555555555'
const archivo: ArchivoIntento = { sha256: 'abc', nombre: 'transf.pdf', tipo: 'application/pdf', tamanio: 1000 }
const guardado: IntentoPago = { clave: CLAVE, idFactura: 30, items: [33, 31], archivo }
let n = 0
const nueva = () => `00000000-0000-4000-8000-00000000000${++n}`

describe('resolverIntento (HU54)', () => {
  it('la misma solicitud reutiliza la clave guardada (reintento o recarga)', () => {
    const r = resolverIntento(guardado, 30, [31, 33], { ...archivo, nombre: 'otro-nombre.pdf' }, nueva)
    expect(r).toEqual({ intento: guardado, reutilizado: true })
  })

  it('si cambian los ítems o el archivo, es otra solicitud: clave nueva', () => {
    const items = resolverIntento(guardado, 30, [31], archivo, nueva)
    expect(items.reutilizado).toBe(false)
    expect(items.intento.clave).not.toBe(CLAVE)
    const otro = resolverIntento(guardado, 30, [31, 33], { ...archivo, sha256: 'def' }, nueva)
    expect(otro.reutilizado).toBe(false)
    expect(otro.intento.items).toEqual([31, 33])
  })

  it('sin intento guardado o de otra factura, clave nueva', () => {
    expect(resolverIntento(null, 30, [31], archivo, nueva).reutilizado).toBe(false)
    expect(resolverIntento(guardado, 31, [31, 33], archivo, nueva).reutilizado).toBe(false)
  })

  it('mismaSolicitud no depende del orden de los ítems', () => {
    expect(mismaSolicitud(guardado, [31, 33], archivo)).toBe(true)
    expect(mismaSolicitud(guardado, [33, 31], archivo)).toBe(true)
    expect(mismaSolicitud(guardado, [31, 33, 34], archivo)).toBe(false)
    expect(mismaSolicitud(guardado, [31], archivo)).toBe(false)
    expect(mismaSolicitud(guardado, [31, 34], archivo)).toBe(false)
    expect(mismaSolicitud(guardado, [], archivo)).toBe(false)
    // sin ambigüedad al unir: [3, 31] no es [1, 33]
    expect(mismaSolicitud({ ...guardado, items: [3, 31] }, [1, 33], archivo)).toBe(false)
    expect(mismaSolicitud(guardado, [31, 33], { ...archivo, tamanio: 999 })).toBe(false)
  })
})

describe('decidirIntento', () => {
  it('sin registro se conserva; registrado se termina; rechazado obliga a un envío nuevo', () => {
    expect(decidirIntento({ existe: false })).toBe('conservar')
    expect(decidirIntento({ existe: true, estado_pago: 'En revision' })).toBe('enviado')
    expect(decidirIntento({ existe: true, estado_pago: 'Aprobado' })).toBe('enviado')
    expect(decidirIntento({ existe: true, estado_pago: 'Rechazado' })).toBe('rechazado')
  })
})

describe('leerIntento', () => {
  it('descarta textos con otra forma, otra factura o una clave inválida', () => {
    expect(leerIntento(null, 30)).toBeNull()
    expect(leerIntento('no es json', 30)).toBeNull()
    expect(leerIntento(JSON.stringify(guardado), 31)).toBeNull()
    expect(leerIntento(JSON.stringify({ ...guardado, clave: 'x' }), 30)).toBeNull()
    expect(leerIntento(JSON.stringify({ ...guardado, items: ['a'] }), 30)).toBeNull()
    expect(leerIntento(JSON.stringify(guardado), 30)).toEqual(guardado)
  })
})

describe('intento guardado por cuenta y factura (sessionStorage)', () => {
  const datos = new Map<string, string>()
  beforeEach(() => {
    datos.clear()
    globalThis.sessionStorage = {
      getItem: (k: string) => datos.get(k) ?? null,
      setItem: (k: string, v: string) => {
        datos.set(k, v)
      },
      removeItem: (k: string) => {
        datos.delete(k)
      },
      key: (i: number) => [...datos.keys()].at(i) ?? null,
      get length() {
        return datos.size
      },
      clear: () => datos.clear(),
    } as Storage
  })
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'sessionStorage')
  })

  it('se guarda por cuenta y factura, y otra cuenta no lo ve', () => {
    guardarIntento('padre-1', guardado)
    expect(datos.has(claveIntento('padre-1', 30))).toBe(true)
    expect(leerIntentoGuardado('padre-1', 30)).toEqual(guardado)
    expect(leerIntentoGuardado('padre-2', 30)).toBeNull()
    borrarIntento('padre-1', 30)
    expect(leerIntentoGuardado('padre-1', 30)).toBeNull()
  })

  it('al cerrar sesión se borran todos los intentos y nada más', () => {
    guardarIntento('padre-1', guardado)
    datos.set('app.alumnoElegido.padre-1', '3')
    borrarIntentos()
    expect([...datos.keys()].some((k) => k.startsWith(PREFIJO_INTENTO))).toBe(false)
    expect(datos.has('app.alumnoElegido.padre-1')).toBe(true)
  })

  it('sin almacenamiento no falla', () => {
    Reflect.deleteProperty(globalThis, 'sessionStorage')
    expect(() => {
      guardarIntento('padre-1', guardado)
      borrarIntentos()
    }).not.toThrow()
    expect(leerIntentoGuardado('padre-1', 30)).toBeNull()
  })
})

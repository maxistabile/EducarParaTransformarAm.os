import { describe, it, expect } from 'vitest'
import { esReintentable, mensajePago, motivoValido, validarArchivo } from './reglasComprobante'

const MB = 1024 * 1024

describe('validarArchivo (HU54, RNF8)', () => {
  it('acepta JPG, PNG y PDF de hasta 5 MB', () => {
    expect(validarArchivo({ name: 'transferencia.jpg', type: 'image/jpeg', size: MB })).toBeNull()
    expect(validarArchivo({ name: 'captura.PNG', type: 'image/png', size: 200 })).toBeNull()
    expect(validarArchivo({ name: 'comprobante.pdf', type: 'application/pdf', size: 5 * MB })).toBeNull()
  })

  it('sin archivo, vacío o de más de 5 MB da un error claro', () => {
    expect(validarArchivo(null)).toMatch(/Elegí el comprobante/)
    expect(validarArchivo({ name: 'a.pdf', type: 'application/pdf', size: 0 })).toMatch(/vacío/)
    expect(validarArchivo({ name: 'a.pdf', type: 'application/pdf', size: 5 * MB + 1 })).toMatch(/5,0 MB|5.0 MB/)
  })

  it('rechaza otros tipos aunque cambien la extensión', () => {
    expect(validarArchivo({ name: 'a.docx', type: 'application/msword', size: 10 })).toMatch(/JPG o PNG, o un PDF/)
    expect(validarArchivo({ name: 'a.pdf', type: 'text/plain', size: 10 })).toMatch(/JPG o PNG, o un PDF/)
    expect(validarArchivo({ name: 'a.gif', type: 'image/png', size: 10 })).toMatch(/JPG o PNG, o un PDF/)
  })
})

describe('mensajes y reintentos', () => {
  it('traduce los códigos y usa el detalle del concepto', () => {
    expect(mensajePago('PAG_ITEM_NO_DISPONIBLE', 'Comedor')).toMatch(/"Comedor" ya está pagado/)
    expect(mensajePago('PAG_ITEM_NO_DISPONIBLE', 'otro comprobante')).toMatch(/Uno de los conceptos/)
    expect(mensajePago('PAG_CLAVE_REUSADA')).toMatch(/no coincide con uno anterior/)
    expect(mensajePago('PAG_MOTIVO')).toMatch(/al menos 5 caracteres/)
    expect(mensajePago('CODIGO_DESCONOCIDO')).toMatch(/error inesperado/)
  })

  it('solo se reintenta (con la misma clave) cuando el envío pudo haber llegado o no', () => {
    expect(esReintentable('PAG_RED')).toBe(true)
    expect(esReintentable('PAG_ERROR')).toBe(true)
    expect(esReintentable('PAG_SUBIDA')).toBe(true)
    expect(esReintentable('PAG_ITEM_NO_DISPONIBLE')).toBe(false)
    expect(esReintentable('PAG_ARCHIVO_TIPO')).toBe(false)
  })

  it('el motivo de rechazo necesita al menos 5 caracteres sin contar espacios', () => {
    expect(motivoValido('  no  ')).toBe(false)
    expect(motivoValido('Monto distinto')).toBe(true)
  })
})

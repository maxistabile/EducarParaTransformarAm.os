import { describe, it, expect } from 'vitest'
import {
  esPeriodoPasado,
  fechaCorta,
  fechaVencimiento,
  mensajeErrorFacturacion,
  nombrePeriodo,
  numeroFactura,
  periodoSiguiente,
  primerDia,
  textoResultado,
  validarPeriodo,
} from './reglasFacturacion'

// Fechas locales: new Date(año, mesBase0, día)
const noviembre = new Date(2026, 10, 8)

describe('período a facturar (HU50)', () => {
  it('el siguiente de noviembre es diciembre del mismo año', () => {
    expect(periodoSiguiente(noviembre)).toEqual({ anio: 2026, mes: 12 })
  })

  it('el siguiente de diciembre es enero del año siguiente', () => {
    expect(periodoSiguiente(new Date(2026, 11, 31))).toEqual({ anio: 2027, mes: 1 })
  })

  it('vence el día 10 y rige el valor vigente al día 1 del mes facturado', () => {
    expect(fechaVencimiento({ anio: 2027, mes: 1 })).toBe('2027-01-10')
    expect(primerDia({ anio: 2026, mes: 12 })).toBe('2026-12-01')
  })

  it('arma nombre, número y fecha para mostrar', () => {
    expect(nombrePeriodo({ anio: 2026, mes: 12 })).toBe('diciembre 2026')
    expect(nombrePeriodo({ anio: 2026, mes: 13 })).toBe('? 2026')
    expect(numeroFactura(123)).toBe('F-000123')
    expect(fechaCorta('2026-12-10')).toBe('10/12/2026')
  })
})

describe('validarPeriodo (mismas reglas que fn_generar_facturas)', () => {
  it('acepta el mes actual y los siguientes', () => {
    expect(validarPeriodo({ anio: 2026, mes: 11 }, noviembre)).toEqual({ ok: true })
    expect(validarPeriodo({ anio: 2027, mes: 3 }, noviembre)).toEqual({ ok: true })
  })

  it('rechaza meses anteriores al actual (sin deuda retroactiva)', () => {
    expect(esPeriodoPasado({ anio: 2026, mes: 10 }, noviembre)).toBe(true)
    expect(esPeriodoPasado({ anio: 2025, mes: 12 }, noviembre)).toBe(true)
    expect(validarPeriodo({ anio: 2026, mes: 10 }, noviembre)).toMatchObject({
      ok: false,
      mensaje: 'No se emiten facturas de meses anteriores al actual.',
    })
  })

  it('rechaza mes o año fuera de rango', () => {
    expect(validarPeriodo({ anio: 2026, mes: 13 }, noviembre)).toMatchObject({ ok: false })
    expect(validarPeriodo({ anio: 2026, mes: 0 }, noviembre)).toMatchObject({ ok: false })
    expect(validarPeriodo({ anio: 2101, mes: 1 }, noviembre)).toMatchObject({ ok: false })
    expect(validarPeriodo({ anio: Number.NaN, mes: 1 }, noviembre)).toMatchObject({
      ok: false,
    })
  })
})

describe('textoResultado', () => {
  const base = { periodo: '2026-12', nuevas: 0, ya_emitidas: 0, cuotas_previas: 0, total: 0 }

  it('informa las nuevas, las ya emitidas y las cuotas respetadas', () => {
    const texto = textoResultado({
      ...base,
      nuevas: 3,
      ya_emitidas: 2,
      cuotas_previas: 1,
      total: 45000,
    })
    expect(texto).toMatch(/^Se emitieron 3 facturas de diciembre 2026 por /)
    expect(texto).toContain('Ya estaban emitidas 2 y no se modificaron.')
    expect(texto).toContain('Se respetaron 1 cuota que ya existían')
  })

  it('al repetir la generación aclara que no se modificó nada', () => {
    expect(textoResultado({ ...base, ya_emitidas: 6 })).toBe(
      'No hubo facturas nuevas: las 6 de diciembre 2026 ya estaban emitidas y no se modificaron.',
    )
  })

  it('sin alumnos activos lo dice', () => {
    expect(textoResultado(base)).toBe('No hay alumnos activos para facturar en diciembre 2026.')
  })
})

describe('mensajeErrorFacturacion', () => {
  const conMensaje = (message: string) => mensajeErrorFacturacion({ code: 'P0001', message })

  it('FAC_SIN_VALOR dice la fecha y qué valores faltan', () => {
    expect(conMensaje('FAC_SIN_VALOR|01/12/2026|Comedor, Deporte: Fútbol')).toBe(
      'Falta el valor vigente al 01/12/2026 de: Comedor, Deporte: Fútbol. Cargalo en Valores con esa fecha o una anterior. No se emitió ninguna factura.',
    )
  })

  it('FAC_SIN_VALOR incompleto usa "?" en lo que falta', () => {
    expect(conMensaje('FAC_SIN_VALOR')).toBe(
      'Falta el valor vigente al ? de: ?. Cargalo en Valores con esa fecha o una anterior. No se emitió ninguna factura.',
    )
    expect(conMensaje('FAC_SIN_VALOR|01/12/2026')).toMatch(/al 01\/12\/2026 de: \?\./)
  })

  it('traduce cada código de la base', () => {
    expect(conMensaje('FAC_PERIODO_PASADO|10/2026')).toMatch(/meses anteriores/)
    expect(conMensaje('FAC_PERIODO|2026|13')).toBe('Elegí un mes y un año válidos.')
    expect(conMensaje('FAC_CUOTA_SIN_VINCULO|12/2026')).toMatch(/avisá al equipo/)
    expect(conMensaje('FAC_EMITIDA|5')).toMatch(/no se pueden modificar/)
    expect(conMensaje('FAC_SOLO_GENERADOR|facturas')).toMatch(/Generar facturas/)
    expect(conMensaje('CUO_PAGADA|11|2026')).toMatch(/ya está pagada/)
    expect(conMensaje('CUO_FACTURADA|11|2026')).toMatch(/ya está facturada/)
    expect(conMensaje('CUO_METODO|Efectivo')).toBe(
      'Los pagos se registran solo por transferencia.',
    )
  })

  it('si falta la migración, lo dice', () => {
    for (const code of ['PGRST202', 'PGRST205', '42P01', '42883'])
      expect(mensajeErrorFacturacion({ code })).toMatch(/etapa17_facturacion\.sql/)
  })

  it('sin permiso o sin sesión pide volver a ingresar', () => {
    expect(mensajeErrorFacturacion({ code: '42501' })).toMatch(/permiso/)
    expect(mensajeErrorFacturacion({ status: 401 })).toMatch(/permiso/)
  })

  it('cualquier otro error da un mensaje genérico', () => {
    expect(mensajeErrorFacturacion({ message: 'Failed to fetch' })).toMatch(/conexión/)
  })
})

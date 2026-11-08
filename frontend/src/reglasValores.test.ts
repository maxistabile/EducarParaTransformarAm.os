import { describe, it, expect } from 'vitest'
import {
  fechaHoy,
  mensajeErrorValores,
  proximoValor,
  puedeGestionarValores,
  validarValor,
  valorVigente,
} from './reglasValores'
import type { ValorServicio } from './reglasValores'

const valor = (
  id: number,
  cambios: Partial<ValorServicio>,
): ValorServicio => ({
  id_valor: id,
  concepto: 'Cuota',
  id_actividad: null,
  id_recorrido: null,
  monto: 1000,
  vigente_desde: '2026-01-01',
  ...cambios,
})

describe('validarValor (HU46 a HU49)', () => {
  const hoy = '2026-11-07'

  it('acepta un importe positivo con coma o punto decimal', () => {
    expect(validarValor({ monto: '15000', vigenteDesde: hoy })).toEqual({
      ok: true,
      monto: 15000,
    })
    expect(validarValor({ monto: '15000,50', vigenteDesde: hoy })).toEqual({
      ok: true,
      monto: 15000.5,
    })
  })

  it('rechaza cero, negativos, texto y más de 2 decimales', () => {
    for (const monto of ['0', '0,00', '-100', 'abc', '', '10,555', '1.2.3', '5.', ',5']) {
      expect(validarValor({ monto, vigenteDesde: hoy }).ok).toBe(false)
    }
  })

  it('rechaza un importe fuera del máximo de la base', () => {
    expect(
      validarValor({ monto: '99999999999', vigenteDesde: hoy }),
    ).toMatchObject({ ok: false })
  })

  it('rechaza una fecha inexistente', () => {
    expect(
      validarValor({ monto: '100', vigenteDesde: '2026-02-30' }),
    ).toMatchObject({ ok: false })
    expect(validarValor({ monto: '100', vigenteDesde: '' })).toMatchObject({
      ok: false,
    })
  })
})

describe('vigencia (HU46)', () => {
  const valores: ValorServicio[] = [
    valor(1, { monto: 10000, vigente_desde: '2026-01-01' }),
    valor(2, { monto: 12000, vigente_desde: '2026-07-01' }),
    valor(3, { monto: 15000, vigente_desde: '2026-12-01' }),
    // Otros conceptos no se mezclan con la cuota
    valor(4, { concepto: 'Comedor', monto: 5000, vigente_desde: '2026-08-01' }),
  ]
  const cuota = { concepto: 'Cuota' as const, idReferencia: null }

  it('rige el de mayor vigencia que no sea posterior a la fecha', () => {
    expect(valorVigente(valores, cuota, '2026-11-07')?.monto).toBe(12000)
  })

  it('rige desde el mismo día de su vigencia', () => {
    expect(valorVigente(valores, cuota, '2026-12-01')?.monto).toBe(15000)
    expect(valorVigente(valores, cuota, '2026-11-30')?.monto).toBe(12000)
  })

  it('un valor futuro queda como próximo y no reemplaza al vigente', () => {
    expect(proximoValor(valores, cuota, '2026-11-07')?.monto).toBe(15000)
    expect(proximoValor(valores, cuota, '2026-12-01')).toBeNull()
  })

  it('sin valores anteriores a la fecha no hay vigente', () => {
    expect(valorVigente(valores, cuota, '2025-12-31')).toBeNull()
  })
})

describe('valores diferenciados (HU47 y HU48)', () => {
  const valores: ValorServicio[] = [
    valor(1, { concepto: 'Deporte', id_actividad: 1, monto: 3000 }),
    valor(2, { concepto: 'Deporte', id_actividad: 2, monto: 4000 }),
    valor(3, { concepto: 'Recorrido', id_recorrido: 1, monto: 6000 }),
    valor(4, { concepto: 'Recorrido', id_recorrido: 4, monto: 9000 }),
  ]
  const fecha = '2026-11-07'

  it('cada deporte tiene su propio valor', () => {
    expect(
      valorVigente(valores, { concepto: 'Deporte', idReferencia: 2 }, fecha)
        ?.monto,
    ).toBe(4000)
    expect(
      valorVigente(valores, { concepto: 'Deporte', idReferencia: 3 }, fecha),
    ).toBeNull()
  })

  it('cada recorrido tiene su propio valor', () => {
    expect(
      valorVigente(valores, { concepto: 'Recorrido', idReferencia: 4 }, fecha)
        ?.monto,
    ).toBe(9000)
    // El id 1 de un recorrido no se confunde con el deporte 1
    expect(
      valorVigente(valores, { concepto: 'Recorrido', idReferencia: 1 }, fecha)
        ?.monto,
    ).toBe(6000)
  })
})

describe('acceso y mensajes', () => {
  it('solo el rol Admin gestiona valores', () => {
    expect(puedeGestionarValores('Admin')).toBe(true)
    for (const rol of ['Directivo', 'Docente', 'Padre', 'Alumno', null]) {
      expect(puedeGestionarValores(rol)).toBe(false)
    }
  })

  it('traduce la tabla faltante y el duplicado', () => {
    expect(mensajeErrorValores({ code: 'PGRST205' })).toMatch(/etapa16/)
    expect(mensajeErrorValores({ code: '23505' })).toMatch(/esa fecha/)
  })

  it('fechaHoy usa la fecha local', () => {
    expect(fechaHoy(new Date(2026, 10, 7, 23, 30))).toBe('2026-11-07')
  })
})

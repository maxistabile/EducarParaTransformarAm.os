import { describe, it, expect } from 'vitest'
import { esCuotaACobrar, etiquetaEstadoCuota, netoCuota } from './reglasCuotas'

const cuota = (cambios: Record<string, unknown> = {}) => ({
  monto_base: 15000,
  recargo: 0,
  descuento: 0,
  estado: 'Pendiente',
  cubierta_por_beca: false,
  ...cambios,
})

describe('cuotas a cobrar (HU50)', () => {
  it('el neto es monto base + recargo − descuento, aunque lleguen como texto', () => {
    expect(netoCuota(cuota({ descuento: 4500 }))).toBe(10500)
    expect(netoCuota(cuota({ monto_base: '14000.00', descuento: '4200.00', recargo: null }))).toBe(
      9800,
    )
  })

  it('una cuota impaga con importe es deuda', () => {
    for (const estado of ['Pendiente', 'Vencida', 'En mora'])
      expect(esCuotaACobrar(cuota({ estado }))).toBe(true)
  })

  it('una cuota heredada con neto 0 en Pendiente no es deuda ni genera avisos', () => {
    const heredada = cuota({ monto_base: 14000, descuento: 14000 })
    expect(esCuotaACobrar(heredada)).toBe(false)
    expect(etiquetaEstadoCuota(heredada)).toBe('Sin cargo')
  })

  it('una cuota pagada no se cobra de nuevo', () => {
    expect(esCuotaACobrar(cuota({ estado: 'Pagada' }))).toBe(false)
    expect(etiquetaEstadoCuota(cuota({ estado: 'Pagada' }))).toBe('Pagada')
  })

  it('la beca del 100 % se muestra como cubierta por beca, no como pagada', () => {
    const becada = cuota({
      estado: 'Pagada',
      descuento: 15000,
      cubierta_por_beca: true,
    })
    expect(esCuotaACobrar(becada)).toBe(false)
    expect(etiquetaEstadoCuota(becada)).toBe('Cubierta por beca')
  })
})

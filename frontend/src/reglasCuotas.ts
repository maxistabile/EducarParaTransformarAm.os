// ═══════════════════════════════════════════════════════════════
//  Cuotas: qué se considera un importe a cobrar (HU50, etapa A)
//  Lógica pura para las pantallas que ya usaban `cuotas`: inicio del
//  panel, Cuotas, Registrar pagos y el portal.
//
//  Una cuota impaga con neto 0 (beca del 100 % generada antes de la
//  facturación) se conserva tal cual en la base, pero no es deuda: no
//  se lista para cobrar, no se cuenta como pendiente y no genera avisos
//  de vencimiento. Mismo criterio que v_factura_items_saldo ("Sin cargo").
// ═══════════════════════════════════════════════════════════════

export interface ImportesCuota {
  monto_base: number | string
  recargo?: number | string | null
  descuento?: number | string | null
  estado: string
  cubierta_por_beca?: boolean | null
}

/** Estados que todavía no están pagados. */
export const ESTADOS_IMPAGOS: readonly string[] = ['Pendiente', 'Vencida', 'En mora']

/** Lo que se paga: monto base + recargo − descuento. */
export function netoCuota(c: ImportesCuota): number {
  return Number(c.monto_base) + Number(c.recargo ?? 0) - Number(c.descuento ?? 0)
}

/** Impaga y con importe mayor que cero: es deuda real. */
export function esCuotaACobrar(c: ImportesCuota): boolean {
  return ESTADOS_IMPAGOS.includes(c.estado) && netoCuota(c) > 0
}

/** Texto del estado para mostrar en las listas. */
export function etiquetaEstadoCuota(c: ImportesCuota): string {
  if (c.cubierta_por_beca) return 'Cubierta por beca'
  if (ESTADOS_IMPAGOS.includes(c.estado) && netoCuota(c) <= 0) return 'Sin cargo'
  return c.estado
}

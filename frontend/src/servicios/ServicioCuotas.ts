// ═══════════════════════════════════════════════════════════════
//  ServicioCuotas — patrón Facade (RF12.1, RF12.2, RF13.1 y RF13.2:
//  HU51, HU52, HU57 y HU58)
// ═══════════════════════════════════════════════════════════════
// Único punto por el que la pantalla Cuotas de la app usa la base. Usa
// la instancia única del cliente (Singleton, src/lib/supabase.ts).
// Pendientes, pagadas y sin cargo de un hijo del padre de la sesión. La
// deuda de un período con factura sale de las vistas de etapa17; la
// cuota no se suma otra vez por fuera de su factura.
// No rechaza: devuelve los datos o el mensaje para mostrar.
import type { RolApp } from '../app/reglasAuthApp'
import { armarEstadoDeCuenta, hoyLocal } from '../app/reglasCuentaAlumno'
import type { EstadoDeCuenta } from '../app/reglasCuentaAlumno'
import { armarDeudaPorItem, armarFacturas } from '../app/reglasFacturasDeuda'
import type { DeudaPorItem, FacturaDetalle } from '../app/reglasFacturasDeuda'
import { leerCuentaAlumno, motivoSinAcceso } from './lecturaCuentaAlumno'

export type ResultadoCuotas = { ok: true; cuenta: EstadoDeCuenta } | { ok: false; mensaje: string }

export const MENSAJE_ERROR_CUOTAS =
  'No pudimos cargar las cuotas. Revisá tu conexión e intentá de nuevo.'

export type ResultadoFacturas = { ok: true; facturas: FacturaDetalle[] } | { ok: false; mensaje: string }
export type ResultadoDeuda = { ok: true; deuda: DeudaPorItem } | { ok: false; mensaje: string }

export const MENSAJE_ERROR_FACTURAS =
  'No pudimos cargar las facturas. Revisá tu conexión e intentá de nuevo.'
export const MENSAJE_ERROR_DEUDA =
  'No pudimos cargar la deuda. Revisá tu conexión e intentá de nuevo.'

export const ServicioCuotas = {
  /**
   * HU57: facturas de un hijo con sus conceptos y comprobantes. El filtro
   * por fecha de emisión se aplica en la pantalla (filtrarPorEmision).
   */
  facturas(
    idAlumno: number,
    permitidos: readonly number[],
    rol: RolApp | null,
  ): Promise<ResultadoFacturas> {
    const motivo = motivoSinAcceso(idAlumno, permitidos, rol)
    if (motivo) return Promise.resolve({ ok: false, mensaje: motivo })
    return leerCuentaAlumno(idAlumno, 'ServicioCuotas', MENSAJE_ERROR_FACTURAS).then((r) =>
      r.ok ? { ok: true, facturas: armarFacturas(r.lectura) } : r,
    )
  },

  /** HU58: deuda de un hijo por concepto y mes. */
  deudaPorItem(
    idAlumno: number,
    permitidos: readonly number[],
    rol: RolApp | null,
  ): Promise<ResultadoDeuda> {
    const motivo = motivoSinAcceso(idAlumno, permitidos, rol)
    if (motivo) return Promise.resolve({ ok: false, mensaje: motivo })
    return leerCuentaAlumno(idAlumno, 'ServicioCuotas', MENSAJE_ERROR_DEUDA).then((r) =>
      r.ok ? { ok: true, deuda: armarDeudaPorItem(r.lectura, hoyLocal()) } : r,
    )
  },

  /** Estado de cuenta de un hijo del padre de la sesión. */
  estadoDeCuenta(
    idAlumno: number,
    permitidos: readonly number[],
    rol: RolApp | null,
  ): Promise<ResultadoCuotas> {
    const motivo = motivoSinAcceso(idAlumno, permitidos, rol)
    if (motivo) return Promise.resolve({ ok: false, mensaje: motivo })
    return leerCuentaAlumno(idAlumno, 'ServicioCuotas', MENSAJE_ERROR_CUOTAS).then((r) =>
      r.ok ? { ok: true, cuenta: armarEstadoDeCuenta(r.lectura) } : r,
    )
  },
}

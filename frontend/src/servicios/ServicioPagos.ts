// ═══════════════════════════════════════════════════════════════
//  ServicioPagos — patrón Facade (RF12.3: HU53 parcial)
// ═══════════════════════════════════════════════════════════════
// Único punto por el que la pantalla Pagos de la app usa la base. Usa la
// instancia única del cliente (Singleton, src/lib/supabase.ts).
// Por ahora solo hay pagos registrados por la administración (cuotas
// pagadas). Los comprobantes y sus estados (en revisión, aprobado,
// rechazado) llegan con HU54 y HU55, que también deciden si se reutiliza
// la tabla pagos; acá todavía no se lee.
// No rechaza: devuelve los datos o el mensaje para mostrar.
import type { RolApp } from '../app/reglasAuthApp'
import { armarHistorialPagos } from '../app/reglasCuentaAlumno'
import type { PagoRegistrado } from '../app/reglasCuentaAlumno'
import { leerCuentaAlumno, motivoSinAcceso } from './lecturaCuentaAlumno'

export type ResultadoPagos = { ok: true; pagos: PagoRegistrado[] } | { ok: false; mensaje: string }

export const MENSAJE_ERROR_PAGOS =
  'No pudimos cargar los pagos. Revisá tu conexión e intentá de nuevo.'

export const ServicioPagos = {
  /** Historial de pagos de un hijo del padre de la sesión. */
  historial(
    idAlumno: number,
    permitidos: readonly number[],
    rol: RolApp | null,
  ): Promise<ResultadoPagos> {
    const motivo = motivoSinAcceso(idAlumno, permitidos, rol)
    if (motivo) return Promise.resolve({ ok: false, mensaje: motivo })
    return leerCuentaAlumno(idAlumno, 'ServicioPagos', MENSAJE_ERROR_PAGOS).then((r) =>
      r.ok ? { ok: true, pagos: armarHistorialPagos(r.lectura) } : r,
    )
  },
}

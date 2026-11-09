// ═══════════════════════════════════════════════════════════════
//  ServicioCuotas — patrón Facade (RF12.1 y RF12.2: HU51 y HU52 parcial)
// ═══════════════════════════════════════════════════════════════
// Único punto por el que la pantalla Cuotas de la app usa la base. Usa
// la instancia única del cliente (Singleton, src/lib/supabase.ts).
// Pendientes, pagadas y sin cargo de un hijo del padre de la sesión. La
// deuda de un período con factura sale de las vistas de etapa17; la
// cuota no se suma otra vez por fuera de su factura.
// No rechaza: devuelve los datos o el mensaje para mostrar.
import type { RolApp } from '../app/reglasAuthApp'
import { armarEstadoDeCuenta } from '../app/reglasCuentaAlumno'
import type { EstadoDeCuenta } from '../app/reglasCuentaAlumno'
import { leerCuentaAlumno, motivoSinAcceso } from './lecturaCuentaAlumno'

export type ResultadoCuotas = { ok: true; cuenta: EstadoDeCuenta } | { ok: false; mensaje: string }

export const MENSAJE_ERROR_CUOTAS =
  'No pudimos cargar las cuotas. Revisá tu conexión e intentá de nuevo.'

export const ServicioCuotas = {
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

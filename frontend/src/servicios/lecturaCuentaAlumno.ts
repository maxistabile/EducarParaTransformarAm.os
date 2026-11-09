// ═══════════════════════════════════════════════════════════════
//  Lectura de la cuenta de un alumno (la usan ServicioCuotas y
//  ServicioPagos; HU51 a HU53)
// ═══════════════════════════════════════════════════════════════
// Tres consultas, todas filtradas por el mismo alumno (también la que
// busca qué cuotas ya están dentro de una factura):
//   - v_facturas_saldo y v_factura_items_saldo (contrato de etapa17);
//   - cuotas, para las heredadas sin factura y la fecha y el método de
//     los pagos registrados por la administración.
// Antes de consultar exige rol Padre y un alumno de la sesión (los que
// devolvió ServicioAlumnosApp). Sin RLS (CLAUDE.md 3.1): este filtro no
// impide consultas directas a la API. La tabla pagos no se lee: su
// reutilización se decide en HU54/HU55.
import { supabase } from '../lib/supabase'
import { resumenError } from '../app/reglasContrasena'
import type { RolApp } from '../app/reglasAuthApp'
import type {
  FilaCuota,
  FilaFacturaSaldo,
  FilaItemSaldo,
  LecturaCuenta,
} from '../app/reglasCuentaAlumno'

export type ResultadoLectura = { ok: true; lectura: LecturaCuenta } | { ok: false; mensaje: string }

export const MENSAJES_CUENTA = {
  soloPadre: 'Las cuotas y los pagos solo están disponibles para el padre o tutor.',
  ajeno: 'No tenés acceso a las cuotas de ese alumno.',
}

/** null si la sesión puede consultar ese alumno; si no, el motivo. */
export function motivoSinAcceso(
  idAlumno: number,
  permitidos: readonly number[],
  rol: RolApp | null,
): string | null {
  if (rol !== 'Padre') return MENSAJES_CUENTA.soloPadre
  if (!permitidos.includes(idAlumno)) return MENSAJES_CUENTA.ajeno
  return null
}

export function leerCuentaAlumno(
  idAlumno: number,
  servicio: string,
  mensajeError: string,
): Promise<ResultadoLectura> {
  const fallo = (causa: unknown): ResultadoLectura => {
    const { code, status } = resumenError(causa)
    console.error(`[${servicio}]`, { code, status })
    return { ok: false, mensaje: mensajeError }
  }

  return Promise.all([
    supabase
      .from('v_facturas_saldo')
      .select('id_factura, anio, mes, fecha_emision, fecha_vencimiento, total, cobrado, saldo, estado_cobro')
      .eq('id_alumno', idAlumno)
      .order('anio')
      .order('mes'),
    supabase
      .from('v_factura_items_saldo')
      .select(
        'id_item, id_factura, anio, mes, concepto, id_cuota, descripcion, porcentaje_beca, neto, cubierta_por_beca, estado_pago, fecha_pago, saldo',
      )
      .eq('id_alumno', idAlumno)
      .order('id_item'),
    supabase
      .from('cuotas')
      .select(
        'id_cuota, anio, mes, monto_base, recargo, descuento, fecha_vencimiento, estado, fecha_pago, metodo_pago, cubierta_por_beca',
      )
      .eq('id_alumno', idAlumno)
      .order('anio')
      .order('mes'),
  ]).then(
    ([fac, ite, cuo]): ResultadoLectura => {
      const error = fac.error ?? ite.error ?? cuo.error
      if (error) return fallo(error)
      return {
        ok: true,
        lectura: {
          facturas: (fac.data ?? []) as unknown as FilaFacturaSaldo[],
          items: (ite.data ?? []) as unknown as FilaItemSaldo[],
          cuotas: (cuo.data ?? []) as unknown as FilaCuota[],
        },
      }
    },
    (causa: unknown) => fallo(causa),
  )
}

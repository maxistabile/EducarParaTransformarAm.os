// ═══════════════════════════════════════════════════════════════
//  ServicioListadosPagos — patrón Facade (RF15: HU62 a HU66)
// ═══════════════════════════════════════════════════════════════
// Único punto por el que la sección "Listados de pagos" de la web usa la
// base. Usa la instancia única del cliente (Singleton, src/lib/supabase.ts)
// y solo lee. Los listados se arman en reglasListadosPagos.ts.
// Acceso: Admin y Directivo (lo controla AdminPanel, como el resto de la
// gestión). Sin RLS (CLAUDE.md 3.1).
// Lee todas las filas por páginas: PostgREST corta en 1000 por defecto y un
// listado truncado daría totales incorrectos.
// No rechaza: devuelve los datos o el mensaje para mostrar.
import { supabase } from '../lib/supabase'
import { resumenError } from '../app/reglasContrasena'
import type { DatosListados } from '../reglasListadosPagos'

export const PAGINA = 1000
export const MENSAJE_ERROR_LISTADOS =
  'No pudimos cargar los datos de los listados. Revisá tu conexión e intentá de nuevo.'

type Pagina = (desde: number, hasta: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>

/** Lee todas las páginas de una consulta ordenada. */
export async function leerTodo<T>(pagina: Pagina): Promise<T[]> {
  const filas: T[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await pagina(desde, desde + PAGINA - 1)
    if (error) throw error
    const lote = (data ?? []) as T[]
    filas.push(...lote)
    if (lote.length < PAGINA) return filas
  }
}

export type ResultadoListados = { ok: true; datos: DatosListados } | { ok: false; mensaje: string }

export const ServicioListadosPagos = {
  async cargar(): Promise<ResultadoListados> {
    try {
      const [facturas, items, saldos, pagos, cuotas, alumnos, inscDeportivas, grupos, recorridos] = await Promise.all([
        leerTodo<DatosListados['facturas'][number]>((a, b) =>
          supabase
            .from('v_facturas_saldo')
            .select('id_factura, id_alumno, anio, mes, alumno_nombre, curso, fecha_vencimiento, total, cobrado, saldo, en_revision')
            .order('id_factura')
            .range(a, b),
        ),
        leerTodo<{ id_item: number; id_factura: number; concepto: string; id_cuota: number | null; id_actividad: number | null; id_recorrido: number | null; descripcion: string; neto: number }>((a, b) =>
          supabase
            .from('factura_items')
            .select('id_item, id_factura, concepto, id_cuota, id_actividad, id_recorrido, descripcion, neto')
            .order('id_item')
            .range(a, b),
        ),
        leerTodo<{ id_item: number; estado_pago: string; saldo: number; fecha_pago: string | null; id_pago: number | null }>((a, b) =>
          supabase
            .from('v_factura_items_saldo')
            .select('id_item, estado_pago, saldo, fecha_pago, id_pago')
            .order('id_item')
            .range(a, b),
        ),
        // Solo comprobantes (con factura): los ingresos usan los Aprobados; el
        // estado de cada ítem ya sale de v_factura_items_saldo
        leerTodo<DatosListados['pagos'][number]>((a, b) =>
          supabase
            .from('pagos')
            .select('id_pago, id_factura, estado, monto_pagado, fecha_revision, metodo_pago, pago_items(id_item, importe, activo)')
            .not('id_factura', 'is', null)
            .eq('estado', 'Aprobado')
            .order('id_pago')
            .range(a, b),
        ),
        // Cuotas pagadas: registros administrativos (y las pagadas por comprobante, que se descartan)
        leerTodo<DatosListados['cuotas'][number]>((a, b) =>
          supabase
            .from('cuotas')
            .select('id_cuota, id_alumno, anio, mes, monto_base, recargo, descuento, estado, fecha_pago, metodo_pago')
            .eq('estado', 'Pagada')
            .order('id_cuota')
            .range(a, b),
        ),
        leerTodo<DatosListados['alumnos'][number]>((a, b) =>
          supabase.from('alumnos').select('id_alumno, nombre, apellido').order('id_alumno').range(a, b),
        ),
        // Todas las inscripciones (también las dadas de baja): el grupo de cada mes sale de sus fechas
        leerTodo<DatosListados['inscDeportivas'][number]>((a, b) =>
          supabase
            .from('inscripciones_deportivas')
            .select('id_alumno, id_grupo, fecha_alta, fecha_baja')
            .order('id_inscripcion_dep')
            .range(a, b),
        ),
        leerTodo<DatosListados['grupos'][number]>((a, b) =>
          supabase
            .from('grupos_deportivos')
            .select('id_grupo, id_actividad, nivel, id_docente, dias, hora_inicio, hora_fin, actividades_extracurriculares(nombre), docentes(usuarios(nombre, apellido))')
            .order('id_grupo')
            .range(a, b),
        ),
        leerTodo<DatosListados['recorridos'][number]>((a, b) =>
          supabase.from('recorridos').select('id_recorrido, numero, nombre').order('numero').range(a, b),
        ),
      ])
      const saldoPorItem = new Map(saldos.map((s) => [s.id_item, s]))
      return {
        ok: true,
        datos: {
          facturas,
          items: items.map((i) => {
            const s = saldoPorItem.get(i.id_item)
            return {
              ...i,
              concepto: i.concepto as DatosListados['items'][number]['concepto'],
              saldo: s?.saldo ?? 0,
              estado_pago: (s?.estado_pago ?? 'Pendiente') as DatosListados['items'][number]['estado_pago'],
              fecha_pago: s?.fecha_pago ?? null,
              id_pago: s?.id_pago ?? null,
            }
          }),
          pagos,
          cuotas,
          alumnos,
          inscDeportivas,
          grupos,
          recorridos,
        },
      }
    } catch (error) {
      console.error('[ServicioListadosPagos] cargar:', resumenError(error))
      return { ok: false, mensaje: MENSAJE_ERROR_LISTADOS }
    }
  },
}

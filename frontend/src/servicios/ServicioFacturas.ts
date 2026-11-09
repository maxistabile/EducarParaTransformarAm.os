// ═══════════════════════════════════════════════════════════════
//  ServicioFacturas — patrón Facade (RF11.5, HU50 etapa A)
// ═══════════════════════════════════════════════════════════════
// Único punto por el que la pantalla de Facturación usa la base. Usa la
// instancia única del cliente (Singleton, src/lib/supabase.ts).
// La generación vive en la base (fn_generar_facturas, que la web llama
// por fn_generar_facturas_gestion: solo Admin o Directivo): crea las
// facturas, sus ítems y la cuota del período si falta, sin pisar nada.
// El saldo se lee de las vistas v_facturas_saldo y v_factura_items_saldo
// (total emitido ≠ saldo pendiente).
// No rechaza: devuelve los datos o el mensaje para mostrar, y la causa
// queda registrada en la consola (solo código y status).
import { supabase } from '../lib/supabase'
import { resumenError } from '../app/reglasContrasena'
import { mensajeErrorFacturacion, validarPeriodo } from '../reglasFacturacion'
import type {
  EstadoCobro,
  EstadoPagoItem,
  Periodo,
  ResumenGeneracion,
} from '../reglasFacturacion'

export interface ItemFactura {
  id_item: number
  id_factura: number
  concepto: 'Cuota' | 'Deporte' | 'Recorrido' | 'Comedor'
  descripcion: string
  importe: number
  porcentaje_beca: number | null
  descuento: number
  neto: number
  estado_pago: EstadoPagoItem
  saldo: number
  cuota_preexistente: boolean
  cubierta_por_beca: boolean
}

export interface FacturaPeriodo {
  id_factura: number
  id_alumno: number
  alumno_nombre: string
  dni: string | null
  curso: string | null
  fecha_emision: string
  fecha_vencimiento: string
  total: number
  cobrado: number
  saldo: number
  estado_cobro: EstadoCobro
  origen: 'Manual' | 'Programada'
  items: ItemFactura[]
}

type Fallo = { ok: false; mensaje: string }

const COLUMNAS_FACTURA =
  'id_factura, id_alumno, alumno_nombre, dni, curso, fecha_emision, fecha_vencimiento, total, cobrado, saldo, estado_cobro, origen'
const COLUMNAS_ITEM =
  'id_item, id_factura, concepto, descripcion, importe, porcentaje_beca, descuento, neto, estado_pago, saldo, cuota_preexistente, cubierta_por_beca'

function fallo(operacion: string, causa: unknown): Fallo {
  const { code, status } = resumenError(causa)
  console.error(`[ServicioFacturas] ${operacion}:`, { code, status })
  // El mensaje trae el código de la base (FAC_..., CUO_...); no se registra
  const message =
    typeof causa === 'object' && causa !== null && 'message' in causa
      ? String((causa as { message: unknown }).message)
      : undefined
  return { ok: false, mensaje: mensajeErrorFacturacion({ code, status, message }) }
}

const numero = (v: unknown) => Number(v ?? 0)
const numeroONulo = (v: unknown) => (v === null || v === undefined ? null : Number(v))

function aItem(fila: Record<string, unknown>): ItemFactura {
  return {
    ...(fila as unknown as ItemFactura),
    importe: numero(fila.importe),
    porcentaje_beca: numeroONulo(fila.porcentaje_beca),
    descuento: numero(fila.descuento),
    neto: numero(fila.neto),
    saldo: numero(fila.saldo),
  }
}

export const ServicioFacturas = {
  /**
   * Emite las facturas del período para los alumnos activos que todavía
   * no la tienen. Repetirlo no duplica ni modifica las ya emitidas.
   */
  generarPeriodo(
    periodo: Periodo,
    hoy = new Date(),
  ): Promise<{ ok: true; resumen: ResumenGeneracion } | Fallo> {
    const validado = validarPeriodo(periodo, hoy)
    if (!validado.ok) return Promise.resolve(validado)
    // fn_generar_facturas_gestion (etapa21) exige Admin o Directivo; la
    // función de fondo ya no la puede llamar cualquier sesión.
    return Promise.resolve(
      supabase.rpc('fn_generar_facturas_gestion', { p_anio: periodo.anio, p_mes: periodo.mes }),
    ).then(
      ({ data, error }) => {
        if (error && ['PGRST202', '42883'].includes(resumenError(error).code ?? '')) {
          console.error('[ServicioFacturas] generarPeriodo:', { code: resumenError(error).code })
          return {
            ok: false as const,
            mensaje: 'Falta ejecutar etapa21_avisos_facturacion.sql en la base. Avisá al equipo.',
          }
        }
        if (error) return fallo('generarPeriodo', error)
        const r = (data ?? {}) as Record<string, unknown>
        return {
          ok: true as const,
          resumen: {
            periodo: String(r.periodo ?? ''),
            nuevas: numero(r.nuevas),
            ya_emitidas: numero(r.ya_emitidas),
            cuotas_previas: numero(r.cuotas_previas),
            total: numero(r.total),
          },
        }
      },
      (causa: unknown) => fallo('generarPeriodo', causa),
    )
  },

  /** Facturas del período con total, cobrado, saldo y sus ítems. */
  listarPeriodo(
    periodo: Periodo,
  ): Promise<{ ok: true; facturas: FacturaPeriodo[] } | Fallo> {
    return Promise.all([
      supabase
        .from('v_facturas_saldo')
        .select(COLUMNAS_FACTURA)
        .eq('anio', periodo.anio)
        .eq('mes', periodo.mes)
        .order('alumno_nombre'),
      supabase
        .from('v_factura_items_saldo')
        .select(COLUMNAS_ITEM)
        .eq('anio', periodo.anio)
        .eq('mes', periodo.mes)
        .order('id_item'),
    ]).then(
      ([facturas, items]) => {
        const error = facturas.error ?? items.error
        if (error) return fallo('listarPeriodo', error)
        const porFactura = new Map<number, ItemFactura[]>()
        for (const fila of (items.data ?? []) as unknown as Array<Record<string, unknown>>) {
          const item = aItem(fila)
          const lista = porFactura.get(item.id_factura) ?? []
          lista.push(item)
          porFactura.set(item.id_factura, lista)
        }
        return {
          ok: true as const,
          facturas: ((facturas.data ?? []) as unknown as Array<Record<string, unknown>>).map(
            (f) => {
              const id = numero(f.id_factura)
              return {
                ...(f as unknown as FacturaPeriodo),
                id_factura: id,
                total: numero(f.total),
                cobrado: numero(f.cobrado),
                saldo: numero(f.saldo),
                items: porFactura.get(id) ?? [],
              }
            },
          ),
        }
      },
      (causa: unknown) => fallo('listarPeriodo', causa),
    )
  },
}

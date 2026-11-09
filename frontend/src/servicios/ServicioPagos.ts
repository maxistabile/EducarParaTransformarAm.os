// ═══════════════════════════════════════════════════════════════
//  ServicioPagos — patrón Facade (RF12.3 a RF12.6: HU53 a HU56)
// ═══════════════════════════════════════════════════════════════
// Único punto por el que las pantallas usan los pagos. Usa la instancia
// única del cliente (Singleton, src/lib/supabase.ts).
//   - App (padre): historial, cargar el comprobante de transferencia,
//     consultar un envío por su clave y abrir archivos y comprobantes.
//   - Web (Admin y Directivo): bandeja de comprobantes y revisión.
// Lo que escribe o toca archivos pasa por la Edge Function "pagos": ahí
// se verifica la sesión y la base valida rol, pertenencia e importes
// (etapa18). El navegador nunca manda importes ni rutas de archivos.
// No rechaza: devuelve los datos o el código con su mensaje.
import { supabase } from '../lib/supabase'
import { resumenError } from '../app/reglasContrasena'
import type { RolApp } from '../app/reglasAuthApp'
import { armarHistorialPagos } from '../app/reglasCuentaAlumno'
import type { EstadoComprobante, MovimientoPago } from '../app/reglasCuentaAlumno'
import { esReintentable, mensajePago } from '../app/reglasComprobante'
import { leerCuentaAlumno, motivoSinAcceso } from './lecturaCuentaAlumno'

export type ResultadoPagos = { ok: true; pagos: MovimientoPago[] } | { ok: false; mensaje: string }

export type Fallo = { ok: false; codigo: string; mensaje: string; reintentable: boolean }

export const MENSAJE_ERROR_PAGOS =
  'No pudimos cargar los pagos. Revisá tu conexión e intentá de nuevo.'

const fallo = (codigo: string, detalle = ''): Fallo => ({
  ok: false,
  codigo,
  mensaje: mensajePago(codigo, detalle),
  reintentable: esReintentable(codigo),
})

type Respuesta = Record<string, unknown> & { ok?: boolean; codigo?: string; detalle?: string }

/** Llama a la Edge Function y normaliza la respuesta (sin rechazar). */
async function invocar(body: FormData | Record<string, unknown>): Promise<Respuesta | Fallo> {
  try {
    const { data, error } = await supabase.functions.invoke('pagos', { body })
    if (error) {
      // Error HTTP: el cuerpo trae el código; sin cuerpo, es de red
      const contexto = (error as { context?: { json?: () => Promise<unknown> } }).context
      const cuerpo = (await contexto?.json?.().catch(() => null)) as Respuesta | null
      if (cuerpo?.codigo) return fallo(cuerpo.codigo, cuerpo.detalle ?? '')
      console.error('[ServicioPagos] invocar:', { nombre: (error as Error).name })
      return fallo(contexto ? 'PAG_ERROR' : 'PAG_RED')
    }
    const r = (data ?? {}) as Respuesta
    if (!r.ok) return fallo(r.codigo ?? 'PAG_ERROR', r.detalle ?? '')
    return r
  } catch (causa) {
    console.error('[ServicioPagos] invocar:', resumenError(causa))
    return fallo('PAG_RED')
  }
}

const esFallo = (r: Respuesta | Fallo): r is Fallo => r.ok === false

export interface ComprobanteGestion {
  id_pago: number
  estado: EstadoComprobante
  importe: number
  fechaCarga: string
  fechaRevision: string | null
  motivo: string | null
  tieneRecibo: boolean
  alumno: string
  curso: string | null
  factura: number
  periodo: { anio: number; mes: number }
  conceptos: Array<{ descripcion: string; importe: number }>
}

interface FilaGestion {
  id_pago: number
  estado: EstadoComprobante
  monto_pagado: number | string
  fecha_pago: string
  fecha_revision: string | null
  motivo_rechazo: string | null
  recibo_path: string | null
  id_factura: number
  facturas: { anio: number; mes: number; alumno_nombre: string; curso: string | null } | null
  pago_items: Array<{ importe: number | string; factura_items: { descripcion: string } | null }> | null
}

export const ServicioPagos = {
  /** HU53: historial de pagos de un hijo del padre de la sesión. */
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

  /**
   * HU54: carga el comprobante de transferencia para ítems de una factura.
   * La clave identifica el envío: un reintento con la misma clave y la
   * misma solicitud devuelve el mismo comprobante.
   */
  async registrarComprobante(datos: {
    clave: string
    idFactura: number
    items: readonly number[]
    archivo: File
  }): Promise<{ ok: true; idPago: number; estado: string; yaExistia: boolean } | Fallo> {
    const form = new FormData()
    form.append('accion', 'subir')
    form.append('clave', datos.clave)
    form.append('id_factura', String(datos.idFactura))
    form.append('items', JSON.stringify(datos.items))
    form.append('archivo', datos.archivo, datos.archivo.name)
    const r = await invocar(form)
    if (esFallo(r)) return r
    return {
      ok: true,
      idPago: Number(r.id_pago),
      estado: String(r.estado_pago),
      yaExistia: Boolean(r.ya_existia),
    }
  },

  /** HU54: ¿esa clave ya tiene un comprobante? (respuesta perdida o recarga) */
  async estadoClave(
    clave: string,
  ): Promise<{ ok: true; existe: boolean; estado?: string; motivo?: string | null } | Fallo> {
    const r = await invocar({ accion: 'estado_clave', clave })
    if (esFallo(r)) return r
    return {
      ok: true,
      existe: Boolean(r.existe),
      estado: typeof r.estado_pago === 'string' ? r.estado_pago : undefined,
      motivo: typeof r.motivo_rechazo === 'string' ? r.motivo_rechazo : null,
    }
  },

  /** URL firmada (60 s) del archivo de transferencia. */
  async urlArchivo(idPago: number): Promise<{ ok: true; url: string } | Fallo> {
    const r = await invocar({ accion: 'archivo', id_pago: idPago })
    return esFallo(r) ? r : { ok: true, url: String(r.url) }
  },

  /** HU56: URL firmada (60 s) del comprobante de pago; lo genera si falta. */
  async urlRecibo(idPago: number): Promise<{ ok: true; url: string } | Fallo> {
    const r = await invocar({ accion: 'recibo', id_pago: idPago })
    return esFallo(r) ? r : { ok: true, url: String(r.url) }
  },

  /** HU55 (web): comprobantes por estado, los más antiguos primero. */
  async comprobantes(
    estado: EstadoComprobante,
  ): Promise<{ ok: true; comprobantes: ComprobanteGestion[] } | { ok: false; mensaje: string }> {
    try {
      const { data, error } = await supabase
        .from('pagos')
        .select(
          'id_pago, estado, monto_pagado, fecha_pago, fecha_revision, motivo_rechazo, recibo_path, id_factura, facturas(anio, mes, alumno_nombre, curso), pago_items(importe, factura_items(descripcion))',
        )
        .not('id_factura', 'is', null)
        .eq('estado', estado)
        .order('fecha_pago', { ascending: estado === 'En revision' })
      if (error) throw error
      return {
        ok: true,
        comprobantes: ((data ?? []) as unknown as FilaGestion[]).map((p) => ({
          id_pago: p.id_pago,
          estado: p.estado,
          importe: Number(p.monto_pagado),
          fechaCarga: p.fecha_pago,
          fechaRevision: p.fecha_revision,
          motivo: p.motivo_rechazo,
          tieneRecibo: Boolean(p.recibo_path),
          alumno: p.facturas?.alumno_nombre ?? 'Alumno',
          curso: p.facturas?.curso ?? null,
          factura: p.id_factura,
          periodo: { anio: p.facturas?.anio ?? 0, mes: p.facturas?.mes ?? 0 },
          conceptos: (p.pago_items ?? []).map((i) => ({
            descripcion: i.factura_items?.descripcion ?? 'Concepto',
            importe: Number(i.importe),
          })),
        })),
      }
    } catch (causa) {
      console.error('[ServicioPagos] comprobantes:', resumenError(causa))
      return { ok: false, mensaje: 'No pudimos cargar los comprobantes. Intentá de nuevo.' }
    }
  },

  /** HU55 (web): aprobar o rechazar. Si aprueba, informa si el PDF quedó listo. */
  async revisar(
    idPago: number,
    aprobar: boolean,
    motivo: string | null,
  ): Promise<
    { ok: true; estado: string; yaRevisado: boolean; recibo: 'listo' | 'pendiente' | null } | Fallo
  > {
    const r = await invocar({ accion: 'revisar', id_pago: idPago, aprobar, motivo })
    if (esFallo(r)) return r
    return {
      ok: true,
      estado: String(r.estado_pago),
      yaRevisado: Boolean(r.ya_revisado),
      recibo: r.recibo === 'listo' || r.recibo === 'pendiente' ? r.recibo : null,
    }
  },

  /** Realtime (Observer): avisa cuando cambia un comprobante. */
  escucharCambios(filtro: { idAlumno?: number }, alCambiar: () => void): () => void {
    const nombre = `pagos-${filtro.idAlumno ?? 'gestion'}-${Math.random().toString(36).slice(2)}`
    const canal = supabase
      .channel(nombre)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pagos',
          ...(filtro.idAlumno ? { filter: `id_alumno=eq.${filtro.idAlumno}` } : {}),
        },
        () => {
          alCambiar()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(canal)
    }
  },
}

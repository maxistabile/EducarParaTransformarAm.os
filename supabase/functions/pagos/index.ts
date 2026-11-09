// ═══════════════════════════════════════════════════════════════
//  Edge Function: pagos (HU54, HU55 y HU56)
// ═══════════════════════════════════════════════════════════════
// Único punto que toca el bucket PRIVADO "pagos" y las funciones de
// etapa18 (solo las ejecuta service_role). La service role vive en los
// secrets de Supabase; nunca en el frontend.
//
// En TODAS las acciones:
//   1. toma el token del encabezado Authorization y lo verifica con
//      auth.getUser(token);
//   2. las funciones SQL validan rol, estado activo y pertenencia actual
//      (Padre del alumno, o Admin/Directivo) en cada llamada.
//
// Acciones (POST):
//   subir        (multipart: accion, clave, id_factura, items, archivo)
//                Padre. Verifica ANTES de tocar Storage; sube a una ruta
//                propia de la solicitud, sin upsert; registra; limpia
//                solo su propio archivo si no quedó vinculado.
//   estado_clave {clave}            Padre: recuperar un envío cuya respuesta se perdió.
//   archivo      {id_pago}          URL firmada (60 s) del archivo de transferencia.
//   revisar      {id_pago, aprobar, motivo}  Admin o Directivo. Si aprueba,
//                                   intenta generar el comprobante PDF.
//   recibo       {id_pago}          Genera (si falta) y firma el comprobante PDF.
//
// Respuesta: { ok: true, ... } o { ok: false, codigo, detalle? }. Los
// códigos (PAG_..., CUO_...) los traduce el frontend.
//
// Despliegue manual: ver supabase/functions/README.md (sección "pagos").
// Secrets: SUPABASE_URL (la setea Supabase) y SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'

const BUCKET = 'pagos'
const MAX_BYTES = 5 * 1024 * 1024
const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ZONA = 'America/Argentina/Buenos_Aires'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function responder(cuerpo: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

class ErrorPago extends Error {
  constructor(
    readonly codigo: string,
    readonly detalle = '',
    readonly status = 200,
  ) {
    super(codigo)
  }
}

/** Error de una función SQL ('PAG_X|detalle') → ErrorPago. */
function deBase(error: { message?: string; code?: string }): ErrorPago {
  const [codigo, ...resto] = (error.message ?? '').split('|')
  if (/^(PAG|CUO)_[A-Z_]+$/.test(codigo)) return new ErrorPago(codigo, resto.join('|'))
  console.error('[pagos] error de base:', { code: error.code })
  return new ErrorPago('PAG_ERROR', '', 500)
}

async function rpc<T>(db: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args)
  if (error) throw deBase(error)
  return data as T
}

// ── Archivo ───────────────────────────────────────────────────
/** Tipo real según los primeros bytes (magic bytes). */
function tipoReal(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (b.length >= 8 && png.every((v, i) => b[i] === v)) return 'image/png'
  const pdf = [0x25, 0x50, 0x44, 0x46, 0x2d] // %PDF-
  if (b.length >= 5 && pdf.every((v, i) => b[i] === v)) return 'application/pdf'
  return null
}

async function sha256(datos: Uint8Array | string): Promise<string> {
  const bytes = typeof datos === 'string' ? new TextEncoder().encode(datos) : datos
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), (x) => x.toString(16).padStart(2, '0')).join('')
}

// ── HU54: subir el comprobante de transferencia ───────────────
async function subir(db: SupabaseClient, usuario: string, form: FormData) {
  const clave = String(form.get('clave') ?? '')
  const idFactura = Number(form.get('id_factura'))
  let items: number[]
  try {
    items = JSON.parse(String(form.get('items') ?? '[]'))
  } catch {
    throw new ErrorPago('PAG_SOLICITUD_INVALIDA', '', 400)
  }
  if (!UUID.test(clave) || !Number.isInteger(idFactura) || idFactura <= 0
      || !Array.isArray(items) || items.length === 0 || items.length > 50
      || !items.every((x) => Number.isInteger(x) && x > 0))
    throw new ErrorPago('PAG_SOLICITUD_INVALIDA', '', 400)

  const archivo = form.get('archivo')
  if (!(archivo instanceof File) || archivo.size === 0) throw new ErrorPago('PAG_ARCHIVO_VACIO')
  if (archivo.size > MAX_BYTES) throw new ErrorPago('PAG_ARCHIVO_GRANDE')
  const bytes = new Uint8Array(await archivo.arrayBuffer())
  const tipo = tipoReal(bytes)
  if (!tipo || (archivo.type && archivo.type !== tipo)) throw new ErrorPago('PAG_ARCHIVO_TIPO')

  // La huella une al usuario con el contenido de la solicitud
  const ordenados = [...items].sort((a, b) => a - b)
  const huella = await sha256(JSON.stringify({
    usuario, id_factura: idFactura, items: ordenados,
    archivo: await sha256(bytes), tipo, tamanio: bytes.length,
  }))

  // 1) Antes de tocar Storage: identidad, pertenencia actual y clave
  const previa = await rpc<{ estado: string; id_pago?: number; estado_pago?: string }>(
    db, 'fn_validar_solicitud',
    { p_usuario: usuario, p_clave: clave, p_id_factura: idFactura, p_items: ordenados, p_huella: huella })
  if (previa.estado === 'existente')
    return { id_pago: previa.id_pago, estado_pago: previa.estado_pago, ya_existia: true }

  // 2) Ruta propia de esta solicitud, sin upsert: nunca pisa otro archivo
  const ruta = `comprobantes/${idFactura}/${clave}/${crypto.randomUUID()}.${EXTENSION[tipo]}`
  const subida = await db.storage.from(BUCKET).upload(ruta, bytes, { contentType: tipo, upsert: false })
  if (subida.error) {
    console.error('[pagos] subida:', { status: (subida.error as { statusCode?: string }).statusCode })
    throw new ErrorPago('PAG_SUBIDA', '', 502)
  }

  // 3) Registro atómico (bloqueos y validación definitiva en la base)
  let registro: { id_pago: number; estado_pago: string; archivo_path: string; ya_existia: boolean }
  try {
    registro = await rpc(db, 'fn_registrar_comprobante', {
      p_usuario: usuario, p_clave: clave, p_id_factura: idFactura, p_items: ordenados,
      p_huella: huella, p_path: ruta, p_tipo: tipo,
    })
  } catch (e) {
    await limpiarSiNoVinculado(db, clave, ruta)
    throw e
  }
  // 4) Si ganó otra solicitud con la misma clave, este archivo sobra
  if (registro.archivo_path !== ruta) await limpiarSiNoVinculado(db, clave, ruta)
  return { id_pago: registro.id_pago, estado_pago: registro.estado_pago, ya_existia: registro.ya_existia }
}

/** Borra SOLO el archivo de esta solicitud, y solo si ningún comprobante lo usa. */
async function limpiarSiNoVinculado(db: SupabaseClient, clave: string, ruta: string) {
  const { data, error } = await db.from('pagos').select('archivo_path').eq('clave', clave).maybeSingle()
  if (error) return // ante la duda, no se borra (queda como huérfano para revisar)
  if (data?.archivo_path === ruta) return
  await db.storage.from(BUCKET).remove([ruta])
}

// ── HU56: comprobante de pago en PDF ──────────────────────────
interface DatosRecibo {
  id_pago: number
  id_factura: number
  anio: number
  mes: number
  alumno: string
  dni: string | null
  curso: string | null
  total: number
  metodo: string
  fecha_aprobacion: string
  recibo_path: string | null
  items: Array<{ concepto: string; descripcion: string; importe: number }>
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre']
const pesos = (n: number) =>
  Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }).replace(/ /g, ' ')
const numero = (prefijo: string, id: number) => `${prefijo}-${String(id).padStart(6, '0')}`

/** PDF solo con datos históricos: regenerarlo da el mismo contenido. */
async function crearPdf(d: DatosRecibo): Promise<Uint8Array> {
  const fecha = new Date(d.fecha_aprobacion)
  const doc = await PDFDocument.create()
  doc.setTitle(`Comprobante de pago ${numero('R', d.id_pago)}`)
  doc.setAuthor('Educar para Transformar')
  doc.setProducer('Educar para Transformar')
  doc.setCreator('Educar para Transformar')
  doc.setCreationDate(fecha)
  doc.setModificationDate(fecha)
  const pagina = doc.addPage([595, 842])
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold)
  const violeta = rgb(0x5b / 255, 0x35 / 255, 0xc5 / 255)
  let y = 790
  const texto = (t: string, x: number, tam = 11, fuente = normal, color = rgb(0.1, 0.1, 0.18)) =>
    pagina.drawText(t, { x, y, size: tam, font: fuente, color })
  const derecha = (t: string, xDer: number, tam = 11, fuente = normal) =>
    pagina.drawText(t, { x: xDer - fuente.widthOfTextAtSize(t, tam), y, size: tam, font: fuente })

  texto('Educar para Transformar', 50, 18, negrita, violeta); y -= 26
  texto(`Comprobante de pago ${numero('R', d.id_pago)}`, 50, 14, negrita); y -= 18
  texto(`Fecha de aprobación: ${fecha.toLocaleDateString('es-AR', { timeZone: ZONA })}`, 50); y -= 30

  texto(`Alumno/a: ${d.alumno}`, 50); y -= 16
  if (d.dni) { texto(`DNI: ${d.dni}`, 50); y -= 16 }
  if (d.curso) { texto(`Curso: ${d.curso}`, 50); y -= 16 }
  texto(`Factura ${numero('F', d.id_factura)} · Período: ${MESES[d.mes - 1] ?? '?'} ${d.anio}`, 50); y -= 30

  texto('Concepto', 50, 11, negrita); derecha('Importe', 545, 11, negrita); y -= 8
  pagina.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: violeta }); y -= 16
  for (const it of d.items) {
    texto(it.descripcion, 50); derecha(pesos(it.importe), 545); y -= 16
  }
  y -= 4
  pagina.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: violeta }); y -= 18
  texto('Total pagado', 50, 12, negrita); derecha(pesos(d.total), 545, 12, negrita); y -= 30

  texto(`Medio de pago: ${d.metodo}`, 50); y -= 30
  texto('Constancia emitida por la institución al aprobar el comprobante de transferencia', 50, 9)
  y -= 12
  texto('cargado por el padre o tutor. No reemplaza a la factura del período.', 50, 9)
  return await doc.save()
}

/** Genera el PDF si falta (ruta fija, sin upsert) y devuelve su ruta. */
async function asegurarRecibo(db: SupabaseClient, usuario: string, idPago: number): Promise<string> {
  const datos = await rpc<DatosRecibo>(db, 'fn_datos_recibo', { p_usuario: usuario, p_id_pago: idPago })
  const ruta = `recibos/${idPago}.pdf`
  if (datos.recibo_path) {
    const { data } = await db.storage.from(BUCKET).list('recibos', { search: `${idPago}.pdf` })
    if (data?.some((o) => o.name === `${idPago}.pdf`)) return datos.recibo_path
  }
  const pdf = await crearPdf(datos)
  const subida = await db.storage.from(BUCKET).upload(ruta, pdf, {
    contentType: 'application/pdf',
    upsert: false,
  })
  // Si ya existe (reintento o generación simultánea), se usa ese: el contenido es el mismo
  const existe = subida.error && /exist|duplicate/i.test(subida.error.message ?? '')
  if (subida.error && !existe) {
    console.error('[pagos] recibo:', { status: (subida.error as { statusCode?: string }).statusCode })
    throw new ErrorPago('PAG_RECIBO_PENDIENTE', '', 502)
  }
  return await rpc<string>(db, 'fn_guardar_recibo', { p_id_pago: idPago, p_path: ruta })
}

async function urlFirmada(db: SupabaseClient, ruta: string): Promise<string> {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(ruta, 60)
  if (error || !data) throw new ErrorPago('PAG_ARCHIVO_NO_DISPONIBLE', '', 502)
  return data.signedUrl
}

// ── Entrada ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return responder({ ok: false, codigo: 'PAG_SOLICITUD_INVALIDA' }, 405)

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) throw new ErrorPago('PAG_SIN_SESION', '', 401)
    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: sesion, error: errorSesion } = await db.auth.getUser(token)
    if (errorSesion || !sesion?.user) throw new ErrorPago('PAG_SIN_SESION', '', 401)
    const usuario = sesion.user.id

    if ((req.headers.get('content-type') ?? '').startsWith('multipart/form-data')) {
      if (Number(req.headers.get('content-length') ?? 0) > MAX_BYTES + 512 * 1024)
        throw new ErrorPago('PAG_ARCHIVO_GRANDE')
      const form = await req.formData()
      if (form.get('accion') !== 'subir') throw new ErrorPago('PAG_SOLICITUD_INVALIDA', '', 400)
      return responder({ ok: true, ...(await subir(db, usuario, form)) })
    }

    const cuerpo = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const idPago = Number(cuerpo.id_pago)
    switch (cuerpo.accion) {
      case 'estado_clave': {
        if (!UUID.test(String(cuerpo.clave ?? ''))) throw new ErrorPago('PAG_SOLICITUD_INVALIDA', '', 400)
        const r = await rpc<Record<string, unknown>>(db, 'fn_estado_clave', { p_usuario: usuario, p_clave: cuerpo.clave })
        return responder({ ok: true, ...r })
      }
      case 'archivo': {
        if (!Number.isInteger(idPago)) throw new ErrorPago('PAG_SOLICITUD_INVALIDA', '', 400)
        const r = await rpc<{ archivo_path: string; archivo_tipo: string }>(
          db, 'fn_datos_archivo', { p_usuario: usuario, p_id_pago: idPago })
        return responder({ ok: true, url: await urlFirmada(db, r.archivo_path), tipo: r.archivo_tipo })
      }
      case 'revisar': {
        if (!Number.isInteger(idPago) || typeof cuerpo.aprobar !== 'boolean')
          throw new ErrorPago('PAG_SOLICITUD_INVALIDA', '', 400)
        const r = await rpc<{ estado_pago: string; ya_revisado: boolean }>(db, 'fn_revisar_comprobante', {
          p_usuario: usuario, p_id_pago: idPago, p_aprobar: cuerpo.aprobar,
          p_motivo: typeof cuerpo.motivo === 'string' ? cuerpo.motivo : null,
        })
        let recibo: 'listo' | 'pendiente' | null = null
        if (r.estado_pago === 'Aprobado') {
          try {
            await asegurarRecibo(db, usuario, idPago)
            recibo = 'listo'
          } catch {
            recibo = 'pendiente' // la aprobación queda; el PDF se reintenta
          }
        }
        return responder({ ok: true, ...r, recibo })
      }
      case 'recibo': {
        if (!Number.isInteger(idPago)) throw new ErrorPago('PAG_SOLICITUD_INVALIDA', '', 400)
        const ruta = await asegurarRecibo(db, usuario, idPago)
        return responder({ ok: true, url: await urlFirmada(db, ruta) })
      }
      default:
        throw new ErrorPago('PAG_SOLICITUD_INVALIDA', '', 400)
    }
  } catch (e) {
    if (e instanceof ErrorPago)
      return responder({ ok: false, codigo: e.codigo, detalle: e.detalle }, e.status)
    console.error('[pagos] inesperado:', { nombre: (e as Error)?.name })
    return responder({ ok: false, codigo: 'PAG_ERROR' }, 500)
  }
})

// ═══════════════════════════════════════════════════════════════
//  Edge Function: avisos (HU50 etapa B, HU60 y HU61)
// ═══════════════════════════════════════════════════════════════
// La dispara pg_cron (programar_avisos_cron.sql) tres veces por día. No
// la puede llamar una sesión común: exige el encabezado x-avisos-clave
// con el secret AVISOS_CLAVE (comparado en tiempo constante). Se
// despliega con "Verify JWT" DESACTIVADO, porque la protege ese secreto.
//
// Decide por la fecha de HOY en Argentina (America/Argentina/Buenos_Aires):
//   - último día hábil del mes (feriados en la tabla feriados):
//       1. factura el mes siguiente (fn_facturacion_programada, que usa
//          fn_generar_facturas: no duplica ni toca lo emitido);
//       2. HU60: a cada padre, la composición por hijo, el total y la
//          factura PDF de cada hijo adjunta (el PDF lo genera la función
//          "pagos", con los mismos datos históricos que ve el padre);
//   - día 20, HU61: aviso solo a padres con deuda, por ítem. Un
//     comprobante En revisión no acredita: sigue en la deuda, marcado.
//
// Envíos (RNF9): cada (tipo, período, padre) se reserva en la base de a
// uno (fn_aviso_reservar), así dos ejecuciones a la vez no duplican.
// Resend recibe una Idempotency-Key por envío. Resultado:
//   - Enviado: Resend aceptó (2xx con id).
//   - Fallido: Resend rechazó (4xx, incluido 429): no se envió; se
//     reintenta en la próxima corrida (hasta 3 intentos).
//   - Incierto: sin respuesta, 5xx o 409: puede haberse enviado. Solo
//     se reintenta con la MISMA clave dentro de las 23 h (Resend
//     deduplica 24 h); después queda para revisión manual.
//   - Omitido: no se llamó a Resend (envío desactivado, sin allowlist,
//     fuera de la allowlist o sin correo). Se reevalúa en la próxima.
//
// Cuerpo opcional (JSON):
//   { simular: true }            arma todo y NO escribe ni envía (sin
//                                facturar ni reservar): devuelve el plan.
//   { fecha: 'AAAA-MM-DD' }      otra fecha: solo con simular: true, o
//                                con recuperar: true y una fecha pasada
//                                (rehacer un día en que el cron falló).
//   { tareas: [...] }            'facturacion', 'mensual', 'deuda'.
// La respuesta y los logs solo llevan conteos y códigos: nunca correos,
// nombres, claves ni URLs.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (los da Supabase),
// AVISOS_CLAVE (nuevo, 32 caracteres o más) y los de enviar-notificacion:
// RESEND_API_KEY, EMAIL_FROM, EMAILS_HABILITADOS y EMAIL_ALLOWLIST. Sin
// EMAIL_ALLOWLIST no se envía nada (demo con datos ficticios).

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

const ZONA = 'America/Argentina/Buenos_Aires'
const BUCKET = 'pagos'
// Solo para pruebas locales: en Supabase no se define y se usa Resend.
const RESEND_URL = Deno.env.get('RESEND_API_URL') ?? 'https://api.resend.com/emails'
const ESPERA_PROVEEDOR_MS = 20000
const PRESUPUESTO_MS = 100000 // lo que no entra queda para la próxima corrida
const TAREAS = ['facturacion', 'mensual', 'deuda'] as const
type Tarea = (typeof TAREAS)[number]
type Tipo = 'Mensual' | 'Deuda'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre']
const FECHA = /^\d{4}-\d{2}-\d{2}$/

function responder(cuerpo: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Comparación en tiempo constante (no corta en la primera diferencia). */
function mismaClave(recibida: string, esperada: string): boolean {
  const a = new TextEncoder().encode(recibida)
  const b = new TextEncoder().encode(esperada)
  let distinto = a.length === b.length ? 0 : 1
  for (let i = 0; i < b.length; i++) distinto |= (a.at(i) ?? 0) ^ (b.at(i) ?? 0)
  return distinto === 0
}

/** 'AAAA-MM-DD' de hoy en Argentina. */
function hoyArgentina(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date())
}

class ErrorBase extends Error {
  constructor(readonly codigo: string) {
    super(codigo)
  }
}

async function rpc<T>(db: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args)
  if (error) {
    const codigo = (error.message ?? '').split('|')[0]
    throw new ErrorBase(/^[A-Z]+_[A-Z_]+$/.test(codigo) ? codigo : 'AVI_BASE')
  }
  return data as T
}

// ── Textos ─────────────────────────────────────────────────────
const pesos = (n: number) =>
  Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }).replace(/\u00a0/g, ' ')
const fechaDia = (iso: string) => String(iso).slice(0, 10).split('-').reverse().join('/')
const periodoTexto = (anio: number, mes: number) => `${MESES.at(mes - 1) ?? '?'} ${anio}`

/** Escapa el texto que va dentro del HTML del correo. */
function escaparHtml(t: unknown): string {
  return String(t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Marco del correo (mismo estilo que enviar-notificacion). */
function marcoHtml(tipo: string, titulo: string, nombre: string, contenidoHtml: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a2e">
  <div style="font-weight:800;font-size:18px;color:#5B35C5;margin-bottom:4px">Educar Para Transformar</div>
  <div style="font-size:11px;color:#6B6B8A;letter-spacing:.08em;text-transform:uppercase;margin-bottom:20px">${escaparHtml(tipo)}</div>
  <h2 style="font-size:18px;margin:0 0 12px">${escaparHtml(titulo)}</h2>
  <p style="font-size:14px;line-height:1.6;margin:0 0 16px">Hola ${escaparHtml(nombre)},</p>
  ${contenidoHtml}
  <hr style="border:none;border-top:1px solid #E8E6F5;margin:24px 0" />
  <p style="font-size:12px;color:#6B6B8A;margin:0">Este es un mensaje automático. No respondas a este correo.</p>
</div>`
}

const filaHtml = (izq: string, der: string, negrita = false) =>
  `<tr><td style="padding:4px 0;font-size:14px${negrita ? ';font-weight:800' : ''}">${escaparHtml(izq)}</td>` +
  `<td style="padding:4px 0;font-size:14px;text-align:right${negrita ? ';font-weight:800' : ''}">${escaparHtml(der)}</td></tr>`

interface ItemFactura { descripcion: string; neto: number }
interface HijoMensual { id_factura: number; alumno: string; vencimiento: string; total: number; items: ItemFactura[] }
interface DestinoMensual { id_usuario_padre: string; email: string | null; nombre: string; anio: number; mes: number; total: number; hijos: HijoMensual[] }
interface ItemDeuda { alumno: string; anio: number; mes: number; descripcion: string; saldo: number; en_revision: boolean; factura: string | null }
interface DestinoDeuda { id_usuario_padre: string; email: string | null; nombre: string; total: number; en_revision: number; items: ItemDeuda[] }

interface Correo { asunto: string; html: string; texto: string }

function correoMensual(d: DestinoMensual): Correo {
  const periodo = periodoTexto(d.anio, d.mes)
  const vence = d.hijos.at(0)?.vencimiento
  const hijosHtml = d.hijos.map((h) =>
    `<p style="font-size:14px;font-weight:800;margin:16px 0 4px">${escaparHtml(h.alumno)} · Factura F-${String(h.id_factura).padStart(6, '0')}</p>` +
    `<table style="width:100%;border-collapse:collapse">${h.items.map((i) => filaHtml(i.descripcion, pesos(i.neto))).join('')}` +
    `${filaHtml('Subtotal', pesos(h.total), true)}</table>`).join('')
  const contenidoHtml =
    `<p style="font-size:14px;line-height:1.6;margin:0 0 8px">Ya está la factura de ${escaparHtml(periodo)}` +
    `${vence ? `, con vencimiento el ${escaparHtml(fechaDia(vence))}` : ''}.</p>` +
    hijosHtml +
    `<table style="width:100%;border-collapse:collapse;margin-top:12px;border-top:1px solid #E8E6F5">${filaHtml('Total a pagar', pesos(d.total), true)}</table>` +
    (Number(d.total) === 0
      ? '<p style="font-size:14px;margin:12px 0 0">Este mes no tenés importes a pagar.</p>'
      : '<p style="font-size:14px;line-height:1.6;margin:12px 0 0">Pagá por transferencia y cargá el comprobante en la app. Adjuntamos la factura en PDF de cada alumno.</p>')
  const texto = [
    `Hola ${d.nombre},`,
    `Ya está la factura de ${periodo}${vence ? `, con vencimiento el ${fechaDia(vence)}` : ''}.`,
    ...d.hijos.flatMap((h) => [
      '', `${h.alumno} - Factura F-${String(h.id_factura).padStart(6, '0')}`,
      ...h.items.map((i) => `  ${i.descripcion}: ${pesos(i.neto)}`), `  Subtotal: ${pesos(h.total)}`]),
    '', `Total a pagar: ${pesos(d.total)}`,
    Number(d.total) === 0 ? 'Este mes no tenés importes a pagar.' : 'Pagá por transferencia y cargá el comprobante en la app.',
  ].join('\n')
  return { asunto: `Factura de ${periodo} - Educar Para Transformar`, html: marcoHtml('Factura del mes', `Factura de ${periodo}`, d.nombre, contenidoHtml), texto }
}

function correoDeuda(d: DestinoDeuda, anio: number, mes: number): Correo {
  const filasHtml = d.items.map((i) =>
    filaHtml(`${i.alumno} · ${periodoTexto(i.anio, i.mes)} · ${i.descripcion}${i.en_revision ? ' (comprobante en revisión, todavía no acreditado)' : ''}`,
      pesos(i.saldo))).join('')
  const contenidoHtml =
    '<p style="font-size:14px;line-height:1.6;margin:0 0 8px">Según nuestros registros, quedan estos conceptos pendientes de pago:</p>' +
    `<table style="width:100%;border-collapse:collapse">${filasHtml}${filaHtml('Total pendiente', pesos(d.total), true)}</table>` +
    (Number(d.en_revision) > 0
      ? `<p style="font-size:14px;line-height:1.6;margin:12px 0 0">${escaparHtml(pesos(d.en_revision))} tienen un comprobante en revisión: si ya lo enviaste, no tenés que hacer nada; lo vamos a acreditar cuando se apruebe.</p>`
      : '') +
    '<p style="font-size:14px;line-height:1.6;margin:12px 0 0">Podés pagar por transferencia y cargar el comprobante en la app.</p>'
  const texto = [
    `Hola ${d.nombre},`,
    'Quedan estos conceptos pendientes de pago:',
    ...d.items.map((i) => `  ${i.alumno} - ${periodoTexto(i.anio, i.mes)} - ${i.descripcion}: ${pesos(i.saldo)}${i.en_revision ? ' (comprobante en revisión)' : ''}`),
    `Total pendiente: ${pesos(d.total)}`,
    ...(Number(d.en_revision) > 0
      ? [`${pesos(d.en_revision)} tienen un comprobante en revisión: si ya lo enviaste, no tenés que hacer nada.`]
      : []),
    'Podés pagar por transferencia y cargar el comprobante en la app.',
  ].join('\n')
  const periodo = periodoTexto(anio, mes)
  return { asunto: `Aviso de deuda (${periodo}) - Educar Para Transformar`, html: marcoHtml('Aviso de deuda', 'Pagos pendientes', d.nombre, contenidoHtml), texto }
}

// ── Factura PDF (la genera "pagos": una sola implementación) ───
function base64(bytes: Uint8Array): string {
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binario)
}

async function pdfFactura(db: SupabaseClient, idFactura: number, clave: string): Promise<string> {
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const resp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/pagos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${servicio}`, apikey: servicio, 'Content-Type': 'application/json', 'x-avisos-clave': clave },
    body: JSON.stringify({ accion: 'factura_sistema', id_factura: idFactura }),
  })
  const r = (await resp.json().catch(() => null)) as { ok?: boolean; ruta?: string } | null
  if (!resp.ok || !r?.ok || typeof r.ruta !== 'string') throw new ErrorBase('AVI_PDF')
  const { data, error } = await db.storage.from(BUCKET).download(r.ruta)
  if (error || !data) throw new ErrorBase('AVI_PDF')
  return base64(new Uint8Array(await data.arrayBuffer()))
}

// ── Envío ──────────────────────────────────────────────────────
interface Contexto {
  db: SupabaseClient
  clave: string
  simular: boolean
  inicio: number
  habilitado: boolean
  allowlist: string[]
  apiKey: string | undefined
  from: string
}

type Conteo = Map<string, number>
const sumar = (c: Conteo, k: string) => {
  c.set(k, (c.get(k) ?? 0) + 1)
}

const correoUtil = (e: string | null | undefined): e is string =>
  typeof e === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !e.endsWith('@alumno.local')

/** Resultado del proveedor → estado del envío. */
export function clasificar(status: number | null, id: unknown): { estado: 'Enviado' | 'Fallido' | 'Incierto'; motivo: string | null } {
  if (status === null) return { estado: 'Incierto', motivo: 'sin_respuesta' }
  if (status >= 200 && status < 300) return typeof id === 'string' && id ? { estado: 'Enviado', motivo: null } : { estado: 'Incierto', motivo: 'respuesta_sin_id' }
  if (status === 409) return { estado: 'Incierto', motivo: 'idempotencia_409' }
  if (status === 429) return { estado: 'Fallido', motivo: 'limite_429' }
  if (status >= 400 && status < 500) return { estado: 'Fallido', motivo: `rechazado_${status}` }
  return { estado: 'Incierto', motivo: `proveedor_${status}` }
}

async function registrar(ctx: Contexto, id: number, estado: string, idProveedor: string | null, motivo: string | null) {
  await rpc(ctx.db, 'fn_aviso_registrar', { p_id_envio: id, p_estado: estado, p_id_proveedor: idProveedor, p_motivo: motivo })
}

async function procesar(
  ctx: Contexto, tipo: Tipo, anio: number, mes: number,
  destino: { id_usuario_padre: string; email: string | null },
  armar: (detalle: Record<string, unknown>) => Correo,
  conteo: Conteo, plan: Array<Record<string, unknown>>,
) {
  const { email, ...detalle } = destino as Record<string, unknown> & { email: string | null }
  const permitido = correoUtil(email) && ctx.allowlist.includes(email.toLowerCase())
  if (ctx.simular) {
    plan.push({
      tipo, id_usuario_padre: destino.id_usuario_padre,
      correo: !correoUtil(email) ? 'sin_correo' : permitido ? 'en_allowlist' : 'fuera_de_allowlist',
      total: detalle.total,
    })
    sumar(conteo, 'simulado')
    return
  }

  const r = await rpc<{ reservado: boolean; motivo?: string; id_envio: number; clave?: string; email?: string | null; detalle?: Record<string, unknown> }>(
    ctx.db, 'fn_aviso_reservar',
    { p_tipo: tipo, p_anio: anio, p_mes: mes, p_padre: destino.id_usuario_padre, p_email: email, p_detalle: detalle })
  if (!r.reservado) {
    sumar(conteo, r.motivo ?? 'no_reservado')
    return
  }
  // Se envía lo reservado: en un reintento incierto, el mismo correo y los mismos datos
  const para = r.email ?? null
  const datos = r.detalle ?? detalle
  const omitir = (motivo: string) => registrar(ctx, r.id_envio, 'Omitido', null, motivo).then(() => sumar(conteo, `omitido_${motivo}`))
  if (!correoUtil(para)) return omitir('sin_correo')
  if (!ctx.habilitado) return omitir('envio_desactivado')
  if (ctx.allowlist.length === 0) return omitir('sin_allowlist')
  if (!ctx.allowlist.includes(para.toLowerCase())) return omitir('fuera_de_allowlist')
  if (!ctx.apiKey) return omitir('sin_api_key')

  let llamado = false
  try {
    const correo = armar(datos)
    const adjuntos: Array<{ filename: string; content: string }> = []
    if (tipo === 'Mensual') {
      for (const h of (datos.hijos as HijoMensual[] | undefined) ?? []) {
        adjuntos.push({ filename: `Factura-F-${String(h.id_factura).padStart(6, '0')}.pdf`, content: await pdfFactura(ctx.db, h.id_factura, ctx.clave) })
      }
    }
    const control = new AbortController()
    const corte = setTimeout(() => {
      control.abort()
    }, ESPERA_PROVEEDOR_MS)
    let status: number | null = null
    let id: unknown = null
    try {
      llamado = true
      const resp = await fetch(RESEND_URL, {
        method: 'POST',
        signal: control.signal,
        headers: { Authorization: `Bearer ${ctx.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': String(r.clave) },
        body: JSON.stringify({ from: ctx.from, to: [para], subject: correo.asunto, html: correo.html, text: correo.texto, attachments: adjuntos }),
      })
      status = resp.status
      id = ((await resp.json().catch(() => null)) as { id?: unknown } | null)?.id ?? null
    } catch (e: unknown) {
      // Red o tiempo agotado: no se sabe si llegó
      console.error('[avisos] proveedor sin respuesta:', { tipo, nombre: e instanceof Error ? e.name : typeof e })
    } finally {
      clearTimeout(corte)
    }
    const res = clasificar(status, id)
    await registrar(ctx, r.id_envio, res.estado, typeof id === 'string' ? id : null, res.motivo)
    sumar(conteo, res.estado.toLowerCase())
  } catch (e: unknown) {
    // Error antes de llamar a Resend (PDF, armado): no se envió nada
    const codigo = e instanceof ErrorBase ? e.codigo : 'AVI_INTERNO'
    console.error('[avisos] error al preparar o registrar:', { tipo, codigo })
    if (!llamado) {
      try {
        await registrar(ctx, r.id_envio, 'Fallido', null, codigo.toLowerCase())
        sumar(conteo, 'fallido')
      } catch (error) {
        // Queda Enviando: la próxima corrida lo retoma (en_curso vence a los 15 min)
        console.error('[avisos] no se pudo registrar el fallo:', { tipo, codigo: error instanceof ErrorBase ? error.codigo : 'AVI_INTERNO' })
        sumar(conteo, 'sin_registro')
      }
    } else {
      sumar(conteo, 'sin_registro')
    }
  }
}

async function enviarATodos<D extends { id_usuario_padre: string; email: string | null }>(
  ctx: Contexto, tipo: Tipo, anio: number, mes: number, destinos: D[], armar: (d: Record<string, unknown>) => Correo,
): Promise<Record<string, unknown>> {
  const conteo: Conteo = new Map()
  const plan: Array<Record<string, unknown>> = []
  let pendientes = 0
  for (const d of destinos) {
    if (Date.now() - ctx.inicio > PRESUPUESTO_MS) {
      pendientes++
      continue
    }
    await procesar(ctx, tipo, anio, mes, d, armar, conteo, plan)
  }
  return { destinatarios: destinos.length, periodo: `${anio}-${String(mes).padStart(2, '0')}`, ...Object.fromEntries(conteo), ...(pendientes ? { pendientes_proxima_corrida: pendientes } : {}), ...(ctx.simular ? { plan } : {}) }
}

// ── Entrada ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') return responder({ ok: false, codigo: 'AVI_METODO' }, 405)
  const esperada = Deno.env.get('AVISOS_CLAVE') ?? ''
  if (esperada.length < 32) {
    console.error('[avisos] falta configurar AVISOS_CLAVE')
    return responder({ ok: false, codigo: 'AVI_CONFIGURACION' }, 500)
  }
  const recibida = req.headers.get('x-avisos-clave') ?? ''
  if (!mismaClave(recibida, esperada)) return responder({ ok: false, codigo: 'AVI_SIN_PERMISO' }, 401)

  try {
    const cuerpo = (await req.json().catch(() => ({}))) as Record<string, unknown>
    // AVISOS_HOY_PRUEBA: solo para las pruebas locales con fechas simuladas.
    // En Supabase NO se define: la fecha es la de hoy en Argentina.
    const hoy = Deno.env.get('AVISOS_HOY_PRUEBA') ?? hoyArgentina()
    const simular = cuerpo.simular === true
    const recuperar = cuerpo.recuperar === true
    const fecha = typeof cuerpo.fecha === 'string' ? cuerpo.fecha : hoy
    if (!FECHA.test(fecha)) return responder({ ok: false, codigo: 'AVI_FECHA' }, 400)
    if (fecha !== hoy && !simular && !(recuperar && fecha < hoy))
      return responder({ ok: false, codigo: 'AVI_FECHA' }, 400)
    const pedidas = Array.isArray(cuerpo.tareas) ? cuerpo.tareas : TAREAS
    const tareas = new Set<Tarea>(TAREAS.filter((t) => pedidas.includes(t)))

    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const ctx: Contexto = {
      db, clave: esperada, simular, inicio: Date.now(),
      habilitado: Deno.env.get('EMAILS_HABILITADOS') === 'true',
      allowlist: (Deno.env.get('EMAIL_ALLOWLIST') ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
      apiKey: Deno.env.get('RESEND_API_KEY'),
      from: Deno.env.get('EMAIL_FROM') ?? 'Educar Para Transformar <onboarding@resend.dev>',
    }

    const [anio, mes, dia] = fecha.split('-').map(Number)
    const ultimo = await rpc<string>(db, 'fn_ultimo_dia_habil', { p_anio: anio, p_mes: mes })
    const esUltimo = String(ultimo).slice(0, 10) === fecha
    const sig = mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 }
    const resultado: Record<string, unknown> = { ok: true, fecha, simular, ultimo_dia_habil: String(ultimo).slice(0, 10) }

    // 1) HU50 etapa B: facturar el mes siguiente
    let facturacionOk = true
    if (tareas.has('facturacion')) {
      if (!esUltimo) resultado.facturacion = { omitida: 'no_es_ultimo_dia_habil' }
      else if (simular) resultado.facturacion = { simulada: true, periodo: `${sig.anio}-${String(sig.mes).padStart(2, '0')}` }
      else {
        try {
          const r = await rpc<{ generada: boolean; resumen?: Record<string, unknown> }>(db, 'fn_facturacion_programada', { p_fecha: fecha })
          resultado.facturacion = { generada: r.generada, nuevas: r.resumen?.nuevas ?? 0, ya_emitidas: r.resumen?.ya_emitidas ?? 0 }
        } catch (e: unknown) {
          facturacionOk = false
          resultado.facturacion = { error: e instanceof ErrorBase ? e.codigo : 'AVI_INTERNO' }
        }
      }
    }

    // 2) HU60: correo con la factura del mes siguiente
    if (tareas.has('mensual')) {
      if (!esUltimo) resultado.mensual = { omitido: 'no_es_ultimo_dia_habil' }
      else if (!facturacionOk) resultado.mensual = { omitido: 'facturacion_con_error' }
      else {
        const destinos = await rpc<DestinoMensual[]>(db, 'fn_avisos_mensual', { p_anio: sig.anio, p_mes: sig.mes })
        resultado.mensual = await enviarATodos(ctx, 'Mensual', sig.anio, sig.mes, destinos,
          (d) => correoMensual(d as unknown as DestinoMensual))
      }
    }

    // 3) HU61: aviso de deuda del día 20
    if (tareas.has('deuda')) {
      if (dia !== 20) resultado.deuda = { omitido: 'no_es_dia_20' }
      else {
        const destinos = await rpc<DestinoDeuda[]>(db, 'fn_avisos_deuda', { p_fecha: fecha })
        resultado.deuda = await enviarATodos(ctx, 'Deuda', anio, mes, destinos,
          (d) => correoDeuda(d as unknown as DestinoDeuda, anio, mes))
      }
    }

    console.log('[avisos] corrida:', JSON.stringify({ fecha, simular, facturacion: resultado.facturacion,
      mensual: resultado.mensual && { ...(resultado.mensual as Record<string, unknown>), plan: undefined },
      deuda: resultado.deuda && { ...(resultado.deuda as Record<string, unknown>), plan: undefined } }))
    return responder(resultado)
  } catch (e: unknown) {
    const codigo = e instanceof ErrorBase ? e.codigo : 'AVI_INTERNO'
    console.error('[avisos] corrida con error:', { codigo, nombre: e instanceof Error ? e.name : typeof e })
    return responder({ ok: false, codigo }, 500)
  }
})

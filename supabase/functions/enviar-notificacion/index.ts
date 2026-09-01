// Edge Function: enviar-notificacion
// Envía un email a cada destinatario ante eventos del colegio
// (inasistencia, calificaciones, vencimiento de cuotas, comunicados, etc.).
//
// Recibe: { tipo: string, mensajes: [{ id_usuario, titulo, mensaje }] }
// Resuelve el email de cada id_usuario desde la tabla `usuarios` (service role)
// y envía vía Resend (https://resend.com).
//
// Variables de entorno necesarias:
//   SUPABASE_URL                (la setea Supabase)
//   SUPABASE_SERVICE_ROLE_KEY   (configurar en el dashboard)
//   RESEND_API_KEY              (tu API key de Resend)
//   EMAIL_FROM                  (opcional, ej: 'Colegio <noreply@tudominio.com>')

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface MensajeEntrada {
  id_usuario: string
  titulo: string
  mensaje: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { tipo, mensajes } = (await req.json()) as {
      tipo?: string
      mensajes?: MensajeEntrada[]
    }

    if (!Array.isArray(mensajes) || mensajes.length === 0) {
      return json({ enviados: 0, motivo: 'sin mensajes' }, 200)
    }

    // SEGURIDAD (app de muestra): el envío real de emails está DESACTIVADO.
    // La tabla `usuarios` contiene emails inventados; enviar correos reales
    // podría llegar a desconocidos. Para reactivarlo, configurá el secret
    // EMAILS_HABILITADOS=true y (recomendado) un EMAIL_ALLOWLIST con los correos
    // autorizados separados por coma.
    const EMAILS_HABILITADOS = Deno.env.get('EMAILS_HABILITADOS') === 'true'
    if (!EMAILS_HABILITADOS) {
      return json(
        { enviados: 0, motivo: 'envío de emails desactivado (demo)' },
        200,
      )
    }

    const ALLOWLIST = (Deno.env.get('EMAIL_ALLOWLIST') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const EMAIL_FROM =
      Deno.env.get('EMAIL_FROM') ??
      'Educar Para Transformar <onboarding@resend.dev>'

    // Si no hay key configurada, no rompemos el flujo: la notificación in-app
    // ya quedó guardada. Devolvemos 200 con aviso.
    if (!RESEND_API_KEY) {
      return json(
        { enviados: 0, motivo: 'RESEND_API_KEY no configurada' },
        200,
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Resolver emails de los destinatarios
    const ids = [...new Set(mensajes.map((m) => m.id_usuario).filter(Boolean))]
    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id_usuario, email, nombre')
      .in('id_usuario', ids)

    const porId: Record<string, { email: string; nombre: string }> = {}
    ;(usuarios ?? []).forEach((u: { id_usuario: string; email: string; nombre: string }) => {
      // ignorar emails generados internos (ej: alumnos sin email real)
      if (u.email && !u.email.endsWith('@alumno.local')) {
        porId[u.id_usuario] = { email: u.email, nombre: u.nombre }
      }
    })

    let enviados = 0
    const errores: string[] = []

    for (const m of mensajes) {
      const destino = porId[m.id_usuario]
      if (!destino) continue
      // Si hay allowlist configurada, solo se envía a correos autorizados.
      if (ALLOWLIST.length && !ALLOWLIST.includes(destino.email.toLowerCase())) {
        continue
      }
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [destino.email],
          subject: m.titulo,
          html: plantilla(destino.nombre, m.titulo, m.mensaje, tipo),
        }),
      })
      if (resp.ok) enviados++
      else errores.push(`${destino.email}: ${await resp.text()}`)
    }

    return json({ enviados, total: mensajes.length, errores }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function plantilla(
  nombre: string,
  titulo: string,
  mensaje: string,
  tipo?: string,
) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a2e">
    <div style="font-weight:800;font-size:18px;color:#5B35C5;margin-bottom:4px">Educar Para Transformar</div>
    <div style="font-size:11px;color:#6B6B8A;letter-spacing:.08em;text-transform:uppercase;margin-bottom:20px">${tipo ?? 'Notificación'}</div>
    <h2 style="font-size:18px;margin:0 0 12px">${titulo}</h2>
    <p style="font-size:14px;line-height:1.6;margin:0 0 16px">Hola ${nombre || ''},</p>
    <p style="font-size:14px;line-height:1.6;margin:0 0 16px">${mensaje}</p>
    <hr style="border:none;border-top:1px solid #E8E6F5;margin:24px 0" />
    <p style="font-size:12px;color:#6B6B8A;margin:0">Este es un mensaje automático del campus virtual. No respondas a este correo.</p>
  </div>`
}

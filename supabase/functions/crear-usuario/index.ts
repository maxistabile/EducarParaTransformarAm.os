// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
//   'Access-Control-Allow-Methods': 'POST, OPTIONS',
// }

// Deno.serve(async (req) => {
//   // Responder al preflight de CORS
//   if (req.method === 'OPTIONS') {
//     return new Response('ok', { headers: corsHeaders })
//   }

//   try {
//     const { email, password, nombre, apellido, rol } = await req.json()

//     const supabase = createClient(
//       Deno.env.get('SUPABASE_URL')!,
//       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
//     )

//     // Crear usuario en Auth
//     const { data, error: authErr } = await supabase.auth.admin.createUser({
//       email,
//       password,
//       email_confirm: true,
//     })

//     if (authErr || !data.user) {
//       return new Response(
//         JSON.stringify({ error: authErr?.message }),
//         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
//       )
//     }

//     // Upsert en tabla usuarios
//     await supabase.from('usuarios').upsert([{
//       id_usuario: data.user.id,
//       email,
//       nombre,
//       apellido,
//       rol,
//     }], { onConflict: 'id_usuario' })

//     // Si es Docente crear registro en docentes
//     if (rol === 'Docente') {
//       await supabase.from('docentes').upsert([{
//         id_usuario: data.user.id,
//         dni: '',
//       }], { onConflict: 'id_usuario' })
//     }

//     return new Response(
//       JSON.stringify({ ok: true }),
//       { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
//     )

//   } catch (err) {
//     return new Response(
//       JSON.stringify({ error: String(err) }),
//       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
//     )
//   }
// })

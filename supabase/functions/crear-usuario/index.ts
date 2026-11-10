// ═══════════════════════════════════════════════════════════════
//  Edge Function: crear-usuario (alta de cuentas desde la gestión web)
// ═══════════════════════════════════════════════════════════════
// Reemplaza la versión publicada hasta el 10/11/2026 (código aportado por el
// equipo, importaba supabase-js desde esm.sh), que:
//   - no validaba quién la llamaba ni sus permisos;
//   - aceptaba el rol tal como venía del cuerpo;
//   - ignoraba los errores de los upsert (podía responder ok con un alta
//     incompleta);
//   - intentaba crear sola un docente con DNI vacío (upsert por id_usuario;
//     interfería con la vinculación de un legajo existente, etapa23).
// Compatibilidad: mismo cuerpo y mismos CORS; el correo se guarda tal como
// llega (la web publicada lo busca así después del alta) y la respuesta
// suma id_usuario. La web publicada sigue funcionando con esta versión.
//
// Ahora:
//   1. Toma el token del encabezado Authorization y lo verifica con
//      auth.getUser(token). Lee el perfil REAL del operador en `usuarios`:
//      tiene que ser Admin o Directivo y estar activo. El rol del operador
//      nunca se toma del cuerpo.
//   2. Valida los datos y el rol de la cuenta nueva. Admin crea cualquier
//      rol; Directivo crea Docente, Padre o Alumno (no Admin ni Directivo:
//      misma jerarquía que ya usa la gestión de usuarios).
//   3. Si el correo ya tiene perfil, responde USR_CORREO_EXISTE y NO toca
//      esa cuenta (ni datos ni contraseña): el frontend decide si la vincula.
//   4. Crea la cuenta en Auth y guarda su perfil (nombre, apellido, rol)
//      comprobando cada escritura. El docente se crea SOLO si se mandan sus
//      datos (`docente`); vincular un legajo existente no crea otro.
//   5. Si falla un paso, deshace solo lo que creó esta misma solicitud
//      (perfil y cuenta nuevos) y responde el error: nunca ok con un alta
//      incompleta. Un reintento empieza de cero o encuentra el correo.
//
// Cuerpo (POST, JSON):
//   { email, password, nombre, apellido, rol, telefono?,
//     docente?: { dni, especialidad, titulo? } }   (docente solo con rol Docente)
// Respuesta: { ok: true, id_usuario } o { ok: false, codigo, detalle? }.
// Códigos: USR_SIN_SESION (401), USR_SIN_PERMISO (403), USR_ROL_NO_PERMITIDO
// (403), USR_DATOS_INVALIDOS (400), USR_CORREO_EXISTE (409),
// USR_DNI_DOCENTE_EXISTE (409), USR_ALTA_FALLIDA / USR_PERFIL_FALLIDO /
// USR_DOCENTE_FALLIDO (500, con `revertido`). Nunca devuelve contraseñas.
//
// Despliegue manual (Verify JWT activo): ver supabase/functions/README.md.
// Secrets: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (los da Supabase).
// RLS sigue fuera de alcance (CLAUDE.md 3.1).

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

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

class ErrorAlta extends Error {
  constructor(
    readonly codigo: string,
    readonly status: number,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(codigo)
  }
}

const ROLES = ['Admin', 'Directivo', 'Docente', 'Padre', 'Alumno'] as const
type Rol = (typeof ROLES)[number]
const GESTION: readonly string[] = ['Admin', 'Directivo']
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/

/** Roles que puede crear cada operador (Directivo: no crea cuentas de gestión). */
function puedeCrear(operador: string, rol: Rol): boolean {
  if (operador === 'Admin') return true
  if (operador === 'Directivo') return !GESTION.includes(rol)
  return false
}

interface Alta {
  email: string
  password: string
  nombre: string
  apellido: string
  rol: Rol
  telefono: string | null
  docente: { dni: string; especialidad: string; titulo: string | null } | null
}

function texto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 && t.length <= max ? t : null
}

/** Valida el cuerpo; devuelve el alta o lanza USR_DATOS_INVALIDOS con el campo. */
function validar(c: Record<string, unknown>): Alta {
  const invalido = (campo: string) => new ErrorAlta('USR_DATOS_INVALIDOS', 400, { campo })
  // Se conserva como llega (la versión anterior lo guardaba así y la web
  // publicada lo busca por igualdad); Auth lo compara sin mayúsculas.
  const email = texto(c.email, 254)
  if (!email || !EMAIL.test(email)) throw invalido('email')
  // 6 como el formulario de Usuarios (las altas de alumno usan su DNI);
  // 72 es el límite de Supabase Auth. No cambia ninguna regla global.
  if (typeof c.password !== 'string' || c.password.length < 6 || c.password.length > 72) throw invalido('password')
  const nombre = texto(c.nombre, 100)
  if (!nombre) throw invalido('nombre')
  const apellido = texto(c.apellido, 100)
  if (!apellido) throw invalido('apellido')
  const rol = ROLES.find((r) => r === c.rol)
  if (!rol) throw invalido('rol')
  const telefono = c.telefono == null || c.telefono === '' ? null : texto(c.telefono, 30)
  if (c.telefono != null && c.telefono !== '' && !telefono) throw invalido('telefono')
  let docente: Alta['docente'] = null
  if (c.docente != null) {
    if (rol !== 'Docente' || typeof c.docente !== 'object') throw invalido('docente')
    const d = c.docente as Record<string, unknown>
    const dni = texto(d.dni, 20)
    const especialidad = texto(d.especialidad, 100)
    if (!dni || !/^\d{7,9}$/.test(dni)) throw invalido('docente.dni')
    if (!especialidad) throw invalido('docente.especialidad')
    const titulo = d.titulo == null || d.titulo === '' ? null : texto(d.titulo, 150)
    docente = { dni, especialidad, titulo }
  }
  return { email, password: c.password, nombre, apellido, rol, telefono, docente }
}

/** Operador: sesión válida y perfil real Admin o Directivo activo. */
async function operador(db: SupabaseClient, req: Request): Promise<string> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) throw new ErrorAlta('USR_SIN_SESION', 401)
  const { data: sesion, error } = await db.auth.getUser(token)
  if (error || !sesion?.user) throw new ErrorAlta('USR_SIN_SESION', 401)
  const { data: perfil, error: errPerfil } = await db
    .from('usuarios')
    .select('rol, activo')
    .eq('id_usuario', sesion.user.id)
    .maybeSingle()
  if (errPerfil) throw new ErrorAlta('USR_ALTA_FALLIDA', 500, { paso: 'perfil_operador' })
  if (!perfil || !GESTION.includes(perfil.rol) || perfil.activo === false)
    throw new ErrorAlta('USR_SIN_PERMISO', 403)
  return perfil.rol as string
}

/** Deshace lo que creó ESTA solicitud (perfil y cuenta nuevos). */
async function revertir(db: SupabaseClient, idNuevo: string): Promise<boolean> {
  const { error: errPerfil } = await db.from('usuarios').delete().eq('id_usuario', idNuevo)
  const { error: errCuenta } = await db.auth.admin.deleteUser(idNuevo)
  if (errPerfil || errCuenta)
    console.error('[crear-usuario] no se pudo revertir el alta:', { perfil: errPerfil?.code, cuenta: errCuenta?.status })
  return !errCuenta
}

async function crear(db: SupabaseClient, alta: Alta): Promise<string> {
  // Correo con perfil existente: no se modifica esa cuenta
  const variantes = [...new Set([alta.email, alta.email.toLowerCase()])]
  const { data: previo, error: errPrevio } = await db
    .from('usuarios')
    .select('id_usuario')
    .in('email', variantes)
    .limit(1)
  if (errPrevio) throw new ErrorAlta('USR_ALTA_FALLIDA', 500, { paso: 'buscar_correo' })
  if (previo && previo.length > 0) throw new ErrorAlta('USR_CORREO_EXISTE', 409)

  if (alta.docente) {
    const { data: dniPrevio, error: errDni } = await db
      .from('docentes').select('id_docente').eq('dni', alta.docente.dni).limit(1)
    if (errDni) throw new ErrorAlta('USR_ALTA_FALLIDA', 500, { paso: 'buscar_dni' })
    if (dniPrevio && dniPrevio.length > 0) throw new ErrorAlta('USR_DNI_DOCENTE_EXISTE', 409)
  }

  const { data: creado, error: errAuth } = await db.auth.admin.createUser({
    email: alta.email,
    password: alta.password,
    email_confirm: true,
  })
  if (errAuth || !creado?.user) {
    // Ya existe en Auth (con o sin perfil): no se toca esa cuenta
    if (errAuth?.code === 'email_exists' || /already.*registered/i.test(errAuth?.message ?? ''))
      throw new ErrorAlta('USR_CORREO_EXISTE', 409)
    if (errAuth?.code === 'weak_password') throw new ErrorAlta('USR_DATOS_INVALIDOS', 400, { campo: 'password' })
    throw new ErrorAlta('USR_ALTA_FALLIDA', 500, { paso: 'auth' })
  }
  const idNuevo = creado.user.id

  // Perfil de la cuenta recién creada, siempre por su id (nunca por correo).
  // Si un trigger de Auth ya creó la fila con valores por defecto, se
  // actualiza; si no, se inserta. Después se relee para confirmar que
  // quedó el rol pedido: recién ahí el alta cuenta como completa.
  const datosPerfil = {
    email: alta.email,
    nombre: alta.nombre,
    apellido: alta.apellido,
    rol: alta.rol,
    ...(alta.telefono ? { telefono: alta.telefono } : {}),
  }
  const { data: filaPrevia, error: errLeer } = await db
    .from('usuarios').select('id_usuario').eq('id_usuario', idNuevo).maybeSingle()
  const { error: errPerfil } = errLeer
    ? { error: errLeer }
    : filaPrevia
      ? await db.from('usuarios').update(datosPerfil).eq('id_usuario', idNuevo)
      : await db.from('usuarios').insert({ id_usuario: idNuevo, activo: true, ...datosPerfil })
  const { data: perfilFinal, error: errReleer } = errPerfil
    ? { data: null, error: errPerfil }
    : await db.from('usuarios').select('rol, nombre').eq('id_usuario', idNuevo).maybeSingle()
  if (errPerfil || errReleer || perfilFinal?.rol !== alta.rol || perfilFinal?.nombre !== alta.nombre) {
    const revertido = await revertir(db, idNuevo)
    throw new ErrorAlta('USR_PERFIL_FALLIDO', 500, { revertido })
  }

  if (alta.docente) {
    const { error: errDoc } = await db.from('docentes').insert({
      id_usuario: idNuevo,
      dni: alta.docente.dni,
      especialidad: alta.docente.especialidad,
      titulo: alta.docente.titulo,
      activo: true,
    })
    if (errDoc) {
      const revertido = await revertir(db, idNuevo)
      if (errDoc.code === '23505') throw new ErrorAlta('USR_DNI_DOCENTE_EXISTE', 409, { revertido })
      throw new ErrorAlta('USR_DOCENTE_FALLIDO', 500, { revertido })
    }
  }
  return idNuevo
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return responder({ ok: false, codigo: 'USR_DATOS_INVALIDOS' }, 405)
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const rolOperador = await operador(db, req)
    const cuerpo = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!cuerpo || typeof cuerpo !== 'object') throw new ErrorAlta('USR_DATOS_INVALIDOS', 400)
    const alta = validar(cuerpo)
    if (!puedeCrear(rolOperador, alta.rol)) throw new ErrorAlta('USR_ROL_NO_PERMITIDO', 403)
    const idUsuario = await crear(db, alta)
    return responder({ ok: true, id_usuario: idUsuario })
  } catch (error) {
    if (error instanceof ErrorAlta) return responder({ ok: false, codigo: error.codigo, ...error.extra }, error.status)
    console.error('[crear-usuario] error inesperado:', { nombre: error instanceof Error ? error.name : typeof error })
    return responder({ ok: false, codigo: 'USR_ALTA_FALLIDA' }, 500)
  }
})

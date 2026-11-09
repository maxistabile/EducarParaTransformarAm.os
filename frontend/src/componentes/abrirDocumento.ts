// ═══════════════════════════════════════════════════════════════
//  APERTURA DE DOCUMENTOS PRIVADOS (HU54 a HU56) — lógica pura
// ═══════════════════════════════════════════════════════════════
// El archivo de la transferencia y el comprobante de pago se abren con una
// URL firmada de Storage (60 s) que entrega la Edge Function "pagos".
// Antes de navegar se valida que sea exactamente eso: HTTPS, el mismo
// origen del Supabase configurado, la ruta de objetos firmados del bucket
// "pagos" y un token. Cualquier otra cosa (javascript:, data:, otro
// origen, credenciales incrustadas) se rechaza. La URL válida no se
// modifica: conserva su token y sus parámetros.
import { resumenError } from '../app/reglasContrasena'

/** Ruta de Storage para objetos firmados del bucket "pagos". */
export const RUTA_FIRMADA_PAGOS = '/storage/v1/object/sign/pagos/'

export const MENSAJE_DOCUMENTO = 'No pudimos abrir el documento. Intentá de nuevo.'

/** La URL firmada, ya validada; null si no es una URL de documento válida. */
export function validarUrlDocumento(texto: string, urlSupabase: string): URL | null {
  let url: URL
  let base: URL
  try {
    url = new URL(texto)
    base = new URL(urlSupabase)
  } catch {
    return null // URL malformada (o Supabase sin configurar)
  }
  if (url.protocol !== 'https:' || base.protocol !== 'https:') return null
  if (url.origin !== base.origin) return null
  if (url.username !== '' || url.password !== '') return null
  // El parser ya resolvió "..": la ruta tiene que seguir dentro del bucket
  if (!url.pathname.startsWith(RUTA_FIRMADA_PAGOS) || url.pathname === RUTA_FIRMADA_PAGOS)
    return null
  if (!url.searchParams.get('token')) return null
  return url
}

/** Lo que usa abrirDocumento de la pestaña nueva (permite probarlo). */
export interface PestanaDocumento {
  opener: unknown
  location: { replace: (url: string) => void }
  close: () => void
}

export type ObtenerDocumento = () => Promise<{ ok: true; url: string } | { ok: false; mensaje: string }>

/**
 * Pide la URL firmada y navega a ella.
 * - `pestana`: la pestaña vacía que el botón abrió al hacer clic (antes de
 *   esperar, para que el navegador no la bloquee); null si la bloqueó.
 *   Se corta su relación con esta ventana (`opener = null`).
 * - Sin pestaña, navega en la misma ventana (`navegarAqui`).
 * Devuelve null si abrió el documento, o el mensaje de error; ante un
 * error cierra la pestaña vacía.
 */
export async function abrirDocumento(
  obtener: ObtenerDocumento,
  entorno: {
    pestana: PestanaDocumento | null
    navegarAqui: (url: string) => void
    urlSupabase: string
  },
): Promise<string | null> {
  const { pestana } = entorno
  if (pestana) pestana.opener = null

  let respuesta: Awaited<ReturnType<ObtenerDocumento>>
  try {
    respuesta = await obtener()
  } catch (causa) {
    console.error('[abrirDocumento] obtener rechazó:', resumenError(causa))
    pestana?.close()
    return MENSAJE_DOCUMENTO
  }
  if (!respuesta.ok) {
    pestana?.close()
    return respuesta.mensaje
  }

  const url = validarUrlDocumento(respuesta.url, entorno.urlSupabase)
  if (!url) {
    // No se registra la URL: puede traer un token
    console.error('[abrirDocumento] URL de documento rechazada')
    pestana?.close()
    return MENSAJE_DOCUMENTO
  }
  if (pestana) pestana.location.replace(url.href)
  else entorno.navegarAqui(url.href)
  return null
}

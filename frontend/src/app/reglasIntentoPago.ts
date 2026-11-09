// ═══════════════════════════════════════════════════════════════
//  INTENTO DE PAGO (HU54) — lógica pura
// ═══════════════════════════════════════════════════════════════
// Cada envío de comprobante tiene una clave (uuid). Si la respuesta se
// pierde, hay un error de red o se recarga la pantalla, el reintento usa
// la MISMA clave: el servidor devuelve el mismo comprobante y no
// duplica. La clave queda guardada por cuenta y por factura.
// Se usa otra clave solo si cambia la solicitud (ítems o archivo) o si
// el comprobante anterior quedó Rechazado: nunca automáticamente al
// reintentar.

export const PREFIJO_INTENTO = 'app.intentoPago.'

export interface ArchivoIntento {
  sha256: string
  nombre: string
  tipo: string
  tamanio: number
}

export interface IntentoPago {
  clave: string
  idFactura: number
  items: number[]
  archivo: ArchivoIntento
}

/** La clave incluye el usuario y la factura. */
export function claveIntento(idUsuario: string, idFactura: number): string {
  return `${PREFIJO_INTENTO}${idUsuario}.${idFactura}`
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Texto guardado → intento, o null si no tiene la forma esperada. */
export function leerIntento(texto: string | null, idFactura: number): IntentoPago | null {
  if (!texto) return null
  try {
    const x = JSON.parse(texto) as Partial<IntentoPago>
    const a = x.archivo
    if (
      typeof x.clave !== 'string' || !UUID.test(x.clave) ||
      x.idFactura !== idFactura ||
      !Array.isArray(x.items) || !x.items.every((i) => Number.isInteger(i) && i > 0) ||
      !a || typeof a.sha256 !== 'string' || typeof a.nombre !== 'string' ||
      typeof a.tipo !== 'string' || typeof a.tamanio !== 'number'
    )
      return null
    return { clave: x.clave, idFactura, items: [...x.items], archivo: { ...a } }
  } catch {
    return null
  }
}

const ordenados = (items: readonly number[]) => [...items].sort((a, b) => a - b)

/** Misma solicitud: los mismos ítems y el mismo contenido de archivo. */
export function mismaSolicitud(
  intento: IntentoPago,
  items: readonly number[],
  archivo: ArchivoIntento,
): boolean {
  const a = ordenados(intento.items)
  const b = ordenados(items)
  return (
    a.length === b.length &&
    a.every((x, i) => x === b[i]) &&
    intento.archivo.sha256 === archivo.sha256 &&
    intento.archivo.tamanio === archivo.tamanio
  )
}

/**
 * Clave para un envío: la del intento guardado si es la misma solicitud;
 * si no hay intento o cambió la solicitud, una nueva.
 */
export function resolverIntento(
  guardado: IntentoPago | null,
  idFactura: number,
  items: readonly number[],
  archivo: ArchivoIntento,
  nuevaClave: () => string,
): { intento: IntentoPago; reutilizado: boolean } {
  if (guardado && guardado.idFactura === idFactura && mismaSolicitud(guardado, items, archivo))
    return { intento: guardado, reutilizado: true }
  return {
    intento: { clave: nuevaClave(), idFactura, items: ordenados(items), archivo },
    reutilizado: false,
  }
}

/**
 * Qué hacer con un intento guardado según lo que informa el servidor de
 * su clave: si ya se registró, se terminó (y si quedó Rechazado, el
 * próximo envío es nuevo); si no existe, se conserva para reintentar.
 */
export function decidirIntento(estado: { existe: boolean; estado_pago?: string }):
  | 'conservar'
  | 'enviado'
  | 'rechazado' {
  if (!estado.existe) return 'conservar'
  return estado.estado_pago === 'Rechazado' ? 'rechazado' : 'enviado'
}

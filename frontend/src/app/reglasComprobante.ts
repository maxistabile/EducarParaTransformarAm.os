// ═══════════════════════════════════════════════════════════════
//  COMPROBANTE DE TRANSFERENCIA (HU54 a HU56) — lógica pura
// ═══════════════════════════════════════════════════════════════
// Validación del archivo en el navegador (RNF8: errores claros) y textos
// de los códigos que devuelven la Edge Function "pagos" y la base
// (etapa18). El servidor vuelve a validar todo: el tipo real del archivo,
// el tamaño, los ítems, la pertenencia y el importe.

/** Tipos aceptados: JPG, PNG o PDF. */
export const TIPOS_COMPROBANTE: readonly string[] = ['image/jpeg', 'image/png', 'application/pdf']
export const MAX_BYTES_COMPROBANTE = 5 * 1024 * 1024
const EXTENSIONES = ['jpg', 'jpeg', 'png', 'pdf']

export interface DatosArchivo {
  name: string
  type: string
  size: number
}

/** null si el archivo se puede enviar; si no, el motivo. */
export function validarArchivo(archivo: DatosArchivo | null): string | null {
  if (!archivo) return 'Elegí el comprobante de la transferencia.'
  const extension = archivo.name.split('.').pop()?.toLowerCase() ?? ''
  if (!TIPOS_COMPROBANTE.includes(archivo.type) || !EXTENSIONES.includes(extension))
    return 'El comprobante tiene que ser una imagen JPG o PNG, o un PDF.'
  if (archivo.size === 0) return 'El archivo está vacío.'
  if (archivo.size > MAX_BYTES_COMPROBANTE)
    return `El archivo pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB: el máximo es 5 MB.`
  return null
}

const MENSAJES: Record<string, string> = {
  PAG_SIN_SESION: 'Tu sesión venció. Volvé a iniciar sesión.',
  PAG_SIN_PERMISO: 'No tenés permiso para esta operación.',
  PAG_FACTURA_AJENA: 'Esa factura no corresponde a un hijo asociado a tu cuenta.',
  PAG_ITEM_AJENO: 'Elegiste un concepto que no es de esta factura.',
  PAG_ITEMS_REPETIDOS: 'Elegiste un concepto más de una vez.',
  PAG_SIN_ITEMS: 'Elegí al menos un concepto para pagar.',
  PAG_ITEM_NO_DISPONIBLE:
    'Uno de los conceptos ya está pagado o tiene un comprobante en revisión. Actualizá la pantalla.',
  PAG_CLAVE_REUSADA:
    'Este envío no coincide con uno anterior. Volvé a elegir los conceptos y el archivo.',
  PAG_SOLICITUD_INVALIDA: 'La solicitud no es válida. Actualizá la pantalla e intentá de nuevo.',
  PAG_ARCHIVO_VACIO: 'El archivo está vacío.',
  PAG_ARCHIVO_GRANDE: 'El archivo supera los 5 MB.',
  PAG_ARCHIVO_TIPO: 'El archivo no es un JPG, PNG o PDF válido.',
  PAG_SUBIDA: 'No pudimos guardar el archivo. Intentá de nuevo: no se va a duplicar.',
  PAG_NO_EXISTE: 'El comprobante no existe.',
  PAG_YA_REVISADO: 'El comprobante ya fue revisado por otra persona. Actualizá la lista.',
  PAG_MOTIVO: 'Para rechazar, escribí un motivo de al menos 5 caracteres.',
  PAG_ITEM_YA_PAGADO:
    'Uno de los conceptos ya figura pagado. Rechazá el comprobante indicando el motivo.',
  PAG_SIN_RECIBO: 'El comprobante de pago se emite solo para pagos aprobados.',
  PAG_RECIBO_PENDIENTE:
    'No pudimos generar el comprobante de pago. Intentá de nuevo en unos minutos.',
  PAG_ARCHIVO_NO_DISPONIBLE: 'No pudimos abrir el archivo. Intentá de nuevo.',
  PAG_RED: 'No pudimos comunicarnos con el servidor. Revisá tu conexión e intentá de nuevo.',
  PAG_ERROR: 'Ocurrió un error inesperado. Intentá de nuevo.',
}

/** Texto para un código de la Edge Function o de la base. */
export function mensajePago(codigo: string, detalle = ''): string {
  if (codigo === 'PAG_ITEM_NO_DISPONIBLE' && detalle && detalle !== 'otro comprobante')
    return `"${detalle}" ya está pagado o tiene un comprobante en revisión. Actualizá la pantalla.`
  if (codigo === 'PAG_ITEM_YA_PAGADO' && detalle)
    return `"${detalle}" ya figura pagado. Rechazá el comprobante indicando el motivo.`
  return MENSAJES[codigo] ?? MENSAJES.PAG_ERROR
}

/**
 * Errores en los que el envío pudo haber llegado o no (respuesta perdida,
 * red, servidor): se reintenta con la MISMA clave, sin duplicar.
 */
export function esReintentable(codigo: string): boolean {
  return ['PAG_RED', 'PAG_ERROR', 'PAG_SUBIDA'].includes(codigo)
}

/** Motivo de rechazo válido (la base exige 5 caracteres o más). */
export function motivoValido(motivo: string): boolean {
  return motivo.trim().length >= 5
}

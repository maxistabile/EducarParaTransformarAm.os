// Intento de pago guardado en sessionStorage, por cuenta y por factura
// (HU54). Siempre dentro de try/catch: sin almacenamiento, el reintento
// funciona mientras la pantalla siga abierta.
import { PREFIJO_INTENTO, claveIntento, leerIntento } from '../reglasIntentoPago'
import type { IntentoPago } from '../reglasIntentoPago'

export function leerIntentoGuardado(idUsuario: string, idFactura: number): IntentoPago | null {
  try {
    return leerIntento(sessionStorage.getItem(claveIntento(idUsuario, idFactura)), idFactura)
  } catch {
    return null
  }
}

export function guardarIntento(idUsuario: string, intento: IntentoPago): void {
  try {
    sessionStorage.setItem(claveIntento(idUsuario, intento.idFactura), JSON.stringify(intento))
  } catch {
    // Sin almacenamiento: el intento vive en la pantalla
  }
}

export function borrarIntento(idUsuario: string, idFactura: number): void {
  try {
    sessionStorage.removeItem(claveIntento(idUsuario, idFactura))
  } catch {
    // Nada guardado
  }
}

/** Al cerrar sesión o cambiar de cuenta se borran todos los intentos. */
export function borrarIntentos(): void {
  try {
    const claves: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const clave = sessionStorage.key(i)
      if (clave?.startsWith(PREFIJO_INTENTO)) claves.push(clave)
    }
    claves.forEach((clave) => {
      sessionStorage.removeItem(clave)
    })
  } catch {
    // Sin almacenamiento no hay nada guardado
  }
}

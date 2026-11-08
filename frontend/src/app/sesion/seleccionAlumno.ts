// Selección de alumno guardada en sessionStorage (solo una comodidad: si
// el almacenamiento no está disponible, la app sigue funcionando y
// muestra el primer alumno de la lista).
import { PREFIJO_SELECCION, claveSeleccion, leerIdGuardado } from '../reglasAlumnoElegido'

export function leerSeleccion(idUsuario: string): number | null {
  try {
    return leerIdGuardado(sessionStorage.getItem(claveSeleccion(idUsuario)))
  } catch {
    return null
  }
}

export function guardarSeleccion(idUsuario: string, idAlumno: number): void {
  try {
    sessionStorage.setItem(claveSeleccion(idUsuario), String(idAlumno))
  } catch {
    // Sin almacenamiento: la elección dura mientras la pantalla esté abierta
  }
}

/** Al cerrar sesión o cambiar de cuenta se borran todas las selecciones. */
export function borrarSelecciones(): void {
  try {
    const claves: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const clave = sessionStorage.key(i)
      if (clave?.startsWith(PREFIJO_SELECCION)) claves.push(clave)
    }
    claves.forEach((clave) => {
      sessionStorage.removeItem(clave)
    })
  } catch {
    // Sin almacenamiento no hay nada guardado
  }
}

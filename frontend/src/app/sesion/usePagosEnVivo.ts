// Cambios en vivo de los comprobantes de un alumno (HU55, patrón
// Observer): cuando la administración aprueba o rechaza, la pantalla del
// padre vuelve a consultar sin recargar. Se desuscribe al cambiar de
// alumno o de cuenta, o al salir de la pantalla.
import { useEffect, useRef } from 'react'
import { ServicioPagos } from '../../servicios/ServicioPagos'

export function usePagosEnVivo(idAlumno: number | null, alCambiar: () => void): void {
  // La última función, sin volver a suscribirse en cada render
  const aviso = useRef(alCambiar)
  useEffect(() => {
    aviso.current = alCambiar
  }, [alCambiar])

  useEffect(() => {
    if (idAlumno === null) return
    return ServicioPagos.escucharCambios({ idAlumno }, () => {
      aviso.current()
    })
  }, [idAlumno])
}

// Consulta de datos del alumno elegido (HU59, HU51 a HU53).
// Reúne lo que necesitan las pantallas de consulta:
//   - el alumno elegido y la lista de la sesión (useAlumnoElegido);
//   - la consulta al servicio Facade con el rol de la sesión;
//   - descarte de respuestas atrasadas: solo se muestra el resultado de
//     la cuenta y del alumno elegidos ahora (esRespuestaVigente).
import { useCallback, useEffect, useState } from 'react'
import type { RolApp } from '../reglasAuthApp'
import { esRespuestaVigente } from '../reglasAlumnoElegido'
import { useSesionApp } from './contextoSesion'
import { useAlumnoElegido } from './useAlumnoElegido'
import type { AlumnoElegido } from './useAlumnoElegido'

export type Consulta<T> = (
  idAlumno: number,
  permitidos: readonly number[],
  rol: RolApp | null,
) => Promise<T>

export interface ConsultaAlumno<T> {
  seleccion: AlumnoElegido
  /** Resultado vigente; null mientras carga. */
  actual: T | null
  reintentar: () => void
  /** Vuelve a consultar sin borrar lo que se ve (cambios en vivo). */
  recargar: () => void
}

/**
 * `consultar` y `siFalla` tienen que ser estables (definidos fuera del
 * componente): si cambian en cada render, la consulta se repite.
 */
export function useConsultaAlumno<T>(consultar: Consulta<T>, siFalla: T): ConsultaAlumno<T> {
  const seleccion = useAlumnoElegido()
  const { sesion } = useSesionApp()
  const rol = sesion.estado === 'app' ? sesion.rol : null
  const { cuenta, elegido, alumnos } = seleccion
  const idAlumno = elegido?.id_alumno ?? null

  const [datos, setDatos] = useState<{ cuenta: string; idAlumno: number; resultado: T } | null>(
    null,
  )
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    if (!cuenta || idAlumno === null) return
    let vigente = true
    const pedido = { cuenta, idAlumno }
    consultar(
      idAlumno,
      alumnos.map((a) => a.id_alumno),
      rol,
    ).then(
      (resultado) => {
        if (vigente) setDatos({ ...pedido, resultado })
      },
      () => {
        if (vigente) setDatos({ ...pedido, resultado: siFalla })
      },
    )
    return () => {
      vigente = false
    }
  }, [consultar, siFalla, cuenta, idAlumno, alumnos, rol, intento])

  const reintentar = useCallback(() => {
    setDatos(null)
    setIntento((n) => n + 1)
  }, [])

  const recargar = useCallback(() => {
    setIntento((n) => n + 1)
  }, [])

  // Solo se muestran datos de la cuenta y del alumno elegidos ahora
  const actual =
    datos && esRespuestaVigente(datos, { cuenta, idAlumno }) ? datos.resultado : null

  return { seleccion, actual, reintentar, recargar }
}

// Alumno elegido para las pantallas de consulta (HU59; base de HU51 a HU53).
// - La lista sale de ServicioAlumnosApp para la sesión actual.
// - Solo se acepta un alumno de esa lista (también el guardado).
// - Todo queda asociado a la cuenta: al cambiar de cuenta no se muestra
//   la lista ni la elección de la anterior, y una respuesta atrasada se
//   descarta.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ServicioAlumnosApp, MENSAJE_ERROR_ALUMNOS } from '../../servicios/ServicioAlumnosApp'
import type { ResultadoAlumnos } from '../../servicios/ServicioAlumnosApp'
import { resolverElegido } from '../reglasAlumnoElegido'
import type { AlumnoApp } from '../reglasAlumnoElegido'
import { useSesionApp } from './contextoSesion'
import { guardarSeleccion, leerSeleccion } from './seleccionAlumno'

export interface AlumnoElegido {
  /** Cuenta actual ('rol:id_usuario'); null sin sesión de la app. */
  cuenta: string | null
  estado: 'cargando' | 'listo' | 'error'
  mensaje: string
  alumnos: readonly AlumnoApp[]
  elegido: AlumnoApp | null
  elegir: (idAlumno: number) => void
  reintentar: () => void
}

const SIN_ALUMNOS: readonly AlumnoApp[] = []

export function useAlumnoElegido(): AlumnoElegido {
  const { sesion } = useSesionApp()
  const idUsuario = sesion.estado === 'app' ? sesion.perfil.id_usuario : null
  const rol = sesion.estado === 'app' ? sesion.rol : null
  const cuenta = idUsuario && rol ? `${rol}:${idUsuario}` : null

  const [lista, setLista] = useState<{ cuenta: string; resultado: ResultadoAlumnos } | null>(
    null,
  )
  const [manual, setManual] = useState<{ cuenta: string; idAlumno: number } | null>(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    if (!idUsuario || !rol) return
    const miCuenta = `${rol}:${idUsuario}`
    let vigente = true
    ServicioAlumnosApp.misAlumnos(idUsuario, rol).then(
      (resultado) => {
        if (vigente) setLista({ cuenta: miCuenta, resultado })
      },
      () => {
        if (vigente)
          setLista({ cuenta: miCuenta, resultado: { ok: false, mensaje: MENSAJE_ERROR_ALUMNOS } })
      },
    )
    return () => {
      vigente = false
    }
  }, [idUsuario, rol, intento])

  // Solo vale la lista de la cuenta actual
  const actual = lista?.cuenta === cuenta ? lista.resultado : null
  const alumnos = useMemo(() => (actual?.ok ? actual.alumnos : SIN_ALUMNOS), [actual])

  const guardado =
    manual?.cuenta === cuenta ? manual.idAlumno : idUsuario ? leerSeleccion(idUsuario) : null
  const idElegido = resolverElegido(alumnos, guardado)
  const elegido = alumnos.find((a) => a.id_alumno === idElegido) ?? null

  const elegir = useCallback(
    (idAlumno: number) => {
      // Solo un alumno de la lista de esta sesión
      if (!cuenta || !idUsuario || !alumnos.some((a) => a.id_alumno === idAlumno)) return
      guardarSeleccion(idUsuario, idAlumno)
      setManual({ cuenta, idAlumno })
    },
    [alumnos, cuenta, idUsuario],
  )

  const reintentar = useCallback(() => {
    setLista(null)
    setIntento((n) => n + 1)
  }, [])

  return {
    cuenta,
    estado: actual === null ? 'cargando' : actual.ok ? 'listo' : 'error',
    mensaje: actual && !actual.ok ? actual.mensaje : '',
    alumnos,
    elegido,
    elegir,
    reintentar,
  }
}

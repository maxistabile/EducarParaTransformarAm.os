// Protección de las rutas de la app (HU42 y HU45).
import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { puedeVerSeccion } from '../reglasAuthApp'
import type { Seccion } from '../reglasAuthApp'
import { useSesionApp } from './contextoSesion'
import {
  PantallaCarga,
  PantallaErrorSesion,
  RedirigirALaWeb,
} from './PantallasEstado'

/**
 * Las pantallas privadas se muestran solo con una sesión validada de padre
 * o alumno. Sin sesión (también al volver con "Atrás" después de cerrar
 * sesión) se va al ingreso, reemplazando la entrada del historial.
 */
export function RutaProtegida() {
  const { sesion } = useSesionApp()
  switch (sesion.estado) {
    case 'cargando':
      return <PantallaCarga />
    case 'sin-sesion':
      return <Navigate to='/app/ingresar' replace />
    case 'web':
      return <RedirigirALaWeb />
    case 'error':
      return <PantallaErrorSesion mensaje={sesion.mensaje} />
    case 'app':
      return <Outlet />
  }
}

/** Una sección que el rol no tiene (por ejemplo, Pagos para un alumno) vuelve al inicio. */
export function RutaSeccion({
  seccion,
  children,
}: {
  seccion: Seccion
  children: ReactNode
}) {
  const { sesion } = useSesionApp()
  if (sesion.estado !== 'app' || !puedeVerSeccion(sesion.rol, seccion))
    return <Navigate to='/app/' replace />
  return children
}

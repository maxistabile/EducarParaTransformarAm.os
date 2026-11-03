// Contexto con el estado de la sesión de la app (lo llena ProveedorSesion).
import { createContext, useContext } from 'react'
import type { EstadoSesion } from '../reglasAuthApp'

export interface ValorSesion {
  sesion: EstadoSesion
  /** Vuelve a validar perfil, rol y estado activo (botón "Reintentar"). */
  revalidar: () => void
  /** HU42: cierra la sesión en este dispositivo. */
  salir: () => Promise<void>
}

export const ContextoSesion = createContext<ValorSesion | null>(null)

export function useSesionApp(): ValorSesion {
  const valor = useContext(ContextoSesion)
  if (!valor) throw new Error('useSesionApp se usa dentro de ProveedorSesion')
  return valor
}

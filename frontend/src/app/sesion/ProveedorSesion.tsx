// Mantiene el estado de la sesión de la app (HU41, HU42 y HU45).
// Cada vez que la sesión se restaura (al abrir la app) o se inicia, se
// vuelven a validar el perfil, el rol y el estado activo: no alcanza con
// que haya una sesión guardada en el dispositivo.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ServicioAuth } from '../../servicios/ServicioAuth'
import { MENSAJES_ACCESO } from '../reglasAuthApp'
import type { EstadoSesion, Resultado } from '../reglasAuthApp'
import { ContextoSesion } from './contextoSesion'

export default function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<EstadoSesion>({ estado: 'cargando' })
  // Cada validación tiene un turno; si llega una respuesta vieja (por
  // ejemplo, después de cerrar sesión), no puede volver a habilitar la app.
  const turno = useRef(0)

  const validar = useCallback((mostrarCarga: boolean) => {
    const miTurno = ++turno.current
    if (mostrarCarga) setSesion({ estado: 'cargando' })
    ServicioAuth.validarSesion().then(
      (nuevo) => {
        // 'sin-sesion' nunca habilita nada: se aplica aunque sea vieja,
        // para no perder el aviso de usuario inactivo o sin perfil.
        if (miTurno === turno.current || nuevo.estado === 'sin-sesion')
          setSesion(nuevo)
      },
      () => {
        // validarSesion no debería rechazar; si pasa algo inesperado, no
        // se habilita nada y se ofrece reintentar.
        if (miTurno === turno.current)
          setSesion({ estado: 'error', mensaje: MENSAJES_ACCESO.errorValidacion })
      },
    )
  }, [])

  useEffect(
    () =>
      ServicioAuth.escucharCambios((cambio) => {
        // Diferido: Supabase pide no llamar a sus métodos dentro del aviso
        setTimeout(() => {
          if (cambio === 'entro') {
            validar(false)
            return
          }
          // 'salio' y 'recuperacion' quitan de la interfaz al usuario anterior.
          // Solo cambia este estado: no se llama a signOut, porque durante la
          // recuperación la sesión hace falta para guardar la contraseña.
          turno.current++
          setSesion((prev) =>
            prev.estado === 'sin-sesion' ? prev : { estado: 'sin-sesion', aviso: null },
          )
        }, 0)
      }),
    [validar],
  )

  // Si el cierre falla (por ejemplo, sin conexión) la sesión puede seguir
  // guardada: se vuelve a validar y el mensaje se devuelve a la pantalla.
  const salir = useCallback(async (): Promise<Resultado> => {
    turno.current++
    const resultado = await ServicioAuth.cerrarSesion()
    if (resultado.ok) setSesion({ estado: 'sin-sesion', aviso: null })
    else validar(false)
    return resultado
  }, [validar])

  const valor = useMemo(
    () => ({
      sesion,
      revalidar: () => {
        validar(true)
      },
      salir,
    }),
    [sesion, validar, salir],
  )

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>
}

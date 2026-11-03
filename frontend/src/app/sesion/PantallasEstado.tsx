// Pantallas de espera, error y redirección mientras se valida la sesión.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { irALaWeb } from '../navegacion'
import { MENSAJES_ACCESO } from '../reglasAuthApp'
import { useSesionApp } from './contextoSesion'

function Centrado({ children }: { children: ReactNode }) {
  return (
    <div className='min-h-dvh min-w-[360px] bg-appFondo font-sans text-text flex items-center justify-center px-6'>
      <div className='w-full max-w-sm text-center'>{children}</div>
    </div>
  )
}

export function PantallaCarga() {
  return (
    <Centrado>
      <p role='status' className='font-extrabold text-purple-700'>
        Cargando...
      </p>
    </Centrado>
  )
}

/** La validación falló (por ejemplo, sin conexión): no se muestra nada privado. */
export function PantallaErrorSesion({ mensaje }: { mensaje: string }) {
  const { revalidar, salir } = useSesionApp()
  const [errorCierre, setErrorCierre] = useState('')

  const cerrarSesion = () => {
    setErrorCierre('')
    salir().then(
      (resultado) => {
        if (!resultado.ok) setErrorCierre(resultado.mensaje)
      },
      () => {
        setErrorCierre(MENSAJES_ACCESO.errorCierre)
      },
    )
  }

  return (
    <Centrado>
      <p role='alert' className='font-bold text-red'>
        {mensaje}
      </p>
      {errorCierre && (
        <p role='alert' className='mt-3 text-sm font-bold text-red'>
          {errorCierre}
        </p>
      )}
      <div className='mt-5 flex flex-col gap-2'>
        <button
          type='button'
          onClick={revalidar}
          className='rounded-btn bg-purple-700 py-3 font-bold text-white'
        >
          Reintentar
        </button>
        <button
          type='button'
          onClick={cerrarSesion}
          className='py-2 text-sm font-semibold text-textMuted underline'
        >
          Cerrar sesión
        </button>
      </div>
    </Centrado>
  )
}

/** HU45: los roles de gestión usan la web (navegación completa). */
export function RedirigirALaWeb() {
  useEffect(() => {
    irALaWeb('/admin')
  }, [])
  return (
    <Centrado>
      <p role='status' className='font-bold text-purple-700'>
        Tu usuario es de gestión. Te llevamos a la web...
      </p>
    </Centrado>
  )
}

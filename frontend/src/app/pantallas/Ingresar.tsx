// HU41 · Iniciar sesión en la app con las cuentas existentes de la web.
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ServicioAuth } from '../../servicios/ServicioAuth'
import { irALaWeb } from '../navegacion'
import { MENSAJES_ACCESO } from '../reglasAuthApp'
import type { EstadoSesion } from '../reglasAuthApp'
import { useSesionApp } from '../sesion/contextoSesion'
import {
  PantallaCarga,
  PantallaErrorSesion,
  RedirigirALaWeb,
} from '../sesion/PantallasEstado'

const INPUT =
  'w-full rounded-input border bg-white px-3 py-3 text-[15px] outline-none focus:border-purple-700'

export default function Ingresar() {
  const { sesion } = useSesionApp()
  // Mensaje de NuevaContrasena al terminar la recuperación (HU43)
  const exito = (useLocation().state as { exito?: string } | null)?.exito
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  // Sesión que había al enviar el formulario: mientras no cambie, se sigue
  // esperando. Cuando ProveedorSesion termina de validar (aceptada o
  // rechazada) el estado cambia y se libera el botón.
  const [sesionAlEnviar, setSesionAlEnviar] = useState<EstadoSesion | null>(null)
  const enviando = sesionAlEnviar === sesion

  if (sesion.estado === 'cargando') return <PantallaCarga />
  if (sesion.estado === 'app') return <Navigate to='/app/' replace />
  if (sesion.estado === 'web') return <RedirigirALaWeb />
  if (sesion.estado === 'error')
    return <PantallaErrorSesion mensaje={sesion.mensaje} />

  const ingresar = (e: FormEvent) => {
    e.preventDefault()
    setSesionAlEnviar(sesion)
    setError('')
    const mostrarError = (mensaje: string) => {
      setError(mensaje)
      setSesionAlEnviar(null)
    }
    ServicioAuth.iniciarSesion(email, password).then(
      (resultado) => {
        // Si las credenciales son correctas, ProveedorSesion valida el
        // perfil y esta pantalla redirige según el rol.
        if (!resultado.ok) mostrarError(resultado.mensaje)
      },
      () => {
        // iniciarSesion no debería rechazar; por las dudas, se avisa
        mostrarError(MENSAJES_ACCESO.sinConexion)
      },
    )
  }

  const mensaje = error || sesion.aviso

  return (
    <div className='min-h-dvh min-w-[360px] bg-appFondo font-sans text-text px-5 py-10'>
      <div className='mx-auto max-w-sm'>
        <div className='flex flex-col items-center text-center'>
          <img src='/logo.png' alt='' className='h-20 w-20' />
          <h1 className='mt-3 text-2xl font-extrabold text-purple-700'>
            Educar para Transformar
          </h1>
          <p className='text-sm text-textMuted'>
            Ingresá con tu cuenta de tutor o de alumno
          </p>
        </div>

        <form
          onSubmit={ingresar}
          className='mt-8 flex flex-col gap-4 rounded-card bg-white p-5 shadow-card'
        >
          <label className='flex flex-col gap-1 text-sm font-bold'>
            Correo electrónico
            <input
              type='email'
              required
              autoComplete='email'
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
              }}
              className={INPUT}
            />
          </label>
          <label className='flex flex-col gap-1 text-sm font-bold'>
            Contraseña
            <input
              type='password'
              required
              autoComplete='current-password'
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
              }}
              className={INPUT}
            />
          </label>

          {mensaje && (
            <p role='alert' className='text-sm font-bold text-red'>
              {mensaje}
            </p>
          )}
          {!mensaje && exito && (
            <p role='status' className='text-sm font-bold text-green'>
              {exito}
            </p>
          )}

          <button
            type='submit'
            disabled={enviando}
            className='rounded-btn bg-purple-700 py-3 font-bold text-white disabled:opacity-60'
          >
            {enviando ? 'Ingresando...' : 'Ingresar'}
          </button>
          <Link
            to='/app/recuperar'
            className='text-center text-sm font-semibold text-purple-700 underline'
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </form>

        <p className='mt-6 text-center'>
          <a
            href='/'
            onClick={(e) => {
              e.preventDefault()
              irALaWeb('/')
            }}
            className='text-sm font-semibold text-textMuted underline'
          >
            Ir al sitio
          </a>
        </p>
      </div>
    </div>
  )
}

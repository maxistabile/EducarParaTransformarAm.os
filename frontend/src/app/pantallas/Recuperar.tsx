// HU43 · "Olvidé mi contraseña": pide el enlace de recuperación por correo.
// El mensaje de éxito es el mismo exista o no la cuenta. La espera también:
// así el límite de Supabase por cuenta no aparece en el uso normal y no
// delata si un correo está registrado.
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ServicioAuth } from '../../servicios/ServicioAuth'
import {
  ESPERA_SOLICITUD_SEG,
  MENSAJES_CONTRASENA,
} from '../reglasContrasena'
import MarcoPublico from './MarcoPublico'

export default function Recuperar() {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  const [espera, setEspera] = useState(0)

  useEffect(() => {
    if (espera <= 0) return undefined
    const reloj = setTimeout(() => {
      setEspera((segundos) => segundos - 1)
    }, 1000)
    return () => {
      clearTimeout(reloj)
    }
  }, [espera])

  const pedirEnlace = (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setEnviado(false)
    setError('')
    ServicioAuth.solicitarRecuperacion(email)
      .then((resultado) => {
        if (resultado.ok) setEnviado(true)
        else setError(resultado.mensaje)
        if (resultado.ok || !resultado.sinEnviar)
          setEspera(ESPERA_SOLICITUD_SEG)
      })
      .catch(() => {
        setError(MENSAJES_CONTRASENA.errorConexion)
      })
      .finally(() => {
        setEnviando(false)
      })
  }

  return (
    <MarcoPublico titulo='Olvidé mi contraseña'>
      <p className='text-sm text-textMuted'>
        Escribí tu correo y te enviamos un enlace para definir una contraseña
        nueva.
      </p>

      <form onSubmit={pedirEnlace} className='flex flex-col gap-4'>
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
            className='w-full rounded-input border bg-white px-3 py-3 text-[15px] outline-none focus:border-purple-700'
          />
        </label>

        {enviado && (
          <p role='status' className='text-sm font-bold text-green'>
            {MENSAJES_CONTRASENA.solicitudEnviada}
          </p>
        )}
        {error && (
          <p role='alert' className='text-sm font-bold text-red'>
            {error}
          </p>
        )}

        <button
          type='submit'
          disabled={enviando || espera > 0}
          className='rounded-btn bg-purple-700 py-3 font-bold text-white disabled:opacity-60'
        >
          {enviando
            ? 'Enviando...'
            : espera > 0
              ? `Podés volver a pedirlo en ${espera} s`
              : 'Enviar enlace'}
        </button>
      </form>
    </MarcoPublico>
  )
}

// HU44 · Cambiar la contraseña con la sesión iniciada, desde Mi cuenta.
import { useState } from 'react'
import type { FormEvent } from 'react'
import { ServicioAuth } from '../../servicios/ServicioAuth'
import {
  MENSAJES_CONTRASENA,
  validarContrasenaNueva,
} from '../reglasContrasena'
import CampoContrasena from './CampoContrasena'

export default function FormCambiarContrasena() {
  const [abierto, setAbierto] = useState(false)
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  const limpiarCampos = () => {
    setActual('')
    setNueva('')
    setConfirmacion('')
  }

  const cambiar = (e: FormEvent) => {
    e.preventDefault()
    setExito('')
    const invalido = validarContrasenaNueva({ nueva, confirmacion, actual })
    if (invalido) {
      setError(invalido)
      return
    }
    setEnviando(true)
    setError('')
    ServicioAuth.cambiarContrasena(actual, nueva)
      .then((resultado) => {
        if (resultado.estado === 'cambiada') {
          limpiarCampos()
          setAbierto(false)
          setExito(MENSAJES_CONTRASENA.cambiada)
          return
        }
        setError(resultado.mensaje)
      })
      .catch(() => {
        // El servicio no debería rechazar: no se afirma ningún resultado
        setError(MENSAJES_CONTRASENA.incierta)
      })
      .finally(() => {
        setEnviando(false)
      })
  }

  return (
    <div className='mt-5'>
      {exito && (
        <p role='status' className='mb-3 text-sm font-bold text-green'>
          {exito}
        </p>
      )}

      {!abierto && (
        <button
          type='button'
          onClick={() => {
            setAbierto(true)
            setExito('')
          }}
          className='w-full rounded-btn border-2 border-purple-700 py-3 font-bold text-purple-700'
        >
          Cambiar contraseña
        </button>
      )}

      {abierto && (
        <form onSubmit={cambiar} className='flex flex-col gap-4'>
          <CampoContrasena
            etiqueta='Contraseña actual'
            valor={actual}
            alCambiar={setActual}
            autoComplete='current-password'
          />
          <CampoContrasena
            etiqueta='Contraseña nueva'
            valor={nueva}
            alCambiar={setNueva}
            autoComplete='new-password'
          />
          <CampoContrasena
            etiqueta='Repetí la contraseña nueva'
            valor={confirmacion}
            alCambiar={setConfirmacion}
            autoComplete='new-password'
          />
          <p className='text-xs text-textMuted'>Al menos 8 caracteres.</p>

          {error && (
            <p role='alert' className='text-sm font-bold text-red'>
              {error}
            </p>
          )}

          <button
            type='submit'
            disabled={enviando}
            className='rounded-btn bg-purple-700 py-3 font-bold text-white disabled:opacity-60'
          >
            {enviando ? 'Guardando...' : 'Guardar contraseña'}
          </button>
          <button
            type='button'
            disabled={enviando}
            onClick={() => {
              limpiarCampos()
              setError('')
              setAbierto(false)
            }}
            className='py-1 text-sm font-semibold text-textMuted underline disabled:opacity-60'
          >
            Cancelar
          </button>
        </form>
      )}
    </div>
  )
}

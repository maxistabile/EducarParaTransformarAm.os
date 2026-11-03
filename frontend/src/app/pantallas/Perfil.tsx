// Perfil: datos de la cuenta y cierre de sesión (HU42).
// Cambiar la contraseña es HU44 (próximo PR).
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSesionApp } from '../sesion/contextoSesion'

export default function Perfil() {
  const { sesion, salir } = useSesionApp()
  const navigate = useNavigate()
  const [saliendo, setSaliendo] = useState(false)
  const [error, setError] = useState('')

  if (sesion.estado !== 'app') return null
  const { perfil } = sesion

  const cerrarSesion = async () => {
    setSaliendo(true)
    setError('')
    try {
      await salir()
      // replace: "Atrás" no vuelve a una pantalla privada
      navigate('/app/ingresar', { replace: true })
    } catch {
      setError('No se pudo cerrar la sesión. Revisá tu conexión e intentá de nuevo.')
      setSaliendo(false)
    }
  }

  return (
    <section className='rounded-card bg-white p-5 shadow-card'>
      <h2 className='text-xl font-extrabold text-purple-700'>Mi cuenta</h2>
      <dl className='mt-4 flex flex-col gap-3 text-sm'>
        <div>
          <dt className='font-bold text-textMuted'>Nombre</dt>
          <dd>{[perfil.nombre, perfil.apellido].filter(Boolean).join(' ')}</dd>
        </div>
        <div>
          <dt className='font-bold text-textMuted'>Correo</dt>
          <dd className='break-all'>{perfil.email}</dd>
        </div>
        <div>
          <dt className='font-bold text-textMuted'>Rol</dt>
          <dd>{sesion.rol === 'Padre' ? 'Tutor' : 'Alumno'}</dd>
        </div>
      </dl>

      <p className='mt-5 text-sm text-textMuted'>
        Cambiar la contraseña: próximamente.
      </p>

      {error && (
        <p role='alert' className='mt-4 text-sm font-bold text-red'>
          {error}
        </p>
      )}

      <button
        type='button'
        onClick={cerrarSesion}
        disabled={saliendo}
        className='mt-5 w-full rounded-btn border-2 border-red py-3 font-bold text-red disabled:opacity-60'
      >
        {saliendo ? 'Cerrando sesión...' : 'Cerrar sesión'}
      </button>
    </section>
  )
}

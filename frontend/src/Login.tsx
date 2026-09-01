import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
)

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  // Si ya hay sesión activa, redirigir directamente
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await redirectByRole(session.user.id)
      } else {
        setChecking(false)
      }
    })
  }, [])

  const redirectByRole = async (userId: string) => {
    const { data } = await supabase
      .from('usuarios')
      .select('rol, activo')
      .eq('id_usuario', userId)
      .single()

    // Usuario desactivado: no permitir el ingreso (cerrar la sesión recién abierta)
    if (data && data.activo === false) {
      await supabase.auth.signOut()
      setError('Tu usuario está desactivado. Contactá a la institución.')
      setChecking(false)
      setLoading(false)
      return
    }

    if (
      data?.rol === 'Admin' ||
      data?.rol === 'Directivo' ||
      data?.rol === 'Docente'
    ) {
      navigate('/admin', { replace: true })
    } else {
      navigate('/portal', { replace: true })
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (err || !data.user) {
      setError('Credenciales incorrectas. Verificá tu email y contraseña.')
      setLoading(false)
      return
    }

    await redirectByRole(data.user.id)
    setLoading(false)
  }

  if (checking) {
    return (
      <div className='min-h-screen bg-bg flex items-center justify-center'>
        <p className='text-purple-700 font-extrabold text-[15px]'>Cargando...</p>
      </div>
    )
  }

  return (
    <div
      className='min-h-screen bg-bg flex flex-col items-center justify-center px-4'
      style={{
        background: 'radial-gradient(ellipse at 60% 0%, #EEE9FF 0%, #F5F4FB 60%)',
      }}
    >
      {/* Volver al inicio */}
      <Link
        to='/'
        className='flex items-center gap-2 text-textMuted text-[13px] font-bold no-underline hover:text-purple-700 transition-colors mb-6 self-start max-w-[420px] w-full mx-auto'
      >
        ← Volver al inicio
      </Link>

      <div className='bg-white rounded-[24px] px-10 py-11 w-full max-w-[420px] border border-border shadow-[0_8px_48px_rgba(91,53,197,0.14)]'>
        {/* Logo */}
        <div className='text-center mb-8'>
          <Link to='/'>
            <img
              src='/logo.png'
              alt='Educar Para Transformar'
              className='h-20 mb-3 mx-auto'
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </Link>
          <div className='text-[17px] font-black text-purple-700'>
            Educar Para Transformar
          </div>
          <div className='text-xs text-textMuted tracking-[0.08em] mt-1'>
            CAMPUS VIRTUAL
          </div>
        </div>

        <form onSubmit={handleLogin} className='flex flex-col gap-4'>
          <div>
            <label className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Correo electrónico
            </label>
            <input
              type='email'
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='tu@email.com'
              className='w-full px-[14px] py-[11px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
            />
          </div>

          <div>
            <label className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Contraseña
            </label>
            <input
              type='password'
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder='••••••••'
              className='w-full px-[14px] py-[11px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
            />
          </div>

          {error && (
            <div className='text-[12px] font-bold text-red bg-[#E74C3C12] border border-[#E74C3C40] rounded-lg px-4 py-3'>
              ⚠️ {error}
            </div>
          )}

          <button
            type='submit'
            disabled={loading}
            className={`border-0 rounded-btn py-[13px] text-[14px] font-extrabold cursor-pointer mt-1 transition-opacity ${
              loading
                ? 'bg-border text-textMuted cursor-not-allowed'
                : 'bg-gradient-to-br from-purple-700 to-purpleMid text-white'
            }`}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className='text-center text-[11px] text-textMuted mt-6 leading-relaxed'>
          Accedés con las credenciales provistas por la institución.
          <br />
          Cada usuario es redirigido automáticamente según su rol.
        </p>
      </div>
    </div>
  )
}

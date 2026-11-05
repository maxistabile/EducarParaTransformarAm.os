// Marco de las pantallas públicas de contraseña (HU43).
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export default function MarcoPublico({
  titulo,
  children,
}: {
  titulo: string
  children: ReactNode
}) {
  return (
    <div className='min-h-dvh min-w-[360px] bg-appFondo font-sans text-text px-5 py-10'>
      <div className='mx-auto max-w-sm'>
        <div className='flex flex-col items-center text-center'>
          <img src='/logo.png' alt='' className='h-20 w-20' />
          <h1 className='mt-3 text-2xl font-extrabold text-purple-700'>
            {titulo}
          </h1>
        </div>

        <div className='mt-8 flex flex-col gap-4 rounded-card bg-white p-5 shadow-card'>
          {children}
        </div>

        <p className='mt-6 text-center'>
          <Link
            to='/app/ingresar'
            className='text-sm font-semibold text-textMuted underline'
          >
            Volver al ingreso
          </Link>
        </p>
      </div>
    </div>
  )
}

// Layout móvil de la PWA (RNF6): pantallas desde 360 px, encabezado con la
// identidad visual (#5B35C5, fondo #F7F6FC, Nunito) y barra inferior con
// las secciones del rol (HU45). Se muestra solo con la sesión validada.
import { NavLink, Outlet } from 'react-router-dom'
import { irALaWeb } from './navegacion'
import { seccionesSegunRol } from './reglasAuthApp'
import type { Seccion } from './reglasAuthApp'
import { useSesionApp } from './sesion/contextoSesion'

interface Pestania {
  ruta: string
  texto: string
  icono: string
}

const PESTANIAS: ReadonlyMap<Seccion, Pestania> = new Map([
  ['inicio', { ruta: '/app/', texto: 'Inicio', icono: '🏠' }],
  ['cuotas', { ruta: '/app/cuotas', texto: 'Cuotas', icono: '💳' }],
  ['facturas', { ruta: '/app/facturas', texto: 'Facturas', icono: '📄' }],
  ['pagos', { ruta: '/app/pagos', texto: 'Pagos', icono: '🧾' }],
  ['inscripciones', { ruta: '/app/inscripciones', texto: 'Inscripciones', icono: '📋' }],
  ['perfil', { ruta: '/app/perfil', texto: 'Perfil', icono: '👤' }],
])

export default function AppLayout() {
  const { sesion } = useSesionApp()
  if (sesion.estado !== 'app') return null
  // Solo las secciones del rol (validado en reglasAuthApp)
  const pestanias = seccionesSegunRol(sesion.rol).flatMap((s) => {
    const pestania = PESTANIAS.get(s)
    return pestania ? [pestania] : []
  })

  return (
    <div className='min-h-dvh min-w-[360px] bg-appFondo font-sans text-text'>
      <div className='mx-auto flex min-h-dvh max-w-md flex-col'>
        <header
          className='sticky top-0 z-40 bg-purple-700 text-white px-4 pb-3 flex items-center gap-3'
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <img
            src='/logo.png'
            alt=''
            className='h-9 w-9 rounded-full bg-white p-0.5'
          />
          <h1 className='flex-1 text-lg font-extrabold leading-tight'>
            Educar para Transformar
          </h1>
          <a
            href='/'
            onClick={(e) => {
              e.preventDefault()
              irALaWeb('/')
            }}
            className='text-xs font-semibold text-white/80 underline'
          >
            Ir al sitio
          </a>
        </header>

        <main className='flex-1 px-4 py-5 pb-24'>
          <Outlet />
        </main>

        <nav
          aria-label='Secciones de la app'
          className='fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t bg-white'
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <ul
            className='grid'
            style={{ gridTemplateColumns: `repeat(${pestanias.length}, minmax(0, 1fr))` }}
          >
            {pestanias.map((p) => (
              <li key={p.ruta}>
                <NavLink
                  to={p.ruta}
                  end={p.ruta === '/app/'}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${
                      isActive ? 'text-purple-700' : 'text-textMuted'
                    }`
                  }
                >
                  <span aria-hidden='true' className='text-xl'>
                    {p.icono}
                  </span>
                  {p.texto}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}

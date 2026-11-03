// Layout móvil de la PWA (RNF6): pantallas desde 360 px, encabezado con la
// identidad visual (#5B35C5, fondo #F7F6FC, Nunito) y barra inferior.
import { NavLink, Outlet } from 'react-router-dom'
import AvisoActualizacion from './AvisoActualizacion'
import { irALaWeb } from './navegacion'

const PESTANIAS = [
  { ruta: '/app/', texto: 'Inicio', icono: '🏠' },
  { ruta: '/app/cuotas', texto: 'Cuotas', icono: '💳' },
  { ruta: '/app/pagos', texto: 'Pagos', icono: '🧾' },
  { ruta: '/app/perfil', texto: 'Perfil', icono: '👤' },
]

export default function AppLayout() {
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
          <ul className='grid grid-cols-4'>
            {PESTANIAS.map((p) => (
              <li key={p.ruta}>
                <NavLink
                  to={p.ruta}
                  end
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 py-2 text-xs font-bold ${
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

        <AvisoActualizacion />
      </div>
    </div>
  )
}

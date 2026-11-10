// Inicio según el rol (HU45): bienvenida y accesos a las secciones que el
// rol ya puede usar. No consulta datos nuevos: los accesos salen de
// seccionesSegunRol (las mismas secciones de la barra inferior) y cada
// pantalla mantiene sus propios controles.
import { Link } from 'react-router-dom'
import { seccionesSegunRol } from '../reglasAuthApp'
import type { Seccion } from '../reglasAuthApp'
import { useSesionApp } from '../sesion/contextoSesion'

interface Acceso {
  ruta: string
  icono: string
  titulo: string
  padre: string
  alumno: string
}

// Map en lugar de objeto: solo se muestran las secciones del rol.
const ACCESOS: ReadonlyMap<Seccion, Acceso> = new Map([
  ['cuotas', {
    ruta: '/app/cuotas', icono: '💳', titulo: 'Cuotas',
    padre: 'Cuotas pendientes y pagadas, vencimientos e importes. Desde acá pagás una factura con transferencia.',
    alumno: '',
  }],
  ['facturas', {
    ruta: '/app/facturas', icono: '📄', titulo: 'Facturas y deuda',
    padre: 'Facturas por período con sus PDF y la deuda por concepto y mes.',
    alumno: '',
  }],
  ['pagos', {
    ruta: '/app/pagos', icono: '🧾', titulo: 'Pagos',
    padre: 'Historial de pagos y estado de cada comprobante: en revisión, aprobado o rechazado.',
    alumno: '',
  }],
  ['inscripciones', {
    ruta: '/app/inscripciones', icono: '📋', titulo: 'Inscripciones',
    padre: 'Deportes, transporte y comedor de cada hijo.',
    alumno: 'Tus deportes, transporte y comedor.',
  }],
  ['perfil', {
    ruta: '/app/perfil', icono: '👤', titulo: 'Mi cuenta',
    padre: 'Tus datos, cambio de contraseña y cierre de sesión.',
    alumno: 'Tus datos, cambio de contraseña y cierre de sesión.',
  }],
])

export default function Inicio() {
  const { sesion } = useSesionApp()
  if (sesion.estado !== 'app') return null
  const esPadre = sesion.rol === 'Padre'
  const accesos = seccionesSegunRol(sesion.rol).flatMap((s) => {
    const acceso = ACCESOS.get(s)
    return acceso ? [acceso] : []
  })

  return (
    <div className='flex flex-col gap-4'>
      <section className='rounded-card bg-white p-5 shadow-card'>
        <h2 className='text-xl font-extrabold text-purple-700'>
          ¡Hola, {sesion.perfil.nombre ?? 'bienvenido/a'}!
        </h2>
        <p className='mt-1 text-xs font-bold uppercase text-textMuted'>{esPadre ? 'Tutor' : 'Alumno'}</p>
        <p className='mt-3 text-sm text-textMuted'>
          {esPadre
            ? 'Consultá las cuotas, las facturas y los pagos de tus hijos, y cargá los comprobantes de transferencia.'
            : 'Consultá tus inscripciones y administrá tu cuenta.'}
        </p>
      </section>

      <nav aria-label='Accesos'>
        <ul className='flex flex-col gap-3'>
          {accesos.map((a) => (
            <li key={a.ruta}>
              <Link
                to={a.ruta}
                className='flex items-center gap-3 rounded-card bg-white p-4 shadow-card active:bg-purpleLight'
              >
                <span aria-hidden='true' className='text-2xl'>{a.icono}</span>
                <span className='flex-1'>
                  <span className='block text-base font-extrabold text-purple-700'>{a.titulo}</span>
                  <span className='block text-[13px] text-textMuted'>{esPadre ? a.padre : a.alumno}</span>
                </span>
                <span aria-hidden='true' className='text-lg font-bold text-textMuted'>›</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

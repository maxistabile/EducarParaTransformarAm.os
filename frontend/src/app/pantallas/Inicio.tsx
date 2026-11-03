// Inicio según el rol (HU45). Solo usa el perfil propio: cuotas, pagos e
// inscripciones se consultan recién cuando existan sus permisos (RLS) y
// sus historias (HU51 en adelante).
import { useSesionApp } from '../sesion/contextoSesion'

const TEXTO_POR_ROL = {
  Padre:
    'Desde esta app vas a poder consultar las cuotas, cargar los comprobantes de pago y ver las inscripciones de tus hijos.',
  Alumno: 'Desde esta app vas a poder ver tus inscripciones.',
}

export default function Inicio() {
  const { sesion } = useSesionApp()
  if (sesion.estado !== 'app') return null

  return (
    <section className='rounded-card bg-white p-5 shadow-card'>
      <h2 className='text-xl font-extrabold text-purple-700'>
        ¡Hola, {sesion.perfil.nombre ?? 'bienvenido/a'}!
      </h2>
      <p className='mt-1 text-xs font-bold uppercase text-textMuted'>
        {sesion.rol === 'Padre' ? 'Tutor' : 'Alumno'}
      </p>
      <p className='mt-3 text-sm text-textMuted'>{TEXTO_POR_ROL[sesion.rol]}</p>
      <p className='mt-4 rounded-input bg-purpleLight px-3 py-2 text-sm font-semibold text-purpleDark'>
        La app está en construcción.
      </p>
    </section>
  )
}

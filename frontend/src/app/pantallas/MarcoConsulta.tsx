// Marco común de las pantallas de consulta por alumno (HU59, HU51 a HU53):
// título, estados de carga, error con reintentar y vacío, y el selector de
// hijo. El contenido se dibuja solo con un resultado correcto y vigente.
import type { ReactNode } from 'react'
import { colorEstadoCobro } from '../../reglasFacturacion'
import SelectorAlumno from '../sesion/SelectorAlumno'
import type { ConsultaAlumno } from '../sesion/useConsultaAlumno'

type Resultado = { ok: true } | { ok: false; mensaje: string }

export function Tarjeta({
  titulo,
  icono,
  children,
}: {
  titulo: string
  icono: string
  children: ReactNode
}) {
  return (
    <section className='mb-4 rounded-card bg-white p-4 shadow-card'>
      <h3 className='mb-2 flex items-center gap-2 text-base font-extrabold text-purple-700'>
        <span aria-hidden='true'>{icono}</span>
        {titulo}
      </h3>
      {children}
    </section>
  )
}

/** Estado con el color del panel (Pagada, Vencida, Sin cargo...). */
export function Etiqueta({ texto }: { texto: string }) {
  const color = colorEstadoCobro(texto)
  return (
    <span
      className='shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold'
      style={{ color, backgroundColor: `${color}1A` }}
    >
      {texto}
    </span>
  )
}

export const Vacio = ({ texto }: { texto: string }) => (
  <p className='text-sm text-textMuted'>{texto}</p>
)

export function Reintentar({ mensaje, onClick }: { mensaje: string; onClick: () => void }) {
  return (
    <div role='alert' className='rounded-card bg-white p-4 shadow-card'>
      <p className='text-sm font-bold text-red'>{mensaje}</p>
      <button
        type='button'
        onClick={onClick}
        className='mt-3 w-full rounded-btn bg-purple-700 py-2.5 text-sm font-bold text-white'
      >
        Reintentar
      </button>
    </div>
  )
}

export default function MarcoConsulta<R extends Resultado>({
  titulo,
  consulta,
  cargando,
  children,
}: {
  titulo: string
  consulta: ConsultaAlumno<R>
  cargando: string
  children: (resultado: Extract<R, { ok: true }>) => ReactNode
}) {
  const { seleccion, actual, reintentar } = consulta

  return (
    <div>
      <h2 className='mb-3 text-xl font-extrabold text-purple-700'>{titulo}</h2>

      {seleccion.estado === 'cargando' && <p className='text-sm text-textMuted'>Cargando...</p>}
      {seleccion.estado === 'error' && (
        <Reintentar mensaje={seleccion.mensaje} onClick={seleccion.reintentar} />
      )}
      {seleccion.estado === 'listo' && !seleccion.elegido && (
        <div className='rounded-card bg-white p-4 shadow-card'>
          <Vacio texto='No hay alumnos asociados a tu cuenta. Contactá a la institución.' />
        </div>
      )}

      {seleccion.elegido && (
        <>
          <SelectorAlumno seleccion={seleccion} />
          {actual === null && <p className='text-sm text-textMuted'>{cargando}</p>}
          {actual && !actual.ok && <Reintentar mensaje={actual.mensaje} onClick={reintentar} />}
          {actual?.ok && children(actual as Extract<R, { ok: true }>)}
        </>
      )}
    </div>
  )
}

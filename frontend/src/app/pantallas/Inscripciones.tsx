// Inscripciones a deportes, transporte y comedor (RF13.3, HU59).
// Solo lectura. El padre elige uno de sus hijos; el alumno ve solo las
// suyas. Usa ServicioInscripciones (Facade): no consulta tablas.
import { ServicioInscripciones, MENSAJES_INSCRIPCIONES } from '../../servicios/ServicioInscripciones'
import type { ResultadoInscripciones } from '../../servicios/ServicioInscripciones'
import { useConsultaAlumno } from '../sesion/useConsultaAlumno'
import type { Consulta } from '../sesion/useConsultaAlumno'
import MarcoConsulta, { Tarjeta, Vacio } from './MarcoConsulta'

/** Fecha local 'DD/MM/AAAA' de un timestamptz. */
const fechaLocal = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

// Fuera del componente: useConsultaAlumno necesita referencias estables
const consultar: Consulta<ResultadoInscripciones> = (idAlumno, permitidos) =>
  ServicioInscripciones.deAlumno(idAlumno, permitidos)
const SI_FALLA: ResultadoInscripciones = { ok: false, mensaje: MENSAJES_INSCRIPCIONES.error }

export default function Inscripciones() {
  const consulta = useConsultaAlumno(consultar, SI_FALLA)

  return (
    <MarcoConsulta titulo='Inscripciones' consulta={consulta} cargando='Cargando inscripciones...'>
      {({ inscripciones }) => (
        <>
          <Tarjeta titulo='Deportes' icono='⚽'>
            {inscripciones.deportes.length === 0 ? (
              <Vacio texto='Sin inscripción activa.' />
            ) : (
              <ul className='flex flex-col gap-3'>
                {inscripciones.deportes.map((d) => (
                  <li key={d.id_inscripcion} className='rounded-input bg-appFondo p-3'>
                    <p className='font-extrabold'>
                      {d.deporte}
                      {d.nivel && <span className='font-semibold text-textMuted'> · {d.nivel}</span>}
                    </p>
                    {d.horario && <p className='text-sm'>🕐 {d.horario}</p>}
                    {d.profesor && <p className='text-sm text-textMuted'>Prof. {d.profesor}</p>}
                    <p className='text-xs text-textMuted'>Desde el {fechaLocal(d.desde)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta titulo='Transporte' icono='🚌'>
            {inscripciones.transporte ? (
              <>
                <p className='font-extrabold'>{inscripciones.transporte.recorrido}</p>
                {inscripciones.transporte.descripcion && (
                  <p className='text-sm text-textMuted'>{inscripciones.transporte.descripcion}</p>
                )}
                <p className='text-xs text-textMuted'>
                  Desde el {fechaLocal(inscripciones.transporte.desde)}
                </p>
              </>
            ) : (
              <Vacio texto='Sin inscripción activa.' />
            )}
          </Tarjeta>

          <Tarjeta titulo='Comedor' icono='🍽️'>
            {inscripciones.comedor ? (
              <p className='text-sm'>
                Inscripto/a desde el {fechaLocal(inscripciones.comedor.desde)}
              </p>
            ) : (
              <Vacio texto='Sin inscripción activa.' />
            )}
          </Tarjeta>

          <p className='text-xs text-textMuted'>
            Consulta de solo lectura. Para inscribir o dar de baja, comunicate con la institución.
          </p>
        </>
      )}
    </MarcoConsulta>
  )
}

// Inscripciones a deportes, transporte y comedor (RF13.3, HU59).
// Solo lectura. El padre elige uno de sus hijos; el alumno ve solo las
// suyas. Usa ServicioInscripciones (Facade): no consulta tablas.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ServicioInscripciones, MENSAJES_INSCRIPCIONES } from '../../servicios/ServicioInscripciones'
import type { ResultadoInscripciones } from '../../servicios/ServicioInscripciones'
import { esRespuestaVigente } from '../reglasAlumnoElegido'
import SelectorAlumno from '../sesion/SelectorAlumno'
import { useAlumnoElegido } from '../sesion/useAlumnoElegido'

/** Fecha local 'DD/MM/AAAA' de un timestamptz. */
const fechaLocal = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

function Tarjeta({ titulo, icono, children }: { titulo: string; icono: string; children: ReactNode }) {
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

const Vacio = ({ texto }: { texto: string }) => (
  <p className='text-sm text-textMuted'>{texto}</p>
)

function Reintentar({ mensaje, onClick }: { mensaje: string; onClick: () => void }) {
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

export default function Inscripciones() {
  const seleccion = useAlumnoElegido()
  const { cuenta, elegido, alumnos } = seleccion
  const idAlumno = elegido?.id_alumno ?? null

  const [datos, setDatos] = useState<{
    cuenta: string
    idAlumno: number
    resultado: ResultadoInscripciones
  } | null>(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    if (!cuenta || idAlumno === null) return
    let vigente = true
    const pedido = { cuenta, idAlumno }
    ServicioInscripciones.deAlumno(
      idAlumno,
      alumnos.map((a) => a.id_alumno),
    ).then(
      (resultado) => {
        if (vigente) setDatos({ ...pedido, resultado })
      },
      () => {
        if (vigente)
          setDatos({ ...pedido, resultado: { ok: false, mensaje: MENSAJES_INSCRIPCIONES.error } })
      },
    )
    return () => {
      vigente = false
    }
  }, [cuenta, idAlumno, alumnos, intento])

  // Solo se muestran datos de la cuenta y del alumno elegidos ahora
  const actual =
    datos && esRespuestaVigente(datos, { cuenta, idAlumno }) ? datos.resultado : null

  return (
    <div>
      <h2 className='mb-3 text-xl font-extrabold text-purple-700'>Inscripciones</h2>

      {seleccion.estado === 'cargando' && <p className='text-sm text-textMuted'>Cargando...</p>}
      {seleccion.estado === 'error' && (
        <Reintentar mensaje={seleccion.mensaje} onClick={seleccion.reintentar} />
      )}
      {seleccion.estado === 'listo' && !elegido && (
        <div className='rounded-card bg-white p-4 shadow-card'>
          <Vacio texto='No hay alumnos asociados a tu cuenta. Contactá a la institución.' />
        </div>
      )}

      {elegido && (
        <>
          <SelectorAlumno seleccion={seleccion} />
          {actual === null && <p className='text-sm text-textMuted'>Cargando inscripciones...</p>}
          {actual && !actual.ok && (
            <Reintentar
              mensaje={actual.mensaje}
              onClick={() => {
                setDatos(null)
                setIntento((n) => n + 1)
              }}
            />
          )}
          {actual?.ok && (
            <>
              <Tarjeta titulo='Deportes' icono='⚽'>
                {actual.inscripciones.deportes.length === 0 ? (
                  <Vacio texto='Sin inscripción activa.' />
                ) : (
                  <ul className='flex flex-col gap-3'>
                    {actual.inscripciones.deportes.map((d) => (
                      <li key={d.id_inscripcion} className='rounded-input bg-appFondo p-3'>
                        <p className='font-extrabold'>
                          {d.deporte}
                          {d.nivel && (
                            <span className='font-semibold text-textMuted'> · {d.nivel}</span>
                          )}
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
                {actual.inscripciones.transporte ? (
                  <>
                    <p className='font-extrabold'>{actual.inscripciones.transporte.recorrido}</p>
                    {actual.inscripciones.transporte.descripcion && (
                      <p className='text-sm text-textMuted'>
                        {actual.inscripciones.transporte.descripcion}
                      </p>
                    )}
                    <p className='text-xs text-textMuted'>
                      Desde el {fechaLocal(actual.inscripciones.transporte.desde)}
                    </p>
                  </>
                ) : (
                  <Vacio texto='Sin inscripción activa.' />
                )}
              </Tarjeta>

              <Tarjeta titulo='Comedor' icono='🍽️'>
                {actual.inscripciones.comedor ? (
                  <p className='text-sm'>
                    Inscripto/a desde el {fechaLocal(actual.inscripciones.comedor.desde)}
                  </p>
                ) : (
                  <Vacio texto='Sin inscripción activa.' />
                )}
              </Tarjeta>

              <p className='text-xs text-textMuted'>
                Consulta de solo lectura. Para inscribir o dar de baja, comunicate con la
                institución.
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}

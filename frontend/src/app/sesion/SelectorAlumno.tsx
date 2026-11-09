// Selector de hijo (HU51, tarea 1; lo usa HU59). Solo aparece si la
// cuenta tiene más de un alumno; si no, muestra el alumno y su curso.
import { nombreAlumno } from '../reglasAlumnoElegido'
import type { AlumnoElegido } from './useAlumnoElegido'

export default function SelectorAlumno({
  seleccion,
}: {
  seleccion: Pick<AlumnoElegido, 'alumnos' | 'elegido' | 'elegir'>
}) {
  const { alumnos, elegido, elegir } = seleccion
  if (!elegido) return null

  if (alumnos.length < 2)
    return (
      <p className='mb-4 text-sm text-textMuted'>
        <strong className='text-text'>{nombreAlumno(elegido)}</strong>
        {elegido.curso && ` · ${elegido.curso}`}
      </p>
    )

  return (
    <label className='mb-4 block'>
      <span className='mb-1 block text-xs font-extrabold text-textMuted'>Hijo/a</span>
      <select
        className='w-full appearance-none rounded-input border-2 border-border bg-white px-3 py-2.5 text-sm font-bold text-text'
        value={elegido.id_alumno}
        onChange={(ev) => {
          elegir(Number(ev.target.value))
        }}
      >
        {alumnos.map((a) => (
          <option key={a.id_alumno} value={a.id_alumno}>
            {nombreAlumno(a)}
            {a.curso ? ` · ${a.curso}` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

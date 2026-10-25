import { describe, it, expect } from 'vitest'
import {
  FORM_ALUMNO_VACIO,
  validarAlumno,
  mensajeErrorAlumno,
} from './validacionesAlumno'
import type { FormAlumno } from './validacionesAlumno'

// Alumno con todos los datos correctos; cada prueba cambia un solo campo
const alumnoValido: FormAlumno = {
  ...FORM_ALUMNO_VACIO,
  nombre: 'Lucía',
  apellido: 'Gómez',
  dni: '45123456',
  fecha_nacimiento: '2015-03-10',
  id_curso: '1',
  email: 'lucia.gomez@mail.com',
  telefono: '3624 123456',
}

describe('validarAlumno (RF1 · HU7 y HU9)', () => {
  it('acepta un alumno con todos los datos válidos', () => {
    expect(validarAlumno(alumnoValido)).toBeNull()
  })

  it('rechaza un nombre de una sola letra', () => {
    expect(validarAlumno({ ...alumnoValido, nombre: 'L' })).toMatch(/nombre/)
  })

  it('rechaza un DNI con puntos o con menos de 7 dígitos', () => {
    expect(validarAlumno({ ...alumnoValido, dni: '45.123.456' })).toMatch(/DNI/)
    expect(validarAlumno({ ...alumnoValido, dni: '123456' })).toMatch(/DNI/)
  })

  it('rechaza una fecha de nacimiento futura', () => {
    expect(
      validarAlumno({ ...alumnoValido, fecha_nacimiento: '2099-01-01' }),
    ).toMatch(/fecha/)
  })

  it('exige el curso (cada alumno pertenece a un único curso)', () => {
    expect(validarAlumno({ ...alumnoValido, id_curso: '' })).toMatch(/curso/)
  })

  it('acepta el email vacío pero rechaza uno mal escrito', () => {
    expect(validarAlumno({ ...alumnoValido, email: '' })).toBeNull()
    expect(validarAlumno({ ...alumnoValido, email: 'lucia@mail' })).toMatch(/email/)
  })

  it('rechaza un teléfono con letras o con pocos dígitos', () => {
    expect(validarAlumno({ ...alumnoValido, telefono: '362-abc' })).toMatch(/teléfono/)
    expect(validarAlumno({ ...alumnoValido, telefono: '12345' })).toMatch(/teléfono/)
  })
})

describe('mensajeErrorAlumno', () => {
  it('traduce el error de DNI duplicado de la base de datos', () => {
    const errorBase =
      'duplicate key value violates unique constraint "alumnos_dni_key"'
    expect(mensajeErrorAlumno(errorBase)).toBe(
      'Ya existe un alumno registrado con ese DNI.',
    )
  })
})

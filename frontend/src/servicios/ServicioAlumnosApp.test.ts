import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

interface Llamada {
  tabla: string
  metodos: Array<[string, unknown[]]>
}

const { estado } = vi.hoisted(() => ({
  estado: {
    llamadas: [] as Llamada[],
    respuesta: null as unknown,
    rechazo: null as Error | null,
  },
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from(tabla: string) {
      const llamada: Llamada = { tabla, metodos: [] }
      estado.llamadas.push(llamada)
      const rechazo = estado.rechazo
      const registrar =
        (metodo: string) =>
        (...args: unknown[]) => {
          llamada.metodos.push([metodo, args])
          return q
        }
      const q = {
        select: registrar('select'),
        eq: registrar('eq'),
        order: registrar('order'),
        then: (ok: (v: unknown) => unknown, mal: (e: unknown) => unknown) =>
          (rechazo instanceof Error
            ? Promise.reject(rechazo)
            : Promise.resolve(estado.respuesta ?? { data: null, error: null })
          ).then(ok, mal),
      }
      return q
    },
  },
}))

import { ServicioAlumnosApp, MENSAJE_ERROR_ALUMNOS } from './ServicioAlumnosApp'

const eqs = () => estado.llamadas.at(0)?.metodos.filter(([m]) => m === 'eq').map(([, a]) => a)

beforeEach(() => {
  estado.llamadas = []
  estado.respuesta = null
  estado.rechazo = null
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ServicioAlumnosApp.misAlumnos (HU59)', () => {
  it('el padre ve solo sus hijos (alumnos.id_usuario_padre), con su curso', async () => {
    estado.respuesta = {
      data: [
        {
          id_alumno: 3,
          nombre: 'Ana',
          apellido: 'Uno',
          cursos: { nivel: 'Primaria', grado_anio: '3', division: 'A' },
        },
        { id_alumno: 7, nombre: 'Beto', apellido: 'Uno', cursos: null },
      ],
      error: null,
    }
    const r = await ServicioAlumnosApp.misAlumnos('padre-1', 'Padre')
    expect(estado.llamadas.at(0)?.tabla).toBe('alumnos')
    expect(eqs()).toEqual([['id_usuario_padre', 'padre-1']])
    expect(r).toEqual({
      ok: true,
      alumnos: [
        { id_alumno: 3, nombre: 'Ana', apellido: 'Uno', curso: 'Primaria · 3 "A"' },
        { id_alumno: 7, nombre: 'Beto', apellido: 'Uno', curso: null },
      ],
    })
  })

  it('el alumno ve solo su propio legajo (alumnos.id_usuario)', async () => {
    estado.respuesta = { data: [{ id_alumno: 5, nombre: 'Caro', apellido: 'Tres', cursos: null }], error: null }
    const r = await ServicioAlumnosApp.misAlumnos('alumno-5', 'Alumno')
    expect(eqs()).toEqual([['id_usuario', 'alumno-5']])
    expect(r).toMatchObject({ ok: true, alumnos: [{ id_alumno: 5 }] })
  })

  it('un padre sin hijos asociados recibe una lista vacía', async () => {
    estado.respuesta = { data: [], error: null }
    expect(await ServicioAlumnosApp.misAlumnos('padre-2', 'Padre')).toEqual({ ok: true, alumnos: [] })
  })

  it('un error de la base da un mensaje claro', async () => {
    estado.respuesta = { data: null, error: { code: '42501', message: 'permiso' } }
    expect(await ServicioAlumnosApp.misAlumnos('padre-1', 'Padre')).toEqual({
      ok: false,
      mensaje: MENSAJE_ERROR_ALUMNOS,
    })
  })

  it('si la promesa se rechaza, no rechaza y avisa', async () => {
    estado.rechazo = new TypeError('Failed to fetch')
    await expect(ServicioAlumnosApp.misAlumnos('padre-1', 'Padre')).resolves.toEqual({
      ok: false,
      mensaje: MENSAJE_ERROR_ALUMNOS,
    })
  })
})

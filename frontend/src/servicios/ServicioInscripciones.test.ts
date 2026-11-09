import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

// Cliente supabase simulado: registra cada llamada y resuelve con la
// respuesta programada para esa tabla.
interface Llamada {
  tabla: string
  metodos: Array<[string, unknown[]]>
}

const { estado } = vi.hoisted(() => ({
  estado: {
    llamadas: [] as Llamada[],
    respuestas: [] as Array<{ tabla: string; respuesta: unknown; rechazo?: Error }>,
  },
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from(tabla: string) {
      const llamada: Llamada = { tabla, metodos: [] }
      estado.llamadas.push(llamada)
      const i = estado.respuestas.findIndex((r) => r.tabla === tabla)
      const programada = i >= 0 ? estado.respuestas.splice(i, 1)[0] : undefined
      const rechazo = programada?.rechazo
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
        maybeSingle: registrar('maybeSingle'),
        then: (ok: (v: unknown) => unknown, mal: (e: unknown) => unknown) =>
          (rechazo instanceof Error
            ? Promise.reject(rechazo)
            : Promise.resolve(programada?.respuesta ?? { data: null, error: null })
          ).then(ok, mal),
      }
      return q
    },
  },
}))

import { ServicioInscripciones, MENSAJES_INSCRIPCIONES } from './ServicioInscripciones'

const responder = (tabla: string, respuesta: unknown) => {
  estado.respuestas.push({ tabla, respuesta })
}
const argumentos = (tabla: string, metodo: string) =>
  estado.llamadas
    .filter((l) => l.tabla === tabla)
    .flatMap((l) => l.metodos.filter(([m]) => m === metodo).map(([, a]) => a))

beforeEach(() => {
  estado.llamadas = []
  estado.respuestas = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ServicioInscripciones.deAlumno (HU59)', () => {
  it('un alumno que no es de la sesión da error sin consultar', async () => {
    expect(await ServicioInscripciones.deAlumno(9, [3, 7])).toEqual({
      ok: false,
      mensaje: MENSAJES_INSCRIPCIONES.ajeno,
    })
    expect(estado.llamadas).toHaveLength(0)
  })

  it('pide solo inscripciones activas del alumno y arma deportes, transporte y comedor', async () => {
    responder('inscripciones_deportivas', {
      data: [
        {
          id_inscripcion_dep: 2,
          fecha_alta: '2026-03-01T12:00:00-03:00',
          grupos_deportivos: {
            nivel: 'Primaria',
            dias: ['Miércoles', 'Lunes'],
            hora_inicio: '14:00:00',
            hora_fin: '15:30:00',
            actividades_extracurriculares: { nombre: 'Vóley' },
            docentes: { usuarios: { nombre: 'Laura', apellido: 'Gómez' } },
          },
        },
        {
          id_inscripcion_dep: 1,
          fecha_alta: '2026-03-01T12:00:00-03:00',
          grupos_deportivos: {
            nivel: 'Primaria',
            dias: ['Viernes'],
            hora_inicio: '16:00:00',
            hora_fin: '17:00:00',
            actividades_extracurriculares: { nombre: 'Ajedrez' },
            docentes: null,
          },
        },
      ],
      error: null,
    })
    responder('inscripciones_transporte', {
      data: {
        fecha_alta: '2026-10-01T12:00:00-03:00',
        recorridos: { numero: 2, nombre: 'Norte', descripcion: 'Paradas a definir' },
      },
      error: null,
    })
    responder('inscripciones_comedor', {
      data: { fecha_alta: '2026-03-02T12:00:00-03:00' },
      error: null,
    })

    const r = await ServicioInscripciones.deAlumno(7, [3, 7])

    for (const tabla of ['inscripciones_deportivas', 'inscripciones_transporte', 'inscripciones_comedor'])
      expect(argumentos(tabla, 'eq')).toEqual([
        ['id_alumno', 7],
        ['activo', true],
      ])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // Ordenados por nombre, con el horario de la web
    expect(r.inscripciones.deportes.map((d) => [d.deporte, d.horario, d.profesor])).toEqual([
      ['Ajedrez', 'Viernes · 16:00 a 17:00', null],
      ['Vóley', 'Lunes y Miércoles · 14:00 a 15:30', 'Laura Gómez'],
    ])
    expect(r.inscripciones.transporte).toEqual({
      recorrido: 'Recorrido 2 — Norte',
      descripcion: 'Paradas a definir',
      desde: '2026-10-01T12:00:00-03:00',
    })
    expect(r.inscripciones.comedor).toEqual({ desde: '2026-03-02T12:00:00-03:00' })
  })

  it('sin transporte ni comedor devuelve null en cada uno', async () => {
    responder('inscripciones_deportivas', { data: [], error: null })
    responder('inscripciones_transporte', { data: null, error: null })
    responder('inscripciones_comedor', { data: null, error: null })
    expect(await ServicioInscripciones.deAlumno(3, [3])).toEqual({
      ok: true,
      inscripciones: { deportes: [], transporte: null, comedor: null },
    })
  })

  it('un error de la base se informa con un mensaje claro y solo el código en la consola', async () => {
    responder('inscripciones_transporte', {
      data: null,
      error: { code: 'PGRST116', message: 'varias filas' },
    })
    expect(await ServicioInscripciones.deAlumno(3, [3])).toEqual({
      ok: false,
      mensaje: MENSAJES_INSCRIPCIONES.error,
    })
    expect(console.error).toHaveBeenCalledWith('[ServicioInscripciones] deAlumno:', {
      code: 'PGRST116',
      status: undefined,
    })
  })

  it('si la promesa se rechaza, no rechaza y avisa', async () => {
    estado.respuestas.push({
      tabla: 'inscripciones_comedor',
      respuesta: null,
      rechazo: new TypeError('Failed to fetch'),
    })
    await expect(ServicioInscripciones.deAlumno(3, [3])).resolves.toEqual({
      ok: false,
      mensaje: MENSAJES_INSCRIPCIONES.error,
    })
  })
})

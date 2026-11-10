import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Cliente supabase simulado: cada consulta resuelve con la próxima respuesta
// programada para esa tabla o función, y registra lo que se llamó.
interface Llamada {
  destino: string
  metodos: Array<[string, unknown[]]>
}

const { estado } = vi.hoisted(() => ({
  estado: {
    llamadas: [] as Llamada[],
    respuestas: [] as Array<{ destino: string; respuesta: unknown }>,
    invocaciones: [] as Array<{ fn: string; body: unknown }>,
    respuestaInvoke: { data: null, error: null } as { data: unknown; error: unknown },
  },
}))

vi.mock('../lib/supabase', () => {
  const consulta = (destino: string, metodoInicial?: [string, unknown[]]) => {
    const llamada: Llamada = { destino, metodos: metodoInicial ? [metodoInicial] : [] }
    estado.llamadas.push(llamada)
    const i = estado.respuestas.findIndex((r) => r.destino === destino)
    const programada = i >= 0 ? estado.respuestas.splice(i, 1)[0] : undefined
    const respuesta = programada?.respuesta ?? { data: null, error: null }
    const registrar =
      (metodo: string) =>
      (...args: unknown[]) => {
        llamada.metodos.push([metodo, args])
        return q
      }
    const q = {
      select: registrar('select'), eq: registrar('eq'), in: registrar('in'), is: registrar('is'),
      not: registrar('not'), order: registrar('order'), limit: registrar('limit'),
      maybeSingle: registrar('maybeSingle'),
      then: (ok: (v: unknown) => unknown, mal: (e: unknown) => unknown) => Promise.resolve(respuesta).then(ok, mal),
    }
    return q
  }
  return {
    supabase: {
      from: (tabla: string) => consulta(tabla),
      rpc: (fn: string, args: unknown) => consulta(fn, ['rpc', [args]]),
      functions: {
        invoke: (fn: string, opciones: { body: unknown }) => {
          estado.invocaciones.push({ fn, body: opciones.body })
          return Promise.resolve(estado.respuestaInvoke)
        },
      },
    },
  }
})

import { ServicioVinculos } from './ServicioVinculos'

const programar = (destino: string, respuesta: unknown) => {
  estado.respuestas.push({ destino, respuesta })
}
const cuenta = { email: 'nuevo@demo.test', password: '12345678', nombre: 'Ana', apellido: 'Pérez', rol: 'Alumno' as const }

beforeEach(() => {
  estado.llamadas = []
  estado.respuestas = []
  estado.invocaciones = []
  estado.respuestaInvoke = { data: null, error: null }
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
})

const errorHttp = (status: number, cuerpo: Record<string, unknown>) => ({
  name: 'FunctionsHttpError',
  context: new Response(JSON.stringify(cuerpo), { status }),
})

describe('crearCuenta: no duplica ante un reintento', () => {
  it('correo nuevo: invoca crear-usuario una vez y usa el id que devuelve (sin escribir el rol desde el navegador)', async () => {
    programar('usuarios', { data: null, error: null })
    estado.respuestaInvoke = { data: { ok: true, id_usuario: 'u1' }, error: null }
    const r = await ServicioVinculos.crearCuenta(cuenta)
    expect(r).toEqual({ ok: true, dato: { id_usuario: 'u1', existente: false } })
    expect(estado.invocaciones).toHaveLength(1)
    expect(estado.invocaciones[0]).toMatchObject({ fn: 'crear-usuario', body: { email: cuenta.email, rol: 'Alumno' } })
    // Solo se leyó el correo antes del alta: ninguna escritura directa en usuarios
    expect(estado.llamadas.map((l) => l.destino)).toEqual(['usuarios'])
  })

  it('reintento: la cuenta Alumno ya existe y no tiene legajo → la reutiliza sin crear otra', async () => {
    programar('usuarios', { data: { id_usuario: 'u1', rol: 'Alumno', email: cuenta.email }, error: null })
    programar('alumnos', { data: [], error: null })
    const r = await ServicioVinculos.crearCuenta(cuenta)
    expect(r).toEqual({ ok: true, dato: { id_usuario: 'u1', existente: true } })
    expect(estado.invocaciones).toHaveLength(0)
  })

  it('el correo es de una cuenta ya vinculada: informa y no crea nada', async () => {
    programar('usuarios', { data: { id_usuario: 'u1', rol: 'Alumno', email: cuenta.email }, error: null })
    programar('alumnos', { data: [{ id_usuario: 'u1' }], error: null })
    const r = await ServicioVinculos.crearCuenta(cuenta)
    expect(r.ok).toBe(false)
    expect(estado.invocaciones).toHaveLength(0)
  })
})

describe('manejo de fallos del alta (respuestas de crear-usuario)', () => {
  it('sin permiso o rol no permitido: muestra el motivo y no sigue', async () => {
    estado.respuestaInvoke = { data: null, error: errorHttp(403, { ok: false, codigo: 'USR_ROL_NO_PERMITIDO' }) }
    const r = await ServicioVinculos.altaCuenta({ ...cuenta, rol: 'Admin' })
    expect(r).toEqual({ ok: false, mensaje: expect.stringContaining('las crea un Admin') })
  })

  it('el perfil no se pudo guardar: no se presenta como éxito y avisa que se deshizo', async () => {
    estado.respuestaInvoke = { data: null, error: errorHttp(500, { ok: false, codigo: 'USR_PERFIL_FALLIDO', revertido: true }) }
    const r = await ServicioVinculos.altaCuenta(cuenta)
    expect(r).toEqual({ ok: false, mensaje: expect.stringContaining('Se deshizo el alta') })
  })

  it('si no se pudo deshacer, lo dice', async () => {
    estado.respuestaInvoke = { data: null, error: errorHttp(500, { ok: false, codigo: 'USR_DOCENTE_FALLIDO', revertido: false }) }
    const r = await ServicioVinculos.altaCuenta(cuenta)
    expect(r.ok === false && r.mensaje).toMatch(/no se pudo deshacer/)
  })

  it('respuesta ok sin id: no se toma como éxito', async () => {
    estado.respuestaInvoke = { data: { ok: true }, error: null }
    const r = await ServicioVinculos.altaCuenta(cuenta)
    expect(r.ok).toBe(false)
  })

  it('el docente viaja en la misma alta (no se inserta aparte)', async () => {
    estado.respuestaInvoke = { data: { ok: true, id_usuario: 'd9' }, error: null }
    const r = await ServicioVinculos.altaCuenta({ ...cuenta, rol: 'Docente', docente: { dni: '20111222', especialidad: 'Matemática' } })
    expect(r).toEqual({ ok: true, dato: { id_usuario: 'd9' } })
    expect(estado.invocaciones[0]?.body).toMatchObject({ rol: 'Docente', docente: { dni: '20111222' } })
    expect(estado.llamadas).toHaveLength(0)
  })

  it('crearLegajoAlumno traduce el error de la base y devuelve el legajo existente en un reintento', async () => {
    programar('fn_crear_legajo_alumno', { data: null, error: { code: 'P0001', message: 'VIN_DNI_EXISTENTE|x' } })
    const datos = { nombre: 'Ana', apellido: 'Pérez', dni: '40111222', fecha_nacimiento: '2015-01-01', id_curso: '1' }
    const mal = await ServicioVinculos.crearLegajoAlumno(datos, 'u1', null)
    expect(mal).toEqual({ ok: false, mensaje: expect.stringContaining('Ya existe un legajo con ese DNI') })
    programar('fn_crear_legajo_alumno', { data: { ok: true, existente: true, id_alumno: 7, legajo: 'A00007' }, error: null })
    const bien = await ServicioVinculos.crearLegajoAlumno(datos, 'u1', null)
    expect(bien).toEqual({ ok: true, dato: { id_alumno: 7, legajo: 'A00007', existente: true } })
  })
})

describe('consultas de vínculos', () => {
  it('vinculosAlumno: una sola consulta a usuarios y separa tutor y cuenta', async () => {
    programar('usuarios', { data: [
      { id_usuario: 'p1', rol: 'Padre', email: 'p@demo.test' },
      { id_usuario: 'a1', rol: 'Alumno', email: 'a@demo.test' },
    ], error: null })
    const r = await ServicioVinculos.vinculosAlumno({ id_usuario: 'a1', id_usuario_padre: 'p1' })
    expect(r.ok && r.dato.tutor?.id_usuario).toBe('p1')
    expect(r.ok && r.dato.cuenta?.id_usuario).toBe('a1')
    expect(estado.llamadas).toHaveLength(1)
  })

  it('vinculosAlumno sin vínculos no consulta la base', async () => {
    const r = await ServicioVinculos.vinculosAlumno({ id_usuario: null, id_usuario_padre: null })
    expect(r).toEqual({ ok: true, dato: { tutor: null, cuenta: null } })
    expect(estado.llamadas).toHaveLength(0)
  })

  it('vinculosUsuario: hijos del Padre y legajo del Docente', async () => {
    programar('alumnos', { data: [{ id_alumno: 1, nombre: 'Ana', apellido: 'Pérez', dni: '1', legajo: 'A00001' }], error: null })
    const padre = await ServicioVinculos.vinculosUsuario({ id_usuario: 'p1', rol: 'Padre' })
    expect(padre).toEqual({ ok: true, dato: { tipo: 'Padre', hijos: [expect.objectContaining({ legajo: 'A00001' })] } })
    programar('docentes', { data: null, error: null })
    const docente = await ServicioVinculos.vinculosUsuario({ id_usuario: 'd1', rol: 'Docente' })
    expect(docente).toEqual({ ok: true, dato: { tipo: 'Docente', legajo: null } })
  })
})

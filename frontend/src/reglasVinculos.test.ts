import { describe, expect, it } from 'vitest'
import {
  ESTADO_VINCULO,
  buscarTutores,
  confirmacionReemplazoTutor,
  correoSugeridoAlumno,
  cuentasDisponibles,
  faltantesAlumno,
  mensajeErrorVinculo,
  planCuentaNueva,
  validarCuentaNueva,
} from './reglasVinculos'
import type { UsuarioBasico } from './reglasVinculos'

const u = (id: string, rol: string, extra: Partial<UsuarioBasico> = {}): UsuarioBasico => ({
  id_usuario: id, nombre: 'Ana', apellido: 'Pérez', email: `${id}@demo.test`, rol, activo: true, ...extra,
})

describe('roles y vínculos válidos', () => {
  it('buscarTutores solo ofrece tutores activos y nunca elige uno solo', () => {
    const usuarios = [
      u('p1', 'Padre', { apellido: 'Gómez' }),
      u('p2', 'Padre', { apellido: 'Gómez Díaz' }),
      u('p3', 'Padre', { apellido: 'Gómez', activo: false }),
      u('a1', 'Alumno', { apellido: 'Gómez' }),
      u('d1', 'Docente', { apellido: 'Gómez' }),
    ]
    // Coincidencia ambigua: devuelve las dos para que se elija, sin tildes ni mayúsculas
    expect(buscarTutores(usuarios, 'gomez').map((x) => x.id_usuario)).toEqual(['p1', 'p2'])
    expect(buscarTutores(usuarios, 'g')).toEqual([])
    expect(buscarTutores(usuarios, 'p1@demo').map((x) => x.id_usuario)).toEqual(['p1'])
  })

  it('cuentasDisponibles: del rol pedido y sin legajo', () => {
    const usuarios = [u('a1', 'Alumno'), u('a2', 'Alumno'), u('p1', 'Padre'), u('d1', 'Docente')]
    expect(cuentasDisponibles(usuarios, 'Alumno', new Set(['a1'])).map((x) => x.id_usuario)).toEqual(['a2'])
    expect(cuentasDisponibles(usuarios, 'Docente', new Set()).map((x) => x.id_usuario)).toEqual(['d1'])
  })

  it('pide confirmación solo si se reemplaza un tutor distinto', () => {
    expect(confirmacionReemplazoTutor(null, u('p1', 'Padre'))).toBeNull()
    expect(confirmacionReemplazoTutor(u('p1', 'Padre'), u('p1', 'Padre'))).toBeNull()
    expect(confirmacionReemplazoTutor(u('p1', 'Padre', { nombre: 'Luis', apellido: 'Sosa' }), u('p2', 'Padre')))
      .toBe('El alumno ya tiene como tutor a Sosa, Luis. ¿Reemplazarlo por Pérez, Ana?')
  })

  it('separa los vínculos faltantes del alumno', () => {
    expect(faltantesAlumno({ id_usuario: null, id_usuario_padre: null })).toEqual([ESTADO_VINCULO.sinTutor, ESTADO_VINCULO.sinCuenta])
    expect(faltantesAlumno({ id_usuario: 'a1', id_usuario_padre: null })).toEqual(['Sin tutor asociado'])
    expect(faltantesAlumno({ id_usuario: 'a1', id_usuario_padre: 'p1' })).toEqual([])
  })
})

describe('prevención de duplicados (cuenta nueva o reintento)', () => {
  it('sin cuenta previa: se crea', () => {
    expect(planCuentaNueva(null, 'Alumno', false)).toEqual({ accion: 'crear' })
  })
  it('cuenta Alumno libre con ese correo (intento anterior): se reutiliza, no se crea otra', () => {
    const previa = u('a1', 'Alumno')
    expect(planCuentaNueva(previa, 'Alumno', false)).toEqual({ accion: 'vincular', usuario: previa })
  })
  it('cuenta ya vinculada a otro legajo: no se reutiliza', () => {
    expect(planCuentaNueva(u('a1', 'Alumno'), 'Alumno', true).accion).toBe('error')
  })
  it('correo de otro rol: no se cambia su rol', () => {
    const plan = planCuentaNueva(u('p1', 'Padre'), 'Alumno', false)
    expect(plan).toEqual({ accion: 'error', mensaje: expect.stringContaining('rol Padre') })
  })
  it('tutor existente: se elige como existente, no se duplica ni se pisan sus datos', () => {
    const plan = planCuentaNueva(u('p1', 'Padre'), 'Padre', false)
    expect(plan.accion === 'error' && plan.mensaje).toMatch(/tutor existente/)
  })
})

describe('datos de la cuenta y mensajes', () => {
  it('valida correo y largo mínimo de la contraseña inicial', () => {
    expect(validarCuentaNueva({ email: 'mal', password: '12345678' })).toMatch(/correo/)
    expect(validarCuentaNueva({ email: 'x@demo.test', password: '1234567' })).toMatch(/8 caracteres/)
    expect(validarCuentaNueva({ email: 'x@demo.test', password: '12345678' })).toBeNull()
  })
  it('sugiere el correo de acceso de alumno solo con un DNI válido', () => {
    expect(correoSugeridoAlumno(' 40111222 ')).toBe('40111222@alumno.local')
    expect(correoSugeridoAlumno('40.111.222')).toBe('')
  })
  it('traduce los códigos de etapa23 y la falta de la migración', () => {
    expect(mensajeErrorVinculo({ message: 'VIN_CUENTA_OCUPADA|La cuenta ya esta vinculada' })).toBe('Esa cuenta ya está vinculada a otro legajo.')
    expect(mensajeErrorVinculo({ message: 'VIN_TUTOR_EXISTENTE|x' })).toMatch(/confirmá el reemplazo/)
    expect(mensajeErrorVinculo({ code: 'PGRST202' })).toMatch(/etapa23/)
    expect(mensajeErrorVinculo({ message: 'otra cosa' })).toMatch(/No se pudo completar/)
  })
})

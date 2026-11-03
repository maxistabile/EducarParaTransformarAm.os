import { describe, it, expect, vi } from 'vitest'
import {
  ErrorSesionInvalida,
  MENSAJES_ACCESO,
  destinoSegunPerfil,
  puedeVerSeccion,
  resolverSesion,
  seccionesSegunRol,
} from './reglasAuthApp'
import type { DependenciasSesion, PerfilUsuario } from './reglasAuthApp'

// Padre activo; cada prueba cambia un solo dato
const padre: PerfilUsuario = {
  id_usuario: 'u-1',
  nombre: 'Ana',
  apellido: 'Pérez',
  email: 'ana@mail.com',
  rol: 'Padre',
  activo: true,
}

function dependencias(
  cambios: Partial<DependenciasSesion> = {},
): DependenciasSesion {
  return {
    obtenerIdSesion: async () => 'u-1',
    cargarPerfil: async () => padre,
    cerrarSesion: vi.fn(async () => {}),
    ...cambios,
  }
}

describe('destinoSegunPerfil (RF10 · HU41 y HU45)', () => {
  it('un padre o un alumno activo entra a la app', () => {
    expect(destinoSegunPerfil(padre)).toEqual({ tipo: 'app', rol: 'Padre' })
    expect(destinoSegunPerfil({ ...padre, rol: 'Alumno' })).toEqual({
      tipo: 'app',
      rol: 'Alumno',
    })
  })

  it('los roles de gestión se redirigen a la web', () => {
    for (const rol of ['Admin', 'Directivo', 'Docente']) {
      expect(destinoSegunPerfil({ ...padre, rol })).toEqual({ tipo: 'web' })
    }
  })

  it('un usuario inactivo no puede ingresar', () => {
    expect(destinoSegunPerfil({ ...padre, activo: false })).toEqual({
      tipo: 'rechazado',
      mensaje: MENSAJES_ACCESO.inactivo,
    })
  })

  it('rechaza un perfil inexistente, sin rol o con un rol desconocido', () => {
    expect(destinoSegunPerfil(null)).toMatchObject({ tipo: 'rechazado' })
    expect(destinoSegunPerfil({ ...padre, rol: null })).toMatchObject({
      tipo: 'rechazado',
    })
    expect(destinoSegunPerfil({ ...padre, rol: 'Tutor' })).toMatchObject({
      tipo: 'rechazado',
    })
  })
})

describe('resolverSesion: validar una sesión existente (HU41 y HU45)', () => {
  it('sin sesión guardada no habilita nada ni cierra sesión', async () => {
    const deps = dependencias({ obtenerIdSesion: async () => null })
    expect(await resolverSesion(deps)).toEqual({
      estado: 'sin-sesion',
      aviso: null,
    })
    expect(deps.cerrarSesion).not.toHaveBeenCalled()
  })

  it('una sesión de padre activo habilita la app', async () => {
    expect(await resolverSesion(dependencias())).toEqual({
      estado: 'app',
      rol: 'Padre',
      perfil: padre,
    })
  })

  it('una sesión de gestión se manda a la web', async () => {
    const deps = dependencias({
      cargarPerfil: async () => ({ ...padre, rol: 'Docente' }),
    })
    expect(await resolverSesion(deps)).toEqual({ estado: 'web' })
  })

  it('si falta el perfil, cierra la sesión y avisa', async () => {
    const deps = dependencias({ cargarPerfil: async () => null })
    expect(await resolverSesion(deps)).toEqual({
      estado: 'sin-sesion',
      aviso: MENSAJES_ACCESO.sinPerfil,
    })
    expect(deps.cerrarSesion).toHaveBeenCalledOnce()
  })

  it('si el usuario quedó inactivo, cierra la sesión guardada', async () => {
    const deps = dependencias({
      cargarPerfil: async () => ({ ...padre, activo: false }),
    })
    expect(await resolverSesion(deps)).toEqual({
      estado: 'sin-sesion',
      aviso: MENSAJES_ACCESO.inactivo,
    })
    expect(deps.cerrarSesion).toHaveBeenCalledOnce()
  })

  it('si falla la consulta del perfil, no habilita la app ni cierra la sesión', async () => {
    const deps = dependencias({
      cargarPerfil: async () => {
        throw new Error('sin conexión')
      },
    })
    expect(await resolverSesion(deps)).toEqual({
      estado: 'error',
      mensaje: MENSAJES_ACCESO.errorValidacion,
    })
    expect(deps.cerrarSesion).not.toHaveBeenCalled()
  })

  it('si el servidor rechaza la sesión guardada, la cierra y pide ingresar de nuevo', async () => {
    const deps = dependencias({
      cargarPerfil: async () => {
        throw new ErrorSesionInvalida()
      },
    })
    expect(await resolverSesion(deps)).toEqual({
      estado: 'sin-sesion',
      aviso: MENSAJES_ACCESO.sesionVencida,
    })
    expect(deps.cerrarSesion).toHaveBeenCalledOnce()
  })

  it('aunque falle el cierre de sesión, no habilita la app', async () => {
    const deps = dependencias({
      cargarPerfil: async () => ({ ...padre, rol: 'Desconocido' }),
      cerrarSesion: async () => {
        throw new Error('sin conexión')
      },
    })
    expect(await resolverSesion(deps)).toMatchObject({ estado: 'sin-sesion' })
  })
})

describe('menú por rol (HU45)', () => {
  it('el padre ve cuotas, pagos e inscripciones', () => {
    expect(seccionesSegunRol('Padre')).toEqual([
      'inicio',
      'cuotas',
      'pagos',
      'inscripciones',
      'perfil',
    ])
  })

  it('el alumno no ve cuotas ni pagos', () => {
    expect(puedeVerSeccion('Alumno', 'inscripciones')).toBe(true)
    expect(puedeVerSeccion('Alumno', 'cuotas')).toBe(false)
    expect(puedeVerSeccion('Alumno', 'pagos')).toBe(false)
  })
})

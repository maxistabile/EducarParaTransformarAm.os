import { afterEach, describe, it, expect, vi } from 'vitest'
import {
  claveSeleccion,
  esRespuestaVigente,
  leerIdGuardado,
  nombreAlumno,
  resolverElegido,
} from './reglasAlumnoElegido'
import { borrarSelecciones, guardarSeleccion, leerSeleccion } from './sesion/seleccionAlumno'

const alumno = (id: number) => ({ id_alumno: id, nombre: `N${id}`, apellido: `A${id}`, curso: null })
const hijos = [alumno(3), alumno(7)]

describe('alumno elegido (HU59)', () => {
  it('acepta el guardado solo si está en la lista de la sesión actual', () => {
    expect(resolverElegido(hijos, 7)).toBe(7)
    // De otra cuenta o un hijo que ya no está: se descarta
    expect(resolverElegido(hijos, 99)).toBe(3)
    expect(resolverElegido(hijos, null)).toBe(3)
  })

  it('sin alumnos no elige ninguno', () => {
    expect(resolverElegido([], 3)).toBeNull()
  })

  it('el texto guardado tiene que ser un id válido', () => {
    expect(leerIdGuardado('7')).toBe(7)
    for (const malo of [null, '', 'abc', '-1', '0', '1.5', '7 ', '99999999999999999999'])
      expect(leerIdGuardado(malo)).toBeNull()
  })

  it('la clave incluye la cuenta', () => {
    expect(claveSeleccion('u-1')).not.toBe(claveSeleccion('u-2'))
  })

  it('una respuesta atrasada (otro alumno u otra cuenta) no es vigente', () => {
    const r = { cuenta: 'Padre:u-1', idAlumno: 3 }
    expect(esRespuestaVigente(r, { cuenta: 'Padre:u-1', idAlumno: 3 })).toBe(true)
    expect(esRespuestaVigente(r, { cuenta: 'Padre:u-1', idAlumno: 7 })).toBe(false)
    expect(esRespuestaVigente(r, { cuenta: 'Padre:u-2', idAlumno: 3 })).toBe(false)
    expect(esRespuestaVigente(r, { cuenta: null, idAlumno: null })).toBe(false)
  })

  it('arma el nombre visible', () => {
    expect(nombreAlumno({ nombre: 'Ana', apellido: 'Uno' })).toBe('Ana Uno')
  })
})

describe('selección guardada en sessionStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const memoria = () => {
    const datos = new Map<string, string>()
    return {
      get length() {
        return datos.size
      },
      key: (i: number) => [...datos.keys()].at(i) ?? null,
      getItem: (k: string) => datos.get(k) ?? null,
      setItem: (k: string, v: string) => {
        datos.set(k, v)
      },
      removeItem: (k: string) => {
        datos.delete(k)
      },
    }
  }

  it('guarda por cuenta y al cerrar sesión se borran todas las selecciones', () => {
    const almacen = memoria()
    almacen.setItem('otra.clave', 'x')
    vi.stubGlobal('sessionStorage', almacen)
    guardarSeleccion('u-1', 7)
    guardarSeleccion('u-2', 3)
    expect(leerSeleccion('u-1')).toBe(7)
    expect(leerSeleccion('u-2')).toBe(3)

    borrarSelecciones()

    expect(leerSeleccion('u-1')).toBeNull()
    expect(leerSeleccion('u-2')).toBeNull()
    // No toca otros datos guardados
    expect(almacen.getItem('otra.clave')).toBe('x')
  })

  it('si el almacenamiento falla, la app sigue sin selección guardada', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
      get length(): number {
        throw new Error('bloqueado')
      },
    })
    expect(leerSeleccion('u-1')).toBeNull()
    expect(() => {
      guardarSeleccion('u-1', 7)
    }).not.toThrow()
    expect(() => {
      borrarSelecciones()
    }).not.toThrow()
  })
})

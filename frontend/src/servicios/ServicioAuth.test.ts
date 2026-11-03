import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MENSAJES_ACCESO } from '../app/reglasAuthApp'

// Cliente de Supabase simulado: las pruebas no se conectan a la base
const { auth } = vi.hoisted(() => ({
  auth: {
    signOut: vi.fn(),
    signInWithPassword: vi.fn(),
  },
}))
vi.mock('../lib/supabase', () => ({ supabase: { auth } }))

import { ServicioAuth } from './ServicioAuth'

beforeEach(() => {
  // La causa se registra con console.error; se silencia y se verifica
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  auth.signOut.mockReset()
  auth.signInWithPassword.mockReset()
})

describe('ServicioAuth.cerrarSesion (HU42)', () => {
  it('cierra la sesión solo en este dispositivo', async () => {
    auth.signOut.mockResolvedValue({ error: null })
    expect(await ServicioAuth.cerrarSesion()).toEqual({ ok: true })
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(console.error).not.toHaveBeenCalled()
  })

  it('si signOut devuelve un error, avisa y registra la causa', async () => {
    const causa = new Error('respuesta inválida del servidor')
    auth.signOut.mockResolvedValue({ error: causa })
    expect(await ServicioAuth.cerrarSesion()).toEqual({
      ok: false,
      mensaje: MENSAJES_ACCESO.errorCierre,
    })
    expect(console.error).toHaveBeenCalledWith(
      '[ServicioAuth] cerrarSesion:',
      causa,
    )
  })

  it('si la promesa de signOut se rechaza, no rechaza: avisa y registra la causa', async () => {
    const causa = new TypeError('Failed to fetch')
    auth.signOut.mockRejectedValue(causa)
    await expect(ServicioAuth.cerrarSesion()).resolves.toEqual({
      ok: false,
      mensaje: MENSAJES_ACCESO.errorCierre,
    })
    expect(console.error).toHaveBeenCalledWith(
      '[ServicioAuth] cerrarSesion:',
      causa,
    )
  })
})

describe('ServicioAuth.iniciarSesion (HU41)', () => {
  it('con credenciales correctas devuelve ok', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u-1' } },
      error: null,
    })
    expect(await ServicioAuth.iniciarSesion(' ana@mail.com ', 'clave')).toEqual({
      ok: true,
    })
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@mail.com',
      password: 'clave',
    })
  })

  it('si Supabase devuelve un 400, dice que las credenciales son incorrectas', async () => {
    const causa = { status: 400, message: 'Invalid login credentials' }
    auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: causa })
    expect(await ServicioAuth.iniciarSesion('ana@mail.com', 'mal')).toEqual({
      ok: false,
      mensaje: MENSAJES_ACCESO.credenciales,
    })
    expect(console.error).toHaveBeenCalledWith('[ServicioAuth] iniciarSesion:', causa)
  })

  it('si la promesa se rechaza (sin conexión), no rechaza y no culpa a la contraseña', async () => {
    auth.signInWithPassword.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(
      ServicioAuth.iniciarSesion('ana@mail.com', 'clave'),
    ).resolves.toEqual({ ok: false, mensaje: MENSAJES_ACCESO.sinConexion })
  })
})

// HU43 · Define la contraseña nueva con el enlace recibido por correo.
//
// Abrir el enlace no consume el token: se verifica recién al guardar. Una
// vez verificado, el token ya no sirve y se quita de la barra de
// direcciones; el estado del proceso queda en memoria, en esta pantalla.
// Si la contraseña se rechaza, se reintenta sin volver a verificar. Si se
// recarga, el proceso se retoma y se puede terminar o cancelar.
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ServicioAuth } from '../../servicios/ServicioAuth'
import type { ProcesoRecuperacion } from '../../servicios/ServicioAuth'
import { MENSAJES_ACCESO } from '../reglasAuthApp'
import {
  MENSAJES_CONTRASENA,
  leerTokenEnlace,
  validarContrasenaNueva,
} from '../reglasContrasena'
import type { ResultadoContrasena } from '../reglasContrasena'
import { useSesionApp } from '../sesion/contextoSesion'
import CampoContrasena from './CampoContrasena'
import MarcoPublico from './MarcoPublico'

type Fase =
  | 'comprobando'
  | 'formulario'
  | 'pedir-enlace'
  | 'cambiada-sin-cerrar'

export default function NuevaContrasena() {
  const [parametros, setParametros] = useSearchParams()
  const navigate = useNavigate()
  const { revalidar } = useSesionApp()
  const [token] = useState(() => leerTokenEnlace(parametros))
  const proceso = useRef<ProcesoRecuperacion | null>(null)
  const [fase, setFase] = useState<Fase>(() => {
    if (token) return 'formulario'
    return ServicioAuth.hayRecuperacionPendiente()
      ? 'comprobando'
      : 'pedir-enlace'
  })
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [verificado, setVerificado] = useState(false)
  const [aviso, setAviso] = useState('')
  const [mensaje, setMensaje] = useState(
    token ? '' : MENSAJES_CONTRASENA.enlaceInvalido,
  )

  // Se recargó después de verificar: retoma el proceso de esta pestaña
  useEffect(() => {
    if (fase !== 'comprobando') return undefined
    let vigente = true
    ServicioAuth.retomarRecuperacion()
      .then((retomado) => {
        if (!vigente) return
        if (!retomado) {
          setMensaje(MENSAJES_CONTRASENA.sesionRecuperacionPerdida)
          setFase('pedir-enlace')
          return
        }
        proceso.current = retomado
        setVerificado(true)
        setMensaje('')
        setAviso(MENSAJES_CONTRASENA.recuperacionRetomada)
        setFase('formulario')
      })
      .catch(() => {
        if (!vigente) return
        setMensaje(MENSAJES_CONTRASENA.sesionRecuperacionPerdida)
        setFase('pedir-enlace')
      })
    return () => {
      vigente = false
    }
  }, [fase])

  // Al salir sin terminar se cierra la sesión de ese proceso
  useEffect(
    () => () => {
      const abierto = proceso.current
      proceso.current = null
      if (abierto) void ServicioAuth.abandonarRecuperacion(abierto)
    },
    [],
  )

  const aplicarResultado = (resultado: ResultadoContrasena) => {
    switch (resultado.estado) {
      case 'cambiada':
        proceso.current = null
        navigate('/app/ingresar', {
          replace: true,
          state: { exito: MENSAJES_CONTRASENA.recuperada },
        })
        return
      case 'cambiada-sin-cerrar':
        proceso.current = null
        revalidar()
        setFase('cambiada-sin-cerrar')
        setMensaje(resultado.mensaje)
        return
      case 'no-cambiada':
        if (resultado.pedirEnlace) {
          proceso.current = null
          setFase('pedir-enlace')
        }
        setMensaje(resultado.mensaje)
        return
      case 'incierta':
        setMensaje(resultado.mensaje)
    }
  }

  const guardarCon = (abierto: ProcesoRecuperacion) =>
    ServicioAuth.guardarContrasenaRecuperada(abierto, nueva).then(
      aplicarResultado,
    )

  const verificarYGuardar = (tokenHash: string) =>
    ServicioAuth.verificarEnlace(tokenHash).then((resultado) => {
      if (resultado.estado === 'verificado') {
        proceso.current = resultado.proceso
        setVerificado(true)
        setParametros({}, { replace: true })
        return guardarCon(resultado.proceso)
      }
      if (resultado.estado === 'invalido') setFase('pedir-enlace')
      setMensaje(resultado.mensaje)
      return undefined
    })

  const guardar = (e: FormEvent) => {
    e.preventDefault()
    const invalido = validarContrasenaNueva({ nueva, confirmacion })
    if (invalido) {
      setMensaje(invalido)
      return
    }
    if (!proceso.current && !token) return
    setEnviando(true)
    setMensaje('')
    setAviso('')
    const operacion = proceso.current
      ? guardarCon(proceso.current)
      : verificarYGuardar(token as string)
    operacion
      .catch(() => {
        // El servicio no debería rechazar: no se afirma ningún resultado
        setMensaje(MENSAJES_CONTRASENA.incierta)
      })
      .finally(() => {
        setEnviando(false)
      })
  }

  // Salida explícita: cierra la sesión de recuperación sin cambiar nada
  const cancelar = () => {
    const abierto = proceso.current
    if (!abierto) return
    setEnviando(true)
    setMensaje('')
    ServicioAuth.abandonarRecuperacion(abierto)
      .then((resultado) => {
        if (resultado.ok) {
          proceso.current = null
          navigate('/app/ingresar', { replace: true })
          return
        }
        setMensaje(resultado.mensaje)
      })
      .catch(() => {
        setMensaje(MENSAJES_ACCESO.errorCierre)
      })
      .finally(() => {
        setEnviando(false)
      })
  }

  if (fase === 'comprobando')
    return (
      <MarcoPublico titulo='Contraseña nueva'>
        <p role='status' className='text-center font-bold text-purple-700'>
          Comprobando...
        </p>
      </MarcoPublico>
    )

  if (fase === 'pedir-enlace')
    return (
      <MarcoPublico titulo='Contraseña nueva'>
        <p role='alert' className='text-sm font-bold text-red'>
          {mensaje}
        </p>
        <Link
          to='/app/recuperar'
          className='rounded-btn bg-purple-700 py-3 text-center font-bold text-white'
        >
          Pedir otro enlace
        </Link>
      </MarcoPublico>
    )

  if (fase === 'cambiada-sin-cerrar')
    return (
      <MarcoPublico titulo='Contraseña nueva'>
        <p role='alert' className='text-sm font-bold text-orange'>
          {mensaje}
        </p>
        <Link
          to='/app/perfil'
          className='rounded-btn bg-purple-700 py-3 text-center font-bold text-white'
        >
          Ir a Mi cuenta
        </Link>
      </MarcoPublico>
    )

  return (
    <MarcoPublico titulo='Contraseña nueva'>
      <form onSubmit={guardar} className='flex flex-col gap-4'>
        <CampoContrasena
          etiqueta='Contraseña nueva'
          valor={nueva}
          alCambiar={setNueva}
          autoComplete='new-password'
        />
        <CampoContrasena
          etiqueta='Repetí la contraseña nueva'
          valor={confirmacion}
          alCambiar={setConfirmacion}
          autoComplete='new-password'
        />
        <p className='text-xs text-textMuted'>Al menos 8 caracteres.</p>

        {aviso && (
          <p role='status' className='text-sm font-bold text-purpleDark'>
            {aviso}
          </p>
        )}
        {mensaje && (
          <p role='alert' className='text-sm font-bold text-red'>
            {mensaje}
          </p>
        )}

        <button
          type='submit'
          disabled={enviando}
          className='rounded-btn bg-purple-700 py-3 font-bold text-white disabled:opacity-60'
        >
          {enviando ? 'Guardando...' : 'Guardar contraseña'}
        </button>
        {verificado && (
          <button
            type='button'
            disabled={enviando}
            onClick={cancelar}
            className='py-1 text-sm font-semibold text-textMuted underline disabled:opacity-60'
          >
            Cancelar y cerrar sesión
          </button>
        )}
      </form>
    </MarcoPublico>
  )
}

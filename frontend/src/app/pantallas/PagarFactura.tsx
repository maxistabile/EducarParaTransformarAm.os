// Pagar conceptos de una factura con transferencia (RF12.4: HU54). Solo el
// padre (RutaSeccion 'cuotas' y la Edge Function "pagos").
// - Se eligen conceptos Pendientes de la factura; los En revisión, Pagados
//   y Sin cargo no se pueden elegir. El total es informativo: lo calcula
//   el servidor.
// - Archivo JPG, PNG o PDF de hasta 5 MB (RNF8). Queda "En revisión": no
//   está acreditado hasta que la administración lo aprueba.
// - Reintentos sin duplicar: el intento (clave, conceptos y huella del
//   archivo) se guarda por cuenta y factura. Si la respuesta se pierde o
//   se recarga la pantalla, se reintenta con la MISMA clave; primero se
//   pregunta al servidor si ese envío ya llegó.
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ServicioCuotas, MENSAJE_ERROR_CUOTAS } from '../../servicios/ServicioCuotas'
import type { ResultadoCuotas } from '../../servicios/ServicioCuotas'
import { ServicioPagos } from '../../servicios/ServicioPagos'
import { etiquetaEstado, fechaCorta, pesos } from '../../reglasFacturacion'
import { periodoTexto } from '../reglasCuentaAlumno'
import type { FacturaPendiente } from '../reglasCuentaAlumno'
import { validarArchivo } from '../reglasComprobante'
import { decidirIntento, resolverIntento } from '../reglasIntentoPago'
import type { ArchivoIntento, IntentoPago } from '../reglasIntentoPago'
import { borrarIntento, guardarIntento, leerIntentoGuardado } from '../sesion/intentoPago'
import { useSesionApp } from '../sesion/contextoSesion'
import { useConsultaAlumno } from '../sesion/useConsultaAlumno'
import type { Consulta } from '../sesion/useConsultaAlumno'
import MarcoConsulta, { Etiqueta, Tarjeta } from './MarcoConsulta'

const consultar: Consulta<ResultadoCuotas> = (idAlumno, permitidos, rol) =>
  ServicioCuotas.estadoDeCuenta(idAlumno, permitidos, rol)
const SI_FALLA: ResultadoCuotas = { ok: false, mensaje: MENSAJE_ERROR_CUOTAS }

async function huellaArchivo(archivo: File): Promise<ArchivoIntento> {
  const hash = await crypto.subtle.digest('SHA-256', await archivo.arrayBuffer())
  return {
    sha256: Array.from(new Uint8Array(hash), (x) => x.toString(16).padStart(2, '0')).join(''),
    nombre: archivo.name,
    tipo: archivo.type,
    tamanio: archivo.size,
  }
}

type Aviso = { tipo: 'info' | 'error'; texto: string } | null

function Formulario({ factura, idUsuario }: { factura: FacturaPendiente; idUsuario: string }) {
  const navigate = useNavigate()
  const elegibles = factura.conceptos.filter((c) => c.seleccionable)
  const [guardado, setGuardado] = useState<IntentoPago | null>(() =>
    leerIntentoGuardado(idUsuario, factura.id_factura),
  )
  const [elegidos, setElegidos] = useState<Set<number>>(() => {
    const previos = guardado?.items.filter((i) => elegibles.some((c) => c.id_item === i)) ?? []
    return new Set(previos.length ? previos : elegibles.map((c) => c.id_item))
  })
  const [archivo, setArchivo] = useState<File | null>(null)
  const [verificando, setVerificando] = useState(guardado !== null)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)
  const enCurso = useRef(false)

  // Un intento guardado: ¿ese envío ya llegó? (respuesta perdida o recarga)
  const claveGuardada = useRef(guardado?.clave ?? null)
  useEffect(() => {
    const clave = claveGuardada.current
    if (!clave) return
    let vigente = true
    void ServicioPagos.estadoClave(clave).then((r) => {
      if (!vigente) return
      setVerificando(false)
      if (!r.ok) return // sin respuesta: se conserva para reintentar
      const decision = decidirIntento({ existe: r.existe, estado_pago: r.estado })
      if (decision === 'conservar') {
        setAviso({
          tipo: 'info',
          texto:
            'Tenés un envío sin confirmar. Para reintentarlo sin duplicarlo, elegí el mismo archivo y los mismos conceptos.',
        })
        return
      }
      borrarIntento(idUsuario, factura.id_factura)
      setGuardado(null)
      if (decision === 'enviado')
        setAviso({
          tipo: 'info',
          texto: `Tu comprobante anterior ya fue recibido (${etiquetaEstado(r.estado ?? '')}). Revisalo en Pagos.`,
        })
    })
    return () => {
      vigente = false
    }
  }, [idUsuario, factura.id_factura])

  const total = elegibles
    .filter((c) => elegidos.has(c.id_item))
    .reduce((s, c) => s + c.saldo, 0)

  const cambiar = (id: number) => {
    setElegidos((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
  }

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault()
    if (enCurso.current) return // doble clic
    const items = [...elegidos]
    if (items.length === 0) {
      setAviso({ tipo: 'error', texto: 'Elegí al menos un concepto para pagar.' })
      return
    }
    const errorArchivo = validarArchivo(archivo)
    if (errorArchivo || !archivo) {
      setAviso({ tipo: 'error', texto: errorArchivo ?? 'Elegí el comprobante de la transferencia.' })
      return
    }
    enCurso.current = true
    setEnviando(true)
    setAviso(null)
    try {
      const meta = await huellaArchivo(archivo)
      // Misma solicitud: misma clave. Si cambió, una nueva (nunca al reintentar)
      const { intento } = resolverIntento(guardado, factura.id_factura, items, meta, () =>
        crypto.randomUUID(),
      )
      guardarIntento(idUsuario, intento)
      setGuardado(intento)
      const r = await ServicioPagos.registrarComprobante({
        clave: intento.clave,
        idFactura: factura.id_factura,
        items: intento.items,
        archivo,
      })
      if (r.ok) {
        borrarIntento(idUsuario, factura.id_factura)
        navigate('/app/cuotas', {
          replace: true,
          state: {
            aviso: r.yaExistia
              ? 'Ese comprobante ya había sido recibido: está en revisión.'
              : 'Comprobante enviado. Queda En revisión hasta que la administración lo apruebe.',
          },
        })
        return
      }
      if (!r.reintentable) {
        // Error definitivo: el próximo envío es una solicitud nueva
        borrarIntento(idUsuario, factura.id_factura)
        setGuardado(null)
      }
      setAviso({
        tipo: 'error',
        texto: r.reintentable
          ? `${r.mensaje} Podés reintentar: no se va a duplicar.`
          : r.mensaje,
      })
    } catch {
      setAviso({ tipo: 'error', texto: 'No pudimos leer el archivo. Elegilo de nuevo.' })
    } finally {
      enCurso.current = false
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={(ev) => void enviar(ev)}>
      <Tarjeta titulo={`${periodoTexto(factura.periodo)} · Factura ${factura.numero}`} icono='🧾'>
        <p className='mb-2 text-sm'>
          Vence el {fechaCorta(factura.vencimiento)} · Saldo {pesos(factura.saldo)}
        </p>
        <fieldset className='flex flex-col gap-2'>
          <legend className='mb-1 text-xs font-extrabold text-textMuted'>Conceptos a pagar</legend>
          {factura.conceptos.map((c) => (
            <label
              key={c.id_item}
              className={`flex items-center justify-between gap-2 rounded-input bg-appFondo p-2 text-sm ${
                c.seleccionable ? '' : 'opacity-70'
              }`}
            >
              <span className='flex items-center gap-2'>
                <input
                  type='checkbox'
                  className='h-5 w-5 accent-purple-700'
                  disabled={!c.seleccionable || enviando}
                  checked={c.seleccionable && elegidos.has(c.id_item)}
                  onChange={() => {
                    cambiar(c.id_item)
                  }}
                />
                {c.descripcion}
              </span>
              {c.seleccionable ? (
                <span>{pesos(c.saldo)}</span>
              ) : (
                <Etiqueta texto={etiquetaEstado(c.estado)} />
              )}
            </label>
          ))}
        </fieldset>
        <p className='mt-3 flex justify-between text-sm font-extrabold'>
          <span>Total a transferir</span>
          <span>{pesos(total)}</span>
        </p>
      </Tarjeta>

      <Tarjeta titulo='Comprobante de la transferencia' icono='📎'>
        <input
          type='file'
          accept='.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf'
          disabled={enviando}
          onChange={(ev) => {
            setArchivo(ev.target.files?.[0] ?? null)
            setAviso(null)
          }}
          className='w-full text-sm'
        />
        <p className='mt-2 text-xs text-textMuted'>JPG, PNG o PDF de hasta 5 MB.</p>
      </Tarjeta>

      {aviso && (
        <p
          role={aviso.tipo === 'error' ? 'alert' : 'status'}
          className={`mb-3 rounded-input px-3 py-2 text-sm font-bold ${
            aviso.tipo === 'error' ? 'bg-white text-red' : 'bg-purpleLight text-purpleDark'
          }`}
        >
          {aviso.texto}
        </p>
      )}

      <button
        type='submit'
        disabled={enviando || verificando || elegibles.length === 0}
        className='w-full rounded-btn bg-purple-700 py-3 text-sm font-bold text-white disabled:opacity-60'
      >
        {verificando ? 'Verificando un envío anterior...' : enviando ? 'Enviando...' : 'Enviar comprobante'}
      </button>
      <p className='mt-2 text-xs text-textMuted'>
        Cargar el comprobante no acredita el pago: queda En revisión hasta que la administración lo
        apruebe.
      </p>
      <Link to='/app/cuotas' className='mt-3 block text-center text-sm font-bold text-purple-700'>
        Volver a Cuotas
      </Link>
    </form>
  )
}

export default function PagarFactura() {
  const { idFactura } = useParams()
  const id = Number(idFactura)
  const consulta = useConsultaAlumno(consultar, SI_FALLA)
  const { sesion } = useSesionApp()
  const idUsuario = sesion.estado === 'app' ? sesion.perfil.id_usuario : null

  return (
    <MarcoConsulta titulo='Pagar con transferencia' consulta={consulta} cargando='Cargando la factura...'>
      {({ cuenta }) => {
        const factura = cuenta.facturasPendientes.find((f) => f.id_factura === id)
        if (!factura || !idUsuario)
          return (
            <div className='rounded-card bg-white p-4 shadow-card'>
              <p className='text-sm text-textMuted'>
                Esta factura no tiene saldo pendiente para el alumno elegido.
              </p>
              <Link to='/app/cuotas' className='mt-3 block text-sm font-bold text-purple-700'>
                Volver a Cuotas
              </Link>
            </div>
          )
        return (
          <Formulario key={`${idUsuario}-${factura.id_factura}`} factura={factura} idUsuario={idUsuario} />
        )
      }}
    </MarcoConsulta>
  )
}

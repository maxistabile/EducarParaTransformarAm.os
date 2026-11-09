// ═══════════════════════════════════════════════════════════════
//  TP METODOLOGÍA II · Parte 3 · RF12.5 y RF12.6 (HU55 y HU56)
//  Comprobantes de transferencia: ver el archivo, aprobar o rechazar con
//  motivo, y el comprobante de pago en PDF de los aprobados.
//  Admin y Directivo (ampliación de RNF7, decisión del equipo del 08/11).
//  Usa ServicioPagos (Facade): esta pantalla no consulta tablas ni
//  archivos directamente. Se actualiza sola (Realtime, patrón Observer).
// ═══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react'
import BotonDocumento from '../componentes/BotonDocumento'
import { ServicioPagos } from '../servicios/ServicioPagos'
import type { ComprobanteGestion } from '../servicios/ServicioPagos'
import type { EstadoComprobante } from '../app/reglasCuentaAlumno'
import { motivoValido } from '../app/reglasComprobante'
import { colorEstadoCobro, etiquetaEstado, nombrePeriodo, numeroFactura, pesos } from '../reglasFacturacion'

const PESTANIAS: Array<[EstadoComprobante, string]> = [
  ['En revision', 'En revisión'],
  ['Aprobado', 'Aprobados'],
  ['Rechazado', 'Rechazados'],
]

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

function Estado({ texto }: { texto: string }) {
  const color = colorEstadoCobro(texto)
  return (
    <span
      className='inline-block rounded-[20px] px-2.5 py-[3px] text-[11px] font-extrabold'
      style={{ background: `${color}1A`, color }}
    >
      {etiquetaEstado(texto)}
    </span>
  )
}

function Tarjeta({
  c,
  ocupado,
  revisar,
}: {
  c: ComprobanteGestion
  ocupado: boolean
  revisar: (c: ComprobanteGestion, aprobar: boolean, motivo: string | null) => void
}) {
  const [rechazando, setRechazando] = useState(false)
  const [motivo, setMotivo] = useState('')

  return (
    <div className='bg-white rounded-card shadow-card p-5 mb-3'>
      <div className='flex flex-wrap items-start justify-between gap-2 mb-2'>
        <div>
          <p className='text-[15px] font-extrabold text-text'>{c.alumno}</p>
          <p className='text-[12px] text-textMuted'>
            {c.curso ? `${c.curso} · ` : ''}Factura {numeroFactura(c.factura)} ·{' '}
            {nombrePeriodo(c.periodo)}
          </p>
        </div>
        <Estado texto={c.estado} />
      </div>
      <ul className='text-[13px] mb-2'>
        {c.conceptos.map((x, i) => (
          <li key={i} className='flex justify-between border-b border-border py-1'>
            <span>{x.descripcion}</span>
            <span>{pesos(x.importe)}</span>
          </li>
        ))}
        <li className='flex justify-between py-1 font-extrabold'>
          <span>Total del comprobante</span>
          <span>{pesos(c.importe)}</span>
        </li>
      </ul>
      <p className='text-[12px] text-textMuted'>
        Cargado el {fechaHora(c.fechaCarga)}
        {c.fechaRevision &&
          ` · ${c.estado === 'Aprobado' ? 'Aprobado' : 'Rechazado'} el ${fechaHora(c.fechaRevision)}`}
      </p>
      {c.estado === 'Rechazado' && c.motivo && (
        <p className='text-[13px] text-red mt-1'>
          <strong>Motivo:</strong> {c.motivo}
        </p>
      )}

      <div className='flex flex-wrap items-center gap-4 mt-3'>
        <BotonDocumento texto='Ver archivo de la transferencia' obtener={() => ServicioPagos.urlArchivo(c.id_pago)} />
        {c.estado === 'Aprobado' && (
          <BotonDocumento
            texto={c.tieneRecibo ? 'Comprobante de pago (PDF)' : 'Generar comprobante de pago (PDF)'}
            obtener={() => ServicioPagos.urlRecibo(c.id_pago)}
          />
        )}
      </div>

      {c.estado === 'En revision' && !rechazando && (
        <div className='flex flex-wrap gap-2 mt-4'>
          <button
            type='button'
            disabled={ocupado}
            onClick={() => {
              if (window.confirm(`¿Aprobar el comprobante de ${c.alumno} por ${pesos(c.importe)}? Los conceptos quedan pagados.`))
                revisar(c, true, null)
            }}
            className='px-4 py-2 rounded-btn bg-green text-white text-[13px] font-extrabold disabled:opacity-60'
          >
            {ocupado ? 'Procesando...' : 'Aprobar'}
          </button>
          <button
            type='button'
            disabled={ocupado}
            onClick={() => {
              setRechazando(true)
            }}
            className='px-4 py-2 rounded-btn border-2 border-red text-red text-[13px] font-extrabold disabled:opacity-60'
          >
            Rechazar
          </button>
        </div>
      )}
      {c.estado === 'En revision' && rechazando && (
        <div className='mt-4'>
          <label className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
            Motivo del rechazo (lo ve el padre o tutor)
          </label>
          <textarea
            value={motivo}
            onChange={(ev) => {
              setMotivo(ev.target.value)
            }}
            rows={2}
            maxLength={300}
            className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] outline-none'
          />
          <div className='flex gap-2 mt-2'>
            <button
              type='button'
              disabled={ocupado || !motivoValido(motivo)}
              onClick={() => {
                revisar(c, false, motivo.trim())
              }}
              className='px-4 py-2 rounded-btn bg-red text-white text-[13px] font-extrabold disabled:opacity-60'
            >
              {ocupado ? 'Procesando...' : 'Confirmar rechazo'}
            </button>
            <button
              type='button'
              disabled={ocupado}
              onClick={() => {
                setRechazando(false)
                setMotivo('')
              }}
              className='px-4 py-2 rounded-btn border-2 border-border text-[13px] font-extrabold'
            >
              Cancelar
            </button>
          </div>
          {!motivoValido(motivo) && (
            <p className='text-[11px] text-textMuted mt-1'>Al menos 5 caracteres.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function GestionComprobantes() {
  const [estado, setEstado] = useState<EstadoComprobante>('En revision')
  const [datos, setDatos] = useState<{
    estado: EstadoComprobante
    resultado: Awaited<ReturnType<typeof ServicioPagos.comprobantes>>
  } | null>(null)
  const [intento, setIntento] = useState(0)
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  useEffect(() => {
    let vigente = true
    void ServicioPagos.comprobantes(estado).then((resultado) => {
      if (vigente) setDatos({ estado, resultado })
    })
    return () => {
      vigente = false
    }
  }, [estado, intento])

  // Observer: un comprobante nuevo o revisado en otra sesión actualiza la lista
  const recargar = useCallback(() => {
    setIntento((n) => n + 1)
  }, [])
  useEffect(() => ServicioPagos.escucharCambios({}, recargar), [recargar])

  const revisar = (c: ComprobanteGestion, aprobar: boolean, motivo: string | null) => {
    if (ocupado !== null) return // doble clic
    setOcupado(c.id_pago)
    setAviso(null)
    void ServicioPagos.revisar(c.id_pago, aprobar, motivo).then((r) => {
      setOcupado(null)
      if (!r.ok) {
        setAviso({ ok: false, texto: r.mensaje })
      } else if (r.yaRevisado) {
        setAviso({ ok: true, texto: `El comprobante ya estaba ${r.estado === 'Aprobado' ? 'aprobado' : 'rechazado'}.` })
      } else if (aprobar) {
        setAviso({
          ok: r.recibo !== 'pendiente',
          texto:
            r.recibo === 'pendiente'
              ? `Comprobante de ${c.alumno} aprobado. No se pudo generar el PDF: generalo desde Aprobados.`
              : `Comprobante de ${c.alumno} aprobado y comprobante de pago emitido.`,
        })
      } else {
        setAviso({ ok: true, texto: `Comprobante de ${c.alumno} rechazado. El padre o tutor ve el motivo.` })
      }
      recargar()
    })
  }

  const actual = datos?.estado === estado ? datos.resultado : null

  return (
    <div>
      <div className='mb-5'>
        <h2 className='text-[22px] font-extrabold text-text'>Comprobantes de pago</h2>
        <p className='text-[13px] text-textMuted'>
          Transferencias informadas por los padres o tutores desde la app. Un comprobante en
          revisión no está acreditado: al aprobarlo, sus conceptos quedan pagados y se emite el
          comprobante de pago.
        </p>
      </div>

      <div className='flex gap-2 mb-4' role='tablist'>
        {PESTANIAS.map(([valor, texto]) => (
          <button
            key={valor}
            type='button'
            role='tab'
            aria-selected={estado === valor}
            onClick={() => {
              setEstado(valor)
              setAviso(null)
            }}
            className={`px-4 py-2 rounded-btn text-[13px] font-extrabold ${
              estado === valor ? 'bg-purple-700 text-white' : 'bg-white text-purpleDark border-2 border-border'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {aviso && (
        <p
          role='status'
          className={`mb-4 rounded-input px-4 py-3 text-[13px] font-bold ${
            aviso.ok ? 'bg-purpleLight text-purpleDark' : 'bg-white text-red border-2 border-red'
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {actual === null && <p className='text-[13px] text-textMuted'>Cargando...</p>}
      {actual && !actual.ok && (
        <div className='bg-white rounded-card shadow-card p-5'>
          <p className='text-[13px] text-red font-bold'>{actual.mensaje}</p>
          <button
            type='button'
            onClick={recargar}
            className='mt-3 px-4 py-2 rounded-btn bg-purple-700 text-white text-[13px] font-extrabold'
          >
            Reintentar
          </button>
        </div>
      )}
      {actual?.ok && actual.comprobantes.length === 0 && (
        <div className='bg-white rounded-card shadow-card p-5 text-[13px] text-textMuted'>
          No hay comprobantes en esta lista.
        </div>
      )}
      {actual?.ok &&
        actual.comprobantes.map((c) => (
          <Tarjeta key={c.id_pago} c={c} ocupado={ocupado === c.id_pago} revisar={revisar} />
        ))}
    </div>
  )
}

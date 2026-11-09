// ═══════════════════════════════════════════════════════════════
//  TP METODOLOGÍA II · Parte 3 · RF11.5 (HU50, etapa A, parcial)
//  Facturación mensual: generar y consultar facturas. Admin y Directivo.
//  Usa ServicioFacturas (Facade): esta pantalla no consulta tablas.
//  Pendiente (etapa B): generación automática el último día hábil y PDF.
// ═══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ServicioFacturas } from '../servicios/ServicioFacturas'
import type { FacturaPeriodo } from '../servicios/ServicioFacturas'
import {
  MESES,
  colorEstadoCobro,
  etiquetaEstado,
  fechaCorta,
  fechaVencimiento,
  nombrePeriodo,
  numeroFactura,
  periodoSiguiente,
  pesos,
  primerDia,
  textoResultado,
  validarPeriodo,
} from '../reglasFacturacion'
import type { Periodo } from '../reglasFacturacion'

const TH =
  'text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'
const TD = 'py-3 pr-3 border-b border-border text-[13px] align-top'
const INPUT =
  'w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
const LABEL = 'text-[11px] font-extrabold text-textMuted block mb-[5px]'

function Estado({ texto }: { texto: string }) {
  const color = colorEstadoCobro(texto)
  return (
    <span
      className='inline-block rounded-[20px] px-2.5 py-[3px] text-[11px] font-extrabold'
      style={{ background: `${color}1A`, color }}
    >
      {texto}
    </span>
  )
}

function DetalleItems({ factura }: { factura: FacturaPeriodo }) {
  return (
    <table className='w-full border-collapse mt-1 mb-2'>
      <thead>
        <tr>
          <th className={TH}>Concepto</th>
          <th className={TH}>Importe</th>
          <th className={TH}>Descuento</th>
          <th className={TH}>Neto</th>
          <th className={TH}>Estado</th>
        </tr>
      </thead>
      <tbody>
        {factura.items.map((i) => (
          <tr key={i.id_item}>
            <td className={TD}>
              {i.descripcion}
              {i.cuota_preexistente && (
                <span className='block text-[11px] text-textMuted'>
                  Cuota que ya existía: se respetó tal cual
                </span>
              )}
            </td>
            <td className={TD}>{pesos(i.importe)}</td>
            <td className={TD}>
              {i.descuento > 0 ? `– ${pesos(i.descuento)}` : '—'}
              {i.porcentaje_beca !== null && (
                <span className='block text-[11px] text-textMuted'>
                  Beca {i.porcentaje_beca} %
                </span>
              )}
            </td>
            <td className={`${TD} font-bold`}>{pesos(i.neto)}</td>
            <td className={TD}>
              <Estado texto={i.cubierta_por_beca ? 'Sin cargo' : etiquetaEstado(i.estado_pago)} />
              {i.cubierta_por_beca && (
                <span className='block text-[11px] text-textMuted'>Cubierta por beca</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function GestionFacturacion() {
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoSiguiente())
  const [anioTexto, setAnioTexto] = useState(() => String(periodoSiguiente().anio))
  const [facturas, setFacturas] = useState<FacturaPeriodo[] | null>(null)
  const [errorLista, setErrorLista] = useState('')
  const [generando, setGenerando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)
  const [abiertas, setAbiertas] = useState<Set<number>>(() => new Set())

  // Solo cambia el estado cuando llega la respuesta; la lista se vacía
  // al cambiar de período (en los manejadores, no en el efecto).
  const cargar = useCallback((p: Periodo) => {
    ServicioFacturas.listarPeriodo(p)
      .then((r) => {
        if (r.ok) {
          setFacturas(r.facturas)
          setErrorLista('')
        } else setErrorLista(r.mensaje)
      })
      .catch(() => {
        setErrorLista('No pudimos cargar las facturas. Intentá de nuevo.')
      })
  }, [])

  const validacion = validarPeriodo(periodo)
  const periodoValido = validacion.ok

  useEffect(() => {
    if (periodoValido) cargar(periodo)
  }, [cargar, periodo, periodoValido])

  const limpiar = () => {
    setResultado(null)
    setFacturas(null)
    setErrorLista('')
    setAbiertas(new Set())
  }

  const cambiarMes = (mes: number) => {
    limpiar()
    setPeriodo((p) => ({ ...p, mes }))
  }

  const cambiarAnio = (texto: string) => {
    limpiar()
    setAnioTexto(texto)
    setPeriodo((p) => ({ ...p, anio: Number(texto) }))
  }

  const generar = (e: FormEvent) => {
    e.preventDefault()
    if (!validacion.ok) {
      setResultado({ ok: false, texto: validacion.mensaje })
      return
    }
    if (
      !window.confirm(
        `¿Emitir las facturas de ${nombrePeriodo(periodo)} para los alumnos activos que todavía no la tienen? Las facturas ya emitidas no se modifican.`,
      )
    )
      return
    setGenerando(true)
    setResultado(null)
    ServicioFacturas.generarPeriodo(periodo)
      .then((r) => {
        setResultado(
          r.ok ? { ok: true, texto: textoResultado(r.resumen) } : { ok: false, texto: r.mensaje },
        )
        if (r.ok) cargar(periodo)
      })
      .catch(() => {
        setResultado({ ok: false, texto: 'No pudimos generar las facturas. Intentá de nuevo.' })
      })
      .finally(() => {
        setGenerando(false)
      })
  }

  const alternar = (id: number) => {
    setAbiertas((previas) => {
      const nuevas = new Set(previas)
      if (nuevas.has(id)) nuevas.delete(id)
      else nuevas.add(id)
      return nuevas
    })
  }

  const totalEmitido = (facturas ?? []).reduce((s, f) => s + f.total, 0)
  const saldoPendiente = (facturas ?? []).reduce((s, f) => s + f.saldo, 0)

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 6px' }}>🧾 Facturación</h2>
      <p className='text-[13px] text-textMuted mb-5'>
        Emite una factura por alumno activo con la cuota y los servicios del mes (deportes,
        transporte y comedor). La beca se aplica solo a la cuota. Si la cuota del mes ya
        existía, se respeta tal cual. Volver a generar solo agrega las facturas que faltan:
        las emitidas no se modifican. La generación automática del último día hábil y el
        PDF todavía no están disponibles.
      </p>

      <div className='bg-white rounded-card p-6 shadow-card border border-border mb-6'>
        <div className='text-[15px] font-extrabold text-text mb-4'>Generar facturas</div>
        <form onSubmit={generar} className='flex flex-wrap items-end gap-3'>
          <label className='w-[160px]'>
            <span className={LABEL}>Mes</span>
            <select
              className={`${INPUT} appearance-none`}
              value={periodo.mes}
              onChange={(ev) => {
                cambiarMes(Number(ev.target.value))
              }}
            >
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className='w-[110px]'>
            <span className={LABEL}>Año</span>
            <input
              className={INPUT}
              inputMode='numeric'
              required
              value={anioTexto}
              onChange={(ev) => {
                cambiarAnio(ev.target.value)
              }}
            />
          </label>
          <button
            type='submit'
            disabled={generando}
            className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer disabled:opacity-60'
          >
            {generando ? 'Generando...' : 'Generar facturas'}
          </button>
        </form>
        {periodoValido && (
          <p className='text-[12px] text-textMuted mt-3'>
            Vencen el {fechaCorta(fechaVencimiento(periodo))}. Se usan los valores vigentes
            al {fechaCorta(primerDia(periodo))} y los servicios activos en algún día del mes.
          </p>
        )}
        {resultado && (
          <p
            role={resultado.ok ? 'status' : 'alert'}
            className={`mt-3 text-[13px] font-bold ${resultado.ok ? 'text-green' : 'text-red'}`}
          >
            {resultado.texto}
          </p>
        )}
      </div>

      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <div className='text-[15px] font-extrabold text-text mb-1'>
          Facturas de {nombrePeriodo(periodo)}
        </div>
        <p className='text-[12px] text-textMuted mb-4'>
          El total emitido no cambia. El saldo descuenta los pagos registrados, también los
          de después de emitir. Por ahora solo se registran pagos de la cuota; los de los
          servicios llegan con los comprobantes (HU54 y HU55).
        </p>
        {!validacion.ok && <p className='text-[13px] text-textMuted'>{validacion.mensaje}</p>}
        {periodoValido && errorLista && (
          <p role='alert' className='text-[13px] font-bold text-red'>
            {errorLista}
          </p>
        )}
        {periodoValido && !errorLista && facturas === null && (
          <p className='text-[13px] text-textMuted'>Cargando...</p>
        )}
        {periodoValido && facturas?.length === 0 && (
          <p className='text-[13px] text-textMuted'>Todavía no hay facturas de este mes.</p>
        )}
        {periodoValido && facturas !== null && facturas.length > 0 && (
          <>
            <p className='text-[13px] mb-3'>
              <strong>{facturas.length}</strong> factura{facturas.length === 1 ? '' : 's'} ·
              total emitido <strong>{pesos(totalEmitido)}</strong> · saldo pendiente{' '}
              <strong>{pesos(saldoPendiente)}</strong>
            </p>
            <div className='overflow-x-auto'>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th className={TH}>Factura</th>
                    <th className={TH}>Alumno</th>
                    <th className={TH}>Total</th>
                    <th className={TH}>Cobrado</th>
                    <th className={TH}>Saldo</th>
                    <th className={TH}>Estado</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody>
                  {facturas.map((f) => (
                    <FilaFactura
                      key={f.id_factura}
                      factura={f}
                      abierta={abiertas.has(f.id_factura)}
                      alternar={alternar}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function FilaFactura({
  factura: f,
  abierta,
  alternar,
}: {
  factura: FacturaPeriodo
  abierta: boolean
  alternar: (id: number) => void
}) {
  return (
    <>
      <tr>
        <td className={TD}>
          <strong>{numeroFactura(f.id_factura)}</strong>
          <span className='block text-[11px] text-textMuted'>
            Emitida el {fechaCorta(f.fecha_emision)} · vence el{' '}
            {fechaCorta(f.fecha_vencimiento)}
          </span>
        </td>
        <td className={TD}>
          <strong>{f.alumno_nombre}</strong>
          {f.curso && <span className='block text-[11px] text-textMuted'>{f.curso}</span>}
        </td>
        <td className={`${TD} font-bold`}>{pesos(f.total)}</td>
        <td className={TD}>{pesos(f.cobrado)}</td>
        <td className={`${TD} font-extrabold text-purple-700`}>{pesos(f.saldo)}</td>
        <td className={TD}>
          <Estado texto={f.estado_cobro} />
        </td>
        <td className={`${TD} text-right`}>
          <button
            type='button'
            aria-expanded={abierta}
            onClick={() => {
              alternar(f.id_factura)
            }}
            className='text-[12px] font-bold text-purple-700 underline'
          >
            {abierta ? 'Ocultar' : `Ver ítems (${f.items.length})`}
          </button>
        </td>
      </tr>
      {abierta && (
        <tr>
          <td colSpan={7} className='pb-3'>
            <DetalleItems factura={f} />
          </td>
        </tr>
      )}
    </>
  )
}

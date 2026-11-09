// Facturas y comprobantes por período (RF13.1: HU57). Solo el padre
// (RutaSeccion y ServicioCuotas). Usa los servicios Facade: no consulta
// tablas.
// - El período filtra por FECHA DE EMISIÓN de la factura, incluidos los
//   dos días; "desde" no puede ser posterior a "hasta".
// - Cada factura muestra sus conceptos con importes y estados, y todos sus
//   comprobantes (En revisión, Aprobado o Rechazado).
// - La factura PDF y los documentos de pago se abren con URLs firmadas
//   que entrega la Edge Function después de controlar rol y pertenencia
//   (BotonDocumento valida la URL antes de navegar).
// Se actualiza sola cuando cambia un comprobante (Realtime).
import { useMemo, useState } from 'react'
import BotonDocumento from '../../componentes/BotonDocumento'
import { etiquetaEstado, fechaCorta, pesos } from '../../reglasFacturacion'
import { MENSAJE_ERROR_FACTURAS, ServicioCuotas } from '../../servicios/ServicioCuotas'
import type { ResultadoFacturas } from '../../servicios/ServicioCuotas'
import { ServicioPagos } from '../../servicios/ServicioPagos'
import { hoyLocal, periodoTexto } from '../reglasCuentaAlumno'
import { filtrarPorEmision, rangoInicial, validarRango } from '../reglasFacturasDeuda'
import type { ComprobanteFactura, FacturaDetalle } from '../reglasFacturasDeuda'
import { useConsultaAlumno } from '../sesion/useConsultaAlumno'
import type { Consulta } from '../sesion/useConsultaAlumno'
import { usePagosEnVivo } from '../sesion/usePagosEnVivo'
import MarcoConsulta, { Etiqueta, Tarjeta, Vacio } from './MarcoConsulta'
import NavFacturas from './NavFacturas'

const consultar: Consulta<ResultadoFacturas> = (idAlumno, permitidos, rol) =>
  ServicioCuotas.facturas(idAlumno, permitidos, rol)
const SI_FALLA: ResultadoFacturas = { ok: false, mensaje: MENSAJE_ERROR_FACTURAS }

/** Fecha local 'DD/MM/AAAA' de un timestamptz. */
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

function Comprobante({ c }: { c: ComprobanteFactura }) {
  const idPago = c.idPago
  return (
    <li className='rounded-input bg-appFondo p-3'>
      <div className='mb-1 flex items-start justify-between gap-2'>
        <p className='font-extrabold'>{pesos(c.importe)}</p>
        <Etiqueta texto={etiquetaEstado(c.estado)} />
      </div>
      <p className='text-sm'>
        {c.conceptos.map((x) => `${x.descripcion} (${pesos(x.importe)})`).join(', ')}
      </p>
      <p className='text-xs text-textMuted'>Transferencia · Cargado el {fechaHora(c.fechaCarga)}</p>
      {c.estado === 'Aprobado' && c.fechaRevision && (
        <p className='text-xs text-textMuted'>Aprobado el {fechaHora(c.fechaRevision)}</p>
      )}
      {c.estado === 'En revision' && (
        <p className='text-xs font-bold text-purpleDark'>Todavía no está acreditado.</p>
      )}
      {c.estado === 'Rechazado' && (
        <p className='mt-1 rounded-input bg-white px-2 py-1 text-sm text-red'>
          <strong>Rechazado{c.fechaRevision ? ` el ${fechaHora(c.fechaRevision)}` : ''}:</strong>{' '}
          {c.motivo}
        </p>
      )}
      <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1'>
        {c.estado === 'Aprobado' && (
          <BotonDocumento
            texto='Comprobante de pago (PDF)'
            obtener={() => ServicioPagos.urlRecibo(idPago)}
          />
        )}
        <BotonDocumento texto='Archivo enviado' obtener={() => ServicioPagos.urlArchivo(idPago)} />
      </div>
    </li>
  )
}

function Factura({ f }: { f: FacturaDetalle }) {
  const idFactura = f.id_factura
  return (
    <section className='mb-4 rounded-card bg-white p-4 shadow-card'>
      <div className='flex items-start justify-between gap-2'>
        <div>
          <h3 className='text-base font-extrabold text-purple-700'>
            Factura {f.numero} · {periodoTexto(f.periodo)}
          </h3>
          <p className='text-xs text-textMuted'>
            Emitida el {fechaCorta(f.emision)} · Vence el {fechaCorta(f.vencimiento)}
          </p>
        </div>
        <Etiqueta texto={f.estado} />
      </div>

      <ul className='mt-3 flex flex-col gap-1 text-sm'>
        {f.conceptos.map((c) => (
          <li key={c.id_item} className='flex items-start justify-between gap-2'>
            <span>
              {c.descripcion}
              {c.registroAdministrativo && (
                <span className='block text-xs text-textMuted'>Registro administrativo</span>
              )}
              {c.estado === 'Sin cargo' && c.cubiertaPorBeca && (
                <span className='block text-xs text-textMuted'>Cubierta por beca</span>
              )}
            </span>
            <span className='flex shrink-0 items-center gap-2'>
              <span className='font-bold'>{pesos(c.neto)}</span>
              <Etiqueta texto={etiquetaEstado(c.estado)} />
            </span>
          </li>
        ))}
      </ul>

      <dl className='mt-3 grid grid-cols-3 gap-2 rounded-input bg-appFondo p-2 text-center text-xs'>
        <div>
          <dt className='text-textMuted'>Total emitido</dt>
          <dd className='font-extrabold'>{pesos(f.total)}</dd>
        </div>
        <div>
          <dt className='text-textMuted'>Pagado</dt>
          <dd className='font-extrabold'>{pesos(f.pagado)}</dd>
        </div>
        <div>
          <dt className='text-textMuted'>Saldo</dt>
          <dd className='font-extrabold'>{pesos(f.saldo)}</dd>
        </div>
      </dl>
      {f.enRevision > 0 && (
        <p className='mt-1 text-xs font-bold text-purpleDark'>
          {pesos(f.enRevision)} del saldo tienen un comprobante en revisión (sin acreditar).
        </p>
      )}

      <div className='mt-3'>
        <BotonDocumento texto='Ver factura (PDF)' obtener={() => ServicioPagos.urlFactura(idFactura)} />
      </div>

      <h4 className='mt-4 mb-2 text-sm font-extrabold'>Comprobantes de pago</h4>
      {f.comprobantes.length === 0 ? (
        <Vacio texto='No hay comprobantes cargados para esta factura.' />
      ) : (
        <ul className='flex flex-col gap-3'>
          {f.comprobantes.map((c) => (
            <Comprobante key={c.idPago} c={c} />
          ))}
        </ul>
      )}
    </section>
  )
}

type Rango = { desde: string; hasta: string }

function Listado({
  facturas,
  rango,
  setRango,
}: {
  facturas: FacturaDetalle[]
  rango: Rango
  setRango: (cambio: (r: Rango) => Rango) => void
}) {
  const error = validarRango(rango.desde, rango.hasta)
  const lista = useMemo(
    () => (error ? [] : filtrarPorEmision(facturas, rango.desde, rango.hasta)),
    [facturas, rango, error],
  )

  return (
    <>
      <Tarjeta titulo='Período' icono='📅'>
        <div className='grid grid-cols-2 gap-2'>
          <label className='text-xs font-bold text-textMuted'>
            Desde
            <input
              type='date'
              value={rango.desde}
              max={rango.hasta || undefined}
              onChange={(e) => {
                const desde = e.target.value
                setRango((r) => ({ ...r, desde }))
              }}
              className='mt-1 w-full rounded-input border px-2 py-2 text-sm text-text'
            />
          </label>
          <label className='text-xs font-bold text-textMuted'>
            Hasta
            <input
              type='date'
              value={rango.hasta}
              min={rango.desde || undefined}
              onChange={(e) => {
                const hasta = e.target.value
                setRango((r) => ({ ...r, hasta }))
              }}
              className='mt-1 w-full rounded-input border px-2 py-2 text-sm text-text'
            />
          </label>
        </div>
        <p className='mt-2 text-xs text-textMuted'>
          Se muestran las facturas según su <strong>fecha de emisión</strong>, incluidos los dos
          días elegidos.
        </p>
        {error && (
          <p role='alert' className='mt-2 text-sm font-bold text-red'>
            {error}
          </p>
        )}
      </Tarjeta>

      {!error && facturas.length === 0 && (
        <div className='rounded-card bg-white p-4 shadow-card'>
          <Vacio texto='Todavía no hay facturas emitidas para este alumno.' />
        </div>
      )}
      {!error && facturas.length > 0 && lista.length === 0 && (
        <div className='rounded-card bg-white p-4 shadow-card'>
          <Vacio
            texto={`No hay facturas emitidas entre el ${fechaCorta(rango.desde)} y el ${fechaCorta(rango.hasta)}.`}
          />
        </div>
      )}
      {lista.map((f) => (
        <Factura key={f.id_factura} f={f} />
      ))}
    </>
  )
}

export default function Facturas() {
  const consulta = useConsultaAlumno(consultar, SI_FALLA)
  usePagosEnVivo(consulta.seleccion.elegido?.id_alumno ?? null, consulta.recargar)
  // El período se conserva al cambiar de hijo
  const [rango, setRango] = useState<Rango>(() => rangoInicial(hoyLocal()))

  return (
    <>
      <NavFacturas />
      <MarcoConsulta titulo='Facturas' consulta={consulta} cargando='Cargando facturas...'>
        {({ facturas }) => <Listado facturas={facturas} rango={rango} setRango={setRango} />}
      </MarcoConsulta>
    </>
  )
}

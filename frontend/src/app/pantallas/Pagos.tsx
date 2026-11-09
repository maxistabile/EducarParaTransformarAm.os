// Historial de pagos de cada hijo (RF12.3: HU53). Solo el padre
// (RutaSeccion y ServicioPagos). Usa ServicioPagos (Facade): no consulta
// tablas.
// - Comprobantes cargados en la app: En revisión, Aprobado (con su
//   comprobante de pago) o Rechazado (con el motivo).
// - Pagos registrados por la administración: identificados como tales,
//   sin comprobante ni fecha de aprobación.
// Se actualiza sola cuando cambia un comprobante (Realtime, HU55).
import { ServicioPagos, MENSAJE_ERROR_PAGOS } from '../../servicios/ServicioPagos'
import type { ResultadoPagos } from '../../servicios/ServicioPagos'
import { etiquetaEstado, fechaCorta, pesos } from '../../reglasFacturacion'
import { periodoTexto } from '../reglasCuentaAlumno'
import type { MovimientoPago } from '../reglasCuentaAlumno'
import { useConsultaAlumno } from '../sesion/useConsultaAlumno'
import type { Consulta } from '../sesion/useConsultaAlumno'
import { usePagosEnVivo } from '../sesion/usePagosEnVivo'
import BotonDocumento from '../../componentes/BotonDocumento'
import MarcoConsulta, { Etiqueta, Tarjeta, Vacio } from './MarcoConsulta'

const consultar: Consulta<ResultadoPagos> = (idAlumno, permitidos, rol) =>
  ServicioPagos.historial(idAlumno, permitidos, rol)
const SI_FALLA: ResultadoPagos = { ok: false, mensaje: MENSAJE_ERROR_PAGOS }

/** Fecha local 'DD/MM/AAAA' de un timestamptz. */
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

function Comprobante({ m }: { m: Extract<MovimientoPago, { tipo: 'comprobante' }> }) {
  const idPago = m.idPago
  return (
    <li className='rounded-input bg-appFondo p-3'>
      <div className='mb-1 flex items-start justify-between gap-2'>
        <p className='font-extrabold'>{pesos(m.importe)}</p>
        <Etiqueta texto={etiquetaEstado(m.estado)} />
      </div>
      <p className='text-sm'>
        {m.conceptos.join(', ')}
        {m.periodo && ` · ${periodoTexto(m.periodo)}`}
      </p>
      <p className='text-xs text-textMuted'>
        Transferencia · Factura {m.factura} · Cargado el {fechaHora(m.fechaCarga)}
      </p>
      {m.estado === 'Aprobado' && m.fechaRevision && (
        <p className='text-xs text-textMuted'>Aprobado el {fechaHora(m.fechaRevision)}</p>
      )}
      {m.estado === 'En revision' && (
        <p className='text-xs font-bold text-purpleDark'>
          La administración todavía no lo revisó: no está acreditado.
        </p>
      )}
      {m.estado === 'Rechazado' && (
        <p className='mt-1 rounded-input bg-white px-2 py-1 text-sm text-red'>
          <strong>Rechazado{m.fechaRevision ? ` el ${fechaHora(m.fechaRevision)}` : ''}:</strong>{' '}
          {m.motivo}
        </p>
      )}
      <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1'>
        {m.estado === 'Aprobado' && (
          <BotonDocumento
            texto='Descargar comprobante de pago'
            obtener={() => ServicioPagos.urlRecibo(idPago)}
          />
        )}
        <BotonDocumento texto='Ver archivo enviado' obtener={() => ServicioPagos.urlArchivo(idPago)} />
      </div>
    </li>
  )
}

function Administrativo({ m }: { m: Extract<MovimientoPago, { tipo: 'administrativo' }> }) {
  return (
    <li className='rounded-input bg-appFondo p-3'>
      <div className='mb-1 flex items-start justify-between gap-2'>
        <p className='font-extrabold'>{pesos(m.importe)}</p>
        <span className='shrink-0 rounded-full bg-purpleLight px-2 py-0.5 text-xs font-extrabold text-purpleDark'>
          {m.origen}
        </span>
      </div>
      <p className='text-sm'>Cuota de {periodoTexto(m.periodo)}</p>
      <p className='text-sm text-textMuted'>
        {m.fecha ? `Pagado el ${fechaCorta(m.fecha)}` : 'Sin fecha registrada'}
        {' · '}
        {m.metodo ?? 'Método no registrado'}
      </p>
      <p className='text-xs text-textMuted'>
        {m.factura ? `Factura ${m.factura}` : 'Sin factura asociada'} · Sin comprobante en la app
      </p>
    </li>
  )
}

export default function Pagos() {
  const consulta = useConsultaAlumno(consultar, SI_FALLA)
  usePagosEnVivo(consulta.seleccion.elegido?.id_alumno ?? null, consulta.recargar)

  return (
    <MarcoConsulta titulo='Pagos' consulta={consulta} cargando='Cargando pagos...'>
      {({ pagos }) => (
        <Tarjeta titulo='Historial de pagos' icono='📒'>
          <p className='mb-2 text-xs text-textMuted'>
            Comprobantes de transferencia cargados en la app y pagos registrados por la
            administración. Un comprobante en revisión todavía no está acreditado.
          </p>
          {pagos.length === 0 ? (
            <Vacio texto='No hay pagos registrados.' />
          ) : (
            <ul className='flex flex-col gap-3'>
              {pagos.map((m) =>
                m.tipo === 'comprobante' ? (
                  <Comprobante key={m.clave} m={m} />
                ) : (
                  <Administrativo key={m.clave} m={m} />
                ),
              )}
            </ul>
          )}
        </Tarjeta>
      )}
    </MarcoConsulta>
  )
}

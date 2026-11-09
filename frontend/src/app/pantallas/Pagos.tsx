// Historial de pagos de cada hijo (RF12.3: HU53 parcial). Solo el padre
// (RutaSeccion y ServicioPagos). Usa ServicioPagos (Facade): no consulta
// tablas.
// Por ahora solo hay pagos registrados por la administración. Los
// comprobantes y los estados En revisión y Rechazado llegan con HU54 y
// HU55: acá no se muestran ni se simulan.
import { ServicioPagos, MENSAJE_ERROR_PAGOS } from '../../servicios/ServicioPagos'
import type { ResultadoPagos } from '../../servicios/ServicioPagos'
import { fechaCorta, pesos } from '../../reglasFacturacion'
import { periodoTexto } from '../reglasCuentaAlumno'
import { useConsultaAlumno } from '../sesion/useConsultaAlumno'
import type { Consulta } from '../sesion/useConsultaAlumno'
import MarcoConsulta, { Tarjeta, Vacio } from './MarcoConsulta'

const consultar: Consulta<ResultadoPagos> = (idAlumno, permitidos, rol) =>
  ServicioPagos.historial(idAlumno, permitidos, rol)
const SI_FALLA: ResultadoPagos = { ok: false, mensaje: MENSAJE_ERROR_PAGOS }

export default function Pagos() {
  const consulta = useConsultaAlumno(consultar, SI_FALLA)

  return (
    <MarcoConsulta titulo='Pagos' consulta={consulta} cargando='Cargando pagos...'>
      {({ pagos }) => (
        <Tarjeta titulo='Historial de pagos' icono='📒'>
          <p className='mb-2 text-xs text-textMuted'>
            Pagos registrados por la administración. La carga de comprobantes todavía no está
            disponible en la app.
          </p>
          {pagos.length === 0 ? (
            <Vacio texto='No hay pagos registrados.' />
          ) : (
            <ul className='flex flex-col gap-3'>
              {pagos.map((p) => (
                <li key={p.clave} className='rounded-input bg-appFondo p-3'>
                  <div className='mb-1 flex items-start justify-between gap-2'>
                    <p className='font-extrabold'>{pesos(p.importe)}</p>
                    <span className='shrink-0 rounded-full bg-purpleLight px-2 py-0.5 text-xs font-extrabold text-purpleDark'>
                      {p.origen}
                    </span>
                  </div>
                  <p className='text-sm'>Cuota de {periodoTexto(p.periodo)}</p>
                  <p className='text-sm text-textMuted'>
                    {p.fecha ? `Pagado el ${fechaCorta(p.fecha)}` : 'Sin fecha registrada'}
                    {' · '}
                    {p.metodo ?? 'Método no registrado'}
                  </p>
                  <p className='text-xs text-textMuted'>
                    {p.factura ? `Factura ${p.factura}` : 'Sin factura asociada'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      )}
    </MarcoConsulta>
  )
}

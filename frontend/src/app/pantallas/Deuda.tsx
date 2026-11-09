// Deuda por ítem y mes (RF13.2: HU58). Solo el padre (RutaSeccion y
// ServicioCuotas). Usa los servicios Facade: no consulta tablas.
// - Agrupada por concepto: la cuota, cada deporte, cada recorrido de
//   transporte y el comedor, con el saldo de cada mes.
// - El total es la suma de los saldos pendientes. Un comprobante En
//   revisión todavía no acredita: su importe sigue en el total.
// - Las cuotas anteriores sin factura se cuentan una sola vez; los
//   conceptos Sin cargo no son deuda.
// Se actualiza sola cuando cambia un comprobante (Realtime).
import { etiquetaEstado, pesos } from '../../reglasFacturacion'
import { MENSAJE_ERROR_DEUDA, ServicioCuotas } from '../../servicios/ServicioCuotas'
import type { ResultadoDeuda } from '../../servicios/ServicioCuotas'
import { periodoTexto } from '../reglasCuentaAlumno'
import type { DeudaPorItem, GrupoDeuda } from '../reglasFacturasDeuda'
import { useConsultaAlumno } from '../sesion/useConsultaAlumno'
import type { Consulta } from '../sesion/useConsultaAlumno'
import { usePagosEnVivo } from '../sesion/usePagosEnVivo'
import MarcoConsulta, { Etiqueta, Tarjeta, Vacio } from './MarcoConsulta'
import NavFacturas from './NavFacturas'

const consultar: Consulta<ResultadoDeuda> = (idAlumno, permitidos, rol) =>
  ServicioCuotas.deudaPorItem(idAlumno, permitidos, rol)
const SI_FALLA: ResultadoDeuda = { ok: false, mensaje: MENSAJE_ERROR_DEUDA }

function icono(concepto: GrupoDeuda['concepto']): string {
  switch (concepto) {
    case 'Cuota':
      return '💳'
    case 'Deporte':
      return '⚽'
    case 'Recorrido':
      return '🚌'
    case 'Comedor':
      return '🍽️'
  }
}

function Grupo({ g }: { g: GrupoDeuda }) {
  return (
    <Tarjeta titulo={g.descripcion} icono={icono(g.concepto)}>
      <ul className='flex flex-col gap-2'>
        {g.renglones.map((r) => (
          <li key={r.clave} className='flex items-start justify-between gap-2 text-sm'>
            <span>
              <span className='font-bold'>{periodoTexto(r.periodo)}</span>
              <span className='block text-xs text-textMuted'>
                {r.factura ? `Factura ${r.factura}` : 'Cuota anterior, sin factura'} · Importe{' '}
                {pesos(r.neto)}
              </span>
            </span>
            <span className='flex shrink-0 flex-col items-end gap-1'>
              <span className='font-extrabold'>{pesos(r.saldo)}</span>
              <Etiqueta texto={etiquetaEstado(r.estado)} />
            </span>
          </li>
        ))}
      </ul>
      <p className='mt-3 flex justify-between border-t pt-2 text-sm font-extrabold'>
        <span>Saldo de este concepto</span>
        <span>{pesos(g.saldo)}</span>
      </p>
    </Tarjeta>
  )
}

function Resumen({ deuda }: { deuda: DeudaPorItem }) {
  return (
    <Tarjeta titulo='Total adeudado' icono='🧮'>
      <p className='text-2xl font-extrabold'>{pesos(deuda.total)}</p>
      <p className='mt-1 text-xs text-textMuted'>
        Suma de los saldos pendientes de todos los conceptos y meses.
      </p>
      {deuda.enRevision > 0 && (
        <p className='mt-2 text-xs font-bold text-purpleDark'>
          Incluye {pesos(deuda.enRevision)} con un comprobante en revisión: todavía no está
          acreditado.
        </p>
      )}
      {deuda.sinCargo > 0 && (
        <p className='mt-1 text-xs text-textMuted'>
          Los conceptos sin cargo ({deuda.sinCargo}) no se cuentan como deuda.
        </p>
      )}
    </Tarjeta>
  )
}

export default function Deuda() {
  const consulta = useConsultaAlumno(consultar, SI_FALLA)
  usePagosEnVivo(consulta.seleccion.elegido?.id_alumno ?? null, consulta.recargar)

  return (
    <>
      <NavFacturas />
      <MarcoConsulta titulo='Deuda por ítem' consulta={consulta} cargando='Cargando la deuda...'>
        {({ deuda }) =>
          deuda.grupos.length === 0 ? (
            <div className='rounded-card bg-white p-4 shadow-card'>
              <Vacio texto='No hay conceptos facturados para este alumno.' />
            </div>
          ) : (
            <>
              <Resumen deuda={deuda} />
              {deuda.grupos.map((g) => (
                <Grupo key={g.clave} g={g} />
              ))}
            </>
          )
        }
      </MarcoConsulta>
    </>
  )
}

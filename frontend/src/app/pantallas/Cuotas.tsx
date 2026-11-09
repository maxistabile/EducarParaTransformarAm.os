// Cuotas de cada hijo (RF12.1 y RF12.2: HU51 y HU52). Solo el padre
// (RutaSeccion y ServicioCuotas). Usa ServicioCuotas y ServicioPagos
// (Facade): no consulta tablas.
// - Pendientes: facturas con saldo (vistas de etapa17 y etapa18) y, aparte,
//   las cuotas heredadas sin factura. Las vencidas se destacan. Desde cada
//   factura se pagan sus conceptos pendientes (HU54).
// - Pagadas: con comprobante aprobado (fecha de aprobación y comprobante
//   de pago) o registradas por la administración (fecha de pago
//   registrada, sin comprobante).
// - Sin cargo: neto 0. No es deuda ni dinero cobrado.
// Se actualiza sola cuando cambia un comprobante (Realtime, HU55).
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ServicioPagos } from '../../servicios/ServicioPagos'
import { ServicioCuotas, MENSAJE_ERROR_CUOTAS } from '../../servicios/ServicioCuotas'
import type { ResultadoCuotas } from '../../servicios/ServicioCuotas'
import { etiquetaEstado, fechaCorta, pesos } from '../../reglasFacturacion'
import { periodoTexto } from '../reglasCuentaAlumno'
import type {
  CuotaHeredada,
  CuotaPagada,
  ConceptoSinCargo,
  EstadoDeCuenta,
  FacturaPendiente,
} from '../reglasCuentaAlumno'
import { useConsultaAlumno } from '../sesion/useConsultaAlumno'
import type { Consulta } from '../sesion/useConsultaAlumno'
import { usePagosEnVivo } from '../sesion/usePagosEnVivo'
import BotonDocumento from '../../componentes/BotonDocumento'
import MarcoConsulta, { Etiqueta, Tarjeta, Vacio } from './MarcoConsulta'

const consultar: Consulta<ResultadoCuotas> = (idAlumno, permitidos, rol) =>
  ServicioCuotas.estadoDeCuenta(idAlumno, permitidos, rol)
const SI_FALLA: ResultadoCuotas = { ok: false, mensaje: MENSAJE_ERROR_CUOTAS }

type Vista = 'pendientes' | 'pagadas' | 'sinCargo'

function Fila({ etiqueta, children, fuerte }: { etiqueta: string; children: ReactNode; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 text-sm ${fuerte ? 'font-extrabold' : ''}`}>
      <span className={fuerte ? '' : 'text-textMuted'}>{etiqueta}</span>
      <span className='text-right'>{children}</span>
    </div>
  )
}

function Renglon({ vencida, children }: { vencida?: boolean; children: ReactNode }) {
  return (
    <li
      className={`rounded-input bg-appFondo p-3 ${vencida ? 'border-l-4 border-red' : ''}`}
    >
      {children}
    </li>
  )
}

function Encabezado({ titulo, estado }: { titulo: string; estado: string }) {
  return (
    <div className='mb-1 flex items-start justify-between gap-2'>
      <p className='font-extrabold'>{titulo}</p>
      <Etiqueta texto={estado} />
    </div>
  )
}

function Factura({ f }: { f: FacturaPendiente }) {
  return (
    <Renglon vencida={f.vencida}>
      <Encabezado titulo={periodoTexto(f.periodo)} estado={f.estado} />
      <p className='mb-2 text-xs text-textMuted'>Factura {f.numero}</p>
      <p className={`mb-2 text-sm ${f.vencida ? 'font-extrabold text-red' : ''}`}>
        {f.vencida ? 'Venció' : 'Vence'} el {fechaCorta(f.vencimiento)}
      </p>
      <Fila etiqueta='Total emitido'>{pesos(f.totalEmitido)}</Fila>
      {f.pagado > 0 && <Fila etiqueta='Pagado'>{pesos(f.pagado)}</Fila>}
      {f.enRevision > 0 && (
        <Fila etiqueta='En revisión (sin acreditar)'>{pesos(f.enRevision)}</Fila>
      )}
      <Fila etiqueta='Saldo a pagar' fuerte>
        {pesos(f.saldo)}
      </Fila>
      <ul className='mt-3 flex flex-col gap-1 border-t border-border pt-2'>
        {f.conceptos.map((c) => (
          <li key={c.id_item} className='flex items-center justify-between gap-2 text-sm'>
            <span>
              {c.descripcion}
              {c.beca !== null && c.beca < 100 && (
                <span className='text-xs text-textMuted'> · beca {c.beca} %</span>
              )}
            </span>
            <span className='flex items-center gap-2'>
              {pesos(c.neto)}
              <Etiqueta texto={etiquetaEstado(c.estado)} />
            </span>
          </li>
        ))}
      </ul>
      {f.conceptos.some((c) => c.seleccionable) && (
        <Link
          to={`/app/cuotas/pagar/${f.id_factura}`}
          className='mt-3 block w-full rounded-btn bg-purple-700 py-2.5 text-center text-sm font-bold text-white'
        >
          Pagar con transferencia
        </Link>
      )}
    </Renglon>
  )
}

function Heredada({ c }: { c: CuotaHeredada }) {
  return (
    <Renglon vencida={c.vencida}>
      <Encabezado titulo={`Cuota de ${periodoTexto(c.periodo)}`} estado={c.estado} />
      {c.vencimiento && (
        <p className={`text-sm ${c.vencida ? 'font-extrabold text-red' : ''}`}>
          {c.vencida ? 'Venció' : 'Vence'} el {fechaCorta(c.vencimiento)}
        </p>
      )}
      <Fila etiqueta='Importe a pagar' fuerte>
        {pesos(c.importe)}
      </Fila>
    </Renglon>
  )
}

function Pendientes({ cuenta }: { cuenta: EstadoDeCuenta }) {
  const { facturasPendientes, cuotasHeredadas, saldoPendiente } = cuenta
  if (facturasPendientes.length === 0 && cuotasHeredadas.length === 0)
    return (
      <Tarjeta titulo='Pendientes' icono='✅'>
        <Vacio texto='No hay cuotas pendientes.' />
      </Tarjeta>
    )

  return (
    <>
      <section className='mb-4 rounded-card bg-purple-700 p-4 text-white shadow-card'>
        <p className='text-xs font-bold uppercase opacity-80'>Saldo pendiente</p>
        <p className='text-2xl font-extrabold'>{pesos(saldoPendiente)}</p>
        <p className='text-xs opacity-80'>Suma de lo que falta pagar de cada factura y cuota.</p>
        {cuenta.enRevision > 0 && (
          <p className='mt-1 text-xs font-bold'>
            Incluye {pesos(cuenta.enRevision)} con comprobante en revisión: se descuenta al
            aprobarse.
          </p>
        )}
      </section>

      {facturasPendientes.length > 0 && (
        <Tarjeta titulo='Facturas con saldo' icono='🧾'>
          <ul className='flex flex-col gap-3'>
            {facturasPendientes.map((f) => (
              <Factura key={f.id_factura} f={f} />
            ))}
          </ul>
        </Tarjeta>
      )}

      {cuotasHeredadas.length > 0 && (
        <Tarjeta titulo='Cuotas sin factura' icono='📄'>
          <p className='mb-2 text-xs text-textMuted'>
            Cuotas emitidas antes de la factura mensual. No están incluidas en ninguna factura: para
            pagarlas, comunicate con la administración.
          </p>
          <ul className='flex flex-col gap-3'>
            {cuotasHeredadas.map((c) => (
              <Heredada key={c.id_cuota} c={c} />
            ))}
          </ul>
        </Tarjeta>
      )}
    </>
  )
}

function Pagada({ p }: { p: CuotaPagada }) {
  const conComprobante = p.origen === 'Comprobante'
  const idPago = p.idPago
  return (
    <Renglon>
      <Encabezado titulo={`Cuota de ${periodoTexto(p.periodo)}`} estado='Pagada' />
      <p className='mb-1 text-xs font-bold text-textMuted'>
        {conComprobante ? 'Transferencia aprobada' : 'Registro administrativo'}
      </p>
      <Fila etiqueta='Importe pagado'>{pesos(p.importe)}</Fila>
      <Fila etiqueta={conComprobante ? 'Fecha de aprobación' : 'Fecha de pago registrada'}>
        {p.fecha ? fechaCorta(p.fecha) : 'Sin fecha registrada'}
      </Fila>
      <Fila etiqueta='Método'>{p.metodo ?? 'No registrado'}</Fila>
      <Fila etiqueta='Factura'>{p.factura ?? 'Sin factura'}</Fila>
      {conComprobante && idPago !== null && (
        <div className='mt-2'>
          <BotonDocumento
            texto='Descargar comprobante de pago'
            obtener={() => ServicioPagos.urlRecibo(idPago)}
          />
        </div>
      )}
    </Renglon>
  )
}

function Pagadas({ pagadas }: { pagadas: CuotaPagada[] }) {
  return (
    <Tarjeta titulo='Cuotas pagadas' icono='💳'>
      <p className='mb-2 text-xs text-textMuted'>
        Las transferencias aprobadas tienen su comprobante de pago. Los pagos registrados por la
        administración figuran como tales, sin comprobante.
      </p>
      {pagadas.length === 0 ? (
        <Vacio texto='No hay cuotas pagadas.' />
      ) : (
        <ul className='flex flex-col gap-3'>
          {pagadas.map((p) => (
            <Pagada key={p.clave} p={p} />
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}

function SinCargo({ conceptos }: { conceptos: ConceptoSinCargo[] }) {
  return (
    <Tarjeta titulo='Sin cargo' icono='🎓'>
      <p className='mb-2 text-xs text-textMuted'>
        Conceptos sin importe a pagar. No se cuentan como deuda ni como pagos.
      </p>
      {conceptos.length === 0 ? (
        <Vacio texto='No hay conceptos sin cargo.' />
      ) : (
        <ul className='flex flex-col gap-3'>
          {conceptos.map((s) => (
            <Renglon key={s.clave}>
              <Encabezado
                titulo={`${s.descripcion} · ${periodoTexto(s.periodo)}`}
                estado={s.cubiertaPorBeca ? 'Cubierta por beca' : 'Sin cargo'}
              />
              <p className='text-xs text-textMuted'>
                {s.factura ? `Factura ${s.factura}` : 'Sin factura'}
              </p>
            </Renglon>
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}

function Pestanias({
  vista,
  cambiar,
  cuenta,
}: {
  vista: Vista
  cambiar: (v: Vista) => void
  cuenta: EstadoDeCuenta
}) {
  const opciones: Array<[Vista, string, number]> = [
    ['pendientes', 'Pendientes', cuenta.facturasPendientes.length + cuenta.cuotasHeredadas.length],
    ['pagadas', 'Pagadas', cuenta.pagadas.length],
    ['sinCargo', 'Sin cargo', cuenta.sinCargo.length],
  ]
  return (
    <div role='tablist' className='mb-4 grid grid-cols-3 gap-1 rounded-btn bg-purpleLight p-1'>
      {opciones.map(([valor, texto, cantidad]) => (
        <button
          key={valor}
          type='button'
          role='tab'
          aria-selected={vista === valor}
          onClick={() => {
            cambiar(valor)
          }}
          className={`rounded-btn px-1 py-2 text-xs font-extrabold ${
            vista === valor ? 'bg-white text-purple-700 shadow-card' : 'text-purpleDark'
          }`}
        >
          {texto} ({cantidad})
        </button>
      ))}
    </div>
  )
}

export default function Cuotas() {
  const consulta = useConsultaAlumno(consultar, SI_FALLA)
  const [vista, setVista] = useState<Vista>('pendientes')
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso
  usePagosEnVivo(consulta.seleccion.elegido?.id_alumno ?? null, consulta.recargar)

  return (
    <MarcoConsulta titulo='Cuotas' consulta={consulta} cargando='Cargando cuotas...'>
      {({ cuenta }) => (
        <>
          {aviso && (
            <p
              role='status'
              className='mb-3 rounded-input bg-purpleLight px-3 py-2 text-sm font-bold text-purpleDark'
            >
              {aviso}
            </p>
          )}
          <Pestanias vista={vista} cambiar={setVista} cuenta={cuenta} />
          {vista === 'pendientes' && <Pendientes cuenta={cuenta} />}
          {vista === 'pagadas' && <Pagadas pagadas={cuenta.pagadas} />}
          {vista === 'sinCargo' && <SinCargo conceptos={cuenta.sinCargo} />}
        </>
      )}
    </MarcoConsulta>
  )
}

// ═══════════════════════════════════════════════════════════════
//  TP METODOLOGÍA II · Parte 3 · RF15 — Listados de pagos (HU62 a HU66)
//  Admin y Directivo. Usa ServicioListadosPagos (Facade): esta pantalla no
//  consulta tablas. La lógica está en reglasListadosPagos.ts.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ServicioListadosPagos } from '../servicios/ServicioListadosPagos'
import type { ResultadoListados } from '../servicios/ServicioListadosPagos'
import { colorEstadoCobro, pesos } from '../reglasFacturacion'
import { hoyLocal } from '../app/reglasCuentaAlumno'
import { tablaACSV } from '../reportes'
import type { TablaReporte } from '../reportes'
import {
  SIN_INSCRIPCION,
  listadoDeportes,
  listadoFacturas,
  listadoIngresos,
  listadoRecorridos,
  tablaFacturas,
  tablaIngresos,
  tablaItems,
  textoPeriodo,
  validarRangoDias,
  validarRangoMeses,
} from '../reglasListadosPagos'
import type { DatosListados, ListadoFacturas, ListadoItems } from '../reglasListadosPagos'

type Tipo = 'ingresos' | 'completas' | 'incompletas' | 'deportes' | 'recorridos'

const TIPOS: ReadonlyArray<{ key: Tipo; label: string; nota: string }> = [
  { key: 'ingresos', label: 'Ingresos por período (HU62)', nota: 'Solo lo acreditado: comprobantes aprobados (por su fecha de aprobación) y pagos registrados por la administración (por su fecha de pago). En revisión, Rechazado y Sin cargo no son ingresos.' },
  { key: 'completas', label: 'Pagos completos (HU63)', nota: 'Facturas del período facturado elegido, pagadas en su totalidad. Se agrupan una sola vez por el "Año de última acreditación": el año en que quedó saldada (fecha de aprobación del comprobante o fecha de pago registrada por la administración). Si algún pago no tiene fecha, figura "Sin fecha registrada". "Año de cursado" sale del curso copiado en la factura.' },
  { key: 'incompletas', label: 'Pagos incompletos (HU64)', nota: 'Facturas del período facturado elegido con pago parcial o sin pago, con su saldo. Se agrupan una sola vez por el "Año de última acreditación" de lo ya pagado ("Sin pagos" si no tienen ninguno; "Sin fecha registrada" si algún pago no tiene fecha). Lo que está en revisión todavía no cuenta como pagado.' },
  { key: 'deportes', label: 'Pagos por deporte, nivel, horario y profesor (HU65)', nota: 'Ítems de deporte facturados. El grupo es el de la inscripción vigente en ese mes. Nivel, horario y profesor son los datos ACTUALES de ese grupo (no una foto de aquel momento); si falta un dato, se indica.' },
  { key: 'recorridos', label: 'Pagos por recorrido de transporte (HU66)', nota: 'Ítems de transporte facturados: solo alumnos inscriptos al transporte en el mes facturado. El recorrido se muestra como figura en la factura (si después se renombró, no cambia); el filtro usa el recorrido, por su nombre actual.' },
]
const ESTADOS = ['Pagado', 'Registro administrativo', 'En revisión', 'Pendiente', 'Sin cargo']

const TH = 'text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'
const TD = 'py-2.5 pr-3 border-b border-border text-[13px] align-top'
const INPUT = 'w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
const LABEL = 'text-[11px] font-extrabold text-textMuted block mb-[5px]'

const SI_FALLA: ResultadoListados = { ok: false, mensaje: 'No pudimos cargar los datos de los listados.' }

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className='block min-w-[160px] flex-1'>
      <span className={LABEL}>{etiqueta}</span>
      {children}
    </label>
  )
}

function Seleccion({ valor, alCambiar, todos, opciones }: {
  valor: string
  alCambiar: (v: string) => void
  todos: string
  opciones: Array<{ value: string; label: string }>
}) {
  return (
    <select className={`${INPUT} appearance-none`} value={valor} onChange={(e) => {
      alCambiar(e.target.value)
    }}>
      <option value=''>{todos}</option>
      {opciones.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function Totales({ datos }: { datos: Array<[string, string]> }) {
  return (
    <div className='mb-4 flex flex-wrap gap-3'>
      {datos.map(([t, v]) => (
        <div key={t} className='rounded-card bg-white px-4 py-3 shadow-card'>
          <div className={LABEL}>{t}</div>
          <div className='text-[16px] font-extrabold'>{v}</div>
        </div>
      ))}
    </div>
  )
}

function Tabla({ t }: { t: TablaReporte }) {
  return (
    <div className='overflow-x-auto'>
      <table className='w-full border-collapse'>
        <thead>
          <tr>{t.columnas.map((c) => <th key={c} className={TH}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {t.filas.map((fila, n) => (
            <tr key={`${n}-${fila.join('|')}`} className={n === t.filas.length - 1 ? 'font-extrabold' : ''}>
              {fila.map((celda, i) => {
                const color = t.columnas.at(i)?.startsWith('Estado') ? colorEstadoCobro(celda.replace(' (vencida)', '')) : undefined
                return (
                  <td key={`${i}-${celda}`} className={TD} style={color && celda ? { color, fontWeight: 800 } : undefined}>
                    {celda}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function descargar(t: TablaReporte, nombre: string) {
  const url = URL.createObjectURL(new Blob([tablaACSV(t)], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombre}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function GestionListadosPagos() {
  const hoy = hoyLocal()
  const anio = hoy.slice(0, 4)
  const [resultado, setResultado] = useState<ResultadoListados | null>(null)
  const [tipo, setTipo] = useState<Tipo>('ingresos')
  // Rangos: días para ingresos; meses (AAAA-MM) para los demás
  const [dias, setDias] = useState({ desde: `${hoy.slice(0, 7)}-01`, hasta: hoy })
  const [meses, setMeses] = useState({ desde: `${anio}-01`, hasta: hoy.slice(0, 7) })
  const [f, setF] = useState<ReadonlyMap<string, string>>(new Map())

  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let vigente = true
    ServicioListadosPagos.cargar().then(
      (r) => {
        if (vigente) setResultado(r)
      },
      () => {
        if (vigente) setResultado(SI_FALLA)
      },
    )
    return () => {
      vigente = false
    }
  }, [intento])
  const cargar = () => {
    setResultado(null)
    setIntento((n) => n + 1)
  }

  const filtro = (k: string) => (v: string) => {
    setF((p) => new Map(p).set(k, v))
  }
  const val = (k: string) => f.get(k) ?? ''
  const datos: DatosListados | null = resultado?.ok ? resultado.datos : null
  const error = tipo === 'ingresos' ? validarRangoDias(dias.desde, dias.hasta) : validarRangoMeses(meses.desde, meses.hasta)
  const info = TIPOS.find((t) => t.key === tipo)

  const armarVista = () => {
    if (!datos || error) return null
    switch (tipo) {
      case 'ingresos': {
        const origen = f.get('origen')
        const l = listadoIngresos(datos, {
          desde: dias.desde,
          hasta: dias.hasta,
          origen: origen === 'Comprobante' || origen === 'Registro administrativo' ? origen : '',
        })
        return { tabla: tablaIngresos(l), extra: l }
      }
      case 'completas':
      case 'incompletas': {
        const l = listadoFacturas(datos, tipo, { ...meses, anioAcreditacion: f.get('anioAcreditacion'), anioCursado: f.get('anioCursado') }, hoy)
        return { tabla: tablaFacturas(l), extra: l }
      }
      case 'deportes': {
        const l = listadoDeportes(datos, {
          ...meses,
          id_actividad: f.get('id_actividad'),
          nivel: f.get('nivel'),
          id_grupo: f.get('id_grupo'),
          id_docente: f.get('id_docente'),
          estado: f.get('estado'),
        })
        return { tabla: tablaItems(l, 'deporte'), extra: l }
      }
      case 'recorridos': {
        const l = listadoRecorridos(datos, { ...meses, id_recorrido: f.get('id_recorrido'), estado: f.get('estado') })
        return { tabla: tablaItems(l, 'recorrido'), extra: l }
      }
    }
  }
  const vista = armarVista()

  // Opciones de los filtros de deportes, a partir de los grupos
  const grupos = datos?.grupos ?? []
  const deportes = [...new Map(grupos.map((g) => [String(g.id_actividad), g.actividades_extracurriculares?.nombre ?? 'Deporte'])).entries()]
    .map(([value, label]) => ({ value, label }))
  const niveles = [...new Set([...grupos.map((g) => g.nivel), SIN_INSCRIPCION])].map((n) => ({ value: n, label: n }))
  const horarios = grupos
    .filter((g) => !val('id_actividad') || String(g.id_actividad) === val('id_actividad'))
    .map((g) => ({ value: String(g.id_grupo), label: `${g.actividades_extracurriculares?.nombre ?? 'Deporte'} · ${g.nivel} · ${g.dias.join(', ')} ${g.hora_inicio.slice(0, 5)}` }))
  const profesores = [...new Map(grupos.map((g) => [String(g.id_docente), g.docentes?.usuarios ? `${g.docentes.usuarios.apellido}, ${g.docentes.usuarios.nombre}` : `Docente ${g.id_docente}`])).entries()]
    .map(([value, label]) => ({ value, label }))
  const recorridos = (datos?.recorridos ?? []).map((r) => ({ value: String(r.id_recorrido), label: r.nombre }))
  const estados = ESTADOS.map((e) => ({ value: e, label: e }))

  return (
    <div>
      <h2 className='mb-5 text-[22px] font-black'>📈 Listados de pagos</h2>

      <div className='mb-5 rounded-card bg-white p-5 shadow-card'>
        <Campo etiqueta='Listado'>
          <select className={`${INPUT} appearance-none mb-2`} value={tipo} onChange={(e) => {
            setTipo(e.target.value as Tipo)
            setF(new Map())
          }}>
            {TIPOS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </Campo>
        <p className='mb-4 text-[12px] text-textMuted'>{info?.nota}</p>

        <div className='flex flex-wrap gap-3'>
          {tipo === 'ingresos' ? (
            <>
              <Campo etiqueta='Acreditados desde'>
                <input type='date' className={INPUT} value={dias.desde} onChange={(e) => {
                  const desde = e.target.value
                  setDias((d) => ({ ...d, desde }))
                }} />
              </Campo>
              <Campo etiqueta='Hasta (incluido)'>
                <input type='date' className={INPUT} value={dias.hasta} onChange={(e) => {
                  const hasta = e.target.value
                  setDias((d) => ({ ...d, hasta }))
                }} />
              </Campo>
              <Campo etiqueta='Origen'>
                <Seleccion valor={val('origen')} alCambiar={filtro('origen')} todos='Todos' opciones={[
                  { value: 'Comprobante', label: 'Comprobante aprobado' },
                  { value: 'Registro administrativo', label: 'Registro administrativo' },
                ]} />
              </Campo>
            </>
          ) : (
            <>
              <Campo etiqueta='Período facturado desde'>
                <input type='month' className={INPUT} value={meses.desde} onChange={(e) => {
                  const desde = e.target.value
                  setMeses((m) => ({ ...m, desde }))
                }} />
              </Campo>
              <Campo etiqueta='Hasta (incluido)'>
                <input type='month' className={INPUT} value={meses.hasta} onChange={(e) => {
                  const hasta = e.target.value
                  setMeses((m) => ({ ...m, hasta }))
                }} />
              </Campo>
            </>
          )}
          {(tipo === 'completas' || tipo === 'incompletas') && vista && (
            <>
              <Campo etiqueta='Año de última acreditación'>
                <Seleccion valor={val('anioAcreditacion')} alCambiar={filtro('anioAcreditacion')} todos='Todos'
                  opciones={(vista.extra as ListadoFacturas).opciones.aniosAcreditacion.map((a) => ({ value: a, label: a }))} />
              </Campo>
              <Campo etiqueta='Año de cursado'>
                <Seleccion valor={val('anioCursado')} alCambiar={filtro('anioCursado')} todos='Todos'
                  opciones={(vista.extra as ListadoFacturas).opciones.aniosCursado.map((a) => ({ value: a, label: a }))} />
              </Campo>
            </>
          )}
          {tipo === 'deportes' && (
            <>
              <Campo etiqueta='Deporte'><Seleccion valor={val('id_actividad')} alCambiar={(v) => {
                setF((p) => new Map(p).set('id_actividad', v).set('id_grupo', ''))
              }} todos='Todos' opciones={deportes} /></Campo>
              <Campo etiqueta='Nivel'><Seleccion valor={val('nivel')} alCambiar={filtro('nivel')} todos='Todos' opciones={niveles} /></Campo>
              <Campo etiqueta='Horario (grupo)'><Seleccion valor={val('id_grupo')} alCambiar={filtro('id_grupo')} todos='Todos' opciones={horarios} /></Campo>
              <Campo etiqueta='Profesor'><Seleccion valor={val('id_docente')} alCambiar={filtro('id_docente')} todos='Todos' opciones={profesores} /></Campo>
            </>
          )}
          {tipo === 'recorridos' && (
            <Campo etiqueta='Recorrido (nombre actual)'><Seleccion valor={val('id_recorrido')} alCambiar={filtro('id_recorrido')} todos='Todos' opciones={recorridos} /></Campo>
          )}
          {(tipo === 'deportes' || tipo === 'recorridos') && (
            <Campo etiqueta='Estado de pago'><Seleccion valor={val('estado')} alCambiar={filtro('estado')} todos='Todos' opciones={estados} /></Campo>
          )}
        </div>
        {error && <p role='alert' className='mt-3 text-[13px] font-bold text-red'>{error}</p>}
      </div>

      {resultado === null && <p className='text-[13px] text-textMuted'>Cargando datos...</p>}
      {resultado && !resultado.ok && (
        <div role='alert' className='rounded-card bg-white p-5 shadow-card'>
          <p className='text-[13px] font-bold text-red'>{resultado.mensaje}</p>
          <button type='button' onClick={cargar} className='mt-3 rounded-btn bg-purple-700 px-4 py-2 text-[13px] font-bold text-white'>
            Reintentar
          </button>
        </div>
      )}

      {vista && (
        <div className='rounded-card bg-white p-5 shadow-card'>
          {tipo === 'ingresos' && (() => {
            const l = vista.extra as ReturnType<typeof listadoIngresos>
            return (
              <>
                <Totales datos={[
                  ['Total acreditado', pesos(l.total)],
                  ['Comprobantes aprobados', pesos(l.porOrigen.comprobantes)],
                  ['Registros administrativos', pesos(l.porOrigen.administrativos)],
                ]} />
                {l.sinFecha > 0 && (
                  <p className='mb-3 text-[12px] text-textMuted'>
                    {l.sinFecha} pago(s) registrado(s) por la administración sin fecha: no se pueden ubicar en un período y no se incluyen.
                  </p>
                )}
              </>
            )
          })()}
          {(tipo === 'completas' || tipo === 'incompletas') && (() => {
            const l = vista.extra as ListadoFacturas
            return (
              <>
                <Totales datos={[
                  ['Facturas', String(l.totales.facturas)],
                  ['Total facturado', pesos(l.totales.total)],
                  ['Pagado', pesos(l.totales.pagado)],
                  ...(tipo === 'incompletas' ? [['En revisión (sin acreditar)', pesos(l.totales.enRevision)], ['Saldo', pesos(l.totales.saldo)]] as Array<[string, string]> : []),
                ]} />
                {l.sinCargo > 0 && <p className='mb-3 text-[12px] text-textMuted'>{l.sinCargo} factura(s) Sin cargo (total $ 0) no se incluyen: no son pagos.</p>}
                {l.grupos.map((g) => (
                  <p key={g.clave} className='text-[12px] text-textMuted'>
                    <strong>Última acreditación: {g.anioAcreditacion} · {g.anioCursado}:</strong> {g.filas.length} factura(s), total {pesos(g.total)}, pagado {pesos(g.pagado)}{tipo === 'incompletas' ? `, saldo ${pesos(g.saldo)}` : ''}
                  </p>
                ))}
              </>
            )
          })()}
          {(tipo === 'deportes' || tipo === 'recorridos') && (() => {
            const l = vista.extra as ListadoItems
            return (
              <>
              {tipo === 'deportes' && (
                <p className='mb-3 rounded-input bg-purpleLight px-3 py-2 text-[12px] font-semibold text-purpleDark'>
                  Nivel, horario y profesor son los datos actuales del grupo de la inscripción vigente en cada mes, no una foto de aquel momento.
                </p>
              )}
              {tipo === 'recorridos' && (
                <p className='mb-3 rounded-input bg-purpleLight px-3 py-2 text-[12px] font-semibold text-purpleDark'>
                  El recorrido se muestra como figura en cada factura, aunque hoy tenga otro nombre.
                </p>
              )}
              <Totales datos={[
                ['Importe facturado', pesos(l.totales.importe)],
                ['Cobrado', pesos(l.totales.cobrado)],
                ['En revisión (sin acreditar)', pesos(l.totales.enRevision)],
                ['Saldo', pesos(l.totales.saldo)],
              ]} />
              </>
            )
          })()}

          {vista.tabla.filas.length <= 1 ? (
            <p className='text-[13px] text-textMuted'>No hay datos para los filtros elegidos.</p>
          ) : (
            <>
              <div className='mb-3 mt-2 flex justify-end'>
                <button type='button' className='rounded-btn border-2 border-border px-4 py-2 text-[13px] font-bold'
                  onClick={() => {
                    descargar(vista.tabla, `${info?.label.replace(/\s*\(HU\d+\)/, '').replace(/[^\wáéíóúñ ]/gi, '').trim().replace(/\s+/g, '_') ?? 'listado'}`)
                  }}>
                  Exportar CSV
                </button>
              </div>
              <Tabla t={vista.tabla} />
            </>
          )}
          <p className='mt-3 text-[11px] text-textMuted'>
            {tipo === 'ingresos' ? `Del ${dias.desde.split('-').reverse().join('/')} al ${dias.hasta.split('-').reverse().join('/')}, incluidos.` : `Períodos facturados de ${textoPeriodo({ anio: Number(meses.desde.slice(0, 4)), mes: Number(meses.desde.slice(5)) })} a ${textoPeriodo({ anio: Number(meses.hasta.slice(0, 4)), mes: Number(meses.hasta.slice(5)) })}.`}
          </p>
        </div>
      )}
    </div>
  )
}

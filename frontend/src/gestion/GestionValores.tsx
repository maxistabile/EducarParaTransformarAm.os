// ═══════════════════════════════════════════════════════════════
//  TP METODOLOGÍA II · Parte 3 · RF11.1 a RF11.4 (HU46 a HU49)
//  Valores de cuota, deportes, transporte y comedor. Admin y Directivo.
//  Usa ServicioValores (Facade): esta pantalla no consulta tablas.
// ═══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ServicioValores } from '../servicios/ServicioValores'
import type { DatosValores } from '../servicios/ServicioValores'
import { fechaHoy, proximoValor, valorVigente } from '../reglasValores'
import type { ClaveValor, ValorServicio } from '../reglasValores'

interface Fila {
  id: string
  nombre: string
  clave: ClaveValor
}

const TH =
  'text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'
const TD = 'py-3 pr-3 border-b border-border text-[13px] align-top'
const INPUT =
  'w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
const LABEL = 'text-[11px] font-extrabold text-textMuted block mb-[5px]'

const pesos = (monto: number) =>
  monto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

const fechaCorta = (fecha: string) => fecha.split('-').reverse().join('/')

function seccionesDe(datos: DatosValores): Array<{ titulo: string; filas: Fila[] }> {
  return [
    {
      titulo: 'Cuota y comedor',
      filas: [
        { id: 'cuota', nombre: 'Cuota mensual', clave: { concepto: 'Cuota', idReferencia: null } },
        { id: 'comedor', nombre: 'Comedor', clave: { concepto: 'Comedor', idReferencia: null } },
      ],
    },
    {
      titulo: 'Deportes',
      filas: datos.deportes.map((d) => ({
        id: `deporte-${d.id_actividad}`,
        nombre: d.nombre,
        clave: { concepto: 'Deporte', idReferencia: d.id_actividad },
      })),
    },
    {
      titulo: 'Transporte',
      filas: datos.recorridos.map((r) => ({
        id: `recorrido-${r.id_recorrido}`,
        nombre: `Recorrido ${r.numero} — ${r.nombre}`,
        clave: { concepto: 'Recorrido', idReferencia: r.id_recorrido },
      })),
    },
  ]
}

function TextoValor({ valor, vacio }: { valor: ValorServicio | null; vacio: string }) {
  if (!valor) return <span className='text-textMuted'>{vacio}</span>
  return (
    <span>
      <strong>{pesos(valor.monto)}</strong>
      <span className='block text-[11px] text-textMuted'>
        desde el {fechaCorta(valor.vigente_desde)}
      </span>
    </span>
  )
}

export default function GestionValores() {
  const [datos, setDatos] = useState<DatosValores | null>(null)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState<Fila | null>(null)
  const [monto, setMonto] = useState('')
  const [vigenteDesde, setVigenteDesde] = useState(fechaHoy())
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(() => {
    ServicioValores.cargar()
      .then((resultado) => {
        if (resultado.ok) {
          setDatos(resultado.datos)
          setError('')
        } else {
          setError(resultado.mensaje)
        }
      })
      .catch(() => {
        setError('No pudimos cargar los valores. Intentá de nuevo.')
      })
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const abrir = (fila: Fila) => {
    setEditando(fila)
    setMonto('')
    setVigenteDesde(fechaHoy())
    setErrorForm('')
    setAviso('')
  }

  const guardar = (e: FormEvent) => {
    e.preventDefault()
    if (!editando) return
    setGuardando(true)
    setErrorForm('')
    ServicioValores.guardar({ clave: editando.clave, monto, vigenteDesde })
      .then((resultado) => {
        if (!resultado.ok) {
          setErrorForm(resultado.mensaje)
          return
        }
        setAviso(`Valor de "${editando.nombre}" guardado.`)
        setEditando(null)
        cargar()
      })
      .catch(() => {
        setErrorForm('No pudimos guardar el valor. Intentá de nuevo.')
      })
      .finally(() => {
        setGuardando(false)
      })
  }

  const hoy = fechaHoy()

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 6px' }}>💲 Valores</h2>
      <p className='text-[13px] text-textMuted mb-5'>
        Cada valor rige desde su fecha de vigencia y lo usará la facturación
        mensual. Para corregir una carga, volvé a cargar el valor con la misma
        fecha.
      </p>

      {aviso && (
        <p role='status' className='mb-4 text-[13px] font-bold text-green'>
          {aviso}
        </p>
      )}
      {error && (
        <p role='alert' className='mb-4 text-[13px] font-bold text-red'>
          {error}
        </p>
      )}
      {!datos && !error && <p className='text-[13px] text-textMuted'>Cargando...</p>}

      {datos &&
        seccionesDe(datos).map((seccion) => (
          <div
            key={seccion.titulo}
            className='bg-white rounded-card p-6 shadow-card border border-border mb-6'
          >
            <div className='text-[15px] font-extrabold text-text mb-4'>
              {seccion.titulo}
            </div>
            {seccion.filas.length === 0 ? (
              <p className='text-[13px] text-textMuted'>No hay elementos activos.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th className={TH}>Concepto</th>
                    <th className={TH}>Vigente hoy</th>
                    <th className={TH}>Próximo</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody>
                  {seccion.filas.map((fila) => (
                    <tr key={fila.id}>
                      <td className={`${TD} font-bold`}>{fila.nombre}</td>
                      <td className={TD}>
                        <TextoValor
                          valor={valorVigente(datos.valores, fila.clave, hoy)}
                          vacio='Sin valor'
                        />
                      </td>
                      <td className={TD}>
                        <TextoValor
                          valor={proximoValor(datos.valores, fila.clave, hoy)}
                          vacio='—'
                        />
                      </td>
                      <td className={`${TD} text-right`}>
                        {editando?.id === fila.id ? (
                          <form
                            onSubmit={guardar}
                            className='flex flex-wrap items-end justify-end gap-3'
                          >
                            <label className='w-[140px] text-left'>
                              <span className={LABEL}>Importe ($)</span>
                              <input
                                className={INPUT}
                                inputMode='decimal'
                                required
                                autoFocus
                                value={monto}
                                placeholder='15000'
                                onChange={(ev) => {
                                  setMonto(ev.target.value)
                                }}
                              />
                            </label>
                            <label className='w-[160px] text-left'>
                              <span className={LABEL}>Vigente desde</span>
                              <input
                                className={INPUT}
                                type='date'
                                required
                                value={vigenteDesde}
                                onChange={(ev) => {
                                  setVigenteDesde(ev.target.value)
                                }}
                              />
                            </label>
                            <button
                              type='submit'
                              disabled={guardando}
                              className='bg-purple-700 text-white rounded-btn py-[10px] px-4 text-[13px] font-extrabold disabled:opacity-60'
                            >
                              {guardando ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button
                              type='button'
                              disabled={guardando}
                              onClick={() => {
                                setEditando(null)
                              }}
                              className='text-[13px] font-bold text-textMuted underline'
                            >
                              Cancelar
                            </button>
                            {errorForm && (
                              <p role='alert' className='w-full text-left text-[12px] font-bold text-red'>
                                {errorForm}
                              </p>
                            )}
                          </form>
                        ) : (
                          <button
                            type='button'
                            onClick={() => {
                              abrir(fila)
                            }}
                            className='border-2 border-purple-700 text-purple-700 rounded-btn py-[6px] px-3 text-[12px] font-extrabold'
                          >
                            Cargar valor
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
    </div>
  )
}

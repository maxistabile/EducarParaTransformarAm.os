// ═══════════════════════════════════════════════════════════════
//  Vínculos de cuentas y legajos (HU7, HU11, HU20 y acceso de HU41)
// ═══════════════════════════════════════════════════════════════
// Ventanas que abren las pantallas de Alumnos, Usuarios y Docentes con
// "Vínculos" / "Cuenta". Consultan UN registro al abrirse (no agregan
// consultas por fila) y todo cambio pasa por ServicioVinculos, que usa
// las funciones de etapa23 (controles de rol en la base). No muestran
// contraseñas ni cambian las credenciales de cuentas existentes.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ESTADO_VINCULO,
  buscarTutores,
  confirmacionReemplazoTutor,
  correoSugeridoAlumno,
  cuentasDisponibles,
  nombreUsuario,
  validarCuentaNueva,
} from '../reglasVinculos'
import type { UsuarioBasico } from '../reglasVinculos'
import { ServicioVinculos } from '../servicios/ServicioVinculos'
import type { LegajoAlumno, LegajoDocente, Vinculos } from '../servicios/ServicioVinculos'

const INPUT = 'w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
const LABEL = 'text-[11px] font-extrabold text-textMuted block mb-[5px]'
const BOTON = 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[9px] px-4 text-[13px] font-extrabold cursor-pointer disabled:opacity-60'
const BOTON_SUAVE = 'bg-purpleLight text-purple-700 border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
const ERROR_LECTURA = 'No se pudieron cargar los vínculos. Cerrá la ventana e intentá de nuevo.'

/** Registra un rechazo inesperado (el servicio devuelve resultados controlados). */
function registrarRechazo(origen: string, error: unknown) {
  console.error(`[Vinculos] ${origen}:`, { nombre: error instanceof Error ? error.name : typeof error })
}

export function Ventana({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  return (
    <div className='fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4' role='dialog' aria-modal='true' aria-label={titulo}>
      <div className='mt-10 w-full max-w-xl rounded-card border border-border bg-white p-6 shadow-card'>
        <div className='mb-4 flex items-center justify-between gap-3'>
          <h3 className='m-0 text-[17px] font-extrabold text-text'>{titulo}</h3>
          <button type='button' className={BOTON_SUAVE} onClick={onCerrar}>Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className='mb-3'>
      <span className={LABEL}>{etiqueta}</span>
      <div className='text-[14px] text-text'>{children}</div>
    </div>
  )
}

function Faltante({ texto }: { texto: string }) {
  return <span className='rounded-full bg-[#E67E221A] px-2 py-[2px] text-[12px] font-extrabold text-[#B9651B]'>{texto}</span>
}

function Aviso({ msg }: { msg: string }) {
  if (!msg) return null
  const ok = msg.startsWith('✅')
  return <p role={ok ? 'status' : 'alert'} className={`mt-3 text-[13px] font-bold ${ok ? 'text-green' : 'text-red'}`}>{msg}</p>
}

// ── Formulario de cuenta nueva (compartido por Alumnos y Docentes) ──
function FormCuentaNueva({
  correoInicial, pedirNombre, nombreInicial = '', apellidoInicial = '', ocupado, onCrear,
}: {
  correoInicial: string
  pedirNombre: boolean
  nombreInicial?: string
  apellidoInicial?: string
  ocupado: boolean
  onCrear: (c: { email: string; password: string; nombre: string; apellido: string }) => void
}) {
  const [c, setC] = useState({ email: correoInicial, password: '', nombre: nombreInicial, apellido: apellidoInicial })
  const [error, setError] = useState('')
  return (
    <form
      className='grid grid-cols-2 gap-3'
      onSubmit={(e) => {
        e.preventDefault()
        const invalido = validarCuentaNueva(c) ?? (pedirNombre && (!c.nombre.trim() || !c.apellido.trim()) ? 'Ingresá nombre y apellido.' : null)
        setError(invalido ?? '')
        if (!invalido) onCrear(c)
      }}
    >
      {pedirNombre && (
        <>
          <label><span className={LABEL}>Nombre</span>
            <input className={INPUT} value={c.nombre} onChange={(e) => { setC({ ...c, nombre: e.target.value }) }} /></label>
          <label><span className={LABEL}>Apellido</span>
            <input className={INPUT} value={c.apellido} onChange={(e) => { setC({ ...c, apellido: e.target.value }) }} /></label>
        </>
      )}
      <label><span className={LABEL}>Correo de acceso</span>
        <input type='email' className={INPUT} value={c.email} onChange={(e) => { setC({ ...c, email: e.target.value }) }} /></label>
      <label><span className={LABEL}>Contraseña inicial</span>
        <input type='password' autoComplete='new-password' className={INPUT} value={c.password} onChange={(e) => { setC({ ...c, password: e.target.value }) }} /></label>
      <div className='col-span-2 flex items-center gap-3'>
        <button type='submit' className={BOTON} disabled={ocupado}>{ocupado ? 'Creando...' : 'Crear cuenta y vincular'}</button>
        {error && <span role='alert' className='text-[13px] font-bold text-red'>{error}</span>}
      </div>
    </form>
  )
}

// ── Selector de una cuenta disponible ──
function SelectorCuenta({ cuentas, ocupado, textoBoton, onElegir }: {
  cuentas: UsuarioBasico[]; ocupado: boolean; textoBoton: string; onElegir: (u: UsuarioBasico) => void
}) {
  const [id, setId] = useState('')
  if (cuentas.length === 0) return <p className='text-[13px] text-textMuted'>No hay cuentas disponibles de ese rol (sin legajo).</p>
  const elegida = cuentas.find((u) => u.id_usuario === id)
  return (
    <div className='flex flex-wrap items-end gap-3'>
      <label className='min-w-[240px] flex-1'><span className={LABEL}>Cuenta disponible</span>
        <select className={INPUT} value={id} onChange={(e) => { setId(e.target.value) }}>
          <option value=''>Elegir…</option>
          {cuentas.map((u) => <option key={u.id_usuario} value={u.id_usuario}>{nombreUsuario(u)} · {u.email}</option>)}
        </select>
      </label>
      <button type='button' className={BOTON} disabled={!elegida || ocupado} onClick={() => { if (elegida) onElegir(elegida) }}>{textoBoton}</button>
    </div>
  )
}

// ═══════════════ Alumno: tutor y cuenta propia ═══════════════
export interface AlumnoVinculable {
  id_alumno: number
  nombre: string
  apellido: string
  dni: string
  legajo?: string | null
  id_usuario?: string | null
  id_usuario_padre?: string | null
}

export function VinculosAlumno({ alumno, onCerrar, onCambio }: { alumno: AlumnoVinculable; onCerrar: () => void; onCambio: () => void }) {
  const [estado, setEstado] = useState(alumno)
  const [tutor, setTutor] = useState<UsuarioBasico | null>(null)
  const [cuenta, setCuenta] = useState<UsuarioBasico | null>(null)
  const [cargando, setCargando] = useState(true)
  const [modo, setModo] = useState<'' | 'tutor' | 'crear' | 'vincular'>('')
  const [tutores, setTutores] = useState<UsuarioBasico[]>([])
  const [disponibles, setDisponibles] = useState<UsuarioBasico[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let vigente = true
    ServicioVinculos.vinculosAlumno(estado)
      .then((r) => {
        if (!vigente) return
        if (r.ok) { setTutor(r.dato.tutor); setCuenta(r.dato.cuenta) } else setMsg(r.mensaje)
        setCargando(false)
      })
      .catch((error: unknown) => {
        registrarRechazo('vinculosAlumno', error)
        if (!vigente) return
        setMsg(ERROR_LECTURA)
        setCargando(false)
      })
    return () => { vigente = false }
  }, [estado])

  const abrir = async (m: 'tutor' | 'vincular' | 'crear') => {
    setMsg('')
    setModo(m)
    if (m === 'tutor') {
      const r = await ServicioVinculos.usuariosPorRol('Padre')
      if (r.ok) setTutores(r.dato); else setMsg(r.mensaje)
    }
    if (m === 'vincular') {
      const [us, ocup] = await Promise.all([ServicioVinculos.usuariosPorRol('Alumno'), ServicioVinculos.cuentasConLegajo('alumnos')])
      if (us.ok && ocup.ok) setDisponibles(cuentasDisponibles(us.dato, 'Alumno', ocup.dato))
      else setMsg(!us.ok ? us.mensaje : !ocup.ok ? ocup.mensaje : '')
    }
  }

  const terminar = (texto: string, cambios: Partial<AlumnoVinculable>) => {
    setMsg(texto)
    setModo('')
    setEstado((p) => ({ ...p, ...cambios }))
    onCambio()
  }

  const elegirTutor = async (nuevo: UsuarioBasico) => {
    const pregunta = confirmacionReemplazoTutor(tutor, nuevo)
    if (pregunta && !confirm(pregunta)) return
    setOcupado(true)
    const r = await ServicioVinculos.vincularTutor(estado.id_alumno, nuevo.id_usuario, Boolean(pregunta))
    setOcupado(false)
    if (r.ok) terminar(`✅ Tutor asociado: ${nombreUsuario(nuevo)}.`, { id_usuario_padre: nuevo.id_usuario })
    else setMsg(r.mensaje)
  }

  const vincularCuenta = async (u: UsuarioBasico) => {
    setOcupado(true)
    const r = await ServicioVinculos.vincularCuentaAlumno(estado.id_alumno, u.id_usuario)
    setOcupado(false)
    if (r.ok) terminar(`✅ Cuenta vinculada: ${u.email ?? ''}. Sus credenciales no cambiaron.`, { id_usuario: u.id_usuario })
    else setMsg(r.mensaje)
  }

  const crearCuenta = async (c: { email: string; password: string }) => {
    setOcupado(true)
    setMsg('')
    const alta = await ServicioVinculos.crearCuenta({ ...c, nombre: estado.nombre, apellido: estado.apellido, rol: 'Alumno' })
    if (!alta.ok) { setOcupado(false); setMsg(alta.mensaje); return }
    const r = await ServicioVinculos.vincularCuentaAlumno(estado.id_alumno, alta.dato.id_usuario)
    setOcupado(false)
    if (r.ok)
      terminar(alta.dato.existente
        ? '✅ Ya existía una cuenta Alumno libre con ese correo: se vinculó sin cambiar sus credenciales.'
        : '✅ Cuenta creada y vinculada. El alumno ya puede ingresar.', { id_usuario: alta.dato.id_usuario })
    else setMsg(`La cuenta quedó creada, pero no se vinculó: ${r.mensaje} Reintentá con "Vincular cuenta existente".`)
  }

  const candidatos = buscarTutores(tutores, busqueda)

  return (
    <Ventana titulo={`Vínculos de ${estado.apellido}, ${estado.nombre}`} onCerrar={onCerrar}>
      <Dato etiqueta='Legajo'>{estado.legajo ?? '—'} · DNI {estado.dni}</Dato>
      {cargando ? <p className='text-[13px] text-textMuted'>Cargando…</p> : (
        <>
          <Dato etiqueta='Tutor asociado'>
            {tutor ? <>{nombreUsuario(tutor)} · <span className='text-textMuted'>{tutor.email}</span></> : <Faltante texto={ESTADO_VINCULO.sinTutor} />}
            <div className='mt-2'><button type='button' className={BOTON_SUAVE} onClick={() => { void abrir('tutor') }}>{tutor ? 'Cambiar tutor' : 'Asociar tutor existente'}</button></div>
          </Dato>
          <Dato etiqueta='Cuenta propia del alumno'>
            {cuenta ? <>{cuenta.email} <span className='text-textMuted'>({cuenta.activo === false ? 'inactiva' : 'activa'})</span></> : <Faltante texto={ESTADO_VINCULO.sinCuenta} />}
            {!cuenta && (
              <div className='mt-2 flex gap-2'>
                <button type='button' className={BOTON_SUAVE} onClick={() => { void abrir('crear') }}>Crear cuenta</button>
                <button type='button' className={BOTON_SUAVE} onClick={() => { void abrir('vincular') }}>Vincular cuenta existente</button>
              </div>
            )}
          </Dato>
        </>
      )}

      {modo === 'tutor' && (
        <div className='mt-2 border-t border-border pt-4'>
          <label><span className={LABEL}>Buscar tutor por correo, nombre o apellido</span>
            <input className={INPUT} value={busqueda} onChange={(e) => { setBusqueda(e.target.value) }} placeholder='Al menos 2 letras' /></label>
          <ul className='mt-2 flex flex-col gap-2'>
            {candidatos.map((u) => (
              <li key={u.id_usuario} className='flex items-center justify-between gap-3 rounded-input border border-border px-3 py-2 text-[13px]'>
                <span>{nombreUsuario(u)} · <span className='text-textMuted'>{u.email}</span></span>
                <button type='button' className={BOTON_SUAVE} disabled={ocupado} onClick={() => { void elegirTutor(u) }}>Elegir</button>
              </li>
            ))}
            {busqueda.trim().length >= 2 && candidatos.length === 0 && <li className='text-[13px] text-textMuted'>No hay tutores activos que coincidan.</li>}
          </ul>
        </div>
      )}
      {modo === 'crear' && (
        <div className='mt-2 border-t border-border pt-4'>
          <FormCuentaNueva correoInicial={correoSugeridoAlumno(estado.dni)} pedirNombre={false} ocupado={ocupado} onCrear={(c) => { void crearCuenta(c) }} />
        </div>
      )}
      {modo === 'vincular' && (
        <div className='mt-2 border-t border-border pt-4'>
          <SelectorCuenta cuentas={disponibles} ocupado={ocupado} textoBoton='Vincular' onElegir={(u) => { void vincularCuenta(u) }} />
        </div>
      )}
      <Aviso msg={msg} />
    </Ventana>
  )
}

// ═══════════════ Usuario: hijos o legajo ═══════════════
export function VinculosUsuario({ usuario, onCerrar }: { usuario: UsuarioBasico; onCerrar: () => void }) {
  const [vinculos, setVinculos] = useState<Vinculos | null>(null)
  const [version, setVersion] = useState(0)
  const [legajosAlumno, setLegajosAlumno] = useState<LegajoAlumno[] | null>(null)
  const [legajosDocente, setLegajosDocente] = useState<LegajoDocente[] | null>(null)
  const [elegido, setElegido] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let vigente = true
    ServicioVinculos.vinculosUsuario({ id_usuario: usuario.id_usuario, rol: usuario.rol ?? '' })
      .then((r) => {
        if (!vigente) return
        if (r.ok) setVinculos(r.dato); else setMsg(r.mensaje)
      })
      .catch((error: unknown) => {
        registrarRechazo('vinculosUsuario', error)
        // La carga termina al mostrar el mensaje ("Cargando…" solo se ve sin mensaje)
        if (vigente) setMsg(ERROR_LECTURA)
      })
    return () => { vigente = false }
  }, [usuario, version])

  const buscarLegajos = async () => {
    setMsg('')
    if (usuario.rol === 'Alumno') {
      const r = await ServicioVinculos.alumnosSinCuenta()
      if (r.ok) setLegajosAlumno(r.dato); else setMsg(r.mensaje)
    } else {
      const r = await ServicioVinculos.docentesSinCuenta()
      if (r.ok) setLegajosDocente(r.dato); else setMsg(r.mensaje)
    }
  }

  const vincular = async () => {
    if (!elegido) return
    setOcupado(true)
    const r = usuario.rol === 'Alumno'
      ? await ServicioVinculos.vincularCuentaAlumno(Number(elegido), usuario.id_usuario)
      : await ServicioVinculos.vincularCuentaDocente(Number(elegido), usuario.id_usuario)
    setOcupado(false)
    if (!r.ok) { setMsg(r.mensaje); return }
    setMsg('✅ Legajo vinculado. Las credenciales de la cuenta no cambiaron.')
    setLegajosAlumno(null)
    setLegajosDocente(null)
    setElegido('')
    setVersion((v) => v + 1)
  }

  const sinLegajo = (vinculos?.tipo === 'Alumno' || vinculos?.tipo === 'Docente') && !vinculos.legajo

  return (
    <Ventana titulo={`Vínculos de ${nombreUsuario(usuario)}`} onCerrar={onCerrar}>
      <Dato etiqueta='Cuenta'>{usuario.email} · {usuario.rol === 'Padre' ? 'Tutor' : usuario.rol}</Dato>
      {!vinculos ? <p className='text-[13px] text-textMuted'>{msg ? '' : 'Cargando…'}</p> : (
        <>
          {vinculos.tipo === 'Padre' && (
            <Dato etiqueta='Hijos asociados'>
              {vinculos.hijos.length === 0 ? <Faltante texto='Sin hijos asociados' /> : (
                <ul className='m-0 flex list-none flex-col gap-1 p-0'>
                  {vinculos.hijos.map((h) => <li key={h.id_alumno}>{h.apellido}, {h.nombre} · Legajo {h.legajo ?? '—'}</li>)}
                </ul>
              )}
              <p className='mt-2 text-[12px] text-textMuted'>Para asociar otro hijo: Alumnos → Vínculos → Asociar tutor existente.</p>
            </Dato>
          )}
          {vinculos.tipo === 'Alumno' && (
            <Dato etiqueta='Legajo del alumno'>
              {vinculos.legajo ? <>{vinculos.legajo.legajo ?? '—'} · {vinculos.legajo.apellido}, {vinculos.legajo.nombre} · DNI {vinculos.legajo.dni ?? '—'}</> : <Faltante texto={ESTADO_VINCULO.sinLegajo} />}
            </Dato>
          )}
          {vinculos.tipo === 'Docente' && (
            <Dato etiqueta='Legajo del docente'>
              {vinculos.legajo ? <>{vinculos.legajo.legajo ?? '—'} · DNI {vinculos.legajo.dni ?? '—'} · {vinculos.legajo.especialidad ?? ''}</> : <Faltante texto={ESTADO_VINCULO.sinLegajo} />}
            </Dato>
          )}
          {vinculos.tipo === 'Gestion' && <Dato etiqueta='Legajo'>Cuenta de gestión: no lleva legajo.</Dato>}

          {sinLegajo && (
            <div className='mt-2 border-t border-border pt-4'>
              {legajosAlumno === null && legajosDocente === null ? (
                <button type='button' className={BOTON_SUAVE} onClick={() => { void buscarLegajos() }}>Vincular un legajo existente sin cuenta</button>
              ) : (
                <div className='flex flex-wrap items-end gap-3'>
                  <label className='min-w-[240px] flex-1'><span className={LABEL}>Legajo sin cuenta</span>
                    <select className={INPUT} value={elegido} onChange={(e) => { setElegido(e.target.value) }}>
                      <option value=''>Elegir…</option>
                      {(legajosAlumno ?? []).map((l) => <option key={l.id_alumno} value={l.id_alumno}>{l.legajo ?? '—'} · {l.apellido}, {l.nombre} · DNI {l.dni ?? '—'}</option>)}
                      {(legajosDocente ?? []).map((l) => <option key={l.id_docente} value={l.id_docente}>{l.legajo ?? '—'} · DNI {l.dni ?? '—'} · {l.especialidad ?? ''}</option>)}
                    </select>
                  </label>
                  <button type='button' className={BOTON} disabled={!elegido || ocupado} onClick={() => { void vincular() }}>Vincular</button>
                </div>
              )}
              {usuario.rol === 'Alumno' && <p className='mt-2 text-[12px] text-textMuted'>Para un alumno nuevo, cargá su legajo en Alumnos y después vinculá esta cuenta.</p>}
            </div>
          )}
        </>
      )}
      <Aviso msg={msg} />
    </Ventana>
  )
}

// ═══════════════ Docente: cuenta de acceso ═══════════════
export interface DocenteVinculable {
  id_docente: number
  dni: string | null
  legajo?: string | null
  id_usuario?: string | null
  usuarios: { nombre: string; apellido: string; email: string } | null
}

export function CuentaDocente({ docente, onCerrar, onCambio }: { docente: DocenteVinculable; onCerrar: () => void; onCambio: () => void }) {
  const [modo, setModo] = useState<'' | 'crear' | 'vincular'>('')
  const [disponibles, setDisponibles] = useState<UsuarioBasico[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState('')
  const [hecho, setHecho] = useState(false)

  const abrirVincular = async () => {
    setMsg('')
    setModo('vincular')
    const [us, ocup] = await Promise.all([ServicioVinculos.usuariosPorRol('Docente'), ServicioVinculos.cuentasConLegajo('docentes')])
    if (us.ok && ocup.ok) setDisponibles(cuentasDisponibles(us.dato, 'Docente', ocup.dato))
    else setMsg(!us.ok ? us.mensaje : !ocup.ok ? ocup.mensaje : '')
  }

  const vincular = async (idUsuario: string, texto: string) => {
    const r = await ServicioVinculos.vincularCuentaDocente(docente.id_docente, idUsuario)
    setOcupado(false)
    if (!r.ok) { setMsg(`${texto ? texto + ' ' : ''}${r.mensaje}`); return }
    setMsg('✅ Cuenta vinculada al docente. Las credenciales de una cuenta existente no cambian.')
    setHecho(true)
    setModo('')
    onCambio()
  }

  const crear = async (c: { email: string; password: string; nombre: string; apellido: string }) => {
    setOcupado(true)
    setMsg('')
    const alta = await ServicioVinculos.crearCuenta({ ...c, rol: 'Docente' })
    if (!alta.ok) { setOcupado(false); setMsg(alta.mensaje); return }
    await vincular(alta.dato.id_usuario, 'La cuenta quedó creada, pero no se vinculó:')
  }

  const tieneCuenta = Boolean(docente.id_usuario) || hecho
  return (
    <Ventana titulo={`Cuenta del docente ${docente.legajo ?? ''}`} onCerrar={onCerrar}>
      <Dato etiqueta='Docente'>DNI {docente.dni ?? '—'} · Legajo {docente.legajo ?? '—'}</Dato>
      <Dato etiqueta='Cuenta de acceso'>
        {docente.usuarios ? <>{docente.usuarios.apellido}, {docente.usuarios.nombre} · <span className='text-textMuted'>{docente.usuarios.email}</span></>
          : hecho ? 'Vinculada.' : <Faltante texto={ESTADO_VINCULO.sinCuenta} />}
      </Dato>
      {!tieneCuenta && (
        <div className='flex gap-2'>
          <button type='button' className={BOTON_SUAVE} onClick={() => { setMsg(''); setModo('crear') }}>Crear cuenta</button>
          <button type='button' className={BOTON_SUAVE} onClick={() => { void abrirVincular() }}>Vincular cuenta existente</button>
        </div>
      )}
      {modo === 'crear' && (
        <div className='mt-4 border-t border-border pt-4'>
          <FormCuentaNueva correoInicial='' pedirNombre ocupado={ocupado} onCrear={(c) => { void crear(c) }} />
        </div>
      )}
      {modo === 'vincular' && (
        <div className='mt-4 border-t border-border pt-4'>
          <SelectorCuenta cuentas={disponibles} ocupado={ocupado} textoBoton='Vincular'
            onElegir={(u) => { setOcupado(true); void vincular(u.id_usuario, '') }} />
        </div>
      )}
      <Aviso msg={msg} />
    </Ventana>
  )
}

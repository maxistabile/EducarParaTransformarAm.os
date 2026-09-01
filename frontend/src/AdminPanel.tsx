/**
 * AdminPanel.tsx
 * Panel de administración — Educar Para Transformar
 * Roles: Admin / Directivo → acceso completo
 *        Docente           → solo sus secciones
 */

import { useState, useEffect, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
)

// ═══════════════════════════════════════════════════════════════
//  TIPOS
// ═══════════════════════════════════════════════════════════════
interface UsuarioPanel {
  id_usuario: string
  nombre: string
  apellido: string
  email: string
  rol: string
  activo: boolean
}

interface PrefillAlumno {
  nombre: string
  apellido: string
  dni: string
  fecha_nacimiento: string
}

interface PrefillUsuario {
  nombre: string
  apellido: string
  email: string
  password: string
  rol: string
  alumno?: PrefillAlumno | null
}

interface Alumno {
  id_alumno: number
  nombre: string
  apellido: string
  dni: string
  activo: boolean
  cursos: { nivel: string; grado_anio: string; division: string } | null
}

interface Docente {
  id_docente: number
  dni: string
  especialidad: string | null
  activo: boolean
  usuarios: { nombre: string; apellido: string; email: string } | null
}

interface Curso {
  id_curso: number
  nivel: string
  grado_anio: string
  division: string
  capacidad_maxima: number
}

interface Materia {
  id_materia: number
  nombre: string
  horas_semanales: number
  activo: boolean
}

interface Asignacion {
  id_asignacion: number
  docentes: { usuarios: { nombre: string; apellido: string } | null } | null
  materias: { nombre: string } | null
  cursos: { nivel: string; grado_anio: string; division: string } | null
}

interface AlumnoAsistencia {
  id_alumno: number
  nombre: string
  apellido: string
  estado: 'Presente' | 'Ausente' | 'Tarde' | 'Justificado'
}

interface Calificacion {
  id_calificacion: number
  nota: number
  trimestre: number
  tipo_evaluacion: string
  fecha_carga: string
  alumnos: { nombre: string; apellido: string } | null
  asignaciones: { materias: { nombre: string } | null } | null
}

interface Cuota {
  id_cuota: number
  mes: number
  anio: number
  monto_base: number
  descuento: number
  estado: string
  fecha_vencimiento: string
  fecha_pago: string | null
  metodo_pago: string | null
  alumnos: { nombre: string; apellido: string } | null
}

interface ActividadEx {
  id_actividad: number
  nombre: string
  tipo: string
  descripcion: string | null
  cupo_maximo: number
  activo: boolean
}

interface DocumentoAlumno {
  id_documento: number
  id_alumno: number
  nombre: string
  tipo: string | null
  url_archivo: string
  fecha_carga: string
}

interface Beca {
  id_beca: number
  id_alumno: number
  porcentaje: number
  motivo: string | null
  activo: boolean
  fecha_otorgamiento: string
  alumnos: { nombre: string; apellido: string } | null
}

interface Sueldo {
  id_sueldo: number
  id_usuario: string | null
  mes: number
  anio: number
  monto: number
  estado: string
  fecha_pago: string | null
  usuarios: { nombre: string; apellido: string; rol: string } | null
}

interface Compra {
  id_compra: number
  descripcion: string
  destino: string
  cantidad: number
  monto: number
  proveedor: string | null
  fecha_compra: string
}

interface Instalacion {
  id_instalacion: number
  nombre: string
  tipo: string | null
  activo: boolean
}

interface Reserva {
  id_reserva: number
  id_instalacion: number
  fecha: string
  hora_inicio: string
  hora_fin: string
  motivo: string | null
  instalaciones: { nombre: string } | null
  usuarios: { nombre: string; apellido: string } | null
}

interface MensajeContacto {
  id_mensaje: number
  nombre: string
  email: string
  mensaje: string
  leido: boolean
  fecha_envio: string
}

interface Inscripcion {
  id_inscripcion: number
  nombre_aspirante: string
  apellido_aspirante: string | null
  fecha_nacimiento_aspirante: string | null
  dni_aspirante: string
  nombre_tutor: string
  email_tutor: string
  telefono_tutor: string | null
  nivel_solicitado: string
  estado: string
  fecha_solicitud: string
  id_alumno_creado: number | null
}

interface Noticia {
  id_noticia: number
  titulo: string
  resumen: string | null
  fecha_publicacion: string
  activo: boolean
  destacada: boolean
}

interface Empleo {
  id_empleo: number
  titulo: string
  descripcion: string | null
  area: string | null
  requisitos: string | null
  tipo_contrato: string | null
  activo: boolean
  fecha_publicacion: string
  fecha_cierre: string | null
}

interface Postulacion {
  id_postulacion: number
  id_empleo: number
  nombre: string
  apellido: string
  email: string
  telefono: string | null
  mensaje: string | null
  estado: string
  fecha_postulacion: string
  empleos: { titulo: string; area: string | null } | null
}

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const badge = (color: string) => ({
  display: 'inline-block' as const,
  background: color + '1A',
  color,
  borderRadius: 20,
  padding: '3px 10px',
  fontSize: 11,
  fontWeight: 800,
})

// ═══════════════════════════════════════════════════════════════
//  NAV ITEMS POR ROL
// ═══════════════════════════════════════════════════════════════
const NAV_ADMIN = [
  { key: 'dashboard', icon: '📊', label: 'Dashboard' },
  { key: 'usuarios', icon: '👥', label: 'Usuarios' },
  { key: 'alumnos', icon: '🎓', label: 'Alumnos' },
  { key: 'docentes', icon: '👨‍🏫', label: 'Docentes' },
  { key: 'cursos', icon: '🏫', label: 'Cursos' },
  { key: 'materias', icon: '📚', label: 'Materias' },
  { key: 'asignaciones', icon: '🔗', label: 'Asignaciones' },
  { key: 'cuotas', icon: '💳', label: 'Cuotas' },
  { key: 'pagos', icon: '💰', label: 'Registrar pagos' },
  { key: 'becas', icon: '🎟️', label: 'Becas' },
  { key: 'sueldos', icon: '💼', label: 'Sueldos' },
  { key: 'compras', icon: '🧪', label: 'Compras insumos' },
  { key: 'inscripciones', icon: '📋', label: 'Inscripciones' },
  { key: 'actividades', icon: '🎨', label: 'Extracurriculares' },
  { key: 'reservas', icon: '🏟️', label: 'Reservas' },
  { key: 'mensajes', icon: '✉️', label: 'Mensajes' },
  { key: 'noticias', icon: '📰', label: 'Noticias' },
  { key: 'empleos', icon: '💼', label: 'Empleos' },
  { key: 'postulaciones', icon: '📩', label: 'Postulaciones' },
  { key: 'galeria', icon: '🖼️', label: 'Galería' },
]

const NAV_DOCENTE = [
  { key: 'dashboard', icon: '📊', label: 'Dashboard' },
  { key: 'asistencia', icon: '📅', label: 'Tomar asistencia' },
  { key: 'calificaciones', icon: '📝', label: 'Calificaciones' },
  { key: 'amonestaciones', icon: '⚠️', label: 'Amonestaciones' },
  { key: 'legajos', icon: '📁', label: 'Legajos' },
  { key: 'reservas', icon: '🏟️', label: 'Reservas' },
]

// ═══════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function AdminPanel() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [perfil, setPerfil] = useState<UsuarioPanel | null>(null)
  const [activeNav, setActiveNav] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [prefillUsuario, setPrefillUsuario] = useState<PrefillUsuario | null>(
    null,
  )

  const irARegistrarUsuario = useCallback((data: PrefillUsuario) => {
    setPrefillUsuario(data)
    setActiveNav('usuarios')
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthChecked(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    supabase
      .from('usuarios')
      .select('*')
      .eq('id_usuario', user.id)
      .single()
      .then(async ({ data }) => {
        if (data && data.activo === false) {
          await supabase.auth.signOut()
          navigate('/login', { replace: true })
          return
        }
        if (data) setPerfil(data as UsuarioPanel)
        setLoading(false)
      })
  }, [user, navigate])

  if (!authChecked) return null

  if (!user) {
    navigate('/login', { replace: true })
    return null
  }

  if (loading || !perfil)
    return (
      <div className='min-h-screen bg-bg flex items-center justify-center'>
        <p className='text-purple-700 font-extrabold'>Cargando...</p>
      </div>
    )

  if (!['Admin', 'Directivo', 'Docente'].includes(perfil.rol)) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: "'Nunito',sans-serif",
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#E74C3C' }}>
            Sin acceso
          </div>
          <p style={{ color: '#6B6B8A' }}>
            Tu usuario no tiene permisos para este panel.
          </p>
          <button
            className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
            onClick={() => supabase.auth.signOut()}
          >
            Salir
          </button>
        </div>
      </div>
    )
  }

  const esAdmin = ['Admin', 'Directivo'].includes(perfil.rol)
  const navItems = esAdmin ? NAV_ADMIN : NAV_DOCENTE
  const initials = `${perfil.nombre[0]}${perfil.apellido[0]}`

  return (
    <div
      style={{
        fontFamily: "'Nunito','Segoe UI',sans-serif",
        background: '#F5F4FB',
        minHeight: '100vh',
        color: '#1A1A2E',
      }}
    >
      {/* ── HEADER ── */}
      <header
        style={{
          background: '#FFFFFF',
          borderBottom: `3px solid ${'#5B35C5'}`,
          padding: '0 28px',
          height: 68,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 2px 16px rgba(91,53,197,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src='/logo.png'
            alt='Logo'
            style={{ height: 46 }}
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: '#5B35C5',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Educar Para Transformar
            </div>
            <div style={{ fontSize: 10, color: '#6B6B8A' }}>
              Panel {perfil.rol}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: `linear-gradient(135deg,${'#5B35C5'},${'#7B55E8'})`,
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 13,
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>
              {perfil.nombre} {perfil.apellido}
            </div>
            <div style={{ fontSize: 11, color: '#6B6B8A' }}>{perfil.rol}</div>
          </div>
          <button
            className='bg-transparent border border-border rounded-[8px] px-3.5 py-[7px] text-xs font-bold text-textMuted cursor-pointer font-[inherit]'
            onClick={() => navigate('/')}
          >
            ← Inicio
          </button>
          <button
            className='bg-purpleLight text-purple-700 border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer !py-[7px] !px-[14px] !text-xs'
            onClick={() => supabase.auth.signOut()}
          >
            Salir
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 68px)' }}>
        {/* ── SIDEBAR ── */}
        <aside
          style={{
            width: 220,
            background: '#FFFFFF',
            borderRight: `1px solid ${'#E8E6F5'}`,
            padding: '20px 0',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: '#6B6B8A',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              padding: '0 20px 14px',
              borderBottom: `1px solid ${'#E8E6F5'}`,
              marginBottom: 6,
            }}
          >
            Menú
          </div>
          {navItems.map((item) => (
            <div
              key={item.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 20px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeNav === item.key ? 800 : 600,
                color: activeNav === item.key ? '#5B35C5' : '#6B6B8A',
                background: activeNav === item.key ? '#EEE9FF' : 'none',
                borderLeft:
                  activeNav === item.key
                    ? `3px solid ${'#5B35C5'}`
                    : '3px solid transparent',
                transition: 'all 0.15s',
              }}
              onClick={() => setActiveNav(item.key)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </aside>

        {/* ── CONTENIDO ── */}
        <main style={{ flex: 1, padding: 28, overflowY: 'auto' }}>
          {activeNav === 'dashboard' && (
            <Dashboard
              esAdmin={esAdmin}
              perfil={perfil}
              onIr={setActiveNav}
            />
          )}
          {activeNav === 'usuarios' && esAdmin && (
            <GestionUsuarios
              prefill={prefillUsuario}
              onPrefillConsumed={() => setPrefillUsuario(null)}
              rolActor={perfil.rol}
            />
          )}
          {activeNav === 'alumnos' && esAdmin && <GestionAlumnos />}
          {activeNav === 'docentes' && esAdmin && <GestionDocentes />}
          {activeNav === 'cursos' && esAdmin && <GestionCursos />}
          {activeNav === 'materias' && esAdmin && <GestionMaterias />}
          {activeNav === 'asignaciones' && esAdmin && <GestionAsignaciones />}
          {activeNav === 'cuotas' && esAdmin && <GestionCuotas />}
          {activeNav === 'pagos' && esAdmin && <RegistrarPagos />}
          {activeNav === 'becas' && esAdmin && <GestionBecas />}
          {activeNav === 'sueldos' && esAdmin && <GestionSueldos />}
          {activeNav === 'compras' && esAdmin && <GestionCompras />}
          {activeNav === 'inscripciones' && esAdmin && (
            <GestionInscripciones onRegistrar={irARegistrarUsuario} />
          )}
          {activeNav === 'mensajes' && esAdmin && <GestionMensajes />}
          {activeNav === 'actividades' && esAdmin && <GestionActividades />}
          {activeNav === 'reservas' && <GestionReservas userId={user.id} />}
          {activeNav === 'noticias' && esAdmin && (
            <GestionNoticias userId={user.id} />
          )}
          {activeNav === 'empleos' && esAdmin && <GestionEmpleos />}
          {activeNav === 'postulaciones' && esAdmin && <GestionPostulaciones />}
          {activeNav === 'galeria' && esAdmin && (
            <GestionGaleria userId={user.id} />
          )}
          {activeNav === 'asistencia' && !esAdmin && (
            <TomarAsistencia userId={user.id} />
          )}
          {activeNav === 'calificaciones' && !esAdmin && (
            <CargarCalificaciones userId={user.id} />
          )}
          {activeNav === 'amonestaciones' && !esAdmin && (
            <GestionAmonestaciones userId={user.id} />
          )}
          {activeNav === 'legajos' && !esAdmin && (
            <LegajosDocente userId={user.id} />
          )}
        </main>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  LOGIN ADMIN
// ═══════════════════════════════════════════════════════════════
function LoginAdmin({
  onLogin,
  loading,
}: {
  onLogin: (u: User) => void
  loading: boolean
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (loading)
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: "'Nunito',sans-serif",
        }}
      >
        <p style={{ color: '#5B35C5', fontWeight: 800 }}>Cargando...</p>
      </div>
    )

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (err || !data.user) {
      setError('Credenciales incorrectas.')
      setBusy(false)
      return
    }
    onLogin(data.user)
    setBusy(false)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: "'Nunito',sans-serif",
        background: `radial-gradient(ellipse at 60% 0%, ${'#EEE9FF'} 0%, ${'#F5F4FB'} 60%)`,
      }}
    >
      <div className='bg-white rounded-card p-6 shadow-card border border-border w-full max-w-[380px] px-[36px] py-[44px]'>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src='/logo.png'
            alt='Logo'
            style={{ height: 70, marginBottom: 12 }}
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
          <div style={{ fontSize: 17, fontWeight: 900, color: '#5B35C5' }}>
            Panel Administrativo
          </div>
          <div style={{ fontSize: 12, color: '#6B6B8A', marginTop: 4 }}>
            Educar Para Transformar
          </div>
        </div>
        <form
          onSubmit={handleLogin}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Email
            </span>
            <input
              type='email'
              required
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='admin@email.com'
            />
          </div>
          <div>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Contraseña
            </span>
            <input
              type='password'
              required
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder='••••••••'
            />
          </div>
          {error && (
            <div
              style={{
                background: '#E74C3C12',
                border: '1px solid #E74C3C40',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 12,
                color: '#E74C3C',
                fontWeight: 700,
              }}
            >
              ⚠️ {error}
            </div>
          )}
          <button
            type='submit'
            disabled={busy}
            className={
              busy
                ? 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn p-[14px] text-sm font-extrabold cursor-pointer opacity-60'
                : 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn p-[14px] text-sm font-extrabold cursor-pointer'
            }
          >
            {busy ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════
function Dashboard({
  esAdmin,
  perfil,
  onIr,
}: {
  esAdmin: boolean
  perfil: UsuarioPanel
  onIr: (key: string) => void
}) {
  const [stats, setStats] = useState({
    alumnos: 0,
    docentes: 0,
    inscripciones: 0,
    cuotasPendientes: 0,
  })

  useEffect(() => {
    if (!esAdmin) return
    Promise.all([
      supabase
        .from('alumnos')
        .select('id_alumno', { count: 'exact' })
        .eq('activo', true),
      supabase
        .from('docentes')
        .select('id_docente', { count: 'exact' })
        .eq('activo', true),
      supabase
        .from('inscripciones')
        .select('id_inscripcion', { count: 'exact' })
        .eq('estado', 'Pendiente'),
      supabase
        .from('cuotas')
        .select('id_cuota', { count: 'exact' })
        .in('estado', ['Pendiente', 'Vencida', 'En mora']),
    ]).then(([a, d, i, c]) => {
      setStats({
        alumnos: a.count ?? 0,
        docentes: d.count ?? 0,
        inscripciones: i.count ?? 0,
        cuotasPendientes: c.count ?? 0,
      })
    })
  }, [esAdmin])

  const statItems = esAdmin
    ? [
        {
          icon: '🎓',
          label: 'Alumnos activos',
          value: stats.alumnos,
          color: '#5B35C5',
        },
        {
          icon: '👨‍🏫',
          label: 'Docentes activos',
          value: stats.docentes,
          color: '#2980B9',
        },
        {
          icon: '📋',
          label: 'Inscripciones pendientes',
          value: stats.inscripciones,
          color: '#E67E22',
        },
        {
          icon: '💳',
          label: 'Cuotas sin pagar',
          value: stats.cuotasPendientes,
          color: '#E74C3C',
        },
      ]
    : []

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 6px' }}>
          Bienvenido/a, {perfil.nombre} 👋
        </h2>
        <p style={{ color: '#6B6B8A', margin: 0, fontSize: 14 }}>
          {new Date().toLocaleDateString('es-AR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {esAdmin && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 16,
            marginBottom: 28,
          }}
        >
          {statItems.map((s) => (
            <div
              key={s.label}
              className='bg-white rounded-card p-6 shadow-card border border-border'
              style={{ borderTop: `3px solid ${s.color}` }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: s.color }}>
                {s.value}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: '#6B6B8A',
                  fontWeight: 700,
                  marginTop: 4,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Accesos rápidos
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {(esAdmin ? NAV_ADMIN : NAV_DOCENTE)
            .filter((n) => n.key !== 'dashboard')
            .map((item) => (
              <div
                key={item.key}
                onClick={() => onIr(item.key)}
                className='bg-white rounded-card px-5 py-4 shadow-card border border-border cursor-pointer min-w-[140px] text-center transition-all duration-200 flex-1 hover:-translate-y-[3px] hover:shadow-card-hover'
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
                <div
                  style={{ fontSize: 13, fontWeight: 800, color: '#5B35C5' }}
                >
                  {item.label}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  GESTIÓN DE USUARIOS (crear directivos, docentes, alumnos)
// ═══════════════════════════════════════════════════════════════
function GestionUsuarios({
  prefill,
  onPrefillConsumed,
  rolActor,
}: {
  prefill?: PrefillUsuario | null
  onPrefillConsumed?: () => void
  rolActor?: string
} = {}) {
  // Jerarquía (solo UX): un Directivo no puede activar/desactivar a un Admin u
  // otro Directivo; un Admin puede con todos.
  const puedeGestionar = (rolObjetivo: string) =>
    rolActor === 'Admin' ||
    (rolActor === 'Directivo' && !['Admin', 'Directivo'].includes(rolObjetivo))
  const [usuarios, setUsuarios] = useState<UsuarioPanel[]>([])
  const [cursos, setCursos] = useState<Curso[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    rol: 'Docente',
  })
  const ALUMNO_VACIO = {
    nombre: '',
    apellido: '',
    dni: '',
    fecha_nacimiento: '',
    id_curso: '',
    obra_social: '',
  }
  const [alumnoForm, setAlumnoForm] = useState(ALUMNO_VACIO)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [{ data: us }, { data: cu }] = await Promise.all([
      supabase.from('usuarios').select('*').order('apellido'),
      supabase.from('cursos').select('*').eq('activo', true),
    ])
    if (us) setUsuarios(us as UsuarioPanel[])
    if (cu) setCursos(cu as Curso[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!prefill) return
    setForm({
      email: prefill.email,
      password: prefill.password,
      nombre: prefill.nombre,
      apellido: prefill.apellido,
      rol: prefill.rol,
    })
    setAlumnoForm(
      prefill.alumno
        ? {
            nombre: prefill.alumno.nombre,
            apellido: prefill.alumno.apellido,
            dni: prefill.alumno.dni,
            fecha_nacimiento: prefill.alumno.fecha_nacimiento,
            id_curso: '',
            obra_social: '',
          }
        : ALUMNO_VACIO,
    )
    setMsg('')
    setShowForm(true)
    onPrefillConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill, onPrefillConsumed])

  // Crea el usuario vía edge function y luego fuerza nombre/apellido/rol en la
  // fila de `usuarios`, porque el backend desplegado no respeta esos valores
  // (los crea sin nombre y con un rol por defecto). Devuelve el id_usuario.
  const crearUsuario = async (datos: {
    email: string
    password: string
    nombre: string
    apellido: string
    rol: string
  }): Promise<{ error: string | null; id: string | null }> => {
    const { error } = await supabase.functions.invoke('crear-usuario', {
      body: datos,
    })
    if (error) return { error: error.message, id: null }

    const { data: u } = await supabase
      .from('usuarios')
      .select('id_usuario')
      .eq('email', datos.email)
      .single()
    if (!u?.id_usuario) {
      return {
        error:
          'No se encontró el usuario recién creado para completar sus datos.',
        id: null,
      }
    }
    const { error: updErr } = await supabase
      .from('usuarios')
      .update({
        nombre: datos.nombre,
        apellido: datos.apellido,
        rol: datos.rol,
      })
      .eq('id_usuario', u.id_usuario)
    if (updErr) {
      return {
        error: 'no se pudo guardar nombre/rol del usuario: ' + updErr.message,
        id: u.id_usuario,
      }
    }
    return { error: null, id: u.id_usuario }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    const { error: errUser, id: idUsuario } = await crearUsuario({
      email: form.email,
      password: form.password,
      nombre: form.nombre,
      apellido: form.apellido,
      rol: form.rol,
    })
    if (errUser) {
      setMsg('Error: ' + errUser)
      setLoading(false)
      return
    }

    // Si es Tutor: crear también el usuario del alumno (email generado desde el
    // DNI) y el registro en `alumnos` vinculado al alumno y al tutor.
    if (form.rol === 'Padre') {
      const emailAlumno = `${alumnoForm.dni}@alumno.local`
      const { error: errAlumno, id: idAlumno } = await crearUsuario({
        email: emailAlumno,
        password: alumnoForm.dni,
        nombre: alumnoForm.nombre,
        apellido: alumnoForm.apellido,
        rol: 'Alumno',
      })
      if (errAlumno) {
        setMsg(
          '⚠️ Tutor creado, pero hubo un error al crear el usuario del alumno: ' +
            errAlumno,
        )
        setLoading(false)
        load()
        return
      }

      const { error: alErr } = await supabase.from('alumnos').insert([
        {
          nombre: alumnoForm.nombre,
          apellido: alumnoForm.apellido,
          dni: alumnoForm.dni,
          fecha_nacimiento: alumnoForm.fecha_nacimiento || null,
          id_curso: alumnoForm.id_curso ? Number(alumnoForm.id_curso) : null,
          id_usuario: idAlumno,
          id_usuario_padre: idUsuario,
          obra_social: alumnoForm.obra_social || null,
        },
      ])
      if (alErr) {
        setMsg(
          '⚠️ Usuarios creados, pero hubo un error al registrar el alumno: ' +
            alErr.message,
        )
        setLoading(false)
        load()
        return
      }
    }

    // Si es Docente: crear también su registro en `docentes` para que aparezca
    // en el panel de Docentes (la fila no se crea sola desde el backend).
    if (form.rol === 'Docente') {
      const { error: docErr } = await supabase.from('docentes').insert([
        {
          id_usuario: idUsuario,
          // dni va NULL (no ''): la columna es UNIQUE y '' chocaría entre
          // docentes sin DNI cargado.
          dni: null,
          activo: true,
        },
      ])
      if (docErr) {
        setMsg(
          '⚠️ Usuario creado, pero no se pudo registrar en Docentes: ' +
            docErr.message,
        )
        setLoading(false)
        load()
        return
      }
    }

    setMsg(
      form.rol === 'Padre'
        ? '✅ Tutor y alumno (usuario + registro) creados correctamente.'
        : '✅ Usuario creado correctamente.',
    )
    setForm({
      email: '',
      password: '',
      nombre: '',
      apellido: '',
      rol: 'Docente',
    })
    setAlumnoForm(ALUMNO_VACIO)
    setShowForm(false)
    load()
    setLoading(false)
  }

  const toggleActivo = async (id: string, activo: boolean) => {
    await supabase
      .from('usuarios')
      .update({ activo: !activo })
      .eq('id_usuario', id)
    load()
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
          👥 Usuarios
        </h2>
        <button
          className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : '+ Nuevo usuario'}
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className='bg-white rounded-card p-6 shadow-card border border-border mb-6'>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            Crear nuevo usuario
          </div>
          <form
            onSubmit={handleCreate}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}
          >
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Nombre
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                required
                value={form.nombre}
                onChange={(e) =>
                  setForm((p) => ({ ...p, nombre: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Apellido
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                required
                value={form.apellido}
                onChange={(e) =>
                  setForm((p) => ({ ...p, apellido: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Email
              </span>
              <input
                type='email'
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                required
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Contraseña
              </span>
              <input
                type='password'
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                required
                minLength={6}
                value={form.password}
                onChange={(e) =>
                  setForm((p) => ({ ...p, password: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Rol
              </span>
              <select
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                value={form.rol}
                onChange={(e) =>
                  setForm((p) => ({ ...p, rol: e.target.value }))
                }
              >
                <option value='Docente'>Docente</option>
                <option value='Directivo'>Directivo</option>
                <option value='Admin'>Admin</option>
                <option value='Alumno'>Alumno</option>
                <option value='Padre'>Tutor</option>
              </select>
            </div>

            {form.rol === 'Padre' && (
              <div
                style={{
                  gridColumn: '1/-1',
                  borderTop: `1px solid ${'#E8E6F5'}`,
                  paddingTop: 16,
                  marginTop: 4,
                }}
              >
                <div className='text-[15px] font-extrabold text-text mb-5'>
                  Datos del alumno asociado
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 14,
                  }}
                >
                  <div>
                    <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                      Nombre del alumno
                    </span>
                    <input
                      className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                      required
                      value={alumnoForm.nombre}
                      onChange={(e) =>
                        setAlumnoForm((p) => ({ ...p, nombre: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                      Apellido del alumno
                    </span>
                    <input
                      className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                      required
                      value={alumnoForm.apellido}
                      onChange={(e) =>
                        setAlumnoForm((p) => ({
                          ...p,
                          apellido: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                      DNI del alumno
                    </span>
                    <input
                      className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                      required
                      value={alumnoForm.dni}
                      onChange={(e) =>
                        setAlumnoForm((p) => ({ ...p, dni: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                      Fecha de nacimiento
                    </span>
                    <input
                      type='date'
                      className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                      value={alumnoForm.fecha_nacimiento}
                      onChange={(e) =>
                        setAlumnoForm((p) => ({
                          ...p,
                          fecha_nacimiento: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                      Curso
                    </span>
                    <select
                      className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                      value={alumnoForm.id_curso}
                      onChange={(e) =>
                        setAlumnoForm((p) => ({
                          ...p,
                          id_curso: e.target.value,
                        }))
                      }
                    >
                      <option value=''>Sin asignar</option>
                      {cursos.map((c) => (
                        <option key={c.id_curso} value={c.id_curso}>
                          {c.nivel} — {c.grado_anio} "{c.division}"
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                      Obra social
                    </span>
                    <input
                      className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                      value={alumnoForm.obra_social}
                      onChange={(e) =>
                        setAlumnoForm((p) => ({
                          ...p,
                          obra_social: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    color: '#6B6B8A',
                    background: '#EEE9FF',
                    borderRadius: 8,
                    padding: '8px 12px',
                  }}
                >
                  Acceso del alumno al portal — email:{' '}
                  <strong>
                    {alumnoForm.dni
                      ? `${alumnoForm.dni}@alumno.local`
                      : '(se genera con el DNI)'}
                  </strong>{' '}
                  · contraseña: <strong>el DNI</strong>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type='submit'
                disabled={loading}
                className={
                  loading
                    ? 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer w-full opacity-60'
                    : 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer w-full'
                }
              >
                {loading
                  ? 'Creando...'
                  : form.rol === 'Padre'
                    ? 'Crear tutor y alumno'
                    : 'Crear usuario'}
              </button>
            </div>
            {msg && (
              <div
                style={{
                  gridColumn: '1/-1',
                  fontSize: 13,
                  fontWeight: 700,
                  color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
                }}
              >
                {msg}
              </div>
            )}
          </form>
        </div>
      )}

      {/* Tabla */}
      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Nombre
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Email
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Rol
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Estado
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id_usuario}>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                  {u.apellido}, {u.nombre}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                  {u.email}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span
                    style={badge(
                      u.rol === 'Admin' || u.rol === 'Directivo'
                        ? '#5B35C5'
                        : '#2980B9',
                    )}
                  >
                    {u.rol}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span style={badge(u.activo ? '#27AE60' : '#E74C3C')}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  {puedeGestionar(u.rol) ? (
                    <button
                      className={
                        u.activo
                          ? 'bg-[#E74C3C1A] text-red border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                          : 'bg-[#27AE601A] text-green border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                      }
                      onClick={() => toggleActivo(u.id_usuario, u.activo)}
                    >
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  ) : (
                    <span className='text-[11px] text-textMuted'>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  GESTIÓN DE ALUMNOS
// ═══════════════════════════════════════════════════════════════
function GestionAlumnos() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [cursos, setCursos] = useState<Curso[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [legajoId, setLegajoId] = useState<number | null>(null)
  const [editCursoId, setEditCursoId] = useState<number | null>(null)
  const [editCursoVal, setEditCursoVal] = useState<string>('')
  const [savingCurso, setSavingCurso] = useState(false)
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    fecha_nacimiento: '',
    id_curso: '',
    email_padre: '',
    obra_social: '',
  })

  const load = useCallback(async () => {
    const [{ data: al }, { data: cu }] = await Promise.all([
      supabase
        .from('alumnos')
        .select('*, cursos(nivel, grado_anio, division)')
        .order('apellido'),
      supabase.from('cursos').select('*').eq('activo', true),
    ])
    if (al) setAlumnos(al as unknown as Alumno[])
    if (cu) setCursos(cu as Curso[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    // Buscar usuario padre por email
    const { data: padre } = await supabase
      .from('usuarios')
      .select('id_usuario')
      .eq('email', form.email_padre)
      .single()
    const { error } = await supabase.from('alumnos').insert([
      {
        nombre: form.nombre,
        apellido: form.apellido,
        dni: form.dni,
        fecha_nacimiento: form.fecha_nacimiento,
        id_curso: form.id_curso ? Number(form.id_curso) : null,
        id_usuario_padre: padre?.id_usuario ?? null,
        obra_social: form.obra_social || null,
      },
    ])
    if (error) {
      setMsg('Error: ' + error.message)
    } else {
      setMsg('✅ Alumno registrado.')
      setShowForm(false)
      load()
    }
    setLoading(false)
  }

  const abrirEditCurso = (a: Alumno) => {
    setEditCursoId(a.id_alumno)
    setEditCursoVal(
      cursos
        .find(
          (c) =>
            c.nivel === a.cursos?.nivel &&
            c.grado_anio === a.cursos?.grado_anio &&
            c.division === a.cursos?.division,
        )
        ?.id_curso?.toString() ?? '',
    )
  }

  const guardarCurso = async () => {
    if (editCursoId === null) return
    setSavingCurso(true)
    await supabase
      .from('alumnos')
      .update({ id_curso: editCursoVal ? Number(editCursoVal) : null })
      .eq('id_alumno', editCursoId)
    setSavingCurso(false)
    setEditCursoId(null)
    load()
  }

  if (legajoId !== null) {
    return (
      <LegajoAlumno idAlumno={legajoId} onClose={() => setLegajoId(null)} />
    )
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>🎓 Alumnos</h2>
        <button
          className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : '+ Nuevo alumno'}
        </button>
      </div>

      {showForm && (
        <div className='bg-white rounded-card p-6 shadow-card border border-border mb-6'>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            Registrar alumno
          </div>
          <form
            onSubmit={handleCreate}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}
          >
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Nombre
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                required
                value={form.nombre}
                onChange={(e) =>
                  setForm((p) => ({ ...p, nombre: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Apellido
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                required
                value={form.apellido}
                onChange={(e) =>
                  setForm((p) => ({ ...p, apellido: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                DNI
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                required
                value={form.dni}
                onChange={(e) =>
                  setForm((p) => ({ ...p, dni: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Fecha de nacimiento
              </span>
              <input
                type='date'
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                required
                value={form.fecha_nacimiento}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fecha_nacimiento: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Curso
              </span>
              <select
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                value={form.id_curso}
                onChange={(e) =>
                  setForm((p) => ({ ...p, id_curso: e.target.value }))
                }
              >
                <option value=''>Sin asignar</option>
                {cursos.map((c) => (
                  <option key={c.id_curso} value={c.id_curso}>
                    {c.nivel} — {c.grado_anio} "{c.division}"
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Email del padre/tutor
              </span>
              <input
                type='email'
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                value={form.email_padre}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email_padre: e.target.value }))
                }
                placeholder='Debe existir en usuarios'
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Obra social
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                value={form.obra_social}
                onChange={(e) =>
                  setForm((p) => ({ ...p, obra_social: e.target.value }))
                }
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type='submit'
                disabled={loading}
                className={
                  loading
                    ? 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer w-full opacity-60'
                    : 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer w-full'
                }
              >
                {loading ? 'Guardando...' : 'Registrar alumno'}
              </button>
            </div>
            {msg && (
              <div
                style={{
                  gridColumn: '1/-1',
                  fontSize: 13,
                  fontWeight: 700,
                  color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
                }}
              >
                {msg}
              </div>
            )}
          </form>
        </div>
      )}

      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Alumno
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                DNI
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Curso
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Estado
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {alumnos.map((a) => (
              <tr key={a.id_alumno}>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                  {a.apellido}, {a.nombre}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                  {a.dni}
                </td>
                <td
                  className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'
                  style={{ minWidth: 260 }}
                >
                  {editCursoId === a.id_alumno ? (
                    <div className='flex items-center gap-2'>
                      <select
                        className='flex-1 px-[10px] py-[6px] rounded-input border-2 border-border text-[13px] text-text outline-none appearance-none'
                        value={editCursoVal}
                        onChange={(e) => setEditCursoVal(e.target.value)}
                        autoFocus
                      >
                        <option value=''>Sin asignar</option>
                        {cursos.map((c) => (
                          <option key={c.id_curso} value={c.id_curso}>
                            {c.nivel} — {c.grado_anio} "{c.division}"
                          </option>
                        ))}
                      </select>
                      <button
                        className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer shrink-0'
                        disabled={savingCurso}
                        onClick={guardarCurso}
                      >
                        {savingCurso ? '...' : '✓'}
                      </button>
                      <button
                        className='bg-[#E74C3C1A] text-red border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer shrink-0'
                        onClick={() => setEditCursoId(null)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className='flex items-center gap-2'>
                      <span
                        className={a.cursos ? 'text-text' : 'text-textMuted'}
                      >
                        {a.cursos
                          ? `${a.cursos.nivel} — ${a.cursos.grado_anio} "${a.cursos.division}"`
                          : 'Sin asignar'}
                      </span>
                      <button
                        className='bg-purpleLight text-purple-700 border-0 rounded py-[3px] px-[8px] text-[10px] font-extrabold cursor-pointer shrink-0 opacity-70 hover:opacity-100 transition-opacity'
                        onClick={() => abrirEditCurso(a)}
                      >
                        Cambiar
                      </button>
                    </div>
                  )}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span style={badge(a.activo ? '#27AE60' : '#E74C3C')}>
                    {a.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <button
                    className='bg-purpleLight text-purple-700 border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                    onClick={() => setLegajoId(a.id_alumno)}
                  >
                    Ver legajo
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  LEGAJO DEL ALUMNO — historial consolidado + documentación (R1/R3)
// ═══════════════════════════════════════════════════════════════
interface AlumnoLegajo {
  id_alumno: number
  nombre: string
  apellido: string
  dni: string
  fecha_nacimiento: string | null
  obra_social: string | null
  activo: boolean
  cursos: { nivel: string; grado_anio: string; division: string } | null
}

const TIPOS_DOC = [
  'DNI',
  'Partida de nacimiento',
  'Certificado médico',
  'Boletín / certificado de estudios',
  'Ficha de inscripción',
  'Otro',
]

function LegajoAlumno({
  idAlumno,
  onClose,
}: {
  idAlumno: number
  onClose: () => void
}) {
  const [alumno, setAlumno] = useState<AlumnoLegajo | null>(null)
  const [califs, setCalifs] = useState<Calificacion[]>([])
  const [asist, setAsist] = useState<{ estado: string }[]>([])
  const [amonest, setAmonest] = useState<
    {
      id_amonestacion: number
      tipo: string
      descripcion: string
      fecha: string
    }[]
  >([])
  const [documentos, setDocumentos] = useState<DocumentoAlumno[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [docNombre, setDocNombre] = useState('')
  const [docTipo, setDocTipo] = useState(TIPOS_DOC[0])
  const [subiendo, setSubiendo] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const { data: al } = await supabase
      .from('alumnos')
      .select(
        'id_alumno, nombre, apellido, dni, fecha_nacimiento, obra_social, activo, cursos(nivel, grado_anio, division)',
      )
      .eq('id_alumno', idAlumno)
      .single()
    if (al) setAlumno(al as unknown as AlumnoLegajo)

    const { data: ca } = await supabase
      .from('calificaciones')
      .select('*, asignaciones(materias(nombre))')
      .eq('id_alumno', idAlumno)
      .order('fecha_carga', { ascending: false })
    if (ca) setCalifs(ca as unknown as Calificacion[])

    const { data: as } = await supabase
      .from('asistencias')
      .select('estado')
      .eq('id_alumno', idAlumno)
    if (as) setAsist(as as { estado: string }[])

    const { data: am } = await supabase
      .from('amonestaciones')
      .select('id_amonestacion, tipo, descripcion, fecha')
      .eq('id_alumno', idAlumno)
      .order('fecha', { ascending: false })
    if (am) setAmonest(am as typeof amonest)

    const { data: doc } = await supabase
      .from('documentos_alumno')
      .select('*')
      .eq('id_alumno', idAlumno)
      .order('fecha_carga', { ascending: false })
    if (doc) setDocumentos(doc as DocumentoAlumno[])
  }, [idAlumno])

  useEffect(() => {
    load()
  }, [load])

  const subirDocumento = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    if (!file) {
      setMsg('Seleccioná un archivo.')
      return
    }
    setSubiendo(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${idAlumno}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 9)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('documentos-alumnos')
        .upload(fileName, file)
      if (upErr) throw new Error(upErr.message)
      const { data } = supabase.storage
        .from('documentos-alumnos')
        .getPublicUrl(fileName)
      const { error } = await supabase.from('documentos_alumno').insert([
        {
          id_alumno: idAlumno,
          nombre: docNombre || file.name,
          tipo: docTipo,
          url_archivo: data.publicUrl,
        },
      ])
      if (error) throw new Error(error.message)
      setMsg('✅ Documento cargado.')
      setFile(null)
      setDocNombre('')
      load()
    } catch (err) {
      setMsg('Error: ' + (err as Error).message)
    } finally {
      setSubiendo(false)
    }
  }

  const eliminarDocumento = async (d: DocumentoAlumno) => {
    if (!window.confirm('¿Eliminar este documento?')) return
    if (d.url_archivo.includes('documentos-alumnos')) {
      const idx = d.url_archivo.indexOf('documentos-alumnos/')
      const path = d.url_archivo.slice(idx + 'documentos-alumnos/'.length)
      await supabase.storage.from('documentos-alumnos').remove([path])
    }
    await supabase
      .from('documentos_alumno')
      .delete()
      .eq('id_documento', d.id_documento)
    load()
  }

  // ── Derivados ──────────────────────────────────────────────
  const promedioGeneral = califs.length
    ? (califs.reduce((a, c) => a + Number(c.nota), 0) / califs.length).toFixed(
        2,
      )
    : '—'

  const asistResumen = asist.reduce(
    (acc, a) => {
      acc[a.estado] = (acc[a.estado] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
  const totalAsist = asist.length
  const pctPresente =
    totalAsist > 0
      ? Math.round(((asistResumen['Presente'] ?? 0) / totalAsist) * 100)
      : null

  const dato = (etiqueta: string, valor: string) => (
    <div>
      <div className='text-[11px] font-extrabold text-textMuted block mb-[2px]'>
        {etiqueta}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{valor}</div>
    </div>
  )

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
          📁 Legajo del alumno
        </h2>
        <button
          className='bg-purpleLight text-purple-700 border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
          onClick={onClose}
        >
          ← Volver a la lista
        </button>
      </div>

      {/* Datos personales */}
      <div className='bg-white rounded-card p-6 shadow-card border border-border mb-5'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Datos personales
        </div>
        {alumno ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 18,
            }}
          >
            {dato('Apellido y nombre', `${alumno.apellido}, ${alumno.nombre}`)}
            {dato('DNI', alumno.dni)}
            {dato(
              'Fecha de nacimiento',
              alumno.fecha_nacimiento
                ? new Date(
                    alumno.fecha_nacimiento + 'T00:00:00',
                  ).toLocaleDateString('es-AR')
                : '—',
            )}
            {dato(
              'Curso',
              alumno.cursos
                ? `${alumno.cursos.nivel} — ${alumno.cursos.grado_anio} "${alumno.cursos.division}"`
                : 'Sin asignar',
            )}
            {dato('Obra social', alumno.obra_social ?? '—')}
            {dato('Estado', alumno.activo ? 'Activo' : 'Inactivo')}
          </div>
        ) : (
          <div style={{ color: '#6B6B8A', fontSize: 13 }}>Cargando...</div>
        )}
      </div>

      {/* Resumen académico */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div className='bg-white rounded-card p-6 shadow-card border border-border'>
          <div className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
            Promedio general
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#5B35C5' }}>
            {promedioGeneral}
          </div>
          <div style={{ fontSize: 12, color: '#6B6B8A' }}>
            {califs.length} calificaciones registradas
          </div>
        </div>
        <div className='bg-white rounded-card p-6 shadow-card border border-border'>
          <div className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
            Asistencia
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#27AE60' }}>
            {pctPresente !== null ? `${pctPresente}%` : '—'}
          </div>
          <div style={{ fontSize: 12, color: '#6B6B8A' }}>
            {asistResumen['Presente'] ?? 0} pres. ·{' '}
            {asistResumen['Ausente'] ?? 0} aus. · {asistResumen['Tarde'] ?? 0}{' '}
            tarde
          </div>
        </div>
        <div className='bg-white rounded-card p-6 shadow-card border border-border'>
          <div className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
            Amonestaciones
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#E67E22' }}>
            {amonest.length}
          </div>
          <div style={{ fontSize: 12, color: '#6B6B8A' }}>
            registradas en su trayectoria
          </div>
        </div>
      </div>

      {/* Historial de calificaciones */}
      <div className='bg-white rounded-card p-6 shadow-card border border-border mb-5'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Historial de calificaciones
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Materia
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Trimestre
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Evaluación
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Nota
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Fecha
              </th>
            </tr>
          </thead>
          <tbody>
            {califs.map((c) => (
              <tr key={c.id_calificacion}>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                  {c.asignaciones?.materias?.nombre ?? '—'}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  {c.trimestre}°
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                  {c.tipo_evaluacion}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span
                    style={badge(Number(c.nota) >= 6 ? '#27AE60' : '#E74C3C')}
                  >
                    {c.nota}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted text-xs'>
                  {new Date(c.fecha_carga).toLocaleDateString('es-AR')}
                </td>
              </tr>
            ))}
            {califs.length === 0 && (
              <tr>
                <td
                  className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'
                  colSpan={5}
                >
                  Sin calificaciones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Amonestaciones */}
      <div className='bg-white rounded-card p-6 shadow-card border border-border mb-5'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Amonestaciones
        </div>
        {amonest.length === 0 ? (
          <div style={{ color: '#6B6B8A', fontSize: 13 }}>
            Sin amonestaciones registradas.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {amonest.map((a) => (
              <div
                key={a.id_amonestacion}
                style={{
                  border: `1px solid ${'#E8E6F5'}`,
                  borderRadius: 10,
                  padding: 12,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <span className='inline-block bg-[#E67E221A] text-orange rounded-[20px] px-[10px] py-[3px] text-[11px] font-extrabold'>
                  {a.tipo}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{a.descripcion}</div>
                  <div style={{ fontSize: 11, color: '#6B6B8A' }}>
                    {new Date(a.fecha).toLocaleDateString('es-AR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documentación */}
      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Documentación del legajo
        </div>
        <form
          onSubmit={subirDocumento}
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            marginBottom: 18,
          }}
        >
          <div style={{ flex: '1 1 200px' }}>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Nombre del documento
            </span>
            <input
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
              value={docNombre}
              placeholder='Ej: DNI frente y dorso'
              onChange={(e) => setDocNombre(e.target.value)}
            />
          </div>
          <div>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Tipo
            </span>
            <select
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none w-[220px]'
              value={docTipo}
              onChange={(e) => setDocTipo(e.target.value)}
            >
              {TIPOS_DOC.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Archivo
            </span>
            <input
              type='file'
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border !p-[7px]'
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <button
            type='submit'
            disabled={subiendo}
            className={
              subiendo
                ? 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer opacity-60'
                : 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
            }
          >
            {subiendo ? 'Subiendo...' : 'Subir documento'}
          </button>
        </form>
        {msg && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 14,
              color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
            }}
          >
            {msg}
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Documento
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Tipo
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Fecha
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {documentos.map((d) => (
              <tr key={d.id_documento}>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                  {d.nombre}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span className='inline-block bg-[#2980B91A] text-blue rounded-[20px] px-[10px] py-[3px] text-[11px] font-extrabold'>
                    {d.tipo ?? 'Documento'}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted text-xs'>
                  {new Date(d.fecha_carga).toLocaleDateString('es-AR')}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <a
                      href={d.url_archivo}
                      target='_blank'
                      rel='noreferrer'
                      className='bg-purpleLight text-purple-700 border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer py-[6px] px-[12px] !text-xs no-underline'
                    >
                      Ver
                    </a>
                    <button
                      className='bg-[#E74C3C1A] text-red border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                      onClick={() => eliminarDocumento(d)}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {documentos.length === 0 && (
              <tr>
                <td
                  className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'
                  colSpan={4}
                >
                  Sin documentación cargada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  GESTIÓN DE DOCENTES
// ═══════════════════════════════════════════════════════════════
function GestionDocentes() {
  const [docentes, setDocentes] = useState<Docente[]>([])

  useEffect(() => {
    supabase
      .from('docentes')
      .select('*, usuarios(nombre, apellido, email)')
      .order('id_docente')
      .then(({ data }) => {
        if (data) setDocentes(data as unknown as Docente[])
      })
  }, [])

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        👨‍🏫 Docentes
      </h2>
      <div className='bg-white rounded-card p-6 shadow-card border border-border mb-3'>
        <p style={{ fontSize: 13, color: '#6B6B8A', margin: 0 }}>
          Para agregar docentes, primero creá el usuario desde{' '}
          <strong>Usuarios</strong> con rol <strong>Docente</strong>. El
          registro en esta tabla se crea automáticamente.
        </p>
      </div>
      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Docente
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Email
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Especialidad
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {docentes.map((d) => (
              <tr key={d.id_docente}>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                  {d.usuarios?.apellido}, {d.usuarios?.nombre}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                  {d.usuarios?.email}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  {d.especialidad ?? '—'}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span style={badge(d.activo ? '#27AE60' : '#E74C3C')}>
                    {d.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  GESTIÓN DE CURSOS
// ═══════════════════════════════════════════════════════════════
function GestionCursos() {
  const [cursos, setCursos] = useState<Curso[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    nivel: 'Inicial',
    grado_anio: '',
    division: 'A',
    capacidad_maxima: '30',
  })

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('cursos')
      .select('*')
      .eq('activo', true)
      .order('nivel')
    if (data) setCursos(data as Curso[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    // Obtener período activo
    const { data: periodo } = await supabase
      .from('periodos_academicos')
      .select('id_periodo')
      .eq('activo', true)
      .single()
    const { error } = await supabase.from('cursos').insert([
      {
        nivel: form.nivel,
        grado_anio: form.grado_anio,
        division: form.division,
        capacidad_maxima: Number(form.capacidad_maxima),
        id_periodo: periodo?.id_periodo ?? null,
      },
    ])
    if (error) setMsg('Error: ' + error.message)
    else {
      setMsg('✅ Curso creado.')
      setShowForm(false)
      load()
    }
    setLoading(false)
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>🏫 Cursos</h2>
        <button
          className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : '+ Nuevo curso'}
        </button>
      </div>

      {showForm && (
        <div className='bg-white rounded-card p-6 shadow-card border border-border mb-6'>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            Crear curso
          </div>
          <form
            onSubmit={handleCreate}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: 14,
            }}
          >
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Nivel
              </span>
              <select
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                value={form.nivel}
                onChange={(e) =>
                  setForm((p) => ({ ...p, nivel: e.target.value }))
                }
              >
                <option>Inicial</option>
                <option>Primario</option>
                <option>Secundario</option>
              </select>
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Grado / Año
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                required
                value={form.grado_anio}
                placeholder='1er Grado'
                onChange={(e) =>
                  setForm((p) => ({ ...p, grado_anio: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                División
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                required
                value={form.division}
                placeholder='A'
                onChange={(e) =>
                  setForm((p) => ({ ...p, division: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Capacidad máx.
              </span>
              <input
                type='number'
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                value={form.capacidad_maxima}
                onChange={(e) =>
                  setForm((p) => ({ ...p, capacidad_maxima: e.target.value }))
                }
              />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <button
                type='submit'
                disabled={loading}
                className={
                  loading
                    ? 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer opacity-60'
                    : 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
                }
              >
                {loading ? 'Guardando...' : 'Crear curso'}
              </button>
            </div>
            {msg && (
              <div
                style={{
                  gridColumn: '1/-1',
                  fontSize: 13,
                  fontWeight: 700,
                  color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
                }}
              >
                {msg}
              </div>
            )}
          </form>
        </div>
      )}

      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Nivel
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Grado / Año
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                División
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Capacidad
              </th>
            </tr>
          </thead>
          <tbody>
            {cursos.map((c) => (
              <tr key={c.id_curso}>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span
                    style={badge(
                      c.nivel === 'Inicial'
                        ? '#27AE60'
                        : c.nivel === 'Primario'
                          ? '#2980B9'
                          : '#5B35C5',
                    )}
                  >
                    {c.nivel}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                  {c.grado_anio}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  División {c.division}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                  {c.capacidad_maxima} alumnos
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  GESTIÓN DE MATERIAS
// ═══════════════════════════════════════════════════════════════
function GestionMaterias() {
  const [materias, setMaterias] = useState<Materia[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', horas_semanales: '4' })
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('materias').select('*').order('nombre')
    if (data) setMaterias(data as Materia[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    const { error } = await supabase
      .from('materias')
      .insert([
        { nombre: form.nombre, horas_semanales: Number(form.horas_semanales) },
      ])
    if (error) setMsg('Error: ' + error.message)
    else {
      setMsg('✅ Materia creada.')
      setShowForm(false)
      load()
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
          📚 Materias
        </h2>
        <button
          className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : '+ Nueva materia'}
        </button>
      </div>
      {showForm && (
        <div className='bg-white rounded-card p-6 shadow-card border border-border mb-6'>
          <form
            onSubmit={handleCreate}
            style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}
          >
            <div style={{ flex: 2 }}>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Nombre de la materia
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                required
                value={form.nombre}
                onChange={(e) =>
                  setForm((p) => ({ ...p, nombre: e.target.value }))
                }
              />
            </div>
            <div style={{ flex: 1 }}>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Horas semanales
              </span>
              <input
                type='number'
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                value={form.horas_semanales}
                onChange={(e) =>
                  setForm((p) => ({ ...p, horas_semanales: e.target.value }))
                }
              />
            </div>
            <button
              type='submit'
              className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
            >
              Guardar
            </button>
          </form>
          {msg && (
            <div
              style={{
                marginTop: 10,
                fontSize: 13,
                fontWeight: 700,
                color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
              }}
            >
              {msg}
            </div>
          )}
        </div>
      )}
      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Materia
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Horas semanales
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {materias.map((m) => (
              <tr key={m.id_materia}>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                  {m.nombre}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  {m.horas_semanales} hs
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span style={badge(m.activo ? '#27AE60' : '#E74C3C')}>
                    {m.activo ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  ASIGNACIONES (docente + materia + curso)
// ═══════════════════════════════════════════════════════════════
function GestionAsignaciones() {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [docentes, setDocentes] = useState<Docente[]>([])
  const [materias, setMaterias] = useState<Materia[]>([])
  const [cursos, setCursos] = useState<Curso[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    id_docente: '',
    id_materia: '',
    id_curso: '',
  })
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [{ data: as }, { data: do_ }, { data: ma }, { data: cu }] =
      await Promise.all([
        supabase
          .from('asignaciones')
          .select(
            '*, docentes(usuarios(nombre,apellido)), materias(nombre), cursos(nivel,grado_anio,division)',
          )
          .eq('activo', true),
        supabase
          .from('docentes')
          .select('*, usuarios(nombre,apellido)')
          .eq('activo', true),
        supabase.from('materias').select('*').eq('activo', true),
        supabase.from('cursos').select('*').eq('activo', true),
      ])
    if (as) setAsignaciones(as as unknown as Asignacion[])
    if (do_) setDocentes(do_ as unknown as Docente[])
    if (ma) setMaterias(ma as Materia[])
    if (cu) setCursos(cu as Curso[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    const { data: periodo } = await supabase
      .from('periodos_academicos')
      .select('id_periodo')
      .eq('activo', true)
      .single()
    const { error } = await supabase.from('asignaciones').insert([
      {
        id_docente: Number(form.id_docente),
        id_materia: Number(form.id_materia),
        id_curso: Number(form.id_curso),
        id_periodo: periodo?.id_periodo ?? null,
      },
    ])
    if (error) setMsg('Error: ' + error.message)
    else {
      setMsg('✅ Asignación creada.')
      setShowForm(false)
      load()
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
          🔗 Asignaciones
        </h2>
        <button
          className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : '+ Nueva asignación'}
        </button>
      </div>
      {showForm && (
        <div className='bg-white rounded-card p-6 shadow-card border border-border mb-6'>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            Asignar docente a materia y curso
          </div>
          <form
            onSubmit={handleCreate}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 14,
            }}
          >
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Docente
              </span>
              <select
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                required
                value={form.id_docente}
                onChange={(e) =>
                  setForm((p) => ({ ...p, id_docente: e.target.value }))
                }
              >
                <option value=''>Seleccioná...</option>
                {docentes.map((d) => (
                  <option key={d.id_docente} value={d.id_docente}>
                    {d.usuarios?.apellido}, {d.usuarios?.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Materia
              </span>
              <select
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                required
                value={form.id_materia}
                onChange={(e) =>
                  setForm((p) => ({ ...p, id_materia: e.target.value }))
                }
              >
                <option value=''>Seleccioná...</option>
                {materias.map((m) => (
                  <option key={m.id_materia} value={m.id_materia}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Curso
              </span>
              <select
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                required
                value={form.id_curso}
                onChange={(e) =>
                  setForm((p) => ({ ...p, id_curso: e.target.value }))
                }
              >
                <option value=''>Seleccioná...</option>
                {cursos.map((c) => (
                  <option key={c.id_curso} value={c.id_curso}>
                    {c.nivel} — {c.grado_anio} "{c.division}"
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <button
                type='submit'
                className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
              >
                Crear asignación
              </button>
            </div>
            {msg && (
              <div
                style={{
                  gridColumn: '1/-1',
                  fontSize: 13,
                  fontWeight: 700,
                  color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
                }}
              >
                {msg}
              </div>
            )}
          </form>
        </div>
      )}
      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Docente
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Materia
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Curso
              </th>
            </tr>
          </thead>
          <tbody>
            {asignaciones.map((a) => (
              <tr key={a.id_asignacion}>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                  {a.docentes?.usuarios?.apellido},{' '}
                  {a.docentes?.usuarios?.nombre}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  {a.materias?.nombre}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  {a.cursos?.nivel} — {a.cursos?.grado_anio} "
                  {a.cursos?.division}"
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  CUOTAS — Generación automática
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
//  NOTIFICACIONES AUTOMÁTICAS A LAS FAMILIAS (R6)
//  Crea avisos en la tabla `notificaciones`, dirigidos al usuario
//  del padre/tutor (o, si no tiene, al del propio alumno).
// ═══════════════════════════════════════════════════════════════
async function notificarFamilias(
  items: { id_alumno: number; titulo: string; mensaje: string }[],
  tipo: string,
) {
  if (items.length === 0) return
  const ids = [...new Set(items.map((i) => i.id_alumno))]
  const { data: alumnos } = await supabase
    .from('alumnos')
    .select('id_alumno, id_usuario, id_usuario_padre')
    .in('id_alumno', ids)

  const destinoPorAlumno: Record<number, string> = {}
  ;(alumnos ?? []).forEach(
    (a: {
      id_alumno: number
      id_usuario: string | null
      id_usuario_padre: string | null
    }) => {
      const destino = a.id_usuario_padre ?? a.id_usuario
      if (destino) destinoPorAlumno[a.id_alumno] = destino
    },
  )

  const rows = items
    .filter((i) => destinoPorAlumno[i.id_alumno])
    .map((i) => ({
      id_usuario_destino: destinoPorAlumno[i.id_alumno],
      titulo: i.titulo,
      mensaje: i.mensaje,
      tipo,
      leida: false,
    }))

  if (rows.length) {
    await supabase.from('notificaciones').insert(rows)
    // R6 · Email automático: DESACTIVADO a propósito.
    // Esta es una app de muestra y la tabla `usuarios` tiene emails inventados;
    // enviar correos reales podría spamear a desconocidos. La notificación in-app
    // ya quedó guardada arriba, que es lo que se muestra en la defensa.
    // (Para reactivarlo: descomentar la invocación a 'enviar-notificacion' y
    // configurar el allowlist en la Edge Function.)
  }
}

function GestionCuotas() {
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    mes: String(new Date().getMonth() + 1),
    anio: String(new Date().getFullYear()),
    monto_base: '',
  })

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('cuotas')
      .select('*, alumnos(nombre, apellido)')
      .order('fecha_vencimiento', { ascending: false })
      .limit(50)
    if (data) setCuotas(data as unknown as Cuota[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const generarCuotas = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    // Traer todos los alumnos activos
    const { data: alumnos } = await supabase
      .from('alumnos')
      .select('id_alumno')
      .eq('activo', true)
    if (!alumnos || alumnos.length === 0) {
      setMsg('No hay alumnos activos.')
      setLoading(false)
      return
    }

    const mes = Number(form.mes)
    const anio = Number(form.anio)
    const vencimiento = new Date(anio, mes - 1, 10) // vence el 10 de cada mes
    const montoBase = Number(form.monto_base)

    // Becas activas → mapa id_alumno → porcentaje de descuento
    const { data: becas } = await supabase
      .from('becas')
      .select('id_alumno, porcentaje')
      .eq('activo', true)
    const becaPorAlumno: Record<number, number> = {}
    ;(becas ?? []).forEach((b: { id_alumno: number; porcentaje: number }) => {
      becaPorAlumno[b.id_alumno] = Number(b.porcentaje)
    })

    const cuotasNuevas = alumnos.map((a) => {
      const pct = becaPorAlumno[a.id_alumno] ?? 0
      return {
        id_alumno: a.id_alumno,
        mes,
        anio,
        monto_base: montoBase,
        recargo: 0,
        descuento: Math.round((montoBase * pct) / 100),
        fecha_vencimiento: vencimiento.toISOString().split('T')[0],
        estado: 'Pendiente',
      }
    })

    // upsert para no duplicar si ya existen
    const { error } = await supabase
      .from('cuotas')
      .upsert(cuotasNuevas, { onConflict: 'id_alumno,mes,anio' })
    if (error) setMsg('Error: ' + error.message)
    else {
      setMsg(
        `✅ ${alumnos.length} cuotas generadas para ${MESES[mes - 1]} ${anio}.`,
      )
      load()
    }
    setLoading(false)
  }

  // R6 · Marca como vencidas las cuotas impagas pasadas de fecha
  //       y notifica automáticamente a las familias.
  const procesarVencimientos = async () => {
    setLoading(true)
    setMsg('')
    const hoy = new Date().toISOString().slice(0, 10)
    const { data: vencidas } = await supabase
      .from('cuotas')
      .select('id_cuota, id_alumno, mes, anio')
      .eq('estado', 'Pendiente')
      .lt('fecha_vencimiento', hoy)
    if (!vencidas || vencidas.length === 0) {
      setMsg('No hay cuotas pendientes que hayan vencido.')
      setLoading(false)
      return
    }
    await supabase
      .from('cuotas')
      .update({ estado: 'Vencida' })
      .in(
        'id_cuota',
        vencidas.map((c) => c.id_cuota),
      )
    await notificarFamilias(
      vencidas.map((c) => ({
        id_alumno: c.id_alumno,
        titulo: 'Cuota vencida',
        mensaje: `La cuota de ${MESES[c.mes - 1]} ${c.anio} se encuentra vencida. Te pedimos regularizar el pago.`,
      })),
      'Cuota',
    )
    setMsg(
      `✅ ${vencidas.length} cuota(s) marcadas como vencidas y familias notificadas.`,
    )
    load()
    setLoading(false)
  }

  const CUOTA_COLOR: Record<string, string> = {
    Pendiente: '#E67E22',
    Pagada: '#27AE60',
    Vencida: '#E74C3C',
    'En mora': '#C0392B',
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        💳 Cuotas
      </h2>

      {/* Generador */}
      <div className='bg-white rounded-card p-6 shadow-card border border-border mb-6'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Generar cuotas automáticamente para todos los alumnos
        </div>
        <form
          onSubmit={generarCuotas}
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Mes
            </span>
            <select
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border w-[160px] appearance-none'
              value={form.mes}
              onChange={(e) => setForm((p) => ({ ...p, mes: e.target.value }))}
            >
              {MESES.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Año
            </span>
            <input
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border w-[100px]'
              value={form.anio}
              onChange={(e) => setForm((p) => ({ ...p, anio: e.target.value }))}
            />
          </div>
          <div>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Monto base ($)
            </span>
            <input
              type='number'
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border w-[160px]'
              required
              value={form.monto_base}
              onChange={(e) =>
                setForm((p) => ({ ...p, monto_base: e.target.value }))
              }
              placeholder='15000'
            />
          </div>
          <button
            type='submit'
            disabled={loading}
            className={
              loading
                ? 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer opacity-60'
                : 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
            }
          >
            {loading ? 'Generando...' : '⚡ Generar cuotas'}
          </button>
          <button
            type='button'
            disabled={loading}
            onClick={procesarVencimientos}
            className='bg-purpleLight text-purple-700 border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
            title='Marca como vencidas las cuotas impagas pasadas de fecha y notifica a las familias'
          >
            ⏰ Procesar vencimientos
          </button>
        </form>
        {msg && (
          <div
            style={{
              marginTop: 12,
              fontSize: 13,
              fontWeight: 700,
              color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
            }}
          >
            {msg}
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Últimas cuotas generadas
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Alumno
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Período
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Monto base
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Descuento beca
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Neto a pagar
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Vencimiento
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {cuotas.map((c) => {
              const desc = c.descuento ?? 0
              return (
                <tr key={c.id_cuota}>
                  <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                    {c.alumnos?.apellido}, {c.alumnos?.nombre}
                  </td>
                  <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                    {MESES[c.mes - 1]} {c.anio}
                  </td>
                  <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                    ${c.monto_base.toLocaleString('es-AR')}
                  </td>
                  <td
                    className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'
                    style={{ color: desc > 0 ? '#27AE60' : '#6B6B8A' }}
                  >
                    {desc > 0 ? `– $${desc.toLocaleString('es-AR')}` : '—'}
                  </td>
                  <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-extrabold text-purple-700'>
                    ${(c.monto_base - desc).toLocaleString('es-AR')}
                  </td>
                  <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                    {c.fecha_vencimiento}
                  </td>
                  <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                    <span style={badge(CUOTA_COLOR[c.estado] ?? '#6B6B8A')}>
                      {c.estado}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  REGISTRO DE PAGOS
// ═══════════════════════════════════════════════════════════════
const METODOS_PAGO = [
  'Efectivo',
  'Transferencia',
  'Tarjeta de débito',
  'Tarjeta de crédito',
  'Cheque',
  'Otro',
]

const CUOTA_ESTADO_COLOR: Record<string, string> = {
  Pendiente: '#E67E22',
  Vencida: '#E74C3C',
  'En mora': '#C0392B',
}

function RegistrarPagos() {
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroAnio, setFiltroAnio] = useState(String(new Date().getFullYear()))
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [selCuota, setSelCuota] = useState<number | null>(null)
  const [formPago, setFormPago] = useState({
    fecha_pago: new Date().toISOString().split('T')[0],
    metodo_pago: 'Efectivo',
  })

  const load = useCallback(async () => {
    let q = supabase
      .from('cuotas')
      .select('*, alumnos(nombre, apellido)')
      .in('estado', ['Pendiente', 'Vencida', 'En mora'])
      .order('fecha_vencimiento', { ascending: true })

    if (filtroAnio) q = q.eq('anio', Number(filtroAnio))
    if (filtroMes) q = q.eq('mes', Number(filtroMes))

    const { data } = await q
    if (data) setCuotas(data as unknown as Cuota[])
  }, [filtroAnio, filtroMes])

  useEffect(() => {
    load()
  }, [load])

  const registrarPago = async (c: Cuota) => {
    setLoading(true)
    setMsg('')
    const { error } = await supabase
      .from('cuotas')
      .update({
        estado: 'Pagada',
        fecha_pago: formPago.fecha_pago,
        metodo_pago: formPago.metodo_pago,
      })
      .eq('id_cuota', c.id_cuota)
    if (error) {
      setMsg('❌ Error al registrar: ' + error.message)
    } else {
      setMsg(
        `✅ Pago de ${c.alumnos?.apellido}, ${c.alumnos?.nombre} registrado correctamente.`,
      )
      setSelCuota(null)
      load()
    }
    setLoading(false)
  }

  const cuotasFiltradas = cuotas.filter((c) => {
    if (filtroEstado !== 'todos' && c.estado !== filtroEstado) return false
    if (busqueda) {
      const term = busqueda.toLowerCase()
      const nombre = `${c.alumnos?.apellido} ${c.alumnos?.nombre}`.toLowerCase()
      if (!nombre.includes(term)) return false
    }
    return true
  })

  const totalPendiente = cuotasFiltradas.reduce(
    (acc, c) => acc + c.monto_base - (c.descuento ?? 0),
    0,
  )

  return (
    <div className='flex flex-col gap-6'>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
        💰 Registro de pagos
      </h2>

      {/* Filtros */}
      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <div className='flex flex-wrap gap-4 items-end'>
          <div className='flex-1' style={{ minWidth: 200 }}>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Buscar alumno
            </span>
            <input
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
              placeholder='Apellido o nombre...'
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Mes
            </span>
            <select
              className='px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
            >
              <option value=''>Todos</option>
              {MESES.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Año
            </span>
            <input
              className='w-[90px] px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
              value={filtroAnio}
              onChange={(e) => setFiltroAnio(e.target.value)}
            />
          </div>
          <div>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Estado
            </span>
            <select
              className='px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value='todos'>Todos los pendientes</option>
              <option value='Pendiente'>Pendiente</option>
              <option value='Vencida'>Vencida</option>
              <option value='En mora'>En mora</option>
            </select>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      <div className='grid grid-cols-3 gap-4'>
        {[
          {
            label: 'Total pendiente',
            value: `$${totalPendiente.toLocaleString('es-AR')}`,
            color: '#5B35C5',
          },
          {
            label: 'Cuotas sin pagar',
            value: cuotasFiltradas.length,
            color: '#E67E22',
          },
          {
            label: 'Vencidas',
            value: cuotasFiltradas.filter(
              (c) => c.estado === 'Vencida' || c.estado === 'En mora',
            ).length,
            color: '#E74C3C',
          },
        ].map((s) => (
          <div
            key={s.label}
            className='bg-white rounded-card p-6 shadow-card border border-border text-center'
          >
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>
              {s.value}
            </div>
            <div className='text-[12px] text-textMuted mt-1'>{s.label}</div>
          </div>
        ))}
      </div>

      {msg && (
        <div
          className='text-[13px] font-bold px-4 py-3 rounded-lg border'
          style={{
            color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
            background: msg.startsWith('✅') ? '#27AE6012' : '#E74C3C12',
            borderColor: msg.startsWith('✅') ? '#27AE6040' : '#E74C3C40',
          }}
        >
          {msg}
        </div>
      )}

      {/* Tabla */}
      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Cuotas pendientes de pago
          {cuotasFiltradas.length > 0 && (
            <span className='ml-2 text-[12px] font-bold text-textMuted'>
              ({cuotasFiltradas.length} resultado
              {cuotasFiltradas.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>

        {cuotasFiltradas.length === 0 ? (
          <div className='text-center text-textMuted py-10 text-[14px]'>
            🎉 No hay cuotas pendientes con los filtros seleccionados.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                  Alumno
                </th>
                <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                  Período
                </th>
                <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                  Neto a pagar
                </th>
                <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                  Vencimiento
                </th>
                <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                  Estado
                </th>
                <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {cuotasFiltradas.map((c) => {
                const neto = c.monto_base - (c.descuento ?? 0)
                const isSelected = selCuota === c.id_cuota
                const color = CUOTA_ESTADO_COLOR[c.estado] ?? '#6B6B8A'
                return (
                  <>
                    <tr key={c.id_cuota}>
                      <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                        {c.alumnos?.apellido}, {c.alumnos?.nombre}
                      </td>
                      <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                        {MESES[c.mes - 1]} {c.anio}
                      </td>
                      <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-extrabold text-purple-700'>
                        ${neto.toLocaleString('es-AR')}
                      </td>
                      <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                        {c.fecha_vencimiento}
                      </td>
                      <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                        <span style={badge(color)}>{c.estado}</span>
                      </td>
                      <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                        {isSelected ? (
                          <button
                            className='bg-[#E74C3C1A] text-red border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                            onClick={() => setSelCuota(null)}
                          >
                            Cancelar
                          </button>
                        ) : (
                          <button
                            className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                            onClick={() => {
                              setSelCuota(c.id_cuota)
                              setMsg('')
                            }}
                          >
                            💳 Registrar pago
                          </button>
                        )}
                      </td>
                    </tr>
                    {isSelected && (
                      <tr key={`pago-${c.id_cuota}`}>
                        <td
                          colSpan={6}
                          className='bg-purpleLight border-b border-border py-4 px-4'
                        >
                          <div className='flex items-center gap-4 flex-wrap'>
                            <div>
                              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                                Fecha de pago
                              </span>
                              <input
                                type='date'
                                className='px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                                value={formPago.fecha_pago}
                                onChange={(e) =>
                                  setFormPago((p) => ({
                                    ...p,
                                    fecha_pago: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                                Método de pago
                              </span>
                              <select
                                className='px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                                value={formPago.metodo_pago}
                                onChange={(e) =>
                                  setFormPago((p) => ({
                                    ...p,
                                    metodo_pago: e.target.value,
                                  }))
                                }
                              >
                                {METODOS_PAGO.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className='flex items-end'>
                              <button
                                disabled={loading}
                                className={
                                  loading
                                    ? 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer opacity-60'
                                    : 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
                                }
                                onClick={() => registrarPago(c)}
                              >
                                {loading ? 'Guardando...' : '✅ Confirmar pago'}
                              </button>
                            </div>
                            <div className='text-[12px] text-textMuted self-end pb-[10px]'>
                              Alumno:{' '}
                              <strong>
                                {c.alumnos?.apellido}, {c.alumnos?.nombre}
                              </strong>{' '}
                              · Neto:{' '}
                              <strong>${neto.toLocaleString('es-AR')}</strong>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  BECAS (R4)
// ═══════════════════════════════════════════════════════════════
function GestionBecas() {
  const [becas, setBecas] = useState<Beca[]>([])
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    id_alumno: '',
    porcentaje: '',
    motivo: '',
  })

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('becas')
      .select('*, alumnos(nombre, apellido)')
      .order('fecha_otorgamiento', { ascending: false })
    if (data) setBecas(data as unknown as Beca[])

    const { data: al } = await supabase
      .from('alumnos')
      .select(
        'id_alumno, nombre, apellido, dni, activo, cursos(nivel, grado_anio, division)',
      )
      .eq('activo', true)
      .order('apellido', { ascending: true })
    if (al) setAlumnos(al as unknown as Alumno[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    const pct = Number(form.porcentaje)
    if (pct <= 0 || pct > 100) {
      setMsg('El porcentaje debe estar entre 1 y 100.')
      return
    }
    // upsert: una beca por alumno (unique id_alumno)
    const { error } = await supabase.from('becas').upsert(
      [
        {
          id_alumno: Number(form.id_alumno),
          porcentaje: pct,
          motivo: form.motivo || null,
          activo: true,
        },
      ],
      { onConflict: 'id_alumno' },
    )
    if (error) setMsg('Error: ' + error.message)
    else {
      setForm({ id_alumno: '', porcentaje: '', motivo: '' })
      load()
    }
  }

  const toggleActivo = async (b: Beca) => {
    await supabase
      .from('becas')
      .update({ activo: !b.activo })
      .eq('id_beca', b.id_beca)
    load()
  }

  const eliminar = async (id: number) => {
    await supabase.from('becas').delete().eq('id_beca', id)
    load()
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        🎟️ Becas
      </h2>

      <div className='bg-white rounded-card p-6 shadow-card border border-border mb-6'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Otorgar / actualizar beca
        </div>
        <form
          onSubmit={guardar}
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 240px' }}>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Alumno
            </span>
            <select
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
              required
              value={form.id_alumno}
              onChange={(e) =>
                setForm((p) => ({ ...p, id_alumno: e.target.value }))
              }
            >
              <option value=''>Seleccioná un alumno...</option>
              {alumnos.map((a) => (
                <option key={a.id_alumno} value={a.id_alumno}>
                  {a.apellido}, {a.nombre} — DNI {a.dni}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Descuento (%)
            </span>
            <input
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border w-[130px]'
              type='number'
              min={1}
              max={100}
              required
              value={form.porcentaje}
              onChange={(e) =>
                setForm((p) => ({ ...p, porcentaje: e.target.value }))
              }
            />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Motivo (opcional)
            </span>
            <input
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
              value={form.motivo}
              placeholder='Ej: beca por hermanos'
              onChange={(e) =>
                setForm((p) => ({ ...p, motivo: e.target.value }))
              }
            />
          </div>
          <button
            type='submit'
            className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
          >
            Guardar beca
          </button>
        </form>
        {msg && (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: '#E74C3C',
              fontWeight: 700,
            }}
          >
            {msg}
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 12, color: '#6B6B8A' }}>
          El descuento se aplica automáticamente al generar las cuotas del mes.
        </div>
      </div>

      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Becas otorgadas
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Alumno
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Descuento
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Motivo
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Estado
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {becas.map((b) => (
              <tr key={b.id_beca}>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                  {b.alumnos?.apellido}, {b.alumnos?.nombre}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span className='inline-block bg-[#27AE601A] text-green rounded-[20px] px-[10px] py-[3px] text-[11px] font-extrabold'>
                    {b.porcentaje}%
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                  {b.motivo ?? '—'}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span style={badge(b.activo ? '#27AE60' : '#6B6B8A')}>
                    {b.activo ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className='bg-purpleLight text-purple-700 border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer !py-[6px] !px-3 !text-xs'
                      onClick={() => toggleActivo(b)}
                    >
                      {b.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      className='bg-[#E74C3C1A] text-red border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                      onClick={() => eliminar(b.id_beca)}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {becas.length === 0 && (
              <tr>
                <td
                  className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'
                  colSpan={5}
                >
                  No hay becas otorgadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  SUELDOS (R4)
// ═══════════════════════════════════════════════════════════════
function GestionSueldos() {
  const [sueldos, setSueldos] = useState<Sueldo[]>([])
  const [personal, setPersonal] = useState<UsuarioPanel[]>([])
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    id_usuario: '',
    mes: String(new Date().getMonth() + 1),
    anio: String(new Date().getFullYear()),
    monto: '',
  })

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('sueldos')
      .select('*, usuarios(nombre, apellido, rol)')
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
    if (data) setSueldos(data as unknown as Sueldo[])

    const { data: us } = await supabase
      .from('usuarios')
      .select('*')
      .in('rol', ['Admin', 'Directivo', 'Docente'])
      .eq('activo', true)
      .order('apellido', { ascending: true })
    if (us) setPersonal(us as UsuarioPanel[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    const { error } = await supabase.from('sueldos').insert([
      {
        id_usuario: form.id_usuario,
        mes: Number(form.mes),
        anio: Number(form.anio),
        monto: Number(form.monto),
        estado: 'Pendiente',
      },
    ])
    if (error) setMsg('Error: ' + error.message)
    else {
      setForm((p) => ({ ...p, id_usuario: '', monto: '' }))
      load()
    }
  }

  const marcarPagado = async (id: number) => {
    await supabase
      .from('sueldos')
      .update({
        estado: 'Pagado',
        fecha_pago: new Date().toISOString().slice(0, 10),
      })
      .eq('id_sueldo', id)
    load()
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        💼 Sueldos del personal
      </h2>

      <div className='bg-white rounded-card p-6 shadow-card border border-border mb-6'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Registrar pago de sueldo
        </div>
        <form
          onSubmit={registrar}
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 240px' }}>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Personal
            </span>
            <select
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
              required
              value={form.id_usuario}
              onChange={(e) =>
                setForm((p) => ({ ...p, id_usuario: e.target.value }))
              }
            >
              <option value=''>Seleccioná...</option>
              {personal.map((u) => (
                <option key={u.id_usuario} value={u.id_usuario}>
                  {u.apellido}, {u.nombre} ({u.rol})
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Mes
            </span>
            <select
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border w-[150px] appearance-none'
              value={form.mes}
              onChange={(e) => setForm((p) => ({ ...p, mes: e.target.value }))}
            >
              {MESES.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Año
            </span>
            <input
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border w-[100px]'
              value={form.anio}
              onChange={(e) => setForm((p) => ({ ...p, anio: e.target.value }))}
            />
          </div>
          <div>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Monto ($)
            </span>
            <input
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border w-[150px]'
              type='number'
              required
              value={form.monto}
              onChange={(e) =>
                setForm((p) => ({ ...p, monto: e.target.value }))
              }
              placeholder='350000'
            />
          </div>
          <button
            type='submit'
            className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
          >
            Registrar
          </button>
        </form>
        {msg && (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: '#E74C3C',
              fontWeight: 700,
            }}
          >
            {msg}
          </div>
        )}
      </div>

      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Sueldos registrados
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Personal
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Período
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Monto
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Estado
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Pagado el
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {sueldos.map((s) => (
              <tr key={s.id_sueldo}>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                  {s.usuarios
                    ? `${s.usuarios.apellido}, ${s.usuarios.nombre}`
                    : '—'}
                  {s.usuarios && (
                    <>
                      <br />
                      <span style={{ fontSize: 11, color: '#6B6B8A' }}>
                        {s.usuarios.rol}
                      </span>
                    </>
                  )}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  {MESES[s.mes - 1]} {s.anio}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-extrabold text-purple-700'>
                  ${Number(s.monto).toLocaleString('es-AR')}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span
                    style={badge(s.estado === 'Pagado' ? '#27AE60' : '#E67E22')}
                  >
                    {s.estado}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted text-xs'>
                  {s.fecha_pago ?? '—'}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  {s.estado !== 'Pagado' && (
                    <button
                      className='bg-purpleLight text-purple-700 border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer !py-[6px] !px-3 !text-xs'
                      onClick={() => marcarPagado(s.id_sueldo)}
                    >
                      Marcar pagado
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {sueldos.length === 0 && (
              <tr>
                <td
                  className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'
                  colSpan={6}
                >
                  No hay sueldos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  COMPRAS DE INSUMOS (R4)
// ═══════════════════════════════════════════════════════════════
const DESTINOS_INSUMO = [
  'Laboratorio de computación',
  'Laboratorio de física',
  'Laboratorio de química',
  'Enfermería',
]

function GestionCompras() {
  const [compras, setCompras] = useState<Compra[]>([])
  const [msg, setMsg] = useState('')
  const FORM_VACIO = {
    descripcion: '',
    destino: DESTINOS_INSUMO[0],
    cantidad: '1',
    monto: '',
    proveedor: '',
    fecha_compra: new Date().toISOString().slice(0, 10),
  }
  const [form, setForm] = useState(FORM_VACIO)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('compras_insumos')
      .select('*')
      .order('fecha_compra', { ascending: false })
    if (data) setCompras(data as Compra[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    const { error } = await supabase.from('compras_insumos').insert([
      {
        descripcion: form.descripcion,
        destino: form.destino,
        cantidad: Number(form.cantidad),
        monto: Number(form.monto),
        proveedor: form.proveedor || null,
        fecha_compra: form.fecha_compra,
      },
    ])
    if (error) setMsg('Error: ' + error.message)
    else {
      setForm(FORM_VACIO)
      load()
    }
  }

  const eliminar = async (id: number) => {
    await supabase.from('compras_insumos').delete().eq('id_compra', id)
    load()
  }

  const totalGastado = compras.reduce((acc, c) => acc + Number(c.monto), 0)

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        🧪 Compras de insumos
      </h2>

      <div className='bg-white rounded-card p-6 shadow-card border border-border mb-6'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Registrar compra
        </div>
        <form
          onSubmit={registrar}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.5fr',
              gap: 14,
            }}
          >
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Descripción
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                required
                value={form.descripcion}
                placeholder='Ej: 10 tubos de ensayo'
                onChange={(e) =>
                  setForm((p) => ({ ...p, descripcion: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Destino
              </span>
              <select
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                value={form.destino}
                onChange={(e) =>
                  setForm((p) => ({ ...p, destino: e.target.value }))
                }
              >
                {DESTINOS_INSUMO.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1.5fr 1fr',
              gap: 14,
            }}
          >
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Cantidad
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                type='number'
                min={1}
                required
                value={form.cantidad}
                onChange={(e) =>
                  setForm((p) => ({ ...p, cantidad: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Monto total ($)
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                type='number'
                required
                value={form.monto}
                onChange={(e) =>
                  setForm((p) => ({ ...p, monto: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Proveedor (opcional)
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                value={form.proveedor}
                onChange={(e) =>
                  setForm((p) => ({ ...p, proveedor: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Fecha
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                type='date'
                value={form.fecha_compra}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fecha_compra: e.target.value }))
                }
              />
            </div>
          </div>
          {msg && (
            <div style={{ fontSize: 12, color: '#E74C3C', fontWeight: 700 }}>
              {msg}
            </div>
          )}
          <button
            type='submit'
            className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer self-start'
          >
            Registrar compra
          </button>
        </form>
      </div>

      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <div className='text-[15px] font-extrabold text-text mb-0'>
            Compras registradas
          </div>
          <span className='inline-block bg-[#5B35C51A] text-purple-700 rounded-[20px] px-[10px] py-[3px] text-[11px] font-extrabold'>
            Total: ${totalGastado.toLocaleString('es-AR')}
          </span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Descripción
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Destino
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Cant.
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Monto
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Proveedor
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Fecha
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {compras.map((c) => (
              <tr key={c.id_compra}>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                  {c.descripcion}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span className='inline-block bg-[#2980B91A] text-blue rounded-[20px] px-[10px] py-[3px] text-[11px] font-extrabold'>
                    {c.destino}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  {c.cantidad}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-extrabold text-purple-700'>
                  ${Number(c.monto).toLocaleString('es-AR')}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                  {c.proveedor ?? '—'}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted text-xs'>
                  {c.fecha_compra}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <button
                    className='bg-[#E74C3C1A] text-red border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                    onClick={() => eliminar(c.id_compra)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {compras.length === 0 && (
              <tr>
                <td
                  className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'
                  colSpan={7}
                >
                  No hay compras registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  INSCRIPCIONES
// ═══════════════════════════════════════════════════════════════
function GestionInscripciones({
  onRegistrar,
}: {
  onRegistrar: (data: PrefillUsuario) => void
}) {
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([])

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('inscripciones')
      .select('*')
      .order('fecha_solicitud', { ascending: false })
    if (data) setInscripciones(data as Inscripcion[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const cambiarEstado = async (id: number, estado: string) => {
    await supabase
      .from('inscripciones')
      .update({ estado })
      .eq('id_inscripcion', id)
    load()
  }

  const ESTADOS = [
    'Pendiente',
    'En revisión',
    'Aprobada',
    'Rechazada',
    'En lista de espera',
  ]
  const EST_COLOR: Record<string, string> = {
    Pendiente: '#E67E22',
    'En revisión': '#2980B9',
    Aprobada: '#27AE60',
    Rechazada: '#E74C3C',
    'En lista de espera': '#6B6B8A',
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        📋 Inscripciones
      </h2>
      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Aspirante
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Tutor
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Nivel
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Fecha
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Estado
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {inscripciones.map((i) => (
              <tr key={i.id_inscripcion}>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                  {i.nombre_aspirante} {i.apellido_aspirante ?? ''}
                  <br />
                  <span style={{ fontSize: 11, color: '#6B6B8A' }}>
                    DNI: {i.dni_aspirante}
                    {i.fecha_nacimiento_aspirante &&
                      ` · Nac: ${new Date(
                        i.fecha_nacimiento_aspirante,
                      ).toLocaleDateString('es-AR')}`}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  {i.nombre_tutor}
                  <br />
                  <span style={{ fontSize: 11, color: '#6B6B8A' }}>
                    {i.email_tutor}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span className='inline-block bg-[#5B35C51A] text-purple-700 rounded-[20px] px-[10px] py-[3px] text-[11px] font-extrabold'>
                    {i.nivel_solicitado}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted text-xs'>
                  {new Date(i.fecha_solicitud).toLocaleDateString('es-AR')}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span style={badge(EST_COLOR[i.estado] ?? '#6B6B8A')}>
                    {i.estado}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <select
                      className='rounded-input border-2 border-border text-[13px] text-text outline-none box-border w-[160px] px-[10px] py-[6px] appearance-none'
                      value={i.estado}
                      onChange={(e) =>
                        cambiarEstado(i.id_inscripcion, e.target.value)
                      }
                    >
                      {ESTADOS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {i.estado === 'Aprobada' && !i.id_alumno_creado && (
                      <button
                        className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn w-[160px] px-[10px] py-[6px] text-xs font-extrabold cursor-pointer'
                        onClick={() => {
                          const partes = i.nombre_tutor.trim().split(/\s+/)
                          onRegistrar({
                            nombre: partes[0] ?? '',
                            apellido: partes.slice(1).join(' '),
                            email: i.email_tutor,
                            password: i.dni_aspirante,
                            rol: 'Padre',
                            alumno: {
                              nombre: i.nombre_aspirante,
                              apellido: i.apellido_aspirante ?? '',
                              dni: i.dni_aspirante,
                              fecha_nacimiento:
                                i.fecha_nacimiento_aspirante ?? '',
                            },
                          })
                        }}
                      >
                        Registrar
                      </button>
                    )}
                    {i.id_alumno_creado && (
                      <span className='text-[11px] font-extrabold text-green text-center'>
                        ✓ Usuario registrado
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  ACTIVIDADES EXTRACURRICULARES (R2)
// ═══════════════════════════════════════════════════════════════
interface InscripcionActividad {
  id_inscripcion_act: number
  id_actividad: number
  id_alumno: number
  fecha_inscripcion: string
  alumnos: {
    nombre: string
    apellido: string
    dni: string
    cursos: { nivel: string; grado_anio: string; division: string } | null
  } | null
}

function GestionActividades() {
  const [actividades, setActividades] = useState<ActividadEx[]>([])
  const [conteos, setConteos] = useState<Record<number, number>>({})
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [msg, setMsg] = useState('')
  const FORM_VACIO = {
    nombre: '',
    tipo: 'Idioma',
    descripcion: '',
    cupo_maximo: 20,
  }
  const [form, setForm] = useState(FORM_VACIO)

  // Inscriptos por actividad
  const [verInscriptosId, setVerInscriptosId] = useState<number | null>(null)
  const [inscriptos, setInscriptos] = useState<InscripcionActividad[]>([])
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [selAlumno, setSelAlumno] = useState('')
  const [inscMsg, setInscMsg] = useState('')
  const [inscribiendo, setInscribiendo] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('actividades_extracurriculares')
      .select('*')
      .order('tipo', { ascending: true })
      .order('nombre', { ascending: true })
    if (data) setActividades(data as ActividadEx[])

    const { data: insc } = await supabase
      .from('inscripciones_actividades')
      .select('id_actividad')
    const cnt: Record<number, number> = {}
    ;(insc ?? []).forEach((i: { id_actividad: number }) => {
      cnt[i.id_actividad] = (cnt[i.id_actividad] ?? 0) + 1
    })
    setConteos(cnt)

    // Alumnos activos para el selector de inscripción
    const { data: al } = await supabase
      .from('alumnos')
      .select(
        'id_alumno, nombre, apellido, dni, activo, cursos(nivel, grado_anio, division)',
      )
      .eq('activo', true)
      .order('apellido', { ascending: true })
    if (al) setAlumnos(al as unknown as Alumno[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const loadInscriptos = useCallback(async (idActividad: number) => {
    const { data } = await supabase
      .from('inscripciones_actividades')
      .select(
        'id_inscripcion_act, id_actividad, id_alumno, fecha_inscripcion, alumnos(nombre, apellido, dni, cursos(nivel, grado_anio, division))',
      )
      .eq('id_actividad', idActividad)
      .order('fecha_inscripcion', { ascending: true })
    if (data) setInscriptos(data as unknown as InscripcionActividad[])
  }, [])

  const toggleVerInscriptos = async (idActividad: number) => {
    setInscMsg('')
    setSelAlumno('')
    if (verInscriptosId === idActividad) {
      setVerInscriptosId(null)
      setInscriptos([])
    } else {
      setVerInscriptosId(idActividad)
      await loadInscriptos(idActividad)
    }
  }

  const inscribirAlumno = async (idActividad: number) => {
    if (!selAlumno) return
    setInscribiendo(true)
    setInscMsg('')
    const { error } = await supabase.from('inscripciones_actividades').insert([
      {
        id_actividad: idActividad,
        id_alumno: Number(selAlumno),
      },
    ])
    if (error) {
      if (error.message.includes('Cupo completo')) {
        setInscMsg('❌ Cupo completo para esta actividad.')
      } else if (
        error.message.includes('duplicate') ||
        error.code === '23505'
      ) {
        setInscMsg('❌ El alumno ya está inscripto en esta actividad.')
      } else {
        setInscMsg('❌ Error: ' + error.message)
      }
    } else {
      setInscMsg('✅ Alumno inscripto correctamente.')
      setSelAlumno('')
      await loadInscriptos(idActividad)
      load()
    }
    setInscribiendo(false)
  }

  const quitarInscripcion = async (
    idInscripcion: number,
    idActividad: number,
  ) => {
    if (!confirm('¿Quitar al alumno de esta actividad?')) return
    await supabase
      .from('inscripciones_actividades')
      .delete()
      .eq('id_inscripcion_act', idInscripcion)
    await loadInscriptos(idActividad)
    load()
  }

  const abrirNueva = () => {
    setEditId(null)
    setForm(FORM_VACIO)
    setShowForm(true)
  }

  const abrirEdicion = (a: ActividadEx) => {
    setEditId(a.id_actividad)
    setForm({
      nombre: a.nombre,
      tipo: a.tipo,
      descripcion: a.descripcion ?? '',
      cupo_maximo: a.cupo_maximo,
    })
    setShowForm(true)
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    const payload = { ...form, cupo_maximo: Number(form.cupo_maximo) }
    const { error } = editId
      ? await supabase
          .from('actividades_extracurriculares')
          .update(payload)
          .eq('id_actividad', editId)
      : await supabase.from('actividades_extracurriculares').insert([payload])
    if (error) setMsg('Error: ' + error.message)
    else {
      setShowForm(false)
      load()
    }
  }

  const toggleActivo = async (a: ActividadEx) => {
    await supabase
      .from('actividades_extracurriculares')
      .update({ activo: !a.activo })
      .eq('id_actividad', a.id_actividad)
    load()
  }

  const idiomas = actividades.filter((a) => a.tipo === 'Idioma')
  const deportes = actividades.filter((a) => a.tipo === 'Deporte')

  const renderGrupo = (titulo: string, items: ActividadEx[]) => (
    <div className='bg-white rounded-card p-6 shadow-card border border-border mb-5'>
      <div className='text-[15px] font-extrabold text-text mb-5'>{titulo}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
              Actividad
            </th>
            <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
              Cupo
            </th>
            <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
              Inscriptos
            </th>
            <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
              Estado
            </th>
            <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
              Acción
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => {
            const ocupados = conteos[a.id_actividad] ?? 0
            const completo = ocupados >= a.cupo_maximo
            const expandida = verInscriptosId === a.id_actividad
            return (
              <Fragment key={a.id_actividad}>
                <tr>
                  <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                    {a.nombre}
                    {a.descripcion && (
                      <>
                        <br />
                        <span style={{ fontSize: 11, color: '#6B6B8A' }}>
                          {a.descripcion}
                        </span>
                      </>
                    )}
                  </td>
                  <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                    {a.cupo_maximo}
                  </td>
                  <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                    <span
                      style={badge(
                        completo
                          ? '#E74C3C'
                          : ocupados > 0
                            ? '#27AE60'
                            : '#6B6B8A',
                      )}
                    >
                      {ocupados} / {a.cupo_maximo}
                      {completo ? ' · COMPLETO' : ''}
                    </span>
                  </td>
                  <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                    <span style={badge(a.activo ? '#27AE60' : '#6B6B8A')}>
                      {a.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        className={
                          expandida
                            ? 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                            : 'bg-purpleLight text-purple-700 border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                        }
                        onClick={() => toggleVerInscriptos(a.id_actividad)}
                      >
                        {expandida
                          ? '▲ Ocultar'
                          : `👥 Inscriptos (${ocupados})`}
                      </button>
                      <button
                        className='bg-purpleLight text-purple-700 border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                        onClick={() => abrirEdicion(a)}
                      >
                        Editar
                      </button>
                      <button
                        className='bg-[#E74C3C1A] text-red border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                        onClick={() => toggleActivo(a)}
                      >
                        {a.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
                {expandida && (
                  <tr>
                    <td
                      colSpan={5}
                      className='bg-purpleLight/50 border-b border-border p-5'
                    >
                      {/* Formulario de inscripción */}
                      <div className='flex items-end gap-3 flex-wrap mb-4'>
                        <div className='flex-1' style={{ minWidth: 280 }}>
                          <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                            Inscribir alumno a {a.nombre}
                          </span>
                          <select
                            className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none bg-white'
                            value={selAlumno}
                            onChange={(e) => setSelAlumno(e.target.value)}
                          >
                            <option value=''>Seleccioná un alumno...</option>
                            {alumnos
                              .filter(
                                (al) =>
                                  !inscriptos.some(
                                    (i) => i.id_alumno === al.id_alumno,
                                  ),
                              )
                              .map((al) => (
                                <option key={al.id_alumno} value={al.id_alumno}>
                                  {al.apellido}, {al.nombre} — DNI {al.dni}
                                  {al.cursos
                                    ? ` (${al.cursos.nivel} ${al.cursos.grado_anio} "${al.cursos.division}")`
                                    : ''}
                                </option>
                              ))}
                          </select>
                        </div>
                        <button
                          disabled={!selAlumno || inscribiendo || completo}
                          className={
                            !selAlumno || inscribiendo || completo
                              ? 'bg-border text-textMuted border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-not-allowed'
                              : 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
                          }
                          onClick={() => inscribirAlumno(a.id_actividad)}
                        >
                          {inscribiendo
                            ? 'Inscribiendo...'
                            : completo
                              ? 'Cupo completo'
                              : '+ Inscribir'}
                        </button>
                      </div>

                      {inscMsg && (
                        <div
                          className='text-[12px] font-bold mb-4'
                          style={{
                            color: inscMsg.startsWith('✅')
                              ? '#27AE60'
                              : '#E74C3C',
                          }}
                        >
                          {inscMsg}
                        </div>
                      )}

                      {/* Listado de inscriptos */}
                      {inscriptos.length === 0 ? (
                        <div className='text-[13px] text-textMuted py-3'>
                          No hay alumnos inscriptos en esta actividad.
                        </div>
                      ) : (
                        <table
                          style={{ width: '100%', borderCollapse: 'collapse' }}
                        >
                          <thead>
                            <tr>
                              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-2 pr-3 border-b border-border'>
                                Alumno
                              </th>
                              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-2 pr-3 border-b border-border'>
                                DNI
                              </th>
                              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-2 pr-3 border-b border-border'>
                                Curso
                              </th>
                              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-2 pr-3 border-b border-border'>
                                Fecha de inscripción
                              </th>
                              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-2 pr-3 border-b border-border'>
                                Acción
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {inscriptos.map((i) => (
                              <tr key={i.id_inscripcion_act}>
                                <td className='py-2 pr-3 text-[13px] border-b border-border align-middle font-bold'>
                                  {i.alumnos?.apellido}, {i.alumnos?.nombre}
                                </td>
                                <td className='py-2 pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                                  {i.alumnos?.dni}
                                </td>
                                <td className='py-2 pr-3 text-[13px] border-b border-border align-middle'>
                                  {i.alumnos?.cursos
                                    ? `${i.alumnos.cursos.nivel} ${i.alumnos.cursos.grado_anio} "${i.alumnos.cursos.division}"`
                                    : 'Sin curso'}
                                </td>
                                <td className='py-2 pr-3 text-[13px] border-b border-border align-middle text-textMuted text-xs'>
                                  {new Date(
                                    i.fecha_inscripcion,
                                  ).toLocaleDateString('es-AR')}
                                </td>
                                <td className='py-2 pr-3 text-[13px] border-b border-border align-middle'>
                                  <button
                                    className='bg-[#E74C3C1A] text-red border-0 rounded-lg py-[5px] px-3 text-xs font-extrabold cursor-pointer'
                                    onClick={() =>
                                      quitarInscripcion(
                                        i.id_inscripcion_act,
                                        a.id_actividad,
                                      )
                                    }
                                  >
                                    Quitar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          {items.length === 0 && (
            <tr>
              <td
                className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'
                colSpan={5}
              >
                Sin actividades cargadas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
          🎨 Actividades extracurriculares
        </h2>
        <button
          className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
          onClick={abrirNueva}
        >
          + Nueva actividad
        </button>
      </div>

      {showForm && (
        <div className='bg-white rounded-card p-6 shadow-card border border-border mb-6'>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            {editId ? 'Editar actividad' : 'Nueva actividad'}
          </div>
          <form
            onSubmit={guardar}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr',
                gap: 14,
              }}
            >
              <div>
                <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                  Nombre
                </span>
                <input
                  className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                  required
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, nombre: e.target.value }))
                  }
                />
              </div>
              <div>
                <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                  Tipo
                </span>
                <select
                  className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                  value={form.tipo}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, tipo: e.target.value }))
                  }
                >
                  <option value='Idioma'>Idioma</option>
                  <option value='Deporte'>Deporte</option>
                </select>
              </div>
              <div>
                <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                  Cupo máximo
                </span>
                <input
                  className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                  type='number'
                  min={1}
                  required
                  value={form.cupo_maximo}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      cupo_maximo: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Descripción (opcional)
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                value={form.descripcion}
                onChange={(e) =>
                  setForm((p) => ({ ...p, descripcion: e.target.value }))
                }
              />
            </div>
            {msg && (
              <div style={{ fontSize: 12, color: '#E74C3C', fontWeight: 700 }}>
                {msg}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type='submit'
                className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
              >
                {editId ? 'Guardar cambios' : 'Crear actividad'}
              </button>
              <button
                type='button'
                className='bg-purpleLight text-purple-700 border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {renderGrupo('🗣️ Idiomas', idiomas)}
      {renderGrupo('⚽ Disciplinas deportivas', deportes)}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  RESERVAS DE INSTALACIONES (R5)
// ═══════════════════════════════════════════════════════════════
function GestionReservas({ userId }: { userId: string }) {
  const [instalaciones, setInstalaciones] = useState<Instalacion[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [msg, setMsg] = useState('')
  const FORM_VACIO = {
    id_instalacion: '',
    fecha: '',
    hora_inicio: '',
    hora_fin: '',
    motivo: '',
  }
  const [form, setForm] = useState(FORM_VACIO)

  const hoy = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    const { data: inst } = await supabase
      .from('instalaciones')
      .select('*')
      .eq('activo', true)
      .order('nombre', { ascending: true })
    if (inst) setInstalaciones(inst as Instalacion[])

    const { data: res } = await supabase
      .from('reservas_instalaciones')
      .select('*, instalaciones(nombre), usuarios(nombre, apellido)')
      .gte('fecha', new Date().toISOString().slice(0, 10))
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true })
    if (res) setReservas(res as unknown as Reserva[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const crear = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    if (form.hora_fin <= form.hora_inicio) {
      setMsg('La hora de fin debe ser posterior a la de inicio.')
      return
    }
    const { error } = await supabase.from('reservas_instalaciones').insert([
      {
        id_instalacion: Number(form.id_instalacion),
        fecha: form.fecha,
        hora_inicio: form.hora_inicio,
        hora_fin: form.hora_fin,
        motivo: form.motivo || null,
        reservado_por: userId,
      },
    ])
    if (error) {
      setMsg(
        error.message.includes('ya está reservada')
          ? '⛔ La instalación ya está reservada en ese horario. Elegí otra franja.'
          : 'Error: ' + error.message,
      )
    } else {
      setForm(FORM_VACIO)
      load()
    }
  }

  const eliminar = async (id: number) => {
    await supabase.from('reservas_instalaciones').delete().eq('id_reserva', id)
    load()
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        🏟️ Reservas de instalaciones
      </h2>

      <div className='bg-white rounded-card p-6 shadow-card border border-border mb-6'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Nueva reserva
        </div>
        <form
          onSubmit={crear}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr',
              gap: 14,
            }}
          >
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Instalación
              </span>
              <select
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                required
                value={form.id_instalacion}
                onChange={(e) =>
                  setForm((p) => ({ ...p, id_instalacion: e.target.value }))
                }
              >
                <option value=''>Seleccioná...</option>
                {instalaciones.map((i) => (
                  <option key={i.id_instalacion} value={i.id_instalacion}>
                    {i.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Fecha
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                type='date'
                required
                min={hoy}
                value={form.fecha}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fecha: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Hora inicio
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                type='time'
                required
                value={form.hora_inicio}
                onChange={(e) =>
                  setForm((p) => ({ ...p, hora_inicio: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Hora fin
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                type='time'
                required
                value={form.hora_fin}
                onChange={(e) =>
                  setForm((p) => ({ ...p, hora_fin: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Motivo (opcional)
            </span>
            <input
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
              value={form.motivo}
              placeholder='Ej: entrenamiento de natación'
              onChange={(e) =>
                setForm((p) => ({ ...p, motivo: e.target.value }))
              }
            />
          </div>
          {msg && (
            <div style={{ fontSize: 12, color: '#E74C3C', fontWeight: 700 }}>
              {msg}
            </div>
          )}
          <button
            type='submit'
            className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer self-start'
          >
            Reservar
          </button>
        </form>
      </div>

      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Próximas reservas
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Instalación
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Fecha
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Horario
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Motivo
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Reservó
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {reservas.map((r) => (
              <tr key={r.id_reserva}>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                  {r.instalaciones?.nombre ?? '—'}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  {new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  {r.hora_inicio.slice(0, 5)} – {r.hora_fin.slice(0, 5)}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                  {r.motivo ?? '—'}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted text-xs'>
                  {r.usuarios
                    ? `${r.usuarios.nombre} ${r.usuarios.apellido}`
                    : '—'}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <button
                    className='bg-[#E74C3C1A] text-red border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                    onClick={() => eliminar(r.id_reserva)}
                  >
                    Cancelar
                  </button>
                </td>
              </tr>
            ))}
            {reservas.length === 0 && (
              <tr>
                <td
                  className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'
                  colSpan={6}
                >
                  No hay reservas próximas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  MENSAJES DE CONTACTO
// ═══════════════════════════════════════════════════════════════
function GestionMensajes() {
  const [mensajes, setMensajes] = useState<MensajeContacto[]>([])
  const [abierto, setAbierto] = useState<number | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('mensajes_contacto')
      .select('*')
      .order('fecha_envio', { ascending: false })
    if (data) setMensajes(data as MensajeContacto[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const marcarLeido = async (id: number, leido: boolean) => {
    await supabase
      .from('mensajes_contacto')
      .update({ leido })
      .eq('id_mensaje', id)
    load()
  }

  const sinLeer = mensajes.filter((m) => !m.leido).length

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        ✉️ Mensajes de contacto
        {sinLeer > 0 && (
          <span style={{ ...badge('#E67E22'), marginLeft: 10 }}>
            {sinLeer} sin leer
          </span>
        )}
      </h2>
      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        {mensajes.length === 0 ? (
          <div style={{ color: '#6B6B8A', fontSize: 13 }}>
            No hay mensajes recibidos.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mensajes.map((m) => (
              <div
                key={m.id_mensaje}
                style={{
                  border: `1px solid ${'#E8E6F5'}`,
                  borderRadius: 12,
                  padding: 14,
                  background: m.leido ? '#FFFFFF' : '#EEE9FF',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() =>
                    setAbierto(abierto === m.id_mensaje ? null : m.id_mensaje)
                  }
                >
                  <div>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>
                      {m.nombre}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: '#6B6B8A',
                        marginLeft: 8,
                      }}
                    >
                      {m.email}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: '#6B6B8A' }}>
                    {new Date(m.fecha_envio).toLocaleString('es-AR')}
                  </span>
                </div>
                {abierto === m.id_mensaje && (
                  <div style={{ marginTop: 12 }}>
                    <p
                      style={{
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: '#1A1A2E',
                        whiteSpace: 'pre-wrap',
                        margin: '0 0 12px',
                      }}
                    >
                      {m.mensaje}
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a
                        href={`mailto:${m.email}`}
                        className='bg-purpleLight text-purple-700 border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer py-[6px] px-[14px] !text-xs no-underline'
                      >
                        Responder por correo
                      </a>
                      <button
                        className='bg-purpleLight text-purple-700 border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer py-[6px] px-[14px] !text-xs'
                        onClick={() => marcarLeido(m.id_mensaje, !m.leido)}
                      >
                        {m.leido ? 'Marcar como no leído' : 'Marcar como leído'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  NOTICIAS
// ═══════════════════════════════════════════════════════════════
function GestionNoticias({ userId }: { userId: string }) {
  const [noticias, setNoticias] = useState<Noticia[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [notificar, setNotificar] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    titulo: '',
    resumen: '',
    contenido: '',
    url_imagen: '',
    destacada: false,
  })

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('noticias')
      .select('*')
      .order('fecha_publicacion', { ascending: false })
    if (data) setNoticias(data as Noticia[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    // Si se adjuntó un archivo, se sube al Storage y se usa su URL pública.
    // Si no, se usa la URL escrita a mano (ambas opciones siguen disponibles).
    let urlImagen = form.url_imagen
    if (file) {
      const ext = file.name.split('.').pop()
      const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('noticias-imagenes')
        .upload(nombre, file)
      if (upErr) {
        setMsg('Error al subir la imagen: ' + upErr.message)
        setLoading(false)
        return
      }
      urlImagen = supabase.storage
        .from('noticias-imagenes')
        .getPublicUrl(nombre).data.publicUrl
    }

    const { error } = await supabase
      .from('noticias')
      .insert([{ ...form, url_imagen: urlImagen, id_autor: userId }])
    if (error) setMsg('Error: ' + error.message)
    else {
      let aviso = '✅ Noticia publicada.'
      // R6 · Comunicado institucional a las familias
      if (notificar) {
        const { data: todos } = await supabase
          .from('alumnos')
          .select('id_alumno')
          .eq('activo', true)
        await notificarFamilias(
          (todos ?? []).map((a: { id_alumno: number }) => ({
            id_alumno: a.id_alumno,
            titulo: 'Comunicado institucional',
            mensaje: form.titulo,
          })),
          'Novedad',
        )
        aviso = '✅ Noticia publicada y familias notificadas.'
      }
      setMsg(aviso)
      setShowForm(false)
      setFile(null)
      setForm({
        titulo: '',
        resumen: '',
        contenido: '',
        url_imagen: '',
        destacada: false,
      })
      load()
    }
    setLoading(false)
  }

  const toggleActivo = async (id: number, activo: boolean) => {
    await supabase
      .from('noticias')
      .update({ activo: !activo })
      .eq('id_noticia', id)
    load()
  }

  const eliminar = async (id: number) => {
    if (
      !confirm(
        '¿Eliminar definitivamente esta noticia? Esta acción no se puede deshacer.',
      )
    )
      return
    const { error } = await supabase
      .from('noticias')
      .delete()
      .eq('id_noticia', id)
    if (error) setMsg('Error al eliminar: ' + error.message)
    else {
      setMsg('🗑️ Noticia eliminada.')
      load()
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
          📰 Noticias
        </h2>
        <button
          className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : '+ Nueva noticia'}
        </button>
      </div>

      {showForm && (
        <div className='bg-white rounded-card p-6 shadow-card border border-border mb-6'>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            Publicar noticia
          </div>
          <form
            onSubmit={handleCreate}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Título
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                required
                value={form.titulo}
                onChange={(e) =>
                  setForm((p) => ({ ...p, titulo: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Resumen (opcional)
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                value={form.resumen}
                onChange={(e) =>
                  setForm((p) => ({ ...p, resumen: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Imagen — subir archivo (opcional)
              </span>
              <input
                type='file'
                accept='image/*'
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                …o pegar una URL de imagen (opcional)
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border disabled:opacity-50'
                value={form.url_imagen}
                onChange={(e) =>
                  setForm((p) => ({ ...p, url_imagen: e.target.value }))
                }
                placeholder='https://...'
                disabled={!!file}
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Contenido
              </span>
              <textarea
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border min-h-[120px] resize-y'
                required
                value={form.contenido}
                onChange={(e) =>
                  setForm((p) => ({ ...p, contenido: e.target.value }))
                }
              />
            </div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              <input
                type='checkbox'
                checked={form.destacada}
                onChange={(e) =>
                  setForm((p) => ({ ...p, destacada: e.target.checked }))
                }
              />
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                Marcar como destacada
              </span>
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              <input
                type='checkbox'
                checked={notificar}
                onChange={(e) => setNotificar(e.target.checked)}
              />
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                Notificar a las familias como comunicado institucional
              </span>
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type='submit'
                disabled={loading}
                className={
                  loading
                    ? 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer opacity-60'
                    : 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
                }
              >
                {loading ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
            {msg && (
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
                }}
              >
                {msg}
              </div>
            )}
          </form>
        </div>
      )}

      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Título
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Fecha
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Destacada
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Estado
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {noticias.map((n) => (
              <tr key={n.id_noticia}>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold max-w-[300px]'>
                  {n.titulo}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                  {new Date(n.fecha_publicacion).toLocaleDateString('es-AR')}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  {n.destacada ? '⭐' : '—'}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span style={badge(n.activo ? '#27AE60' : '#E74C3C')}>
                    {n.activo ? 'Publicada' : 'Oculta'}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <div className='flex gap-2'>
                    <button
                      className={
                        n.activo
                          ? 'bg-[#E74C3C1A] text-red border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                          : 'bg-[#27AE601A] text-green border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                      }
                      onClick={() => toggleActivo(n.id_noticia, n.activo)}
                    >
                      {n.activo ? 'Ocultar' : 'Publicar'}
                    </button>
                    <button
                      className='bg-[#6B6B8A1A] text-textMuted border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                      onClick={() => eliminar(n.id_noticia)}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  TOMAR ASISTENCIA (Docente)
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
//  R1: LEGAJOS PARA DOCENTE (ver legajo de alumnos de sus cursos)
// ═══════════════════════════════════════════════════════════════
function LegajosDocente({ userId }: { userId: string }) {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [selAsignacion, setSelAsignacion] = useState<number | null>(null)
  const [alumnos, setAlumnos] = useState<
    { id_alumno: number; nombre: string; apellido: string }[]
  >([])
  const [legajoId, setLegajoId] = useState<number | null>(null)

  // Asignaciones del docente logueado
  useEffect(() => {
    supabase
      .from('docentes')
      .select('id_docente')
      .eq('id_usuario', userId)
      .single()
      .then(({ data: doc }) => {
        if (!doc) return
        supabase
          .from('asignaciones')
          .select('*, materias(nombre), cursos(nivel, grado_anio, division)')
          .eq('id_docente', doc.id_docente)
          .eq('activo', true)
          .then(({ data }) => {
            if (data) setAsignaciones(data as unknown as Asignacion[])
          })
      })
  }, [userId])

  // Alumnos del curso de la asignación seleccionada
  useEffect(() => {
    if (!selAsignacion) {
      setAlumnos([])
      return
    }
    supabase
      .from('asignaciones')
      .select('id_curso')
      .eq('id_asignacion', selAsignacion)
      .single()
      .then(({ data: a }) => {
        if (!a) return
        supabase
          .from('alumnos')
          .select('id_alumno, nombre, apellido')
          .eq('id_curso', a.id_curso)
          .eq('activo', true)
          .order('apellido')
          .then(({ data: al }) => {
            if (al)
              setAlumnos(
                al as { id_alumno: number; nombre: string; apellido: string }[],
              )
          })
      })
  }, [selAsignacion])

  if (legajoId !== null) {
    return (
      <LegajoAlumno idAlumno={legajoId} onClose={() => setLegajoId(null)} />
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        📁 Legajos de alumnos
      </h2>
      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <label className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
          Elegí una de tus asignaciones
        </label>
        <select
          className='rounded-input border-2 border-border text-[13px] text-text outline-none box-border w-full max-w-[420px] px-[14px] py-[10px] appearance-none mb-5'
          value={selAsignacion ?? ''}
          onChange={(e) =>
            setSelAsignacion(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value=''>— Seleccioná materia y curso —</option>
          {asignaciones.map((a) => (
            <option key={a.id_asignacion} value={a.id_asignacion}>
              {a.materias?.nombre ?? 'Materia'} ·{' '}
              {a.cursos
                ? `${a.cursos.nivel} ${a.cursos.grado_anio} ${a.cursos.division}`
                : 'Curso'}
            </option>
          ))}
        </select>

        {selAsignacion && alumnos.length === 0 && (
          <p className='text-[13px] text-textMuted'>
            No hay alumnos activos en este curso.
          </p>
        )}

        {alumnos.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                  Alumno
                </th>
                <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                  Legajo
                </th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map((a) => (
                <tr key={a.id_alumno}>
                  <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                    {a.apellido}, {a.nombre}
                  </td>
                  <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                    <button
                      className='bg-[#5B35C51A] text-purple-700 border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                      onClick={() => setLegajoId(a.id_alumno)}
                    >
                      Ver legajo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function TomarAsistencia({ userId }: { userId: string }) {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [selAsignacion, setSelAsignacion] = useState<number | null>(null)
  const [alumnos, setAlumnos] = useState<AlumnoAsistencia[]>([])
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase
      .from('docentes')
      .select('id_docente')
      .eq('id_usuario', userId)
      .single()
      .then(({ data: doc }) => {
        if (!doc) return
        supabase
          .from('asignaciones')
          .select('*, materias(nombre), cursos(nivel, grado_anio, division)')
          .eq('id_docente', doc.id_docente)
          .eq('activo', true)
          .then(({ data }) => {
            if (data) setAsignaciones(data as unknown as Asignacion[])
          })
      })
  }, [userId])

  useEffect(() => {
    if (!selAsignacion) return
    // Cargar alumnos del curso de la asignación
    const asig = asignaciones.find((a) => a.id_asignacion === selAsignacion)
    if (!asig) return
    // Obtener el id_curso de la asignación
    supabase
      .from('asignaciones')
      .select('id_curso')
      .eq('id_asignacion', selAsignacion)
      .single()
      .then(({ data: a }) => {
        if (!a) return
        supabase
          .from('alumnos')
          .select('id_alumno, nombre, apellido')
          .eq('id_curso', a.id_curso)
          .eq('activo', true)
          .order('apellido')
          .then(({ data: al }) => {
            if (al)
              setAlumnos(al.map((a) => ({ ...a, estado: 'Presente' as const })))
          })
      })
  }, [selAsignacion, asignaciones])

  const toggleEstado = (id: number) => {
    setAlumnos((prev) =>
      prev.map((a) => {
        if (a.id_alumno !== id) return a
        const ciclo: AlumnoAsistencia['estado'][] = [
          'Presente',
          'Ausente',
          'Tarde',
          'Justificado',
        ]
        const next = ciclo[(ciclo.indexOf(a.estado) + 1) % ciclo.length]
        return { ...a, estado: next }
      }),
    )
  }

  const guardar = async () => {
    if (!selAsignacion || alumnos.length === 0) return
    setLoading(true)
    setMsg('')
    const registros = alumnos.map((a) => ({
      id_alumno: a.id_alumno,
      id_asignacion: selAsignacion,
      fecha,
      estado: a.estado,
      registrado_por: userId,
    }))
    const { error } = await supabase
      .from('asistencias')
      .upsert(registros, { onConflict: 'id_alumno,id_asignacion,fecha' })
    if (error) {
      setMsg('Error: ' + error.message)
    } else {
      // R6 · Notificación automática por inasistencia
      const ausentes = alumnos.filter((a) => a.estado === 'Ausente')
      await notificarFamilias(
        ausentes.map((a) => ({
          id_alumno: a.id_alumno,
          titulo: 'Inasistencia registrada',
          mensaje: `${a.nombre} ${a.apellido} fue registrado/a como ausente el ${new Date(
            fecha + 'T00:00:00',
          ).toLocaleDateString('es-AR')}.`,
        })),
        'Asistencia',
      )
      setMsg(
        ausentes.length > 0
          ? `✅ Asistencia guardada. Se notificó a ${ausentes.length} familia(s) por inasistencia.`
          : '✅ Asistencia guardada correctamente.',
      )
    }
    setLoading(false)
  }

  const EST_COLOR: Record<string, string> = {
    Presente: '#27AE60',
    Ausente: '#E74C3C',
    Tarde: '#E67E22',
    Justificado: '#2980B9',
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        📅 Tomar asistencia
      </h2>

      <div className='bg-white rounded-card p-6 shadow-card border border-border mb-5'>
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Clase / Materia
            </span>
            <select
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border w-[280px] appearance-none'
              value={selAsignacion ?? ''}
              onChange={(e) => setSelAsignacion(Number(e.target.value))}
            >
              <option value=''>Seleccioná una clase...</option>
              {asignaciones.map((a) => (
                <option key={a.id_asignacion} value={a.id_asignacion}>
                  {a.materias?.nombre} — {a.cursos?.nivel}{' '}
                  {a.cursos?.grado_anio} "{a.cursos?.division}"
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
              Fecha
            </span>
            <input
              type='date'
              className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border w-[160px]'
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
        </div>
      </div>

      {selAsignacion && alumnos.length > 0 && (
        <div className='bg-white rounded-card p-6 shadow-card border border-border'>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <div className='text-[15px] font-extrabold text-text mb-5'>
              {alumnos.length} alumnos — Tocá el estado para cambiar
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['Presente', 'Ausente', 'Tarde', 'Justificado'] as const).map(
                (e) => (
                  <span key={e} style={badge(EST_COLOR[e])}>
                    {e}
                  </span>
                ),
              )}
            </div>
          </div>

          {alumnos.map((a) => (
            <div
              key={a.id_alumno}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: `1px solid ${'#E8E6F5'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: `${'#5B35C5'}18`,
                    color: '#5B35C5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: 13,
                  }}
                >
                  {a.nombre[0]}
                  {a.apellido[0]}
                </div>
                <span style={{ fontWeight: 700 }}>
                  {a.apellido}, {a.nombre}
                </span>
              </div>
              <button
                onClick={() => toggleEstado(a.id_alumno)}
                style={{
                  ...badge(EST_COLOR[a.estado]),
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: '8px 20px',
                  fontSize: 13,
                  fontWeight: 800,
                  transition: 'all 0.15s',
                }}
              >
                {a.estado}
              </button>
            </div>
          ))}

          <div
            style={{
              marginTop: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <button
              onClick={guardar}
              disabled={loading}
              className={
                loading
                  ? 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer opacity-60'
                  : 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
              }
            >
              {loading ? 'Guardando...' : '💾 Guardar asistencia'}
            </button>
            {msg && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
                }}
              >
                {msg}
              </span>
            )}
          </div>
        </div>
      )}

      {selAsignacion && alumnos.length === 0 && (
        <div className='bg-white rounded-card p-6 shadow-card border border-border text-center text-textMuted'>
          No hay alumnos asignados a este curso.
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  CARGAR CALIFICACIONES (Docente)
// ═══════════════════════════════════════════════════════════════
function CargarCalificaciones({ userId }: { userId: string }) {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [selAsignacion, setSelAsig] = useState<number | null>(null)
  const [calificaciones, setCals] = useState<Calificacion[]>([])
  const [alumnos, setAlumnos] = useState<
    { id_alumno: number; nombre: string; apellido: string }[]
  >([])
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    id_alumno: '',
    trimestre: '1',
    tipo_evaluacion: 'Parcial',
    nota: '',
    descripcion: '',
  })

  useEffect(() => {
    supabase
      .from('docentes')
      .select('id_docente')
      .eq('id_usuario', userId)
      .single()
      .then(({ data: doc }) => {
        if (!doc) return
        supabase
          .from('asignaciones')
          .select('*, materias(nombre), cursos(nivel, grado_anio, division)')
          .eq('id_docente', doc.id_docente)
          .eq('activo', true)
          .then(({ data }) => {
            if (data) setAsignaciones(data as unknown as Asignacion[])
          })
      })
  }, [userId])

  useEffect(() => {
    if (!selAsignacion) return
    supabase
      .from('asignaciones')
      .select('id_curso')
      .eq('id_asignacion', selAsignacion)
      .single()
      .then(({ data: a }) => {
        if (!a) return
        supabase
          .from('alumnos')
          .select('id_alumno, nombre, apellido')
          .eq('id_curso', a.id_curso)
          .eq('activo', true)
          .order('apellido')
          .then(({ data: al }) => {
            if (al) setAlumnos(al)
          })
      })
    supabase
      .from('calificaciones')
      .select('*, alumnos(nombre, apellido), asignaciones(materias(nombre))')
      .eq('id_asignacion', selAsignacion)
      .order('fecha_carga', { ascending: false })
      .then(({ data }) => {
        if (data) setCals(data as unknown as Calificacion[])
      })
  }, [selAsignacion])

  const handleCargar = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    const { data: periodo } = await supabase
      .from('periodos_academicos')
      .select('id_periodo')
      .eq('activo', true)
      .single()
    const { error } = await supabase.from('calificaciones').insert([
      {
        id_alumno: Number(form.id_alumno),
        id_asignacion: selAsignacion,
        id_periodo: periodo?.id_periodo ?? null,
        trimestre: Number(form.trimestre),
        tipo_evaluacion: form.tipo_evaluacion,
        nota: Number(form.nota),
        descripcion: form.descripcion || null,
      },
    ])
    if (error) setMsg('Error: ' + error.message)
    else {
      // R6 · Notificación automática por publicación de calificación
      const asig = asignaciones.find((a) => a.id_asignacion === selAsignacion)
      const materia = asig?.materias?.nombre ?? 'una materia'
      await notificarFamilias(
        [
          {
            id_alumno: Number(form.id_alumno),
            titulo: 'Nueva calificación publicada',
            mensaje: `Se publicó una nota de ${materia}: ${form.nota} (${form.tipo_evaluacion}, ${form.trimestre}° trimestre).`,
          },
        ],
        'Calificación',
      )
      setMsg('✅ Nota cargada y familia notificada.')
      setForm((p) => ({ ...p, id_alumno: '', nota: '', descripcion: '' }))
      // Recargar calificaciones
      if (selAsignacion) {
        supabase
          .from('calificaciones')
          .select(
            '*, alumnos(nombre, apellido), asignaciones(materias(nombre))',
          )
          .eq('id_asignacion', selAsignacion)
          .order('fecha_carga', { ascending: false })
          .then(({ data }) => {
            if (data) setCals(data as unknown as Calificacion[])
          })
      }
    }
  }

  const notaColor = (n: number) =>
    n >= 8 ? '#27AE60' : n >= 6 ? '#E67E22' : '#E74C3C'

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        📝 Calificaciones
      </h2>

      <div className='bg-white rounded-card p-6 shadow-card border border-border mb-5'>
        <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
          Clase / Materia
        </span>
        <select
          className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none max-w-[360px]'
          value={selAsignacion ?? ''}
          onChange={(e) => setSelAsig(Number(e.target.value))}
        >
          <option value=''>Seleccioná una clase...</option>
          {asignaciones.map((a) => (
            <option key={a.id_asignacion} value={a.id_asignacion}>
              {a.materias?.nombre} — {a.cursos?.nivel} {a.cursos?.grado_anio} "
              {a.cursos?.division}"
            </option>
          ))}
        </select>
      </div>

      {selAsignacion && (
        <>
          {/* Formulario */}
          <div className='bg-white rounded-card p-6 shadow-card border border-border mb-5'>
            <div className='text-[15px] font-extrabold text-text mb-5'>
              Cargar nota
            </div>
            <form
              onSubmit={handleCargar}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr',
                gap: 14,
              }}
            >
              <div>
                <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                  Alumno
                </span>
                <select
                  className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                  required
                  value={form.id_alumno}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, id_alumno: e.target.value }))
                  }
                >
                  <option value=''>Seleccioná...</option>
                  {alumnos.map((a) => (
                    <option key={a.id_alumno} value={a.id_alumno}>
                      {a.apellido}, {a.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                  Trimestre
                </span>
                <select
                  className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                  value={form.trimestre}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, trimestre: e.target.value }))
                  }
                >
                  <option value='1'>1º Trimestre</option>
                  <option value='2'>2º Trimestre</option>
                  <option value='3'>3º Trimestre</option>
                </select>
              </div>
              <div>
                <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                  Tipo
                </span>
                <select
                  className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                  value={form.tipo_evaluacion}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, tipo_evaluacion: e.target.value }))
                  }
                >
                  <option>Parcial</option>
                  <option>Final</option>
                  <option>Trabajo Práctico</option>
                  <option>Oral</option>
                  <option>Recuperatorio</option>
                </select>
              </div>
              <div>
                <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                  Nota (0–10)
                </span>
                <input
                  type='number'
                  min='0'
                  max='10'
                  step='0.25'
                  required
                  className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                  value={form.nota}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, nota: e.target.value }))
                  }
                />
              </div>
              <div
                style={{
                  gridColumn: '1/-1',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-end',
                }}
              >
                <div style={{ flex: 1 }}>
                  <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                    Descripción (opcional)
                  </span>
                  <input
                    className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                    value={form.descripcion}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, descripcion: e.target.value }))
                    }
                    placeholder='Ej: Primer parcial unidad 1'
                  />
                </div>
                <button
                  type='submit'
                  className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
                >
                  Cargar nota
                </button>
              </div>
              {msg && (
                <div
                  style={{
                    gridColumn: '1/-1',
                    fontSize: 13,
                    fontWeight: 700,
                    color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
                  }}
                >
                  {msg}
                </div>
              )}
            </form>
          </div>

          {/* Historial */}
          <div className='bg-white rounded-card p-6 shadow-card border border-border'>
            <div className='text-[15px] font-extrabold text-text mb-5'>
              Notas cargadas
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                    Alumno
                  </th>
                  <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                    Tipo
                  </th>
                  <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                    Trimestre
                  </th>
                  <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                    Fecha
                  </th>
                  <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                    Nota
                  </th>
                </tr>
              </thead>
              <tbody>
                {calificaciones.map((c) => (
                  <tr key={c.id_calificacion}>
                    <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                      {c.alumnos?.apellido}, {c.alumnos?.nombre}
                    </td>
                    <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                      <span className='inline-block bg-[#5B35C51A] text-purple-700 rounded-[20px] px-[10px] py-[3px] text-[11px] font-extrabold'>
                        {c.tipo_evaluacion}
                      </span>
                    </td>
                    <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                      T{c.trimestre}
                    </td>
                    <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                      {new Date(c.fecha_carga).toLocaleDateString('es-AR')}
                    </td>
                    <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: notaColor(c.nota) + '1A',
                          color: notaColor(c.nota),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          fontSize: 14,
                        }}
                      >
                        {c.nota}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  AMONESTACIONES (Docente)
// ═══════════════════════════════════════════════════════════════
function GestionAmonestaciones({ userId }: { userId: string }) {
  const [idDocente, setIdDocente] = useState<number | null>(null)
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [alumnos, setAlumnos] = useState<
    { id_alumno: number; nombre: string; apellido: string }[]
  >([])
  const [amonestaciones, setAmonest] = useState<
    {
      id_amonestacion: number
      tipo: string
      descripcion: string
      fecha: string
      alumnos: { nombre: string; apellido: string } | null
    }[]
  >([])
  const [selCurso, setSelCurso] = useState<number | null>(null)
  const [form, setForm] = useState({
    id_alumno: '',
    tipo: 'Leve',
    descripcion: '',
  })
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase
      .from('docentes')
      .select('id_docente')
      .eq('id_usuario', userId)
      .single()
      .then(({ data: doc }) => {
        if (!doc) return
        setIdDocente(doc.id_docente)
        supabase
          .from('asignaciones')
          .select(
            '*, materias(nombre), cursos(id_curso, nivel, grado_anio, division)',
          )
          .eq('id_docente', doc.id_docente)
          .eq('activo', true)
          .then(({ data }) => {
            if (data) setAsignaciones(data as unknown as Asignacion[])
          })
        supabase
          .from('amonestaciones')
          .select('*, alumnos(nombre, apellido)')
          .eq('id_docente', doc.id_docente)
          .order('fecha', { ascending: false })
          .then(({ data }) => {
            if (data) setAmonest(data as any)
          })
      })
  }, [userId])

  const handleSelCurso = (idCurso: number) => {
    setSelCurso(idCurso)
    supabase
      .from('alumnos')
      .select('id_alumno, nombre, apellido')
      .eq('id_curso', idCurso)
      .eq('activo', true)
      .order('apellido')
      .then(({ data }) => {
        if (data) setAlumnos(data)
      })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    const { error } = await supabase.from('amonestaciones').insert([
      {
        id_alumno: Number(form.id_alumno),
        id_docente: idDocente,
        tipo: form.tipo,
        descripcion: form.descripcion,
      },
    ])
    if (error) setMsg('Error: ' + error.message)
    else {
      setMsg('✅ Amonestación registrada.')
      setForm({ id_alumno: '', tipo: 'Leve', descripcion: '' })
      supabase
        .from('amonestaciones')
        .select('*, alumnos(nombre, apellido)')
        .eq('id_docente', idDocente!)
        .order('fecha', { ascending: false })
        .then(({ data }) => {
          if (data) setAmonest(data as any)
        })
    }
  }

  const TIPO_COLOR: Record<string, string> = {
    Leve: '#E67E22',
    Grave: '#E74C3C',
    'Muy grave': '#C0392B',
  }
  const cursosUnicos = asignaciones.filter(
    (a, i, arr) =>
      arr.findIndex(
        (b) => (b.cursos as any)?.id_curso === (a.cursos as any)?.id_curso,
      ) === i,
  )

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 20px' }}>
        ⚠️ Amonestaciones
      </h2>

      <div className='bg-white rounded-card p-6 shadow-card border border-border mb-5'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Registrar amonestación
        </div>
        <div style={{ marginBottom: 14 }}>
          <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
            Seleccioná el curso
          </span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {cursosUnicos.map((a) => (
              <button
                key={(a.cursos as any)?.id_curso}
                className={
                  selCurso === (a.cursos as any)?.id_curso
                    ? 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
                    : 'bg-purpleLight text-purple-700 border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
                }
                onClick={() => handleSelCurso((a.cursos as any)?.id_curso)}
              >
                {a.cursos?.nivel} {a.cursos?.grado_anio} "{a.cursos?.division}"
              </button>
            ))}
          </div>
        </div>
        {selCurso && (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}
          >
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Alumno
              </span>
              <select
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                required
                value={form.id_alumno}
                onChange={(e) =>
                  setForm((p) => ({ ...p, id_alumno: e.target.value }))
                }
              >
                <option value=''>Seleccioná...</option>
                {alumnos.map((a) => (
                  <option key={a.id_alumno} value={a.id_alumno}>
                    {a.apellido}, {a.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Tipo
              </span>
              <select
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                value={form.tipo}
                onChange={(e) =>
                  setForm((p) => ({ ...p, tipo: e.target.value }))
                }
              >
                <option>Leve</option>
                <option>Grave</option>
                <option>Muy grave</option>
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Descripción del hecho
              </span>
              <textarea
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border min-h-[80px] resize-y'
                required
                value={form.descripcion}
                onChange={(e) =>
                  setForm((p) => ({ ...p, descripcion: e.target.value }))
                }
              />
            </div>
            <div
              style={{
                gridColumn: '1/-1',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <button
                type='submit'
                className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
              >
                Registrar amonestación
              </button>
              {msg && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
                  }}
                >
                  {msg}
                </span>
              )}
            </div>
          </form>
        )}
      </div>

      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Historial de amonestaciones
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Alumno
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Tipo
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Descripción
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Fecha
              </th>
            </tr>
          </thead>
          <tbody>
            {amonestaciones.map((a) => (
              <tr key={a.id_amonestacion}>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle font-bold'>
                  {a.alumnos?.apellido}, {a.alumnos?.nombre}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span style={badge(TIPO_COLOR[a.tipo] ?? '#6B6B8A')}>
                    {a.tipo}
                  </span>
                </td>
                <td
                  className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'
                  style={{ color: '#6B6B8A', maxWidth: 300 }}
                >
                  {a.descripcion}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                  {new Date(a.fecha).toLocaleDateString('es-AR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
// ═══════════════════════════════════════════════════════════════
//  R7: GESTIÓN DE GALERÍA DE FOTOS (Admin / Directivos)
// ═══════════════════════════════════════════════════════════════
function GestionGaleria({ userId }: { userId: string }) {
  const [imagenes, setImagenes] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    categoria: 'Instalaciones',
    url_imagen: '',
  })

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('galeria')
      .select('*')
      .order('fecha_subida', { ascending: false })
    if (data) setImagenes(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    try {
      let finalUrl = form.url_imagen

      // Si el usuario adjuntó un archivo local, procesamos la subida a Supabase Storage
      if (file) {
        const fileExt = file.name.split('.').pop()
        const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('galeria-imagenes')
          .upload(uniqueFileName, file)

        if (uploadError)
          throw new Error('Error en Storage: ' + uploadError.message)

        // Recuperar URL pública del archivo cargado
        const { data } = supabase.storage
          .from('galeria-imagenes')
          .getPublicUrl(uniqueFileName)

        finalUrl = data.publicUrl
      }

      if (!finalUrl) {
        throw new Error(
          'Debes seleccionar un archivo de imagen o ingresar una URL externa.',
        )
      }

      // Persistir registro meta en la base de datos relacional
      const { error } = await supabase.from('galeria').insert([
        {
          titulo: form.titulo || null,
          descripcion: form.descripcion || null,
          categoria: form.categoria || null,
          url_imagen: finalUrl,
          id_autor: userId,
        },
      ])

      if (error) throw error

      setMsg('✅ Imagen incorporada a la galería correctamente.')
      setForm({
        titulo: '',
        descripcion: '',
        categoria: 'Instalaciones',
        url_imagen: '',
      })
      setFile(null)
      setShowForm(false)
      load()
    } catch (err: any) {
      setMsg('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleActivo = async (id: number, activo: boolean) => {
    await supabase
      .from('galeria')
      .update({ activo: !activo })
      .eq('id_imagen', id)
    load()
  }

  const eliminarImagen = async (id: number, urlImagen: string) => {
    if (
      !window.confirm(
        '¿Confirmás la eliminación permanente de esta fotografía?',
      )
    )
      return

    try {
      // Si la imagen pertenece al storage propio, borramos el binario para evitar archivos huérfanos
      if (urlImagen.includes('galeria-imagenes')) {
        const parts = urlImagen.split('/')
        const fileName = parts[parts.length - 1]
        await supabase.storage.from('galeria-imagenes').remove([fileName])
      }

      const { error } = await supabase
        .from('galeria')
        .delete()
        .eq('id_imagen', id)
      if (error) throw error

      setMsg('✅ Registro fotográfico purgado con éxito.')
      load()
    } catch (err: any) {
      setMsg('Error al eliminar: ' + err.message)
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
          🖼️ Galería Institucional
        </h2>
        <button
          className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : '+ Agregar Imagen'}
        </button>
      </div>

      {showForm && (
        <div className='bg-white rounded-card p-6 shadow-card border border-border mb-6'>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            Publicar nueva fotografía
          </div>
          <form
            onSubmit={handleCreate}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 14,
              }}
            >
              <div>
                <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                  Título de la foto (Opcional)
                </span>
                <input
                  className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                  value={form.titulo}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, titulo: e.target.value }))
                  }
                  placeholder='Ej: Laboratorio de Ciencias Avanzadas'
                />
              </div>
              <div>
                <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                  Categoría / Sección
                </span>
                <select
                  className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                  value={form.categoria}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, categoria: e.target.value }))
                  }
                >
                  <option value='Instalaciones'>Instalaciones</option>
                  <option value='Actividades'>Actividades</option>
                  <option value='Idiomas'>Idiomas</option>
                  <option value='Deportes'>Deportes</option>
                  <option value='Arte'>Arte</option>
                  <option value='Tecnología'>Tecnología</option>
                </select>
              </div>
            </div>

            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Descripción descriptiva (Opcional)
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                value={form.descripcion}
                onChange={(e) =>
                  setForm((p) => ({ ...p, descripcion: e.target.value }))
                }
                placeholder='Breve reseña sobre lo que muestra la imagen...'
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 14,
                alignItems: 'center',
              }}
            >
              <div>
                <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                  Opción A: Seleccionar archivo local
                </span>
                <input
                  type='file'
                  accept='image/*'
                  className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFile(e.target.files[0])
                    }
                  }}
                />
              </div>
              <div>
                <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                  Opción B: Vincular URL de imagen remota
                </span>
                <input
                  className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                  value={form.url_imagen}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, url_imagen: e.target.value }))
                  }
                  placeholder='https://images.unsplash.com/...'
                  disabled={!!file}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <button
                type='submit'
                disabled={loading}
                className={
                  loading
                    ? 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer opacity-60'
                    : 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
                }
              >
                {loading ? 'Subiendo contenido...' : 'Publicar en Galería'}
              </button>
            </div>

            {msg && (
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
                }}
              >
                {msg}
              </div>
            )}
          </form>
        </div>
      )}

      {/* Lista del Repositorio Visual */}
      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Miniatura
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Título / Categoría
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Fecha de Subida
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Estado
              </th>
              <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {imagenes.map((img) => (
              <tr key={img.id_imagen}>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <img
                    src={img.url_imagen}
                    alt={img.titulo || 'Mina'}
                    style={{
                      width: 65,
                      height: 48,
                      objectFit: 'cover',
                      borderRadius: 8,
                      border: `1px solid ${'#E8E6F5'}`,
                    }}
                  />
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span style={{ fontWeight: 700 }}>
                    {img.titulo || 'Fotografía sin título'}
                  </span>
                  <br />
                  <span className='inline-block bg-[#5B35C51A] text-purple-700 rounded-[20px] px-[10px] py-[3px] text-[11px] font-extrabold'>
                    {img.categoria || 'General'}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted'>
                  {new Date(img.fecha_subida).toLocaleDateString('es-AR')}
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <span style={badge(img.activo ? '#27AE60' : '#E74C3C')}>
                    {img.activo ? 'Visible en Home' : 'Oculta'}
                  </span>
                </td>
                <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={
                        img.activo
                          ? 'bg-[#E74C3C1A] text-red border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                          : 'bg-[#27AE601A] text-green border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                      }
                      onClick={() => toggleActivo(img.id_imagen, img.activo)}
                    >
                      {img.activo ? 'Ocultar' : 'Mostrar'}
                    </button>
                    <button
                      className='bg-[#E74C3C26] text-red border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                      onClick={() =>
                        eliminarImagen(img.id_imagen, img.url_imagen)
                      }
                    >
                      Eliminar permanentemente
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {imagenes.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-center text-textMuted p-8'
                >
                  No se registran imágenes en la galería institucional.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
// ═══════════════════════════════════════════════════════════════
//  GESTIÓN DE EMPLEOS
// ═══════════════════════════════════════════════════════════════
const MODALIDADES = ['Presencial', 'Remoto', 'Híbrido']
const TIPOS_CONTRATO = [
  'Full-time',
  'Part-time',
  'Pasantía',
  'Suplencia',
  'Temporal',
]
const MODALIDAD_COLOR: Record<string, string> = {
  Presencial: '#2980B9',
  Remoto: '#27AE60',
  Híbrido: '#7B55E8',
}

function GestionEmpleos() {
  const [empleos, setEmpleos] = useState<Empleo[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const FORM_VACIO = {
    titulo: '',
    descripcion: '',
    area: '',
    requisitos: '',
    tipo_contrato: 'Full-time',
    fecha_cierre: '',
  }
  const [form, setForm] = useState(FORM_VACIO)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('empleos')
      .select('*')
      .order('fecha_publicacion', { ascending: false })
    if (data) setEmpleos(data as Empleo[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const { error } = await supabase.from('empleos').insert([
      {
        ...form,
        fecha_cierre: form.fecha_cierre || null,
      },
    ])
    if (error) {
      setMsg('❌ Error: ' + error.message)
    } else {
      setMsg('✅ Empleo publicado correctamente.')
      setForm(FORM_VACIO)
      setShowForm(false)
      load()
    }
    setLoading(false)
  }

  const toggleActivo = async (id: number, activo: boolean) => {
    await supabase
      .from('empleos')
      .update({ activo: !activo })
      .eq('id_empleo', id)
    load()
  }

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar esta oferta?')) return
    await supabase.from('empleos').delete().eq('id_empleo', id)
    load()
  }

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex justify-between items-center'>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>💼 Empleos</h2>
        <button
          className='bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer'
          onClick={() => {
            setShowForm(!showForm)
            setMsg('')
          }}
        >
          {showForm ? 'Cancelar' : '+ Publicar empleo'}
        </button>
      </div>

      {showForm && (
        <div className='bg-white rounded-card p-6 shadow-card border border-border'>
          <div className='text-[15px] font-extrabold text-text mb-5'>
            Nueva oferta laboral
          </div>
          <form onSubmit={handleCreate} className='flex flex-col gap-4'>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Título del puesto *
              </span>
              <input
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                required
                placeholder='Ej: Docente de Matemáticas'
                value={form.titulo}
                onChange={(e) =>
                  setForm((p) => ({ ...p, titulo: e.target.value }))
                }
              />
            </div>
            <div className='grid grid-cols-3 gap-4'>
              <div>
                <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                  Área / Departamento
                </span>
                <input
                  className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                  placeholder='Ej: Educación primaria'
                  value={form.area}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, area: e.target.value }))
                  }
                />
              </div>

              <div>
                <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                  Tipo de contrato
                </span>
                <select
                  className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border appearance-none'
                  value={form.tipo_contrato}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, tipo_contrato: e.target.value }))
                  }
                >
                  {TIPOS_CONTRATO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Descripción
              </span>
              <textarea
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border min-h-[80px] resize-y'
                placeholder='Descripción del puesto, tareas, etc.'
                value={form.descripcion}
                onChange={(e) =>
                  setForm((p) => ({ ...p, descripcion: e.target.value }))
                }
              />
            </div>
            <div>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Requisitos
              </span>
              <textarea
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border min-h-[80px] resize-y'
                placeholder='Formación requerida, experiencia, certificaciones...'
                value={form.requisitos}
                onChange={(e) =>
                  setForm((p) => ({ ...p, requisitos: e.target.value }))
                }
              />
            </div>
            <div style={{ maxWidth: 240 }}>
              <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
                Fecha de cierre (opcional)
              </span>
              <input
                type='date'
                className='w-full px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none box-border'
                value={form.fecha_cierre}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fecha_cierre: e.target.value }))
                }
              />
            </div>
            <button
              type='submit'
              disabled={loading}
              className={
                loading
                  ? 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer opacity-60 self-start'
                  : 'bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-btn py-[10px] px-5 text-[13px] font-extrabold cursor-pointer self-start'
              }
            >
              {loading ? 'Publicando...' : 'Publicar oferta'}
            </button>
            {msg && (
              <div
                className='text-[13px] font-bold px-4 py-3 rounded-lg border'
                style={{
                  color: msg.startsWith('✅') ? '#27AE60' : '#E74C3C',
                  background: msg.startsWith('✅') ? '#27AE6012' : '#E74C3C12',
                  borderColor: msg.startsWith('✅') ? '#27AE6040' : '#E74C3C40',
                }}
              >
                {msg}
              </div>
            )}
          </form>
        </div>
      )}

      {msg && !showForm && (
        <div className='text-[13px] font-bold text-green px-4 py-3 rounded-lg bg-[#27AE6012] border border-[#27AE6040]'>
          {msg}
        </div>
      )}

      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Ofertas publicadas
          <span className='ml-2 text-[12px] font-bold text-textMuted'>
            ({empleos.length})
          </span>
        </div>
        {empleos.length === 0 ? (
          <div className='text-center text-textMuted py-8 text-[14px]'>
            No hay ofertas publicadas aún.
          </div>
        ) : (
          <div className='flex flex-col gap-3'>
            {empleos.map((emp) => (
              <div
                key={emp.id_empleo}
                className='flex items-start justify-between gap-4 p-4 rounded-xl border border-border transition-all duration-200'
                style={{ opacity: emp.activo ? 1 : 0.5 }}
              >
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-2 flex-wrap mb-1'>
                    <span className='text-[15px] font-extrabold text-text'>
                      {emp.titulo}
                    </span>

                    {emp.tipo_contrato && (
                      <span className='inline-block bg-purpleLight text-purple-700 px-[8px] py-[2px] rounded-full text-[10px] font-extrabold'>
                        {emp.tipo_contrato}
                      </span>
                    )}
                    {!emp.activo && (
                      <span className='inline-block bg-[#6B6B8A1A] text-textMuted px-[8px] py-[2px] rounded-full text-[10px] font-extrabold'>
                        Inactivo
                      </span>
                    )}
                  </div>
                  {emp.area && (
                    <div className='text-[12px] text-textMuted mb-1'>
                      📍 {emp.area}
                    </div>
                  )}
                  {emp.descripcion && (
                    <div className='text-[12px] text-text leading-relaxed'>
                      {emp.descripcion.slice(0, 120)}
                      {emp.descripcion.length > 120 ? '...' : ''}
                    </div>
                  )}
                  <div className='text-[11px] text-textMuted mt-2'>
                    Publicado: {emp.fecha_publicacion}
                    {emp.fecha_cierre && ` · Cierre: ${emp.fecha_cierre}`}
                  </div>
                </div>
                <div className='flex gap-2 shrink-0'>
                  <button
                    className={
                      emp.activo
                        ? 'bg-[#E67E221A] text-orange border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                        : 'bg-[#27AE601A] text-green border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                    }
                    onClick={() => toggleActivo(emp.id_empleo, emp.activo)}
                  >
                    {emp.activo ? 'Pausar' : 'Activar'}
                  </button>
                  <button
                    className='bg-[#E74C3C1A] text-red border-0 rounded-lg py-[6px] px-3 text-xs font-extrabold cursor-pointer'
                    onClick={() => eliminar(emp.id_empleo)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  POSTULACIONES A EMPLEOS
// ═══════════════════════════════════════════════════════════════
const POST_ESTADOS = [
  'Recibida',
  'En revisión',
  'Entrevista',
  'Seleccionada',
  'Rechazada',
]
const POST_COLOR: Record<string, string> = {
  Recibida: '#2980B9',
  'En revisión': '#E67E22',
  Entrevista: '#7B55E8',
  Seleccionada: '#27AE60',
  Rechazada: '#E74C3C',
}

function GestionPostulaciones() {
  const [postulaciones, setPostulaciones] = useState<Postulacion[]>([])
  const [empleos, setEmpleos] = useState<
    { id_empleo: number; titulo: string }[]
  >([])
  const [filtroEmpleo, setFiltroEmpleo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [expandido, setExpandido] = useState<number | null>(null)

  const load = useCallback(async () => {
    const [{ data: posts }, { data: emps }] = await Promise.all([
      supabase
        .from('postulaciones')
        .select('*, empleos(titulo, area)')
        .order('fecha_postulacion', { ascending: false }),
      supabase
        .from('empleos')
        .select('id_empleo, titulo')
        .eq('activo', true)
        .order('titulo'),
    ])
    if (posts) setPostulaciones(posts as unknown as Postulacion[])
    if (emps) setEmpleos(emps as { id_empleo: number; titulo: string }[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const cambiarEstado = async (id: number, estado: string) => {
    await supabase
      .from('postulaciones')
      .update({ estado })
      .eq('id_postulacion', id)
    load()
  }

  const filtradas = postulaciones.filter((p) => {
    if (filtroEmpleo && p.id_empleo !== Number(filtroEmpleo)) return false
    if (filtroEstado && p.estado !== filtroEstado) return false
    return true
  })

  const conteosPorEstado = POST_ESTADOS.reduce<Record<string, number>>(
    (acc, e) => {
      acc[e] = postulaciones.filter((p) => p.estado === e).length
      return acc
    },
    {},
  )

  return (
    <div className='flex flex-col gap-6'>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
        📩 Postulaciones
      </h2>

      {/* Estadísticas */}
      <div className='grid grid-cols-5 gap-3'>
        {POST_ESTADOS.map((e) => (
          <button
            key={e}
            onClick={() => setFiltroEstado(filtroEstado === e ? '' : e)}
            className='bg-white rounded-card p-4 shadow-card border text-center transition-all duration-200 cursor-pointer'
            style={{
              borderColor: filtroEstado === e ? POST_COLOR[e] : '#E8E6F5',
              borderWidth: filtroEstado === e ? 2 : 1,
            }}
          >
            <div
              className='text-[22px] font-black'
              style={{ color: POST_COLOR[e] }}
            >
              {conteosPorEstado[e] ?? 0}
            </div>
            <div className='text-[10px] font-extrabold text-textMuted mt-1'>
              {e}
            </div>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className='flex gap-4 items-center'>
        <div>
          <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
            Filtrar por empleo
          </span>
          <select
            className='px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none appearance-none'
            style={{ minWidth: 260 }}
            value={filtroEmpleo}
            onChange={(e) => setFiltroEmpleo(e.target.value)}
          >
            <option value=''>Todos los empleos</option>
            {empleos.map((emp) => (
              <option key={emp.id_empleo} value={emp.id_empleo}>
                {emp.titulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className='text-[11px] font-extrabold text-textMuted block mb-[5px]'>
            Filtrar por estado
          </span>
          <select
            className='px-[14px] py-[10px] rounded-input border-2 border-border text-[13px] text-text outline-none appearance-none'
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value=''>Todos los estados</option>
            {POST_ESTADOS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {(filtroEmpleo || filtroEstado) && (
          <button
            className='mt-5 text-[12px] font-bold text-purple-700 bg-purpleLight border-0 rounded-lg px-3 py-[7px] cursor-pointer'
            onClick={() => {
              setFiltroEmpleo('')
              setFiltroEstado('')
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className='bg-white rounded-card p-6 shadow-card border border-border'>
        <div className='text-[15px] font-extrabold text-text mb-5'>
          Postulantes
          <span className='ml-2 text-[12px] font-bold text-textMuted'>
            ({filtradas.length} resultado{filtradas.length !== 1 ? 's' : ''})
          </span>
        </div>

        {filtradas.length === 0 ? (
          <div className='text-center text-textMuted py-10 text-[14px]'>
            No hay postulaciones con los filtros seleccionados.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                  Postulante
                </th>
                <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                  Empleo
                </th>
                <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                  Fecha
                </th>
                <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                  Estado
                </th>
                <th className='text-left text-[10px] font-extrabold text-textMuted uppercase tracking-[0.07em] pb-3 pr-3 border-b-2 border-border'>
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((p) => (
                <>
                  <tr key={p.id_postulacion}>
                    <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                      <div className='font-bold'>
                        {p.apellido}, {p.nombre}
                      </div>
                      <a
                        href={`mailto:${p.email}`}
                        className='text-[11px] text-purple-700 no-underline hover:underline'
                      >
                        {p.email}
                      </a>
                      {p.telefono && (
                        <div className='text-[11px] text-textMuted'>
                          {p.telefono}
                        </div>
                      )}
                    </td>
                    <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                      <div className='font-extrabold text-purple-700 text-[12px]'>
                        {p.empleos?.titulo}
                      </div>
                      {p.empleos?.area && (
                        <div className='text-[11px] text-textMuted'>
                          📍 {p.empleos.area}
                        </div>
                      )}
                    </td>
                    <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle text-textMuted text-xs'>
                      {new Date(p.fecha_postulacion).toLocaleDateString(
                        'es-AR',
                      )}
                    </td>
                    <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                      <span style={badge(POST_COLOR[p.estado] ?? '#6B6B8A')}>
                        {p.estado}
                      </span>
                    </td>
                    <td className='py-[11px] pr-3 text-[13px] border-b border-border align-middle'>
                      <div className='flex flex-col gap-[6px]'>
                        <select
                          className='rounded-input border-2 border-border text-[13px] text-text outline-none w-[160px] px-[10px] py-[6px] appearance-none'
                          value={p.estado}
                          onChange={(e) =>
                            cambiarEstado(p.id_postulacion, e.target.value)
                          }
                        >
                          {POST_ESTADOS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        {p.mensaje && (
                          <button
                            className='bg-purpleLight text-purple-700 border-0 rounded-lg w-[160px] px-[10px] py-[6px] text-xs font-extrabold cursor-pointer text-left'
                            onClick={() =>
                              setExpandido(
                                expandido === p.id_postulacion
                                  ? null
                                  : p.id_postulacion,
                              )
                            }
                          >
                            {expandido === p.id_postulacion
                              ? '▲ Ocultar mensaje'
                              : '▼ Ver mensaje'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandido === p.id_postulacion && p.mensaje && (
                    <tr key={`msg-${p.id_postulacion}`}>
                      <td
                        colSpan={5}
                        className='bg-purpleLight px-6 py-4 border-b border-border text-[13px] text-text leading-relaxed'
                      >
                        <div className='text-[10px] font-extrabold text-textMuted uppercase tracking-wider mb-2'>
                          Mensaje del postulante
                        </div>
                        {p.mensaje}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

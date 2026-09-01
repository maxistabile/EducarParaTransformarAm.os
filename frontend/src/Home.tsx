/**
 * Home.tsx
 * Página pública — Educar Para Transformar
 * Secciones: Nav, Info general, Contamos con, Misión, Novedades, Galería, Contacto
 */

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Link, useNavigate } from 'react-router-dom'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
)

// ═══════════════════════════════════════════════════════════════
//  TIPOS
// ═══════════════════════════════════════════════════════════════
interface Noticia {
  id_noticia: number
  titulo: string
  resumen: string | null
  url_imagen: string | null
  fecha_publicacion: string
  destacada: boolean
}

interface Empleo {
  id_empleo: number
  titulo: string
  descripcion: string | null
  area: string | null
  requisitos: string | null
  tipo_contrato: string | null
  fecha_publicacion: string
  fecha_cierre: string | null
}

interface ImagenGaleria {
  id_imagen: number
  titulo: string | null
  url_imagen: string
  categoria: string | null
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
const MESES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]

function formatFecha(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

// Imágenes placeholder por sección (unsplash)
const PLACEHOLDERS: Record<string, string> = {
  alumnos:
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&q=80',
  docentes:
    'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&q=80',
  niveles:
    'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&q=80',
  instalaciones:
    'https://images.unsplash.com/photo-1562774053-701939374585?w=600&q=80',
  idiomas:
    'https://images.unsplash.com/photo-1526470498-9ae73c665de8?w=600&q=80',
  deportes:
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&q=80',
  tecnologia:
    'https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=600&q=80',
  arte: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&q=80',
  hero: 'https://images.unsplash.com/photo-1529390079861-591de354faf5?w=1200&q=80',
  noticia:
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&q=80',
}

// ═══════════════════════════════════════════════════════════════
//  DATOS DE CONTACTO INSTITUCIONALES
// ═══════════════════════════════════════════════════════════════
const CONTACTO = {
  // Número en formato internacional, solo dígitos (para enlaces wa.me)
  whatsapp: '5493624123456',
  whatsappLabel: '+54 9 362 412-3456',
  email: 'educarparatransformar@gmail.com',
  direccion: 'Resistencia, Chaco',
  instagram: 'https://instagram.com/educarparatransformar',
  instagramHandle: '@educarparatransformar',
  facebook: 'https://facebook.com/educarparatransformar',
  facebookHandle: 'Educar Para Transformar',
}

// ═══════════════════════════════════════════════════════════════
//  CAROUSEL DATA
// ═══════════════════════════════════════════════════════════════
const CAROUSEL_ITEMS = [
  { label: 'Instalaciones', color: '#5B35C5', img: PLACEHOLDERS.instalaciones },
  { label: 'Idiomas', color: '#2980B9', img: 'idiomas.png' },
  { label: 'Deportes', color: '#27AE60', img: PLACEHOLDERS.deportes },
  { label: 'Tecnología', color: '#E67E22', img: PLACEHOLDERS.tecnologia },
  { label: 'Arte', color: '#E91E8C', img: PLACEHOLDERS.arte },
]

const INFO_CARDS = [
  {
    label: 'Perfil de los alumnos',
    color: '#E91E8C',
    img: 'https://images.ecestaticos.com/CKUfRzWT3KFUBKN7Ho1h4N9P9io=/189x5:2202x1515/1200x900/filters:fill(white):format(jpg)/f.elconfidencial.com%2Foriginal%2Fa3d%2F216%2F63b%2Fa3d21663bc3dc3a57cf5f0dfb50a2d18.jpg',
  },
  { label: 'Planta docente', color: '#27AE60', img: PLACEHOLDERS.docentes },
  { label: 'Niveles educativos', color: '#E67E22', img: PLACEHOLDERS.niveles },
]

// Links del navbar (reutilizados en desktop y en el menú mobile)
const NAV_LINKS = [
  { label: 'Nosotros', href: '#nosotros' },
  { label: 'Ingresantes', href: '#ingresantes' },
  { label: 'Novedades', href: '#novedades' },
  { label: 'Empleos', href: '#empleos' },
  { label: 'Galerías', href: '#galeria' },
  { label: 'Campus Virtual', href: '/login', isRoute: true },
  { label: 'Contacto', href: '#contacto' },
]

// ═══════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function Home() {
  const navigate = useNavigate()
  const [noticias, setNoticias] = useState<Noticia[]>([])
  const [galeria, setGaleria] = useState<ImagenGaleria[]>([])
  const [empleos, setEmpleos] = useState<Empleo[]>([])
  const [empleoModal, setEmpleoModal] = useState<Empleo | null>(null)
  const [carouselIdx, setCarouselIdx] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchVal, setSearchVal] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    loadNoticias()
    loadGaleria()
    loadEmpleos()
  }, [])

  // Verificar el rol del usuario para redirección correcta
  useEffect(() => {
    const checkUserRole = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.user) {
        const { data } = await supabase
          .from('usuarios')
          .select('rol')
          .eq('id_usuario', session.user.id)
          .single()
        if (data) {
          setUserRole(data.rol)
        }
      }
    }
    checkUserRole()
  }, [])

  async function loadNoticias() {
    const { data } = await supabase
      .from('noticias')
      .select(
        'id_noticia, titulo, resumen, url_imagen, fecha_publicacion, destacada',
      )
      .eq('activo', true)
      .order('fecha_publicacion', { ascending: false })
      .limit(6)
    if (data) setNoticias(data as Noticia[])
  }

  async function loadGaleria() {
    const { data } = await supabase
      .from('galeria')
      .select('id_imagen, titulo, url_imagen, categoria')
      .eq('activo', true)
      .limit(8)
    if (data) setGaleria(data as ImagenGaleria[])
  }

  async function loadEmpleos() {
    const { data } = await supabase
      .from('empleos')
      .select(
        'id_empleo, titulo, descripcion, area, requisitos, tipo_contrato, fecha_publicacion, fecha_cierre',
      )
      .eq('activo', true)
      .order('fecha_publicacion', { ascending: false })
      .limit(6)
    if (data) setEmpleos(data as Empleo[])
  }

  const prevCarousel = () =>
    setCarouselIdx(
      (i) => (i - 1 + CAROUSEL_ITEMS.length) % CAROUSEL_ITEMS.length,
    )
  const nextCarousel = () =>
    setCarouselIdx((i) => (i + 1) % CAROUSEL_ITEMS.length)

  // 3 items visibles en el carousel
  const visibleItems = [0, 1, 2].map(
    (offset) => CAROUSEL_ITEMS[(carouselIdx + offset) % CAROUSEL_ITEMS.length],
  )

  return (
    <div className='text-text bg-bg'>
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          NAVBAR
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className='bg-white border-b-[3px] border-b-purple-700 sticky top-0 z-[200] shadow-[0_2px_16px_rgba(91,53,197,0.08)]'>
        <div className='max-w-[1200px] mx-auto px-4 md:px-6 h-[64px] md:h-[70px] flex items-center justify-between gap-4'>
          {/* Logo */}
          <div className='flex items-center gap-[10px] shrink-0'>
            <Link to='/'>
              <img
                src='/logo.png'
                alt='Logo'
                className='h-10 md:h-[50px] w-auto'
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </Link>
            <div>
              <div className='text-[11px] md:text-xs font-black text-purple-700 uppercase tracking-wide leading-tight'>
                Educar Para Transformar
              </div>
              <div className='text-[9px] text-textMuted uppercase tracking-wider'>
                Centro Educativo
              </div>
            </div>
          </div>

          {/* Nav links — desktop */}
          <nav className='hidden lg:flex items-center gap-1 flex-wrap'>
            {NAV_LINKS.map((item) => (
              <a
                key={item.label}
                href={item.isRoute ? undefined : item.href}
                onClick={item.isRoute ? () => navigate(item.href) : undefined}
                className={
                  item.isRoute
                    ? 'text-[13px] font-bold text-white bg-gradient-to-br from-purple-700 to-purpleMid py-[7px] px-[14px] rounded-lg no-underline cursor-pointer whitespace-nowrap'
                    : 'text-[13px] font-bold text-textMuted hover:text-purple-700 transition-colors duration-200 py-[7px] px-[10px] no-underline cursor-pointer whitespace-nowrap'
                }
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Buscador — solo desktop ancho */}
          <div className='hidden xl:flex items-center gap-2'>
            <input
              type='text'
              placeholder='Buscar...'
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              className='border-2 border-border rounded-full py-[7px] px-4 text-[13px] outline-none text-text w-40'
            />
            <span className='text-lg cursor-pointer text-purple-700'>🔍</span>
          </div>

          {/* Botón hamburguesa — mobile/tablet */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label='Abrir menú'
            aria-expanded={menuOpen}
            className='lg:hidden flex flex-col justify-center gap-[5px] w-10 h-10 shrink-0 cursor-pointer bg-transparent border-0 p-2'
          >
            <span
              className={`block h-[2px] w-full bg-purple-700 rounded transition-all duration-200 ${menuOpen ? 'translate-y-[7px] rotate-45' : ''}`}
            />
            <span
              className={`block h-[2px] w-full bg-purple-700 rounded transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`}
            />
            <span
              className={`block h-[2px] w-full bg-purple-700 rounded transition-all duration-200 ${menuOpen ? '-translate-y-[7px] -rotate-45' : ''}`}
            />
          </button>
        </div>

        {/* Menú desplegable — mobile/tablet */}
        {menuOpen && (
          <nav className='lg:hidden border-t border-border bg-white px-4 py-3 flex flex-col gap-1'>
            {NAV_LINKS.map((item) => (
              <a
                key={item.label}
                href={item.isRoute ? undefined : item.href}
                onClick={() => {
                  if (item.isRoute) navigate(item.href)
                  setMenuOpen(false)
                }}
                className={
                  item.isRoute
                    ? 'text-sm font-bold text-white bg-gradient-to-br from-purple-700 to-purpleMid py-[10px] px-3 rounded-lg no-underline cursor-pointer text-center mt-1'
                    : 'text-sm font-bold text-textMuted hover:text-purple-700 py-[10px] px-3 rounded-lg no-underline cursor-pointer'
                }
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          HERO
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className='relative overflow-hidden h-[440px] md:h-[500px]'>
        <img
          src={'/hero.png'}
          alt='Hero'
          className='absolute inset-0 w-full h-full object-cover object-center'
        />
        <div
          className='absolute inset-0 flex items-center'
          // style={{
          //   background:
          //     'linear-gradient(135deg, #3D2092CC 0%, #5B35C599 50%, transparent 100%)',
          // }}
        >
          <div className='max-w-[1200px] mx-auto px-6 md:px-10 text-white w-full'>
            <div className='text-[10px] md:text-[11px] font-extrabold tracking-[0.15em] uppercase opacity-80 mb-3'>
              Centro Educativo
            </div>
            <h1 className='text-[26px] sm:text-[36px] md:text-[44px] font-black leading-[1.15] mt-0 mb-4 max-w-[580px]'>
              Educamos para transformar el mundo
            </h1>
            <p className='text-sm md:text-base opacity-90 max-w-[460px] leading-relaxed mt-0 mb-7'>
              Inspiramos, desafiamos y empoderamos a nuestros alumnos a ser
              agentes de cambio en su comunidad.
            </p>
            <div className='flex flex-col sm:flex-row gap-3'>
              <a
                href='#ingresantes'
                className='bg-white text-purple-700 rounded-btn py-3 px-7 font-extrabold text-sm no-underline cursor-pointer text-center'
              >
                Quiero inscribirme
              </a>
              <a
                href='#nosotros'
                className='bg-white/15 text-white rounded-btn py-3 px-7 font-extrabold text-sm no-underline border-2 border-white/40 cursor-pointer text-center'
              >
                Conocenos
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          INFORMACIÓN GENERAL
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        id='nosotros'
        className='max-w-[1200px] mx-auto px-6 pt-[60px] pb-10'
      >
        <div className='mb-9'>
          <span className='text-[11px] font-extrabold text-purple-700 uppercase tracking-[0.12em]'>
            Quiénes somos
          </span>
          <h2 className='text-[30px] font-black mt-2 mb-0 text-text'>
            Información general del Instituto
          </h2>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
          {INFO_CARDS.map((card) => (
            <div
              key={card.label}
              className='group relative rounded-card overflow-hidden cursor-pointer h-[260px] hover:-translate-y-1 transition-transform duration-200 shadow-[0_4px_20px_rgba(91,53,197,0.1)] '
            >
              <img
                src={card.img}
                alt={card.label}
                className='w-full h-full object-cover block'
              />
              <div
                className='overlay absolute '
                style={{ background: card.color }}
              />
              <div className='absolute bottom-0 left-0 right-0 p-5 px-6 text-white'>
                <div className='text-lg font-black'>{card.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          CONTAMOS CON (CAROUSEL)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className='bg-white py-[60px]'>
        <div className='max-w-[1200px] mx-auto px-6'>
          <div className='mb-9'>
            <span className='text-[11px] font-extrabold text-purple-700 uppercase tracking-[0.12em]'>
              Nuestra oferta
            </span>
            <h2 className='text-[30px] font-black mt-2 mb-0 text-text'>
              Contamos con:
            </h2>
          </div>

          <div className='flex items-center gap-4'>
            {/* Flecha izq */}
            <button
              onClick={prevCarousel}
              className='w-11 h-11 rounded-full border-2 border-border bg-white cursor-pointer text-[20px] flex items-center justify-center shrink-0 text-purple-700 shadow-[0_2px_8px_rgba(91,53,197,0.1)]'
            >
              ‹
            </button>

            {/* Cards */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 flex-1'>
              {visibleItems.map((item, i) => (
                <div
                  key={i}
                  className='rounded-card overflow-hidden shadow-[0_4px_20px_rgba(91,53,197,0.1)] cursor-pointer hover:-translate-y-1 transition-transform duration-200'
                >
                  <div className='relative h-[200px]'>
                    <img
                      src={item.img}
                      alt={item.label}
                      className='w-full h-full object-cover'
                    />
                  </div>
                  <div
                    className='py-4 px-5 bg-white'
                    style={{ borderTop: `3px solid ${item.color}` }}
                  >
                    <div
                      className='text-base font-black'
                      style={{ color: item.color }}
                    >
                      {item.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Flecha der */}
            <button
              onClick={nextCarousel}
              className='w-11 h-11 rounded-full border-2 border-border bg-white cursor-pointer text-[20px] flex items-center justify-center shrink-0 text-purple-700 shadow-[0_2px_8px_rgba(91,53,197,0.1)]'
            >
              ›
            </button>
          </div>

          {/* Dots */}
          <div className='flex justify-center gap-2 mt-6'>
            {CAROUSEL_ITEMS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCarouselIdx(i)}
                className={[
                  'h-2 rounded border-0 cursor-pointer transition-all duration-300 p-0',
                  i === carouselIdx ? 'w-6 bg-purple-700' : 'w-2 bg-border',
                ].join(' ')}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          MISIÓN
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className='bg-gradient-to-br from-purpleDark via-purple-700 to-purpleMid py-20 px-6 text-center text-white relative overflow-hidden'>
        {/* Círculos decorativos */}
        <div className='absolute right-[-60px] top-[-60px] w-[300px] h-[300px] rounded-full bg-white/[0.04]' />
        <div className='absolute left-[-80px] bottom-[-80px] w-[400px] h-[400px] rounded-full bg-white/[0.03]' />

        <div className='relative max-w-[700px] mx-auto'>
          <div className='inline-block bg-white/15 rounded-[20px] py-[6px] px-5 text-[11px] font-extrabold tracking-[0.12em] uppercase mb-5'>
            Nuestra filosofía
          </div>
          <h2 className='text-4xl font-black mt-0 mb-6'>Nuestra misión</h2>
          <p className='text-lg leading-loose opacity-[0.92] mt-0 mb-8'>
            Inspiramos, desafiamos y empoderamos a todos nuestros alumnos a ser
            miembros comprometidos y éticos de una comunidad global, para que se
            conviertan en agentes de cambio conscientes de sí mismos, seguros,
            innovadores y colaborativos.
          </p>
          <a
            href='#nosotros'
            className='inline-block bg-white text-purple-700 rounded-btn py-3 px-8 font-black text-sm no-underline cursor-pointer'
          >
            Conocé más sobre nosotros
          </a>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          NOVEDADES (desde Supabase)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id='novedades' className='max-w-[1200px] mx-auto px-6 py-[60px]'>
        <div className='flex justify-between items-end mb-9'>
          <div>
            <span className='text-[11px] font-extrabold text-purple-700 uppercase tracking-[0.12em]'>
              Últimas noticias
            </span>
            <h2 className='text-[30px] font-black mt-2 mb-0 text-text'>
              Novedades
            </h2>
          </div>
          {noticias.length > 0 && (
            <a
              href='#novedades'
              className='text-[13px] font-extrabold text-purple-700 no-underline'
            >
              Ver todas →
            </a>
          )}
        </div>

        {noticias.length === 0 ? (
          /* Placeholder si no hay noticias cargadas aún */
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className='rounded-card overflow-hidden bg-white shadow-card border border-border'
              >
                <div className='h-[180px] bg-purpleLight flex items-center justify-center'>
                  <span className='text-3xl'>📰</span>
                </div>
                <div className='p-5'>
                  <div className='text-[11px] text-textMuted font-bold mb-2'>
                    Próximamente
                  </div>
                  <div className='h-4 bg-border rounded mb-2 w-4/5' />
                  <div className='h-3 bg-border rounded w-3/5' />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
            {noticias.slice(0, 6).map((n) => (
              <div
                key={n.id_noticia}
                onClick={() => navigate(`/noticias/${n.id_noticia}`)}
                className='rounded-card overflow-hidden bg-white shadow-card border border-border cursor-pointer hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(91,53,197,0.14)] transition-all duration-200'
              >
                <img
                  src={n.url_imagen ?? PLACEHOLDERS.noticia}
                  alt={n.titulo}
                  className='w-full h-[180px] object-cover block'
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).src = PLACEHOLDERS.noticia
                  }}
                />
                {n.destacada && (
                  <div className='bg-purple-700 text-white text-[10px] font-extrabold py-1 px-3 tracking-[0.08em] uppercase'>
                    ⭐ Destacado
                  </div>
                )}
                <div className='p-5'>
                  <div className='text-[11px] text-textMuted font-bold mb-2'>
                    {formatFecha(n.fecha_publicacion)}
                  </div>
                  <h3 className='text-[15px] font-black mt-0 mb-2 text-text leading-snug'>
                    {n.titulo}
                  </h3>
                  {n.resumen && (
                    <p className='text-[13px] text-textMuted m-0 leading-relaxed'>
                      {n.resumen.slice(0, 100)}...
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          EMPLEOS (desde Supabase)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id='empleos' className='bg-bg py-[60px]'>
        <div className='max-w-[1200px] mx-auto px-6'>
          <div className='mb-9'>
            <span className='text-[11px] font-extrabold text-purple-700 uppercase tracking-[0.12em]'>
              Sumate al equipo
            </span>
            <h2 className='text-[30px] font-black mt-2 mb-0 text-text'>
              Empleos disponibles
            </h2>
          </div>

          {empleos.length === 0 ? (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className='bg-white rounded-card shadow-card border border-border p-6 flex flex-col gap-3'
                >
                  <div className='h-4 bg-border rounded w-3/4' />
                  <div className='h-3 bg-border rounded w-1/3' />
                  <div className='h-3 bg-border rounded' />
                  <div className='h-3 bg-border rounded w-5/6' />
                  <div className='mt-2 h-3 bg-border rounded w-2/5' />
                </div>
              ))}
            </div>
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
              {empleos.map((emp) => (
                <div
                  key={emp.id_empleo}
                  className='bg-white rounded-card shadow-card border border-border overflow-hidden flex flex-col hover:-translate-y-1 transition-transform duration-200'
                >
                  {/* Header de color */}
                  <div className='bg-gradient-to-br from-purple-700 to-purpleMid px-6 py-5'>
                    <div className='flex gap-2 flex-wrap mb-2'>
                      {emp.tipo_contrato && (
                        <span className='inline-block bg-white/20 text-white px-[8px] py-[2px] rounded-full text-[10px] font-extrabold'>
                          {emp.tipo_contrato}
                        </span>
                      )}
                    </div>
                    <h3 className='text-white font-black text-[17px] leading-snug m-0'>
                      {emp.titulo}
                    </h3>
                    {emp.area && (
                      <div className='text-white/80 text-[12px] mt-1'>
                        📍 {emp.area}
                      </div>
                    )}
                  </div>

                  {/* Cuerpo */}
                  <div className='p-6 flex flex-col flex-1 gap-3'>
                    {emp.descripcion && (
                      <p className='text-[13px] text-text leading-relaxed m-0'>
                        {emp.descripcion.slice(0, 120)}
                        {emp.descripcion.length > 120 ? '...' : ''}
                      </p>
                    )}
                    {emp.requisitos && (
                      <div>
                        <div className='text-[10px] font-extrabold text-textMuted uppercase tracking-wider mb-1'>
                          Requisitos
                        </div>
                        <p className='text-[12px] text-textMuted leading-relaxed m-0'>
                          {emp.requisitos.slice(0, 100)}
                          {emp.requisitos.length > 100 ? '...' : ''}
                        </p>
                      </div>
                    )}

                    <div className='mt-auto pt-3 flex items-center justify-between border-t border-border'>
                      <span className='text-[11px] text-textMuted'>
                        {emp.fecha_cierre
                          ? `Cierre: ${emp.fecha_cierre}`
                          : `Publicado: ${emp.fecha_publicacion}`}
                      </span>
                      <button
                        className='bg-gradient-to-br from-purple-700 to-purpleMid text-white text-[12px] font-extrabold px-4 py-[7px] rounded-btn border-0 cursor-pointer'
                        onClick={() => setEmpleoModal(emp)}
                      >
                        Postularme →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          GALERÍA (desde Supabase)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id='galeria' className='bg-white py-[60px]'>
        <div className='max-w-[1200px] mx-auto px-6'>
          <div className='mb-9'>
            <span className='text-[11px] font-extrabold text-purple-700 uppercase tracking-[0.12em]'>
              Imágenes
            </span>
            <h2 className='text-[30px] font-black mt-2 mb-0 text-text'>
              Galería
            </h2>
          </div>

          {galeria.length === 0 ? (
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className='h-[180px] rounded-xl bg-purpleLight flex items-center justify-center text-[28px]'
                >
                  🖼️
                </div>
              ))}
            </div>
          ) : (
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
              {galeria.map((img) => (
                <div
                  key={img.id_imagen}
                  className='group relative h-[180px] rounded-xl overflow-hidden cursor-pointer hover:-translate-y-1 transition-transform duration-200 shadow-[0_4px_20px_rgba(91,53,197,0.1)] '
                >
                  <img
                    src={img.url_imagen}
                    alt={img.titulo ?? ''}
                    className='w-full h-full object-cover'
                  />
                  <div
                    className='gal-overlay absolute flex items-center justify-center  text-white font-extrabold text-[13px] text-center p-3'
                    style={{ background: '#5B35C5CC' }}
                  >
                    {img.titulo ?? img.categoria ?? 'Ver imagen'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          INGRESANTES / INSCRIPCIÓN
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id='ingresantes' className='bg-bg py-[60px] px-6'>
        <div className='max-w-[1200px] mx-auto'>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center'>
            <div>
              <span className='text-[11px] font-extrabold text-purple-700 uppercase tracking-[0.12em]'>
                Inscripciones abiertas
              </span>
              <h2 className='text-3xl font-black mt-2 mb-4 text-text'>
                ¿Querés ser parte de nuestra comunidad?
              </h2>
              <p className='text-[15px] text-textMuted leading-[1.7] mt-0 mb-7'>
                Ofrecemos los niveles Inicial, Primario y Secundario. Completá
                el formulario y nos pondremos en contacto con vos a la brevedad
                para guiarte en el proceso.
              </p>
              <div className='flex flex-col gap-3'>
                {[
                  'Nivel Inicial (3, 4 y 5 años)',
                  'Nivel Primario (1º a 7º grado)',
                  'Nivel Secundario (1º a 5º año)',
                ].map((nivel) => (
                  <div key={nivel} className='flex items-center gap-[10px]'>
                    <div className='w-6 h-6 rounded-full bg-purpleLight text-purple-700 flex items-center justify-center text-xs font-black shrink-0'>
                      ✓
                    </div>
                    <span className='text-sm font-semibold'>{nivel}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Formulario de inscripción */}
            <div className='bg-white rounded-[20px] p-6 md:p-8 shadow-[0_4px_32px_rgba(91,53,197,0.1)] border border-border'>
              <h3 className='text-lg font-black mt-0 mb-5 text-text'>
                Solicitar inscripción
              </h3>
              <InscripcionForm />
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          CONTACTO
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id='contacto' className='bg-white py-[60px] px-6'>
        <div className='max-w-[1200px] mx-auto'>
          <div className='mb-9'>
            <span className='text-[11px] font-extrabold text-purple-700 uppercase tracking-[0.12em]'>
              Estamos para ayudarte
            </span>
            <h2 className='text-[30px] font-black mt-2 mb-0 text-text'>
              Contacto
            </h2>
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 lg:gap-10 items-start'>
            {/* Formulario de contacto */}
            <div className='bg-bg rounded-[20px] p-6 md:p-8 border border-border'>
              <h3 className='text-lg font-black mt-0 mb-[6px] text-text'>
                Escribinos
              </h3>
              <p className='text-[13px] text-textMuted mt-0 mb-5 leading-relaxed'>
                Dejanos tu consulta y el equipo de la institución te responderá
                a la brevedad.
              </p>
              <ContactoForm />
            </div>

            {/* Canales directos */}
            <div className='flex flex-col gap-[14px]'>
              <a
                href={`https://wa.me/${CONTACTO.whatsapp}`}
                target='_blank'
                rel='noreferrer'
                className='flex items-center gap-[14px] bg-[#25D36612] border border-[#25D36640] rounded-[14px] py-4 px-[18px] no-underline text-text'
              >
                <span className='text-[26px]'>💬</span>
                <div>
                  <div className='text-sm font-black'>WhatsApp</div>
                  <div className='text-xs text-textMuted'>
                    {CONTACTO.whatsappLabel}
                  </div>
                </div>
              </a>
              <a
                href={`mailto:${CONTACTO.email}`}
                className='flex items-center gap-[14px] bg-purpleLight border border-border rounded-[14px] py-4 px-[18px] no-underline text-text'
              >
                <span className='text-[26px]'>✉️</span>
                <div>
                  <div className='text-sm font-black'>Correo electrónico</div>
                  <div className='text-xs text-textMuted'>{CONTACTO.email}</div>
                </div>
              </a>
              <div className='flex gap-[14px]'>
                <a
                  href={CONTACTO.instagram}
                  target='_blank'
                  rel='noreferrer'
                  className='flex-1 flex items-center gap-[10px] bg-[#E91E8C12] border border-[#E91E8C40] rounded-[14px] py-[14px] px-4 no-underline text-text'
                >
                  <span className='text-[22px]'>📸</span>
                  <span className='text-[13px] font-extrabold'>Instagram</span>
                </a>
                <a
                  href={CONTACTO.facebook}
                  target='_blank'
                  rel='noreferrer'
                  className='flex-1 flex items-center gap-[10px] bg-[#2980B912] border border-[#2980B940] rounded-[14px] py-[14px] px-4 no-underline text-text'
                >
                  <span className='text-[22px]'>📘</span>
                  <span className='text-[13px] font-extrabold'>Facebook</span>
                </a>
              </div>
              <div className='flex items-center gap-[14px] py-4 px-[18px] text-textMuted text-[13px]'>
                <span className='text-[22px]'>📍</span>
                {CONTACTO.direccion}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          FOOTER
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <footer className='bg-text text-white pt-12 px-6 pb-7'>
        <div className='max-w-[1200px] mx-auto'>
          <div className='grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr] gap-8 md:gap-10 mb-10'>
            {/* Info */}
            <div className='col-span-2 md:col-span-1'>
              <div className='flex items-center gap-[10px] mb-4'>
                <img
                  src='/logo.png'
                  alt='Logo'
                  className='w-auto h-11'
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
                <div>
                  <div className='text-xs font-black tracking-[0.04em]'>
                    Educar Para Transformar
                  </div>
                  <div className='text-[10px] opacity-60 tracking-[0.08em]'>
                    CENTRO EDUCATIVO
                  </div>
                </div>
              </div>
              <p className='text-[13px] opacity-70 leading-[1.7] m-0'>
                Formando líderes del mañana con valores, conocimiento y
                compromiso social.
              </p>
            </div>

            {/* Navegación */}
            <div>
              <div className='text-xs font-extrabold opacity-50 uppercase tracking-wider mb-4'>
                Navegación
              </div>
              {['Nosotros', 'Ingresantes', 'Novedades', 'Galerías'].map(
                (item) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    className='block text-[13px] opacity-70 no-underline text-white mb-[10px] font-semibold'
                  >
                    {item}
                  </a>
                ),
              )}
            </div>

            {/* Contacto */}
            <div>
              <div className='text-xs font-extrabold opacity-50 uppercase tracking-wider mb-4'>
                Datos de contacto
              </div>
              {[
                {
                  icon: '📞',
                  text: CONTACTO.whatsappLabel,
                  href: `https://wa.me/${CONTACTO.whatsapp}`,
                },
                {
                  icon: '✉️',
                  text: CONTACTO.email,
                  href: `mailto:${CONTACTO.email}`,
                },
                { icon: '📍', text: CONTACTO.direccion, href: undefined },
              ].map((item) => (
                <a
                  key={item.text}
                  href={item.href}
                  target={item.href?.startsWith('http') ? '_blank' : undefined}
                  rel='noreferrer'
                  className={[
                    'flex gap-2 items-start mb-3 no-underline text-white',
                    item.href ? 'cursor-pointer' : 'cursor-default',
                  ].join(' ')}
                >
                  <span className='text-sm'>{item.icon}</span>
                  <span className='text-xs opacity-70 leading-[1.5]'>
                    {item.text}
                  </span>
                </a>
              ))}
            </div>

            {/* Redes */}
            <div>
              <div className='text-xs font-extrabold opacity-50 uppercase tracking-wider mb-4'>
                Redes sociales
              </div>
              {[
                {
                  icon: '📸',
                  label: 'Instagram',
                  handle: CONTACTO.instagramHandle,
                  href: CONTACTO.instagram,
                },
                {
                  icon: '📘',
                  label: 'Facebook',
                  handle: CONTACTO.facebookHandle,
                  href: CONTACTO.facebook,
                },
              ].map((red) => (
                <a
                  key={red.label}
                  href={red.href}
                  target='_blank'
                  rel='noreferrer'
                  className='flex gap-[10px] items-center mb-[14px] cursor-pointer no-underline text-white'
                >
                  <div className='w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-base'>
                    {red.icon}
                  </div>
                  <div>
                    <div className='text-xs font-bold'>{red.label}</div>
                    <div className='text-[11px] opacity-60'>{red.handle}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div className='border-t border-white/10 pt-5 flex flex-col sm:flex-row gap-4 justify-between items-center text-center sm:text-left'>
            <span className='text-xs opacity-50'>
              © {new Date().getFullYear()} Educar Para Transformar. Todos los
              derechos reservados.
            </span>
            <button
              onClick={() => navigate('/login')}
              className='bg-purple-700 text-white border-0 rounded-lg py-2 px-[18px] text-xs font-extrabold cursor-pointer'
            >
              Acceder al Campus Virtual →
            </button>
          </div>
        </div>
      </footer>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          MODAL POSTULACIÓN
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {empleoModal && (
        <PostulacionModal
          empleo={empleoModal}
          onClose={() => setEmpleoModal(null)}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  FORMULARIO DE INSCRIPCIÓN
// ═══════════════════════════════════════════════════════════════
function InscripcionForm() {
  const [form, setForm] = useState({
    nombre_aspirante: '',
    apellido_aspirante: '',
    fecha_nacimiento_aspirante: '',
    dni_aspirante: '',
    nombre_tutor: '',
    email_tutor: '',
    telefono_tutor: '',
    nivel_solicitado: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  // Errores por campo y campos que el usuario ya tocó (para no mostrar errores antes de tiempo)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Validación de UX en cliente (la integridad real va con CHECK/NOT NULL en la DB)
  // Solo letras (con acentos/ñ/ü), espacios, guiones y apóstrofos; mínimo 2 caracteres.
  const SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü][A-Za-zÁÉÍÓÚáéíóúÑñÜü\s'-]*$/
  // Email simple: algo@algo.dominio
  const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/
  // Teléfono: dígitos, espacios, + - ( ); debe contener al menos 7 dígitos
  const TEL_FORMATO = /^[\d\s()+-]+$/

  // Valida un único campo y devuelve el mensaje de error (o null si está OK).
  const validarCampo = (name: string, valor: string): string | null => {
    const v = valor.trim()
    switch (name) {
      case 'nombre_aspirante':
        if (v.length < 2)
          return 'El nombre del aspirante debe tener al menos 2 caracteres.'
        if (!SOLO_LETRAS.test(v))
          return 'El nombre del aspirante solo puede contener letras.'
        return null
      case 'apellido_aspirante':
        if (v.length < 2)
          return 'El apellido del aspirante debe tener al menos 2 caracteres.'
        if (!SOLO_LETRAS.test(v))
          return 'El apellido del aspirante solo puede contener letras.'
        return null
      case 'dni_aspirante':
        if (!/^\d{7,9}$/.test(v))
          return 'El DNI debe tener entre 7 y 9 dígitos numéricos (sin puntos).'
        return null
      case 'fecha_nacimiento_aspirante': {
        if (!valor) return 'Ingresá la fecha de nacimiento del aspirante.'
        const fnac = new Date(valor)
        if (isNaN(fnac.getTime()) || fnac > new Date())
          return 'La fecha de nacimiento no es válida.'
        return null
      }
      case 'nombre_tutor':
        if (v.length < 2)
          return 'El nombre del tutor debe tener al menos 2 caracteres.'
        if (!SOLO_LETRAS.test(v))
          return 'El nombre del tutor solo puede contener letras.'
        return null
      case 'email_tutor':
        if (!EMAIL.test(v))
          return 'Ingresá un email de contacto válido (ej: nombre@dominio.com).'
        return null
      case 'telefono_tutor':
        // Opcional, pero si se completa debe tener formato válido
        if (v) {
          if (!TEL_FORMATO.test(v))
            return 'El teléfono solo puede tener números, espacios y los signos + - ( ).'
          const digitos = v.replace(/\D/g, '')
          if (digitos.length < 7 || digitos.length > 15)
            return 'El teléfono debe tener entre 7 y 15 dígitos.'
        }
        return null
      case 'nivel_solicitado':
        if (!valor) return 'Elegí el nivel solicitado.'
        return null
      default:
        return null
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    // Si el campo ya fue tocado, revalidamos mientras escribe para limpiar/actualizar el error
    if (touched[name]) {
      setErrores((prev) => ({ ...prev, [name]: validarCampo(name, value) ?? '' }))
    }
  }

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrores((prev) => ({ ...prev, [name]: validarCampo(name, value) ?? '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Validamos todos los campos y marcamos todo como tocado
    const nuevosErrores: Record<string, string> = {}
    ;(Object.keys(form) as Array<keyof typeof form>).forEach((k) => {
      const msg = validarCampo(k, form[k])
      if (msg) nuevosErrores[k] = msg
    })
    setErrores(nuevosErrores)
    setTouched(
      Object.keys(form).reduce(
        (acc, k) => ({ ...acc, [k]: true }),
        {} as Record<string, boolean>,
      ),
    )
    if (Object.keys(nuevosErrores).length > 0) {
      setError('Revisá los campos marcados antes de enviar.')
      return
    }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.from('inscripciones').insert([form])
    if (err) {
      setError('Hubo un error al enviar. Intentá de nuevo.')
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  const inputBaseCls =
    'w-full py-[11px] px-[14px] rounded-input border-2 text-[13px] outline-none text-text box-border'

  // Aplica borde rojo cuando el campo tiene error
  const campoCls = (name: string) =>
    `${inputBaseCls} ${errores[name] ? 'border-red' : 'border-border'}`

  // Mensaje de error debajo de un campo
  const ErrorCampo = ({ name }: { name: string }) =>
    errores[name] ? (
      <p className='text-[11px] text-red font-bold mt-[5px]'>{errores[name]}</p>
    ) : null

  const labelCls = 'text-[11px] font-extrabold text-textMuted block mb-[5px]'

  if (success) {
    return (
      <div className='text-center py-5'>
        <div className='text-[44px] mb-3'>✅</div>
        <div className='text-base font-black text-purple-700 mb-2'>
          ¡Solicitud enviada!
        </div>
        <p className='text-[13px] text-textMuted'>
          Nos pondremos en contacto con vos a la brevedad.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-3'>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <div>
          <label className={labelCls}>Nombre del aspirante</label>
          <input
            name='nombre_aspirante'
            required
            value={form.nombre_aspirante}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder='Juan'
            className={campoCls('nombre_aspirante')}
          />
          <ErrorCampo name='nombre_aspirante' />
        </div>
        <div>
          <label className={labelCls}>Apellido del aspirante</label>
          <input
            name='apellido_aspirante'
            required
            value={form.apellido_aspirante}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder='Pérez'
            className={campoCls('apellido_aspirante')}
          />
          <ErrorCampo name='apellido_aspirante' />
        </div>
      </div>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <div>
          <label className={labelCls}>DNI del aspirante</label>
          <input
            name='dni_aspirante'
            required
            value={form.dni_aspirante}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder='12345678'
            className={campoCls('dni_aspirante')}
          />
          <ErrorCampo name='dni_aspirante' />
        </div>
        <div>
          <label className={labelCls}>Fecha de nacimiento</label>
          <input
            type='date'
            name='fecha_nacimiento_aspirante'
            required
            value={form.fecha_nacimiento_aspirante}
            onChange={handleChange}
            onBlur={handleBlur}
            className={campoCls('fecha_nacimiento_aspirante')}
          />
          <ErrorCampo name='fecha_nacimiento_aspirante' />
        </div>
      </div>
      <div>
        <label className={labelCls}>Nombre del tutor / padre</label>
        <input
          name='nombre_tutor'
          required
          value={form.nombre_tutor}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder='María García'
          className={campoCls('nombre_tutor')}
        />
        <ErrorCampo name='nombre_tutor' />
      </div>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <div>
          <label className={labelCls}>Email de contacto</label>
          <input
            type='email'
            name='email_tutor'
            required
            value={form.email_tutor}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder='mail@gmail.com'
            className={campoCls('email_tutor')}
          />
          <ErrorCampo name='email_tutor' />
        </div>
        <div>
          <label className={labelCls}>Teléfono</label>
          <input
            name='telefono_tutor'
            value={form.telefono_tutor}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder='+54 9 362...'
            className={campoCls('telefono_tutor')}
          />
          <ErrorCampo name='telefono_tutor' />
        </div>
      </div>
      <div>
        <label className={labelCls}>Nivel solicitado</label>
        <select
          name='nivel_solicitado'
          required
          value={form.nivel_solicitado}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`${campoCls('nivel_solicitado')} appearance-none`}
        >
          <option value=''>Seleccioná un nivel...</option>
          <option value='Inicial'>Inicial</option>
          <option value='Primario'>Primario</option>
          <option value='Secundario'>Secundario</option>
        </select>
        <ErrorCampo name='nivel_solicitado' />
      </div>

      {error && (
        <div className='bg-[#E74C3C12] border border-[#E74C3C40] rounded-lg py-[10px] px-[14px] text-xs text-red font-bold'>
          ⚠️ {error}
        </div>
      )}

      <button
        type='submit'
        disabled={loading}
        className={[
          'border-0 rounded-btn p-[13px] text-sm font-extrabold mt-1',
          loading
            ? 'bg-border cursor-not-allowed text-textMuted'
            : 'bg-gradient-to-br from-purple-700 to-purpleMid cursor-pointer text-white',
        ].join(' ')}
      >
        {loading ? 'Enviando...' : 'Enviar solicitud'}
      </button>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════════
//  FORMULARIO DE CONTACTO
// ═══════════════════════════════════════════════════════════════
function ContactoForm() {
  const [form, setForm] = useState({ nombre: '', email: '', mensaje: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase
      .from('mensajes_contacto')
      .insert([form])
    if (err) {
      setError('Hubo un error al enviar. Intentá de nuevo.')
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  const inputCls =
    'w-full py-[11px] px-[14px] rounded-input border-2 border-border text-[13px] outline-none text-text box-border'

  const labelCls = 'text-[11px] font-extrabold text-textMuted block mb-[5px]'

  if (success) {
    return (
      <div className='text-center py-5'>
        <div className='text-[44px] mb-3'>✅</div>
        <div className='text-base font-black text-purple-700 mb-2'>
          ¡Mensaje enviado!
        </div>
        <p className='text-[13px] text-textMuted'>
          Recibimos tu consulta. Te responderemos a la brevedad.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-3'>
      <div>
        <label className={labelCls}>Nombre</label>
        <input
          name='nombre'
          required
          value={form.nombre}
          onChange={handleChange}
          placeholder='Tu nombre'
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Correo electrónico</label>
        <input
          type='email'
          name='email'
          required
          value={form.email}
          onChange={handleChange}
          placeholder='mail@gmail.com'
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Mensaje</label>
        <textarea
          name='mensaje'
          required
          value={form.mensaje}
          onChange={handleChange}
          placeholder='Escribí tu consulta...'
          rows={4}
          className={`${inputCls} resize-y`}
        />
      </div>

      {error && (
        <div className='bg-[#E74C3C12] border border-[#E74C3C40] rounded-lg py-[10px] px-[14px] text-xs text-red font-bold'>
          ⚠️ {error}
        </div>
      )}

      <button
        type='submit'
        disabled={loading}
        className={[
          'border-0 rounded-btn p-[13px] text-sm font-extrabold mt-1',
          loading
            ? 'bg-border cursor-not-allowed text-textMuted'
            : 'bg-gradient-to-br from-purple-700 to-purpleMid cursor-pointer text-white',
        ].join(' ')}
      >
        {loading ? 'Enviando...' : 'Enviar mensaje'}
      </button>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════════
//  MODAL DE POSTULACIÓN A EMPLEO
// ═══════════════════════════════════════════════════════════════
function PostulacionModal({
  empleo,
  onClose,
}: {
  empleo: Empleo
  onClose: () => void
}) {
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    mensaje: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.from('postulaciones').insert([
      {
        id_empleo: empleo.id_empleo,
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email,
        telefono: form.telefono || null,
        mensaje: form.mensaje || null,
      },
    ])
    if (err) {
      setError('Hubo un error al enviar. Intentá de nuevo.')
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  const inputCls =
    'w-full px-[14px] py-[11px] rounded-[10px] border-2 border-border text-[13px] text-text outline-none box-border'
  const labelCls = 'text-[11px] font-extrabold text-textMuted block mb-[5px]'

  return (
    <div
      className='fixed inset-0 z-[500] flex items-center justify-center px-4'
      style={{ background: 'rgba(26,26,46,0.55)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className='bg-white rounded-[20px] w-full max-w-[520px] max-h-[90vh] overflow-y-auto shadow-[0_8px_40px_rgba(91,53,197,0.18)]'>
        <div className='bg-gradient-to-br from-purple-700 to-purpleMid px-5 md:px-7 py-6 flex items-start justify-between gap-4'>
          <div>
            <div className='text-white/70 text-[11px] font-extrabold uppercase tracking-wider mb-1'>
              Postulación
            </div>
            <h3 className='text-white font-black text-[18px] leading-snug m-0'>
              {empleo.titulo}
            </h3>
            {empleo.area && (
              <div className='text-white/75 text-[12px] mt-1'>
                📍 {empleo.area}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className='text-white/70 hover:text-white border-0 bg-transparent cursor-pointer text-[24px] leading-none shrink-0'
            aria-label='Cerrar'
          >
            ×
          </button>
        </div>

        <div className='px-5 md:px-7 py-6'>
          {success ? (
            <div className='text-center py-6'>
              <div className='text-[44px] mb-3'>✅</div>
              <div className='text-[17px] font-black text-purple-700 mb-2'>
                ¡Postulación enviada!
              </div>
              <p className='text-[13px] text-textMuted m-0'>
                Recibimos tus datos. Nos pondremos en contacto a la brevedad.
              </p>
              <button
                onClick={onClose}
                className='mt-6 bg-gradient-to-br from-purple-700 to-purpleMid text-white border-0 rounded-[10px] px-6 py-3 text-[13px] font-extrabold cursor-pointer'
              >
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                <div>
                  <label className={labelCls}>Nombre *</label>
                  <input
                    className={inputCls}
                    required
                    placeholder='Juan'
                    value={form.nombre}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, nombre: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Apellido *</label>
                  <input
                    className={inputCls}
                    required
                    placeholder='Pérez'
                    value={form.apellido}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, apellido: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                <div>
                  <label className={labelCls}>Email *</label>
                  <input
                    type='email'
                    className={inputCls}
                    required
                    placeholder='mail@gmail.com'
                    value={form.email}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, email: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Teléfono (opcional)</label>
                  <input
                    className={inputCls}
                    placeholder='+54 9 362...'
                    value={form.telefono}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, telefono: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  Mensaje / carta de presentación (opcional)
                </label>
                <textarea
                  className={`${inputCls} min-h-[90px] resize-y`}
                  placeholder='Contanos por qué te interesa el puesto...'
                  value={form.mensaje}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, mensaje: e.target.value }))
                  }
                />
              </div>

              {error && (
                <div className='text-[12px] font-bold text-red bg-[#E74C3C12] border border-[#E74C3C40] rounded-lg px-4 py-3'>
                  ⚠️ {error}
                </div>
              )}

              <button
                type='submit'
                disabled={loading}
                className={`border-0 rounded-[10px] py-[13px] text-[14px] font-extrabold cursor-pointer mt-1 ${
                  loading
                    ? 'bg-border text-textMuted cursor-not-allowed'
                    : 'bg-gradient-to-br from-purple-700 to-purpleMid text-white'
                }`}
              >
                {loading ? 'Enviando...' : 'Enviar postulación'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

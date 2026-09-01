/**
 * NoticiaDetalle.tsx
 * Vista pública de detalle de una noticia (ruta /noticias/:id).
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
)

const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

function formatFecha(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&q=80'

interface Noticia {
  id_noticia: number
  titulo: string
  resumen: string | null
  contenido: string
  url_imagen: string | null
  fecha_publicacion: string | null
  destacada: boolean
}

export default function NoticiaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [noticia, setNoticia] = useState<Noticia | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) {
      setNotFound(true)
      setLoading(false)
      return
    }
    supabase
      .from('noticias')
      .select(
        'id_noticia, titulo, resumen, contenido, url_imagen, fecha_publicacion, destacada',
      )
      .eq('id_noticia', Number(id))
      .eq('activo', true)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true)
        else setNoticia(data as Noticia)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return (
      <div className='min-h-screen bg-bg flex items-center justify-center'>
        <p className='text-purple-700 font-extrabold text-[15px]'>Cargando...</p>
      </div>
    )
  }

  if (notFound || !noticia) {
    return (
      <div className='min-h-screen bg-bg flex flex-col items-center justify-center gap-4 px-4'>
        <p className='text-text font-extrabold text-[18px]'>
          No encontramos esta noticia.
        </p>
        <Link
          to='/'
          className='text-purple-700 text-[13px] font-bold no-underline hover:underline'
        >
          ← Volver al inicio
        </Link>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-bg'>
      <div className='max-w-[760px] mx-auto px-4 py-10'>
        <button
          onClick={() => navigate(-1)}
          className='flex items-center gap-2 text-textMuted text-[13px] font-bold bg-transparent border-0 cursor-pointer hover:text-purple-700 transition-colors mb-6 p-0'
        >
          ← Volver
        </button>

        {noticia.destacada && (
          <div className='inline-block bg-purple-700 text-white text-[10px] font-extrabold py-1 px-3 tracking-[0.08em] uppercase rounded-[20px] mb-4'>
            ⭐ Destacado
          </div>
        )}

        <h1 className='text-[30px] font-black text-text leading-tight mt-0 mb-3'>
          {noticia.titulo}
        </h1>

        <div className='text-[12px] text-textMuted font-bold mb-6'>
          {formatFecha(noticia.fecha_publicacion)}
        </div>

        <img
          src={noticia.url_imagen ?? PLACEHOLDER}
          alt={noticia.titulo}
          className='w-full max-h-[420px] object-cover rounded-card block mb-7'
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = PLACEHOLDER
          }}
        />

        {noticia.resumen && (
          <p className='text-[16px] text-text font-semibold leading-relaxed mt-0 mb-5'>
            {noticia.resumen}
          </p>
        )}

        <div className='text-[15px] text-text leading-relaxed whitespace-pre-line'>
          {noticia.contenido}
        </div>
      </div>
    </div>
  )
}

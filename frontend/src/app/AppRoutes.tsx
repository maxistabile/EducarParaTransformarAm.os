// ═══════════════════════════════════════════════════════════════
//  PWA — rutas bajo /app/
// ═══════════════════════════════════════════════════════════════
// Se carga con lazy() desde App.tsx: el código de la app no entra en el
// bundle de la web.
import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AppLayout from './AppLayout'
import Inicio from './pantallas/Inicio'
import Proximamente from './pantallas/Proximamente'

// Etiquetas del <head> que solo existen mientras se está en la app, para
// que el navegador no ofrezca instalarla desde la web (ver vite.config.ts).
// crossorigin="use-credentials": el navegador pide el manifiesto sin
// cookies; con este atributo las envía, y así carga también en los
// previews de Vercel protegidos con Vercel Authentication.
const CABECERA_APP: Array<{ tag: 'link' | 'meta'; attrs: Record<string, string> }> = [
  {
    tag: 'link',
    attrs: {
      rel: 'manifest',
      href: '/manifest.webmanifest',
      crossorigin: 'use-credentials',
    },
  },
  { tag: 'meta', attrs: { name: 'theme-color', content: '#5B35C5' } },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' } },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: 'Educar App' } },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'default' } },
]

function agregarCabeceraApp() {
  const elementos = CABECERA_APP.map(({ tag, attrs }) => {
    const el = document.createElement(tag)
    Object.entries(attrs).forEach(([k, v]) => {
      el.setAttribute(k, v);
    });
    document.head.appendChild(el)
    return el
  })
  return () => {
    elementos.forEach((el) => {
      el.remove();
    });
  };
}

export default function AppRoutes() {
  const { pathname } = useLocation()

  useEffect(() => agregarCabeceraApp(), [])

  // El service worker y el manifiesto usan el scope /app/ (con barra)
  if (pathname === '/app') return <Navigate to='/app/' replace />

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Inicio />} />
        <Route path='cuotas' element={<Proximamente titulo='Cuotas' />} />
        <Route path='pagos' element={<Proximamente titulo='Pagos' />} />
        <Route path='perfil' element={<Proximamente titulo='Perfil' />} />
        <Route path='*' element={<Navigate to='/app/' replace />} />
      </Route>
    </Routes>
  )
}

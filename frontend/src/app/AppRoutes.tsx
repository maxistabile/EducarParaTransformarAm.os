// ═══════════════════════════════════════════════════════════════
//  PWA — rutas bajo /app/
// ═══════════════════════════════════════════════════════════════
// Se carga con lazy() desde App.tsx: el código de la app no entra en el
// bundle de la web.
import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AppLayout from './AppLayout'
import AvisoActualizacion from './AvisoActualizacion'
import Ingresar from './pantallas/Ingresar'
import Inicio from './pantallas/Inicio'
import NuevaContrasena from './pantallas/NuevaContrasena'
import Perfil from './pantallas/Perfil'
import Proximamente from './pantallas/Proximamente'
import Recuperar from './pantallas/Recuperar'
import ProveedorSesion from './sesion/ProveedorSesion'
import { RutaProtegida, RutaSeccion } from './sesion/RutasProtegidas'

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

  // Cuotas, pagos e inscripciones siguen como "Próximamente": no se
  // consultan esos datos hasta tener sus permisos (RLS) y sus historias.
  return (
    <ProveedorSesion>
      <Routes>
        <Route path='ingresar' element={<Ingresar />} />
        <Route path='recuperar' element={<Recuperar />} />
        <Route path='nueva-contrasena' element={<NuevaContrasena />} />
        <Route element={<RutaProtegida />}>
          <Route element={<AppLayout />}>
            <Route index element={<Inicio />} />
            <Route
              path='cuotas'
              element={
                <RutaSeccion seccion='cuotas'>
                  <Proximamente titulo='Cuotas' />
                </RutaSeccion>
              }
            />
            <Route
              path='pagos'
              element={
                <RutaSeccion seccion='pagos'>
                  <Proximamente titulo='Pagos' />
                </RutaSeccion>
              }
            />
            <Route
              path='inscripciones'
              element={
                <RutaSeccion seccion='inscripciones'>
                  <Proximamente titulo='Inscripciones' />
                </RutaSeccion>
              }
            />
            <Route path='perfil' element={<Perfil />} />
            <Route path='*' element={<Navigate to='/app/' replace />} />
          </Route>
        </Route>
      </Routes>
      <AvisoActualizacion />
    </ProveedorSesion>
  )
}

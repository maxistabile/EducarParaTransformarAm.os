// ═══════════════════════════════════════════════════════════════
//  NAVEGACIÓN ENTRE LA WEB Y LA PWA
// ═══════════════════════════════════════════════════════════════
// Regla: para cruzar entre la web de gestión (/, /login, /admin, /portal…)
// y la app (/app/…) se usa SIEMPRE navegación completa, nunca navigate()
// ni <Link> de React Router. Así cada lado carga su propio documento: la
// web queda fuera del service worker (scope /app/) y sin el manifiesto de
// la app, y la app queda controlada por su service worker.
// Dentro de cada lado se sigue usando React Router normalmente.

/** Sale de la app hacia una página de la web (por ejemplo, '/admin'). */
export function irALaWeb(ruta = '/') {
  window.location.assign(ruta)
}

/** Entra a la app desde la web (por ejemplo, '/app/'). */
export function irALaApp(ruta = '/app/') {
  window.location.assign(ruta)
}

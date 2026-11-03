// Registro del service worker de la PWA y aviso de versión nueva.
// Con registerType 'prompt' (vite.config.ts) la versión nueva queda en
// espera hasta que el usuario toca "Actualizar": la app nunca se recarga
// sola mientras el padre completa un formulario o carga un comprobante.
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function AvisoActualizacion() {
  const {
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW()

  if (!hayVersionNueva) return null

  return (
    <div
      role='status'
      className='fixed inset-x-0 z-50 mx-auto w-[calc(100%-2rem)] max-w-md rounded-card bg-text text-white shadow-card-hover px-4 py-3 flex items-center gap-3'
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
    >
      <p className='flex-1 text-sm font-semibold'>
        Hay una actualización disponible
      </p>
      <button
        type='button'
        onClick={() => setHayVersionNueva(false)}
        className='text-sm font-semibold text-white/70'
      >
        Más tarde
      </button>
      <button
        type='button'
        onClick={() => updateServiceWorker(true)}
        className='rounded-btn bg-purple-700 px-3 py-1.5 text-sm font-bold'
      >
        Actualizar
      </button>
    </div>
  )
}

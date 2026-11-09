// Botón que abre un documento privado (HU54 a HU56). Lo usan la app (Cuotas
// y Pagos) y la web (Comprobantes). La URL firmada dura 60 segundos y se
// pide recién al tocar el botón; la validación está en abrirDocumento.ts.
import { useState } from 'react'
import { resumenError } from '../app/reglasContrasena'
import { MENSAJE_DOCUMENTO, abrirDocumento } from './abrirDocumento'
import type { ObtenerDocumento } from './abrirDocumento'

/**
 * Abre un documento privado (archivo de transferencia o comprobante de
 * pago). La pestaña se abre antes de esperar, para que el navegador no la
 * bloquee; si la bloquea, el documento se abre en esta misma ventana.
 */
export default function BotonDocumento({
  texto,
  obtener,
}: {
  texto: string
  obtener: ObtenerDocumento
}) {
  const [estado, setEstado] = useState<{ cargando: boolean; error: string }>({
    cargando: false,
    error: '',
  })
  return (
    <span className='inline-flex flex-col'>
      <button
        type='button'
        disabled={estado.cargando}
        onClick={() => {
          const pestana = window.open('', '_blank')
          setEstado({ cargando: true, error: '' })
          abrirDocumento(obtener, {
            pestana,
            navegarAqui: (url) => {
              window.location.assign(url)
            },
            urlSupabase: import.meta.env.VITE_SUPABASE_URL as string,
          })
            .then((error) => {
              setEstado({ cargando: false, error: error ?? '' })
            })
            .catch((causa: unknown) => {
              // Falla al navegar (no al pedir la URL, que ya se maneja)
              console.error('[BotonDocumento]', resumenError(causa))
              pestana?.close()
              setEstado({ cargando: false, error: MENSAJE_DOCUMENTO })
            })
        }}
        className='text-left text-sm font-extrabold text-purple-700 underline disabled:opacity-60'
      >
        {estado.cargando ? 'Abriendo...' : texto}
      </button>
      {estado.error && (
        <span role='alert' className='text-xs font-bold text-red'>
          {estado.error}
        </span>
      )}
    </span>
  )
}

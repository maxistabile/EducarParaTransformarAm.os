// Botón que abre un documento privado (HU54 a HU56). Lo usan la app (Cuotas
// y Pagos) y la web (Comprobantes). La URL firmada dura 60 segundos y se
// pide recién al tocar el botón.
import { useState } from 'react'

/**
 * Abre un documento privado (archivo de transferencia o comprobante de
 * pago) con una URL firmada que se pide recién al tocar el botón. La
 * pestaña se abre antes de esperar, para que el navegador no la bloquee.
 */
export default function BotonDocumento({
  texto,
  obtener,
}: {
  texto: string
  obtener: () => Promise<{ ok: true; url: string } | { ok: false; mensaje: string }>
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
          const ventana = window.open('', '_blank')
          setEstado({ cargando: true, error: '' })
          void obtener().then((r) => {
            if (r.ok) {
              if (ventana) ventana.location.href = r.url
              else window.location.assign(r.url)
              setEstado({ cargando: false, error: '' })
            } else {
              ventana?.close()
              setEstado({ cargando: false, error: r.mensaje })
            }
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

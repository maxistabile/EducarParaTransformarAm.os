// Campo de contraseña de los formularios de HU43 y HU44.
export default function CampoContrasena({
  etiqueta,
  valor,
  alCambiar,
  autoComplete,
}: {
  etiqueta: string
  valor: string
  alCambiar: (valor: string) => void
  autoComplete: 'current-password' | 'new-password'
}) {
  return (
    <label className='flex flex-col gap-1 text-sm font-bold'>
      {etiqueta}
      <input
        type='password'
        required
        autoComplete={autoComplete}
        value={valor}
        onChange={(e) => {
          alCambiar(e.target.value)
        }}
        className='w-full rounded-input border bg-white px-3 py-3 text-[15px] outline-none focus:border-purple-700'
      />
    </label>
  )
}

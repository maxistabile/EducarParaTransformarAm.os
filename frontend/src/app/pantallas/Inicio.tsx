// Pantalla de inicio provisoria de la app. El inicio de sesión y el menú
// por rol llegan con HU41–HU45.
export default function Inicio() {
  return (
    <section className='rounded-card bg-white p-5 shadow-card'>
      <h2 className='text-xl font-extrabold text-purple-700'>¡Hola!</h2>
      <p className='mt-2 text-sm text-textMuted'>
        Desde esta app vas a poder consultar las cuotas, cargar los
        comprobantes de pago y ver las inscripciones de tus hijos.
      </p>
      <p className='mt-4 rounded-input bg-purpleLight px-3 py-2 text-sm font-semibold text-purpleDark'>
        La app está en construcción.
      </p>
    </section>
  )
}

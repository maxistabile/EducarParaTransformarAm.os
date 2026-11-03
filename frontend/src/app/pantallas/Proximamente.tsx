// Lugar reservado para las secciones de la app que todavía no existen
// (Cuotas: HU51–HU53 · Pagos: HU54 · Inscripciones: HU59).
export default function Proximamente({ titulo }: { titulo: string }) {
  return (
    <section className='rounded-card bg-white p-5 shadow-card text-center'>
      <h2 className='text-xl font-extrabold text-purple-700'>{titulo}</h2>
      <p className='mt-2 text-sm text-textMuted'>Próximamente.</p>
    </section>
  )
}

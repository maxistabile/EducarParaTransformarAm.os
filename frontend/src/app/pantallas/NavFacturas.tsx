// Pestañas internas de la sección Facturas: facturas por período (HU57) y
// deuda por ítem (HU58).
import { NavLink } from 'react-router-dom'

const PESTANIAS = [
  { ruta: '/app/facturas', texto: 'Por período' },
  { ruta: '/app/facturas/deuda', texto: 'Deuda por ítem' },
]

export default function NavFacturas() {
  return (
    <nav aria-label='Facturas y deuda' className='mb-4 grid grid-cols-2 gap-1 rounded-btn bg-white p-1 shadow-card'>
      {PESTANIAS.map((p) => (
        <NavLink
          key={p.ruta}
          to={p.ruta}
          end
          className={({ isActive }) =>
            `rounded-btn py-2 text-center text-sm font-extrabold ${
              isActive ? 'bg-purple-700 text-white' : 'text-purple-700'
            }`
          }
        >
          {p.texto}
        </NavLink>
      ))}
    </nav>
  )
}

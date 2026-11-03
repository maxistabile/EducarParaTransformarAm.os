// ═══════════════════════════════════════════════════════════════
//  CLIENTE DE SUPABASE — patrón Singleton (plan de trabajo, patrones)
// ═══════════════════════════════════════════════════════════════
// Única instancia del cliente para toda la aplicación (web de gestión
// y PWA). Un módulo ES se evalúa una sola vez, así que todas las
// pantallas que importan `supabase` reciben el mismo objeto: una sola
// sesión, un solo listener de auth y una sola conexión de Realtime.
// Ninguna pantalla debe llamar a `createClient` por su cuenta.
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
)

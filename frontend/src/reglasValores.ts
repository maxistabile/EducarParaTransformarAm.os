// ═══════════════════════════════════════════════════════════════
//  TP METODOLOGÍA II · Parte 3 · RF11.1 a RF11.4 (HU46 a HU49)
//  Valores de cuota, deportes, transporte y comedor, con vigencia.
//  Lógica pura (sin Supabase) para poder probarla con Vitest.
// ═══════════════════════════════════════════════════════════════

export type Concepto = 'Cuota' | 'Deporte' | 'Recorrido' | 'Comedor'

/** Qué se cobra: Deporte y Recorrido llevan su id; Cuota y Comedor, no. */
export interface ClaveValor {
  concepto: Concepto
  idReferencia: number | null
}

/** Fila de `valores_servicio` (etapa16). */
export interface ValorServicio {
  id_valor: number
  concepto: Concepto
  id_actividad: number | null
  id_recorrido: number | null
  monto: number
  vigente_desde: string // 'AAAA-MM-DD'
}

/** Máximo de numeric(12,2): 10 dígitos enteros. */
const MONTO_MAXIMO = 9_999_999_999.99

/** Solo el rol Admin carga valores (HU47 a HU49). */
export function puedeGestionarValores(rol: string | null | undefined): boolean {
  return rol === 'Admin'
}

/**
 * Valida lo que escribe el administrador. Acepta coma o punto decimal.
 * Devuelve el monto como número, o el mensaje de error.
 */
export function validarValor(datos: {
  monto: string
  vigenteDesde: string
}): { ok: true; monto: number } | { ok: false; mensaje: string } {
  const texto = datos.monto.trim().replace(',', '.')
  // Parte entera y hasta 2 decimales, sin una expresión con cuantificadores
  // anidados: se separa por el punto y cada parte se valida por su cuenta.
  const partes = texto.split('.')
  const soloDigitos = (parte: string) => /^\d+$/.test(parte)
  const formatoValido =
    partes.length <= 2 &&
    soloDigitos(partes[0]) &&
    (partes.length === 1 || (soloDigitos(partes[1]) && partes[1].length <= 2))
  if (!formatoValido)
    return {
      ok: false,
      mensaje: 'Ingresá un importe válido, con hasta 2 decimales (ej.: 15000 o 15000,50).',
    }
  const monto = Number(texto)
  if (monto <= 0)
    return { ok: false, mensaje: 'El importe tiene que ser mayor que cero.' }
  if (monto > MONTO_MAXIMO)
    return { ok: false, mensaje: 'El importe es demasiado grande.' }
  if (!esFechaValida(datos.vigenteDesde))
    return { ok: false, mensaje: 'Ingresá una fecha de vigencia válida.' }
  return { ok: true, monto }
}

/** 'AAAA-MM-DD' que corresponde a una fecha real del calendario. */
export function esFechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const d = new Date(anio, mes - 1, dia)
  return (
    d.getFullYear() === anio && d.getMonth() === mes - 1 && d.getDate() === dia
  )
}

/** Fecha local de hoy en 'AAAA-MM-DD' (no UTC: evita correrse un día). */
export function fechaHoy(ahora = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`
}

/** El valor pertenece a ese concepto y a esa referencia. */
export function coincideClave(valor: ValorServicio, clave: ClaveValor): boolean {
  if (valor.concepto !== clave.concepto) return false
  if (clave.concepto === 'Deporte') return valor.id_actividad === clave.idReferencia
  if (clave.concepto === 'Recorrido')
    return valor.id_recorrido === clave.idReferencia
  return true
}

/**
 * Valor que rige en una fecha: el de mayor vigencia que no sea posterior.
 * HU50 usará esta regla con el primer día del mes facturado.
 */
export function valorVigente(
  valores: ValorServicio[],
  clave: ClaveValor,
  fecha: string,
): ValorServicio | null {
  let vigente: ValorServicio | null = null
  for (const v of valores) {
    if (!coincideClave(v, clave) || v.vigente_desde > fecha) continue
    if (!vigente || v.vigente_desde > vigente.vigente_desde) vigente = v
  }
  return vigente
}

/** Próximo valor programado: el de menor vigencia posterior a la fecha. */
export function proximoValor(
  valores: ValorServicio[],
  clave: ClaveValor,
  fecha: string,
): ValorServicio | null {
  let proximo: ValorServicio | null = null
  for (const v of valores) {
    if (!coincideClave(v, clave) || v.vigente_desde <= fecha) continue
    if (!proximo || v.vigente_desde < proximo.vigente_desde) proximo = v
  }
  return proximo
}

/** Mensaje para un error de la base al cargar o guardar valores. */
export function mensajeErrorValores(error: {
  code?: string
  status?: number
}): string {
  switch (error.code) {
    case '23505':
      return 'Ya hay un valor con esa fecha. Recargá la página y volvé a intentar.'
    case '23514':
      return 'El importe tiene que ser mayor que cero.'
    case '42P01':
    case 'PGRST205':
      return 'Falta crear la tabla de valores (etapa16_valores.sql). Avisá al equipo.'
    default:
      return 'No pudimos completar la operación. Revisá tu conexión e intentá de nuevo.'
  }
}

// ═══════════════════════════════════════════════════════════════
//  TP METODOLOGÍA II · Parte 3 · RF11.5 (HU50, etapa A, parcial)
//  Factura mensual por alumno. Lógica pura (sin Supabase) para poder
//  probarla con Vitest. La generación y las reglas de datos están en
//  la base (etapa17_facturacion.sql); acá se valida lo que elige el
//  usuario y se traducen los códigos de error a textos claros.
// ═══════════════════════════════════════════════════════════════

export interface Periodo {
  anio: number
  mes: number // 1 a 12
}

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const

/** Estado de cobro que calcula v_facturas_saldo. */
export type EstadoCobro = 'Pendiente' | 'Parcial' | 'Pagada' | 'Vencida' | 'Sin cargo'

/** Estado de cada ítem que calcula v_factura_items_saldo ('En revision':
 *  tiene un comprobante cargado sin aprobar; desde etapa18). */
export type EstadoPagoItem = 'Pendiente' | 'Pagado' | 'Sin cargo' | 'En revision'

/** Texto para mostrar de un estado guardado sin tilde en la base. */
export function etiquetaEstado(estado: string): string {
  return estado === 'En revision' ? 'En revisión' : estado
}

/** Lo que devuelve fn_generar_facturas. */
export interface ResumenGeneracion {
  periodo: string // 'AAAA-MM'
  nuevas: number
  ya_emitidas: number
  cuotas_previas: number
  total: number
}

const dos = (n: number) => String(n).padStart(2, '0')

/** Mes de una fecha local (no UTC: evita correrse de mes el último día). */
export function periodoDe(fecha = new Date()): Periodo {
  return { anio: fecha.getFullYear(), mes: fecha.getMonth() + 1 }
}

/** El mes que se factura normalmente: el siguiente (diciembre → enero). */
export function periodoSiguiente(fecha = new Date()): Periodo {
  const { anio, mes } = periodoDe(fecha)
  return mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 }
}

/** La factura vence el día 10 del mes facturado ('AAAA-MM-10'). */
export function fechaVencimiento(p: Periodo): string {
  return `${p.anio}-${dos(p.mes)}-10`
}

/** Primer día del mes facturado: rige el valor vigente a esa fecha. */
export function primerDia(p: Periodo): string {
  return `${p.anio}-${dos(p.mes)}-01`
}

/** 'diciembre 2026' */
export function nombrePeriodo(p: Periodo): string {
  const mes = p.mes >= 1 && p.mes <= 12 ? MESES.at(p.mes - 1) : undefined
  return `${mes ?? '?'} ${p.anio}`
}

/** 'AAAA-MM-DD' → 'DD/MM/AAAA' */
export function fechaCorta(fecha: string): string {
  return fecha.slice(0, 10).split('-').reverse().join('/')
}

export function pesos(monto: number): string {
  return monto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

/** Número visible de la factura: 'F-000123'. */
export function numeroFactura(id: number): string {
  return `F-${String(id).padStart(6, '0')}`
}

/** Mes anterior al actual: no se emiten facturas retroactivas. */
export function esPeriodoPasado(p: Periodo, hoy = new Date()): boolean {
  const actual = periodoDe(hoy)
  return p.anio * 12 + p.mes < actual.anio * 12 + actual.mes
}

/** Mismas reglas que fn_generar_facturas (FAC_PERIODO y FAC_PERIODO_PASADO). */
export function validarPeriodo(
  p: Periodo,
  hoy = new Date(),
): { ok: true } | { ok: false; mensaje: string } {
  if (!Number.isInteger(p.anio) || p.anio < 2020 || p.anio > 2100)
    return { ok: false, mensaje: 'Ingresá un año válido (entre 2020 y 2100).' }
  if (!Number.isInteger(p.mes) || p.mes < 1 || p.mes > 12)
    return { ok: false, mensaje: 'Elegí un mes válido.' }
  if (esPeriodoPasado(p, hoy))
    return {
      ok: false,
      mensaje: 'No se emiten facturas de meses anteriores al actual.',
    }
  return { ok: true }
}

/** Texto del resultado de una generación. */
export function textoResultado(r: ResumenGeneracion): string {
  const [anio, mes] = r.periodo.split('-').map(Number)
  const periodo = nombrePeriodo({ anio, mes })
  if (r.nuevas === 0) {
    return r.ya_emitidas > 0
      ? `No hubo facturas nuevas: las ${r.ya_emitidas} de ${periodo} ya estaban emitidas y no se modificaron.`
      : `No hay alumnos activos para facturar en ${periodo}.`
  }
  const partes = [
    `Se emitieron ${r.nuevas} factura${r.nuevas === 1 ? '' : 's'} de ${periodo} por ${pesos(r.total)}.`,
  ]
  if (r.ya_emitidas > 0)
    partes.push(`Ya estaban emitidas ${r.ya_emitidas} y no se modificaron.`)
  if (r.cuotas_previas > 0)
    partes.push(
      `Se respetaron ${r.cuotas_previas} cuota${r.cuotas_previas === 1 ? '' : 's'} que ya existían (importe, descuento y estado).`,
    )
  return partes.join(' ')
}

/** Mensaje para un error al generar o consultar facturas. */
export function mensajeErrorFacturacion(error: {
  code?: string
  status?: number
  message?: string
}): string {
  const mensaje = error.message ?? ''
  const [codigo, ...datos] = mensaje.split('|')
  switch (codigo) {
    case 'FAC_SIN_VALOR': {
      // .at() devuelve undefined si falta la parte: el respaldo '?' aplica
      const fecha = datos.at(0) ?? '?'
      const lista = datos.at(1) ?? '?'
      return `Falta el valor vigente al ${fecha} de: ${lista}. Cargalo en Valores con esa fecha o una anterior. No se emitió ninguna factura.`
    }
    case 'FAC_PERIODO_PASADO':
      return 'No se emiten facturas de meses anteriores al actual.'
    case 'FAC_PERIODO':
      return 'Elegí un mes y un año válidos.'
    case 'FAC_CUOTA_SIN_VINCULO':
      return 'No se pudo vincular una cuota del período. No se emitió ninguna factura: avisá al equipo.'
    case 'FAC_EMITIDA':
      return 'Las facturas emitidas no se pueden modificar ni borrar.'
    case 'FAC_SOLO_GENERADOR':
      return 'Las facturas solo se crean con "Generar facturas".'
    case 'CUO_PAGADA':
      return 'La cuota ya está pagada: no puede volver a pendiente ni cambiar su importe, su fecha de pago ni su método.'
    case 'CUO_EN_REVISION':
      return 'La cuota tiene un comprobante de transferencia en revisión. Aprobalo o rechazalo en Comprobantes antes de registrar otro pago.'
    case 'CUO_FACTURADA':
      return 'La cuota ya está facturada: no se puede cambiar su alumno, período, vencimiento ni importe.'
    case 'CUO_METODO':
      return 'Los pagos se registran solo por transferencia.'
  }
  switch (error.code) {
    case 'PGRST202':
    case 'PGRST205':
    case '42P01':
    case '42883':
      return 'Falta ejecutar etapa17_facturacion.sql en la base. Avisá al equipo.'
    case '42501':
      return 'No tenés permiso para esta operación. Volvé a iniciar sesión.'
  }
  if (error.status === 401)
    return 'No tenés permiso para esta operación. Volvé a iniciar sesión.'
  return 'No pudimos completar la operación. Revisá tu conexión e intentá de nuevo.'
}

/** Color del estado de cobro (mismos tonos que el resto del panel). */
export function colorEstadoCobro(estado: string): string {
  switch (estado) {
    case 'Pagada':
    case 'Pagado':
    case 'Aprobado':
      return '#27AE60'
    case 'En revision':
    case 'En revisión':
      return '#8E44AD'
    case 'Rechazado':
      return '#E74C3C'
    case 'Parcial':
      return '#2980B9'
    case 'Vencida':
      return '#E74C3C'
    case 'En mora':
      return '#C0392B'
    case 'Sin cargo':
    case 'Cubierta por beca':
      return '#6B6B8A'
    default:
      return '#E67E22'
  }
}

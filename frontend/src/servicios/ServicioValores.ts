// ═══════════════════════════════════════════════════════════════
//  ServicioValores — patrón Facade (RF11.1 a RF11.4, HU46 a HU49)
// ═══════════════════════════════════════════════════════════════
// Único punto por el que la pantalla de Valores usa la base. Usa la
// instancia única del cliente (Singleton, src/lib/supabase.ts).
// No rechaza: devuelve los datos o el mensaje para mostrar, y la causa
// queda registrada en la consola (solo código y status).
import { supabase } from '../lib/supabase'
import { resumenError } from '../app/reglasContrasena'
import { mensajeErrorValores, validarValor } from '../reglasValores'
import type { ClaveValor, ValorServicio } from '../reglasValores'

export interface DeporteValor {
  id_actividad: number
  nombre: string
}

export interface RecorridoValor {
  id_recorrido: number
  numero: number
  nombre: string
}

export interface DatosValores {
  deportes: DeporteValor[]
  recorridos: RecorridoValor[]
  valores: ValorServicio[]
}

export type Resultado = { ok: true } | { ok: false; mensaje: string }

const TABLA = 'valores_servicio'

function fallo(operacion: string, causa: unknown): { ok: false; mensaje: string } {
  console.error(`[ServicioValores] ${operacion}:`, resumenError(causa))
  const { code, status } = resumenError(causa)
  return { ok: false, mensaje: mensajeErrorValores({ code, status }) }
}

/** Columnas de referencia según el concepto (como chk_valor_referencia). */
function referencias(clave: ClaveValor) {
  return {
    id_actividad: clave.concepto === 'Deporte' ? clave.idReferencia : null,
    id_recorrido: clave.concepto === 'Recorrido' ? clave.idReferencia : null,
  }
}

export const ServicioValores = {
  /** Deportes activos, los recorridos y todos los valores cargados. */
  cargar(): Promise<{ ok: true; datos: DatosValores } | { ok: false; mensaje: string }> {
    return Promise.all([
      supabase
        .from('actividades_extracurriculares')
        .select('id_actividad, nombre')
        .eq('tipo', 'Deporte')
        .eq('activo', true)
        .order('nombre'),
      supabase
        .from('recorridos')
        .select('id_recorrido, numero, nombre')
        .order('numero'),
      supabase
        .from(TABLA)
        .select('id_valor, concepto, id_actividad, id_recorrido, monto, vigente_desde')
        .order('vigente_desde'),
    ]).then(
      ([deportes, recorridos, valores]) => {
        const error = deportes.error ?? recorridos.error ?? valores.error
        if (error) return fallo('cargar', error)
        return {
          ok: true as const,
          datos: {
            deportes: (deportes.data ?? []) as DeporteValor[],
            recorridos: (recorridos.data ?? []) as RecorridoValor[],
            valores: ((valores.data ?? []) as ValorServicio[]).map((v) => ({
              ...v,
              monto: Number(v.monto),
            })),
          },
        }
      },
      (causa: unknown) => fallo('cargar', causa),
    )
  },

  /**
   * Guarda un valor. Si ya hay uno con el mismo concepto, referencia y
   * fecha, lo reemplaza (así se corrige una carga equivocada); si no, lo
   * agrega. Se busca antes porque el índice único usa coalesce y PostgREST
   * no puede hacer upsert sobre un índice de expresiones.
   */
  guardar(datos: {
    clave: ClaveValor
    monto: string
    vigenteDesde: string
  }): Promise<Resultado> {
    const validado = validarValor(datos)
    if (!validado.ok) return Promise.resolve(validado)
    const { id_actividad, id_recorrido } = referencias(datos.clave)

    let existente = supabase
      .from(TABLA)
      .select('id_valor')
      .eq('concepto', datos.clave.concepto)
      .eq('vigente_desde', datos.vigenteDesde)
    existente =
      id_actividad === null
        ? existente.is('id_actividad', null)
        : existente.eq('id_actividad', id_actividad)
    existente =
      id_recorrido === null
        ? existente.is('id_recorrido', null)
        : existente.eq('id_recorrido', id_recorrido)

    const guardarFila = (idExistente: number | null) =>
      idExistente === null
        ? supabase.from(TABLA).insert({
            concepto: datos.clave.concepto,
            id_actividad,
            id_recorrido,
            monto: validado.monto,
            vigente_desde: datos.vigenteDesde,
          })
        : supabase
            .from(TABLA)
            .update({ monto: validado.monto, fecha_carga: new Date().toISOString() })
            .eq('id_valor', idExistente)

    return Promise.resolve(existente.maybeSingle()).then(
      ({ data, error }) => {
        if (error) return fallo('guardar', error)
        const idExistente = (data as { id_valor: number } | null)?.id_valor ?? null
        return guardarFila(idExistente).then(
          ({ error: errorGuardado }): Resultado =>
            errorGuardado ? fallo('guardar', errorGuardado) : { ok: true },
          (causa: unknown) => fallo('guardar', causa),
        )
      },
      (causa: unknown) => fallo('guardar', causa),
    )
  },
}

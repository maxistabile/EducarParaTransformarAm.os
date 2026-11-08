-- ============================================================
-- ETAPA 16 - TP Metodologia de Sistemas II (Parte 3)
--   RF11.1 a RF11.4  Valores de cuota, deportes, transporte y comedor
--                    (HU46 a HU49)
--
-- Requiere: etapa2 (actividades_extracurriculares) y etapa14 (recorridos).
-- Correr en: Supabase -> SQL Editor, ANTES de probar el frontend.
-- Idempotente y solo ASCII. Solo agrega una tabla: no cambia datos.
-- Al final muestra una TABLA con el resultado.
--
-- Reglas que controla la base:
--   * Cada valor es de un concepto: Cuota, Deporte, Recorrido o Comedor.
--   * Deporte lleva su id_actividad; Recorrido, su id_recorrido;
--     Cuota y Comedor no llevan referencia (valor unico).
--   * El monto es mayor que cero.
--   * Un solo valor por concepto, referencia y fecha de vigencia.
--     Para corregir una carga se reemplaza el valor de esa misma fecha.
--
-- Vigencia: para un mes rige el valor con mayor vigente_desde que sea
-- menor o igual al primer dia de ese mes. La factura (HU50) copia el
-- importe en cada item, asi que un cambio posterior no altera facturas
-- ya emitidas.
--
-- Sin RLS ni politicas: decision del equipo (CLAUDE.md, seccion 3.1).
-- ============================================================

create table if not exists valores_servicio (
  id_valor      bigint generated always as identity primary key,
  concepto      text not null
                check (concepto in ('Cuota', 'Deporte', 'Recorrido', 'Comedor')),
  id_actividad  bigint references actividades_extracurriculares(id_actividad),
  id_recorrido  integer references recorridos(id_recorrido),
  monto         numeric(12,2) not null check (monto > 0),
  vigente_desde date not null,
  fecha_carga   timestamptz not null default now(),
  constraint chk_valor_referencia check (
    (concepto = 'Deporte'   and id_actividad is not null and id_recorrido is null) or
    (concepto = 'Recorrido' and id_recorrido is not null and id_actividad is null) or
    (concepto in ('Cuota', 'Comedor') and id_actividad is null and id_recorrido is null))
);

-- Un valor por concepto, referencia y fecha. coalesce para que Cuota y
-- Comedor (sin referencia) tampoco se repitan en la misma fecha.
create unique index if not exists uq_valor_vigencia
  on valores_servicio (concepto, coalesce(id_actividad, 0),
                       coalesce(id_recorrido, 0), vigente_desde);


-- ------------------------------------------------------------
-- RESULTADO (solo lectura)
-- ------------------------------------------------------------
select 'Tabla valores_servicio' as control,
       case when to_regclass('public.valores_servicio') is not null
            then 'OK' else 'FALLA' end as resultado,
       'Tabla de valores con fecha de vigencia' as detalle
union all
select 'Indice uq_valor_vigencia',
       case when to_regclass('public.uq_valor_vigencia') is not null
            then 'OK' else 'FALLA' end,
       'Un valor por concepto, referencia y fecha'
union all
select 'RLS en valores_servicio (informativo)',
       case when relrowsecurity then 'ACTIVO' else 'INACTIVO' end,
       case when relrowsecurity
            then 'Avisar al equipo: la app no va a poder leer ni guardar valores'
            else 'Esperado para esta demo (CLAUDE.md, seccion 3.1)' end
  from pg_class
 where oid = to_regclass('public.valores_servicio')
union all
select 'Valores cargados', 'INFO', count(*)::text || ' fila(s)'
  from valores_servicio;

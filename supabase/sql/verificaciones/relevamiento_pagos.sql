-- ============================================================
-- RELEVAMIENTO DE PAGOS Y DE LO QUE ESCRIBE EN CUOTAS
-- (segunda parte, antes de etapa17 - HU50)
--
-- SOLO LECTURA: no crea, no modifica y no borra nada.
-- Correr en: Supabase -> SQL Editor, ANTES de etapa17_facturacion.sql.
-- Muestra UNA tabla (seccion, elemento, detalle). Solo conteos y
-- definiciones: ningun nombre, DNI ni importe de un alumno.
--
-- Por que: el relevamiento de cuotas (08/11) mostro una tabla `pagos`
-- con FK a cuotas (ON DELETE RESTRICT) que no se crea en el repo y que
-- el codigo no usa. Antes de ejecutar etapa17 hay que saber si tiene
-- datos y si algo (trigger, funcion o tarea programada) escribe en
-- cuotas por fuera de la aplicacion: etapa17 agrega un trigger a cuotas
-- que rechaza cambiar una cuota pagada o facturada.
--
-- LO ESPERADO
--   1-3 pagos: columnas, restricciones y triggers (informativo).
--   4  Datos de pagos: idealmente 0 filas. Si tiene filas, avisar:
--      hay que decidir si cuentan para el historial de pagos (HU53).
--   5  Funciones que mencionan cuotas fuera de etapa17: NINGUNA.
--   6  Vistas que usan cuotas: NINGUNA (informativo).
--   7  Tareas programadas (pg_cron) que mencionan cuotas: NINGUNA.
--   8  Cuotas sin alumno (id_alumno nulo): 0.
--   9  El rol authenticated puede crear tablas temporales: SI.
-- ============================================================

with
p_cols as (
  select column_name::text as col, data_type::text as tipo,
         is_nullable::text as nulo, column_default::text as def,
         ordinal_position as pos
    from information_schema.columns
   where table_schema = 'public' and table_name = 'pagos'
),
p_rows as (
  select to_jsonb(p) as j from public.pagos p
),
p_cuota as (
  select (r.j ->> 'id_cuota')::bigint as id_cuota, c.estado
    from p_rows r
    left join public.cuotas c on c.id_cuota = (r.j ->> 'id_cuota')::bigint
),
salida as (
  -- 1) Columnas de pagos
  select 1 as orden, pos::bigint as sub, '1 pagos: columnas'::text as seccion,
         col as elemento,
         tipo || ' | ' || case when nulo = 'NO' then 'NOT NULL' else 'acepta nulos' end
         || ' | default: ' || coalesce(def, '(ninguno)') as detalle
    from p_cols

  -- 2) Restricciones de pagos
  union all
  select 2, row_number() over (order by conname), '2 pagos: restricciones',
         conname::text,
         case contype when 'p' then 'PRIMARY KEY' when 'u' then 'UNIQUE'
                      when 'c' then 'CHECK' when 'f' then 'FOREIGN KEY'
                      when 'n' then 'NOT NULL' else contype::text end
         || ': ' || pg_get_constraintdef(oid)
    from pg_constraint
   where conrelid = 'public.pagos'::regclass

  -- 3) Triggers de pagos
  union all
  select 3, 0, '3 pagos: triggers', 'Cantidad', count(*)::text
    from pg_trigger
   where tgrelid = 'public.pagos'::regclass and not tgisinternal
  union all
  select 3, row_number() over (order by t.tgname), '3 pagos: triggers', t.tgname::text,
         'funcion ' || p.proname || ' | ' || pg_get_triggerdef(t.oid)
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid
   where t.tgrelid = 'public.pagos'::regclass and not t.tgisinternal

  -- 4) Datos de pagos (solo conteos)
  union all
  select 4, 1, '4 pagos: datos', 'Filas', count(*)::text || ' (ideal: 0)' from p_rows
  union all
  select 4, 2, '4 pagos: datos', 'Cuotas distintas con pagos',
         count(distinct id_cuota)::text from p_cuota
  union all
  select 4, 3, '4 pagos: datos', 'Filas por estado de su cuota',
         coalesce(string_agg(e || ': ' || n, ', ' order by e), '(sin filas)')
    from (select coalesce(estado, '(sin cuota)') as e, count(*)::text as n
            from p_cuota group by 1) x
  union all
  select 4, 4, '4 pagos: datos', 'Cuotas Pagada sin fila en pagos',
         count(*)::text
    from public.cuotas c
   where c.estado = 'Pagada'
     and not exists (select 1 from p_cuota pc where pc.id_cuota = c.id_cuota)
  union all
  select 4, 5, '4 pagos: datos', 'Actividad desde el ultimo reinicio de estadisticas',
         'insertadas: ' || n_tup_ins || ', modificadas: ' || n_tup_upd
         || ', borradas: ' || n_tup_del
    from pg_stat_user_tables where relid = 'public.pagos'::regclass

  -- 5) Funciones (fuera de etapa17) que mencionan cuotas
  union all
  select 5, 0, '5 Funciones que mencionan cuotas', 'Cantidad',
         count(*)::text || ' (esperado: 0)'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname not in ('pg_catalog', 'information_schema')
     and p.prokind in ('f', 'p')
     and p.prosrc ilike '%cuotas%'
     and p.proname not in ('fn_generar_facturas', 'fn_controlar_cuota',
                           'fn_proteger_facturacion', 'fn_activa_en_periodo')
  union all
  select 5, row_number() over (order by n.nspname, p.proname),
         '5 Funciones que mencionan cuotas', n.nspname || '.' || p.proname,
         case when p.prosrc ~* '(insert\s+into|update|delete\s+from)\s+(public\.)?cuotas'
              then 'ESCRIBE en cuotas (avisar)' else 'solo lectura' end
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname not in ('pg_catalog', 'information_schema')
     and p.prokind in ('f', 'p')
     and p.prosrc ilike '%cuotas%'
     and p.proname not in ('fn_generar_facturas', 'fn_controlar_cuota',
                           'fn_proteger_facturacion', 'fn_activa_en_periodo')

  -- 6) Vistas que usan cuotas
  union all
  select 6, 0, '6 Vistas que usan cuotas', 'Vistas',
         coalesce(string_agg(view_schema || '.' || view_name, ', '), 'ninguna')
    from information_schema.view_table_usage
   where table_schema = 'public' and table_name = 'cuotas'
     and view_name not in ('v_facturas_saldo', 'v_factura_items_saldo')

  -- 7) Tareas programadas (pg_cron) que mencionan cuotas
  union all
  select 7, 1, '7 Tareas programadas', 'pg_cron',
         case when to_regclass('cron.job') is null then 'no instalado'
              else (xpath('/row/t/text()', query_to_xml(
                     'select coalesce(string_agg(jobname || '' ['' || schedule || '']'', '', ''), ''ninguna'') as t '
                     || 'from cron.job where command ilike ''%cuota%''',
                     false, true, '')))[1]::text
         end

  -- 8) Cuotas sin alumno
  union all
  select 8, 1, '8 Cuotas sin alumno', 'id_alumno nulo',
         count(*)::text || ' (esperado: 0)'
    from public.cuotas where id_alumno is null

  -- 9) Tablas temporales (las usa fn_generar_facturas)
  union all
  select 9, 1, '9 Permisos', 'authenticated puede crear tablas temporales',
         case when has_database_privilege('authenticated', current_database(), 'TEMPORARY')
              then 'SI (esperado)' else 'NO (avisar)' end
)
select seccion, elemento, detalle
  from salida
 order by orden, sub;

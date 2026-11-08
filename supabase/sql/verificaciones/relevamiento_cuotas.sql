-- ============================================================
-- RELEVAMIENTO DE CUOTAS - antes de etapa17 (HU50)
--
-- SOLO LECTURA: no crea, no modifica y no borra nada.
-- Correr en: Supabase -> SQL Editor, ANTES de etapa17_facturacion.sql.
-- Muestra UNA tabla (seccion, elemento, detalle) con el esquema real
-- de cuotas y los datos que la facturacion necesita. Solo muestra
-- conteos: ningun nombre, DNI ni importe de un alumno.
--
-- La tabla cuotas no se crea en ningun script del repo, asi que
-- etapa17 se escribio con lo que usa el codigo. Si algo de lo que
-- sigue NO coincide, avisar antes de ejecutar etapa17.
--
-- LO ESPERADO
--   1 Columnas: id_cuota, id_alumno, mes, anio, monto_base, recargo,
--     descuento, fecha_vencimiento, estado, fecha_pago, metodo_pago.
--     Otra columna NOT NULL sin default -> AVISAR (la facturacion
--     no la completaria al crear la cuota).
--   2 Restricciones: PRIMARY KEY (id_cuota); UNIQUE (id_alumno, mes,
--     anio) en cualquier orden; FK de id_alumno a alumnos; CHECK de
--     metodo_pago (etapa6). Si hay un CHECK de estado, tiene que
--     aceptar 'Pendiente', 'Vencida' y 'Pagada'.
--   3 Indices: los de las restricciones + idx_cuotas_estado e
--     idx_cuotas_alumno_mes (etapa6).
--   4 Triggers: NINGUNO. Cualquier trigger -> AVISAR.
--   5 RLS: INACTIVO, sin politicas (CLAUDE.md 3.1).
--   6 Claves foraneas que apuntan a cuotas: NINGUNA.
--     (Relevado el 08/11: existe pagos.pagos_id_cuota_fkey, ON DELETE
--     RESTRICT, que el codigo no usa. Ver relevamiento_pagos.sql.)
--   7 Datos: duplicados por alumno y periodo = 0; recargo > 0 = 0.
--     Las cuotas con neto <= 0 son informativas (beca del 100 %
--     generada con el sistema anterior): se conservan.
--   8 Tablas relacionadas: columnas que usa la facturacion, todas OK.
--   9 Nombres nuevos: todos LIBRE (o EXISTE si etapa17 ya se corrio).
--  10 Version de PostgreSQL 15 o superior.
--  11 Valores para el mes siguiente: informativo. Un concepto en uso
--     sin valor vigente hace que la facturacion de ese mes no emita
--     ninguna factura hasta cargarlo en Valores.
-- ============================================================

with
c_cols as (
  select column_name::text as col, data_type::text as tipo,
         is_nullable::text as nulo, column_default::text as def,
         ordinal_position as pos
    from information_schema.columns
   where table_schema = 'public' and table_name = 'cuotas'
),
c_rows as (
  select to_jsonb(c) as j from public.cuotas c
),
c_neto as (
  select j ->> 'estado' as estado,
         coalesce(j ->> 'metodo_pago', '(sin metodo)') as metodo,
         (j ->> 'id_alumno') as id_alumno,
         (j ->> 'mes') as mes, (j ->> 'anio') as anio,
         coalesce((j ->> 'recargo')::numeric, 0) as recargo,
         coalesce((j ->> 'monto_base')::numeric, 0)
           + coalesce((j ->> 'recargo')::numeric, 0)
           - coalesce((j ->> 'descuento')::numeric, 0) as neto
    from c_rows
),
mes_sig as (
  select (date_trunc('month', (now() at time zone 'America/Argentina/Buenos_Aires'))
          + interval '1 month')::date as desde
),
salida as (
  -- 1) Columnas
  select 1 as orden, pos::bigint as sub, '1 Columnas'::text as seccion, col as elemento,
         tipo || ' | ' || case when nulo = 'NO' then 'NOT NULL' else 'acepta nulos' end
         || ' | default: ' || coalesce(def, '(ninguno)') as detalle
    from c_cols

  -- 2) Restricciones
  union all
  select 2, row_number() over (order by contype, conname), '2 Restricciones',
         conname::text,
         case contype when 'p' then 'PRIMARY KEY' when 'u' then 'UNIQUE'
                      when 'c' then 'CHECK' when 'f' then 'FOREIGN KEY'
                      when 'n' then 'NOT NULL'
                      else contype::text end
         || ': ' || pg_get_constraintdef(oid)
    from pg_constraint
   where conrelid = 'public.cuotas'::regclass

  -- 3) Indices
  union all
  select 3, row_number() over (order by indexname), '3 Indices',
         indexname::text, indexdef::text
    from pg_indexes
   where schemaname = 'public' and tablename = 'cuotas'

  -- 4) Triggers propios (no los internos de las FK)
  union all
  select 4, row_number() over (order by t.tgname), '4 Triggers',
         t.tgname::text,
         'funcion ' || p.proname || ' | '
         || case t.tgenabled when 'D' then 'DESACTIVADO' else 'activo' end
         || ' | ' || pg_get_triggerdef(t.oid)
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
   where t.tgrelid = 'public.cuotas'::regclass and not t.tgisinternal
  union all
  select 4, 0, '4 Triggers', 'Cantidad',
         count(*)::text || ' (esperado: 0)'
    from pg_trigger
   where tgrelid = 'public.cuotas'::regclass and not tgisinternal

  -- 5) RLS (informativo)
  union all
  select 5, 1, '5 RLS', 'RLS en cuotas',
         case when relrowsecurity then 'ACTIVO (avisar)' else 'INACTIVO (esperado)' end
    from pg_class where oid = 'public.cuotas'::regclass
  union all
  select 5, 2, '5 RLS', 'Politicas en cuotas',
         count(*)::text || ' (esperado: 0)'
    from pg_policies where schemaname = 'public' and tablename = 'cuotas'

  -- 6) Claves foraneas de otras tablas hacia cuotas
  union all
  select 6, 0, '6 FK hacia cuotas', 'Cantidad',
         count(*)::text || ' (esperado: 0)'
    from pg_constraint where contype = 'f' and confrelid = 'public.cuotas'::regclass
  union all
  select 6, row_number() over (order by conname), '6 FK hacia cuotas',
         conrelid::regclass::text || '.' || conname::text, pg_get_constraintdef(oid)
    from pg_constraint where contype = 'f' and confrelid = 'public.cuotas'::regclass

  -- 7) Datos (solo conteos)
  union all
  select 7, 1, '7 Datos', 'Total de cuotas', count(*)::text from c_neto
  union all
  select 7, 2, '7 Datos', 'Por estado',
         coalesce(string_agg(estado || ': ' || n, ', ' order by estado), '(sin cuotas)')
    from (select coalesce(estado, '(nulo)') as estado, count(*)::text as n
            from c_neto group by 1) x
  union all
  select 7, 3, '7 Datos', 'Por metodo de pago',
         coalesce(string_agg(metodo || ': ' || n, ', ' order by metodo), '(sin cuotas)')
    from (select metodo, count(*)::text as n from c_neto group by 1) x
  union all
  select 7, 4, '7 Datos', 'Duplicadas por alumno y periodo',
         count(*)::text || ' (esperado: 0)'
    from (select 1 from c_neto group by id_alumno, mes, anio having count(*) > 1) x
  union all
  select 7, 5, '7 Datos', 'Con recargo > 0',
         count(*)::text || ' (esperado: 0)' from c_neto where recargo > 0
  union all
  select 7, 6, '7 Datos', 'Con neto <= 0 (informativo)',
         count(*)::text || ' en total; sin pagar: '
         || (count(*) filter (where coalesce(estado, '') <> 'Pagada'))::text
    from c_neto where neto <= 0
  union all
  select 7, 7, '7 Datos', 'Periodos con cuotas (anio-mes: cantidad)',
         coalesce(string_agg(p || ': ' || n, ', ' order by p), '(sin cuotas)')
    from (select anio || '-' || lpad(mes, 2, '0') as p, count(*)::text as n
            from c_neto group by anio, mes) x

  -- 8) Tablas relacionadas: columnas que usa la facturacion
  union all
  select 8, row_number() over (order by r.tabla, r.columna), '8 Tablas relacionadas',
         r.tabla || '.' || r.columna,
         coalesce(ic.data_type::text || ' | OK', 'FALTA (avisar)')
    from (values ('alumnos', 'id_alumno'), ('alumnos', 'activo'), ('alumnos', 'nombre'),
                 ('alumnos', 'apellido'), ('alumnos', 'dni'), ('alumnos', 'id_curso'),
                 ('cursos', 'nivel'), ('cursos', 'grado_anio'), ('cursos', 'division'),
                 ('becas', 'id_alumno'), ('becas', 'porcentaje'), ('becas', 'activo'),
                 ('inscripciones_deportivas', 'fecha_alta'),
                 ('inscripciones_deportivas', 'fecha_baja'),
                 ('inscripciones_transporte', 'fecha_alta'),
                 ('inscripciones_transporte', 'fecha_baja'),
                 ('inscripciones_comedor', 'fecha_alta'),
                 ('inscripciones_comedor', 'fecha_baja'),
                 ('valores_servicio', 'vigente_desde')) as r(tabla, columna)
    left join information_schema.columns ic
      on ic.table_schema = 'public' and ic.table_name = r.tabla
     and ic.column_name = r.columna

  -- 9) Nombres que crea etapa17
  union all
  select 9, row_number() over (order by n.nombre), '9 Nombres nuevos', n.nombre,
         case when to_regclass('public.' || n.nombre) is not null then 'EXISTE'
              else 'LIBRE' end
    from (values ('facturas'), ('factura_items'), ('v_facturas_saldo'),
                 ('v_factura_items_saldo')) as n(nombre)
  union all
  select 9, 10, '9 Nombres nuevos', 'cuotas.cubierta_por_beca',
         case when exists (select 1 from c_cols where col = 'cubierta_por_beca')
              then 'EXISTE' else 'LIBRE' end
  union all
  select 9, 11, '9 Nombres nuevos', 'Funciones',
         coalesce(string_agg(proname || ': EXISTE', ', '), 'todas LIBRE')
    from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('fn_generar_facturas', 'fn_activa_en_periodo',
                     'fn_controlar_cuota', 'fn_proteger_facturacion')

  -- 10) Version
  union all
  select 10, 1, '10 Version', 'PostgreSQL', current_setting('server_version')

  -- 11) Valores para el mes siguiente (informativo)
  union all
  select 11, 1, '11 Valores mes siguiente', 'Primer dia del mes',
         to_char(desde, 'DD/MM/YYYY') from mes_sig
  union all
  select 11, 2, '11 Valores mes siguiente', 'Cuota',
         case when exists (select 1 from valores_servicio v, mes_sig m
                            where v.concepto = 'Cuota' and v.vigente_desde <= m.desde)
              then 'con valor' else 'SIN VALOR' end
  union all
  select 11, 3, '11 Valores mes siguiente', 'Comedor (alumnos con comedor activo)',
         count(*)::text || ' alumno(s); '
         || case when exists (select 1 from valores_servicio v, mes_sig m
                               where v.concepto = 'Comedor' and v.vigente_desde <= m.desde)
                 then 'con valor' else 'SIN VALOR' end
    from inscripciones_comedor where activo
  union all
  select 11, 4, '11 Valores mes siguiente', 'Deportes en uso sin valor',
         coalesce(string_agg(distinct ae.nombre, ', '), 'ninguno')
    from inscripciones_deportivas i
    join grupos_deportivos g on g.id_grupo = i.id_grupo
    join actividades_extracurriculares ae on ae.id_actividad = g.id_actividad
   where i.activo
     and not exists (select 1 from valores_servicio v, mes_sig m
                      where v.concepto = 'Deporte' and v.id_actividad = g.id_actividad
                        and v.vigente_desde <= m.desde)
  union all
  select 11, 5, '11 Valores mes siguiente', 'Recorridos en uso sin valor',
         coalesce(string_agg(distinct r.nombre, ', '), 'ninguno')
    from inscripciones_transporte t
    join recorridos r on r.id_recorrido = t.id_recorrido
   where t.activo
     and not exists (select 1 from valores_servicio v, mes_sig m
                      where v.concepto = 'Recorrido' and v.id_recorrido = t.id_recorrido
                        and v.vigente_desde <= m.desde)
  union all
  select 11, 6, '11 Valores mes siguiente', 'Becas activas',
         count(*)::text || ' (del 100 %: '
         || (count(*) filter (where porcentaje = 100))::text || ')'
    from becas where activo
)
select seccion, elemento, detalle
  from salida
 order by orden, sub;

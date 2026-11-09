-- ============================================================
-- RELEVAMIENTO ANTES DE ETAPA 18 (comprobantes de pago, HU54 a HU56)
--
-- SOLO LECTURA: no crea, no modifica y no borra nada.
-- Correr en: Supabase -> SQL Editor, ANTES de etapa18_comprobantes.sql.
-- Muestra UNA tabla (orden, seccion, elemento, resultado, detalle).
-- Solo estructura y conteos: ningun nombre, DNI ni importe.
--
-- Por que: etapa18 reutiliza la tabla pagos (vacia el 08/11) como
-- comprobante de transferencia, agrega pago_items, un bucket privado
-- de Storage y publica pagos en Realtime. Antes hay que confirmar que
-- la estructura sigue igual y que no hay nada con los nombres nuevos.
--
-- LO ESPERADO (columna resultado)
--   OK      coincide con lo que supone etapa18.
--   AVISAR  no coincide: pasar el resultado completo antes de seguir.
--   INFO    dato informativo.
-- ============================================================

with
cols as (
  select column_name::text as col, data_type::text as tipo,
         udt_name::text as udt, is_nullable::text as nulo,
         column_default::text as def, ordinal_position as pos
    from information_schema.columns
   where table_schema = 'public' and table_name = 'pagos'
),
nuevas(col, udt) as (
  values ('id_factura', 'int8'), ('id_alumno', 'int8'), ('estado', 'text'),
         ('clave', 'uuid'), ('huella', 'text'), ('archivo_path', 'text'),
         ('archivo_tipo', 'text'), ('motivo_rechazo', 'text'),
         ('fecha_revision', 'timestamptz'), ('id_usuario_revisa', 'uuid'),
         ('recibo_path', 'text')
),
funciones(nombre) as (
  values ('fn_pago_actor'), ('fn_validar_items_pago'), ('fn_validar_solicitud'),
         ('fn_registrar_comprobante'), ('fn_estado_clave'), ('fn_revisar_comprobante'),
         ('fn_datos_archivo'), ('fn_datos_recibo'), ('fn_guardar_recibo'),
         ('fn_proteger_pagos')
),
salida as (
  -- 1) Columnas actuales de pagos
  select 1 as orden, pos::bigint as sub, '1 pagos: columnas'::text as seccion,
         col as elemento, 'INFO'::text as resultado,
         tipo || ' | ' || case when nulo = 'NO' then 'NOT NULL' else 'acepta nulos' end
         || ' | default: ' || coalesce(def, '(ninguno)') as detalle
    from cols

  -- 2) Restricciones de pagos
  union all
  select 2, row_number() over (order by conname), '2 pagos: restricciones',
         conname::text, 'INFO',
         pg_get_constraintdef(oid)
    from pg_constraint
   where conrelid = to_regclass('public.pagos')

  -- 3) Lo que etapa18 necesita de pagos
  union all
  select 3, 1, '3 pagos: requisitos', 'Filas',
         case when (select count(*) from public.pagos) = 0 then 'OK' else 'AVISAR' end,
         (select count(*) from public.pagos)::text || ' fila(s); se espera 0'
  union all
  select 3, 2, '3 pagos: requisitos', 'id_cuota acepta nulos',
         case when exists (select 1 from cols where col = 'id_cuota' and nulo = 'YES')
              then 'OK' else 'AVISAR' end,
         'Los comprobantes nuevos no tienen cuota propia (id_cuota nulo)'
  union all
  select 3, 3, '3 pagos: requisitos', 'id_pago integer',
         case when exists (select 1 from cols where col = 'id_pago' and udt = 'int4')
              then 'OK' else 'AVISAR' end,
         coalesce((select udt from cols where col = 'id_pago'), '(no existe)')
  union all
  select 3, 4, '3 pagos: requisitos', 'monto_pagado',
         case when exists (select 1 from cols where col = 'monto_pagado' and udt = 'numeric')
              then 'OK' else 'AVISAR' end,
         coalesce((select udt || ' | ' || nulo from cols where col = 'monto_pagado'),
                  '(no existe)')
  union all
  select 3, 5, '3 pagos: requisitos', 'fecha_pago, metodo_pago, id_usuario_registra',
         case when (select count(*) from cols
                     where (col = 'fecha_pago' and udt = 'timestamptz')
                        or (col = 'metodo_pago')
                        or (col = 'id_usuario_registra' and udt = 'uuid')) = 3
              then 'OK' else 'AVISAR' end,
         'Se reutilizan: fecha de carga, Transferencia y el padre que carga'
  union all
  select 3, 6, '3 pagos: requisitos', 'Check de metodo_pago admite Transferencia',
         case when not exists (select 1 from pg_constraint
                                where conrelid = to_regclass('public.pagos')
                                  and contype = 'c'
                                  and pg_get_constraintdef(oid) like '%metodo_pago%'
                                  and pg_get_constraintdef(oid) not like '%Transferencia%')
              then 'OK' else 'AVISAR' end,
         'Los comprobantes se guardan con metodo_pago = Transferencia'
  union all
  select 3, 7, '3 pagos: requisitos', 'Otros UNIQUE o CHECK',
         case when not exists (select 1 from pg_constraint
                                where conrelid = to_regclass('public.pagos')
                                  and (contype = 'u'
                                       or (contype = 'c'
                                           and pg_get_constraintdef(oid) not like '%metodo_pago%')))
              then 'OK' else 'AVISAR' end,
         'Ninguno esperado: podrian chocar con filas sin id_cuota'
  union all
  select 3, 8, '3 pagos: requisitos', 'Triggers',
         case when (select count(*) from pg_trigger
                     where tgrelid = to_regclass('public.pagos') and not tgisinternal) = 0
              then 'OK' else 'AVISAR' end,
         (select count(*) from pg_trigger
           where tgrelid = to_regclass('public.pagos') and not tgisinternal)::text
         || ' trigger(s); se espera 0'
  union all
  select 3, 9, '3 pagos: requisitos', 'RLS',
         case when relrowsecurity then 'AVISAR' else 'OK' end,
         case when relrowsecurity then 'Activo: las lecturas de la app fallarian'
              else 'Inactivo (CLAUDE.md 3.1)' end
    from pg_class where oid = to_regclass('public.pagos')
  union all
  select 3, 10, '3 pagos: requisitos', 'Permisos de authenticated',
         case when has_table_privilege('authenticated', 'public.pagos', 'select')
              then 'OK' else 'AVISAR' end,
         'select: ' || has_table_privilege('authenticated', 'public.pagos', 'select')::text
         || ' | insert: ' || has_table_privilege('authenticated', 'public.pagos', 'insert')::text
         || ' (etapa18 quita insert, update y delete)'
  union all
  select 3, 11, '3 pagos: requisitos', 'Permisos de anon', 'INFO',
         'select: ' || has_table_privilege('anon', 'public.pagos', 'select')::text
         || ' (etapa18 los quita)'
  union all
  select 3, 12, '3 pagos: requisitos', 'Secuencia de id_pago',
         case when pg_get_serial_sequence('public.pagos', 'id_pago') is not null
              then 'OK' else 'AVISAR' end,
         coalesce(pg_get_serial_sequence('public.pagos', 'id_pago'), '(sin secuencia)')
         || ' | duenio: '
         || coalesce((select pg_get_userbyid(c.relowner) from pg_class c
                       where c.oid = to_regclass(pg_get_serial_sequence('public.pagos', 'id_pago'))),
                     '?')

  -- 4) Columnas que etapa18 agrega: no deben existir con otro tipo
  union all
  select 4, row_number() over (order by n.col), '4 pagos: columnas nuevas',
         n.col,
         case when c.col is null then 'OK'
              when c.udt = n.udt then 'OK'
              else 'AVISAR' end,
         case when c.col is null then 'No existe (se crea)'
              when c.udt = n.udt then 'Ya existe con el tipo esperado'
              else 'Ya existe como ' || c.udt || '; se espera ' || n.udt end
    from nuevas n left join cols c on c.col = n.col

  -- 5) Otras tablas y usuarios
  union all
  select 5, 1, '5 otras tablas', 'pago_items',
         case when to_regclass('public.pago_items') is null then 'OK' else 'AVISAR' end,
         case when to_regclass('public.pago_items') is null then 'No existe (se crea)'
              else 'Ya existe: ' || (select string_agg(column_name::text, ', ' order by ordinal_position)
                                       from information_schema.columns
                                      where table_schema = 'public' and table_name = 'pago_items') end
  union all
  select 5, 2, '5 otras tablas', 'usuarios.id_usuario',
         case when exists (select 1 from information_schema.columns
                            where table_schema = 'public' and table_name = 'usuarios'
                              and column_name = 'id_usuario' and udt_name = 'uuid')
              then 'OK' else 'AVISAR' end,
         'uuid esperado (FK de quien carga y de quien revisa)'
  union all
  select 5, 3, '5 otras tablas', 'usuarios.id_usuario y auth.users', 'INFO',
         coalesce((select string_agg(pg_get_constraintdef(oid), '; ')
                     from pg_constraint
                    where conrelid = to_regclass('public.usuarios') and contype = 'f'
                      and pg_get_constraintdef(oid) like '%auth.users%'),
                  'Sin FK a auth.users')
  union all
  select 5, 4, '5 otras tablas', 'usuarios.activo',
         case when exists (select 1 from information_schema.columns
                            where table_schema = 'public' and table_name = 'usuarios'
                              and column_name = 'activo')
              then 'OK' else 'AVISAR' end,
         'Se valida que quien carga o revisa no este desactivado'
  union all
  select 5, 5, '5 otras tablas', 'etapa17 aplicada',
         case when to_regclass('public.facturas') is not null
               and to_regclass('public.factura_items') is not null
               and to_regclass('public.v_factura_items_saldo') is not null
               and to_regprocedure('public.fn_controlar_cuota()') is not null
              then 'OK' else 'AVISAR' end,
         'facturas, factura_items, vistas de saldo y fn_controlar_cuota'
  union all
  select 5, 6, '5 otras tablas', 'Facturas emitidas', 'INFO',
         (select count(*) from public.facturas)::text || ' factura(s), '
         || (select count(*) from public.factura_items)::text || ' item(s)'
  union all
  select 5, 7, '5 otras tablas', 'Usuarios activos por rol', 'INFO',
         coalesce((select string_agg(rol || ': ' || n, ', ' order by rol)
                     from (select coalesce(rol, '(nulo)') as rol, count(*)::text as n
                             from public.usuarios
                            where activo is distinct from false
                              and rol in ('Admin', 'Directivo', 'Padre')
                            group by 1) x), '(ninguno)')

  -- 6) Storage
  union all
  select 6, 1, '6 storage', 'Bucket pagos',
         case when b.id is null then 'OK'
              when not b.public and b.file_size_limit = 5242880
                   and b.allowed_mime_types @> array['image/jpeg', 'image/png', 'application/pdf']
                   and array['image/jpeg', 'image/png', 'application/pdf'] @> b.allowed_mime_types
              then 'OK' else 'AVISAR' end,
         case when b.id is null then 'No existe (se crea privado, 5 MB, JPG/PNG/PDF)'
              else 'Existe | public: ' || b.public::text
                   || ' | limite: ' || coalesce(b.file_size_limit::text, '(sin limite)')
                   || ' | tipos: ' || coalesce(array_to_string(b.allowed_mime_types, ', '), '(todos)') end
    from (select 1) uno
    left join storage.buckets b on b.id = 'pagos'
  union all
  select 6, 2, '6 storage', 'Otros buckets', 'INFO',
         coalesce((select string_agg(id || case when public then ' (publico)' else ' (privado)' end,
                                     ', ' order by id)
                     from storage.buckets where id <> 'pagos'), '(ninguno)')

  -- 7) Funciones con los nombres nuevos
  union all
  select 7, row_number() over (order by f.nombre), '7 funciones nuevas', f.nombre,
         case when exists (select 1 from pg_proc p
                            join pg_namespace ns on ns.oid = p.pronamespace
                           where ns.nspname = 'public' and p.proname = f.nombre)
              then 'AVISAR' else 'OK' end,
         case when exists (select 1 from pg_proc p
                            join pg_namespace ns on ns.oid = p.pronamespace
                           where ns.nspname = 'public' and p.proname = f.nombre)
              then 'Ya existe una funcion con este nombre' else 'No existe (se crea)' end
    from funciones f

  -- 8) Realtime
  union all
  select 8, 1, '8 realtime', 'Publicacion supabase_realtime',
         case when exists (select 1 from pg_publication where pubname = 'supabase_realtime')
              then 'OK' else 'AVISAR' end,
         'Necesaria para que el padre vea el cambio sin recargar'
  union all
  select 8, 2, '8 realtime', 'Tablas publicadas', 'INFO',
         coalesce((select string_agg(schemaname || '.' || tablename, ', ' order by tablename)
                     from pg_publication_tables where pubname = 'supabase_realtime'),
                  '(ninguna)')
)
select orden, seccion, elemento, resultado, detalle
  from salida
 order by orden, sub;

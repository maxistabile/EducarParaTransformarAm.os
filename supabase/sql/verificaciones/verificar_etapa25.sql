-- ============================================================
-- VERIFICAR ETAPA 25 (SOLO LECTURA)
-- Escritura sobre usuarios despues de etapa25. No modifica nada.
-- Se espera OK en las cuatro filas; la ultima consulta muestra el detalle.
-- Solo ASCII.
-- ============================================================
select 'anon sin escritura en usuarios (tabla)' as control,
       case when not has_table_privilege('anon', 'public.usuarios', 'INSERT')
             and not has_table_privilege('anon', 'public.usuarios', 'UPDATE')
             and not has_table_privilege('anon', 'public.usuarios', 'DELETE')
             and not has_table_privilege('anon', 'public.usuarios', 'TRUNCATE')
            then 'OK' else 'REVISAR' end as estado
union all
select 'anon sin escritura en usuarios (columnas)',
       case when not has_any_column_privilege('anon', 'public.usuarios', 'INSERT')
             and not has_any_column_privilege('anon', 'public.usuarios', 'UPDATE')
            then 'OK' else 'REVISAR' end
union all
select 'authenticated conserva la escritura (limitacion aceptada, sin RLS)',
       case when has_table_privilege('authenticated', 'public.usuarios', 'UPDATE')
            then 'OK' else 'REVISAR: la gestion web necesita UPDATE' end
union all
select 'service_role conserva la escritura',
       case when has_table_privilege('service_role', 'public.usuarios', 'INSERT')
             and has_table_privilege('service_role', 'public.usuarios', 'UPDATE')
             and has_table_privilege('service_role', 'public.usuarios', 'DELETE')
            then 'OK' else 'REVISAR: crear-usuario la necesita' end;

-- Detalle por rol (SELECT no cambia)
select r.rol,
       has_table_privilege(r.rol, 'public.usuarios', 'SELECT') as puede_select,
       has_table_privilege(r.rol, 'public.usuarios', 'INSERT') as puede_insert,
       has_table_privilege(r.rol, 'public.usuarios', 'UPDATE') as puede_update,
       has_table_privilege(r.rol, 'public.usuarios', 'DELETE') as puede_delete
  from (values ('anon'), ('authenticated'), ('service_role')) as r(rol);

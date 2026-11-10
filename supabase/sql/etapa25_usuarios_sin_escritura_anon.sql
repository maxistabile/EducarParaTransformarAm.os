-- ============================================================
-- ETAPA 25 - QUITAR A anon LA ESCRITURA EN usuarios
-- TP Metodologia de Sistemas II (seguimiento de etapa24)
--
-- El inventario de etapa24 mostro que anon (sin sesion) y authenticated
-- tienen INSERT, UPDATE y DELETE sobre usuarios. Ningun flujo sin sesion
-- escribe en usuarios:
--   - sitio publico, login, portal y app: solo LEEN usuarios, y con sesion;
--   - altas y cambios de la gestion web: con sesion (authenticated);
--   - Edge Functions (crear-usuario, pagos, avisos): service_role;
--   - un trigger de Auth, si lo hubiera, no corre como anon.
-- Por eso se retira a anon (y a PUBLIC, de quien anon hereda) INSERT,
-- UPDATE, DELETE y TRUNCATE sobre usuarios, incluidos permisos por
-- columna. No se toca SELECT.
--
-- authenticated y service_role CONSERVAN exactamente lo que tenian: se
-- registra antes de revocar y, si un permiso les llegaba solo por
-- PUBLIC, se les otorga directo. No se amplia nada.
--
-- LIMITACION QUE SIGUE (CLAUDE.md 3.1): sin RLS, cualquier sesion iniciada
-- (authenticated) puede seguir escribiendo usuarios por la API, incluido
-- el rol. Esto no resuelve el aislamiento completo; solo cierra el acceso
-- sin sesion. RLS sigue fuera de alcance.
--
-- Correr en: Supabase -> SQL Editor. Idempotente. Solo ASCII.
-- Despues: la consulta final (o verificaciones/verificar_etapa25.sql).
-- ============================================================

do $$
declare
  v_priv  text;
  v_rol   text;
  v_tenia jsonb := '{}'::jsonb;
  v_col   record;
begin
  if to_regclass('public.usuarios') is null then
    raise exception 'ETAPA25_SIN_TABLA|No existe public.usuarios';
  end if;

  -- 1) Lo que hoy tienen authenticated y service_role (directo o por PUBLIC)
  foreach v_rol in array array['authenticated', 'service_role'] loop
    foreach v_priv in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
      v_tenia := v_tenia || jsonb_build_object(v_rol || ':' || v_priv,
                   has_table_privilege(v_rol, 'public.usuarios', v_priv));
    end loop;
  end loop;

  -- 2) Retirar la escritura a anon y a PUBLIC (tabla)
  revoke insert, update, delete, truncate on table public.usuarios from anon;
  revoke insert, update, delete, truncate on table public.usuarios from public;

  -- 3) Permisos por columna que pudieran quedar (no los quita el revoke de tabla)
  for v_col in
    select distinct grantee, privilege_type, column_name
      from information_schema.column_privileges
     where table_schema = 'public' and table_name = 'usuarios'
       and grantee in ('anon', 'PUBLIC')
       and privilege_type in ('INSERT', 'UPDATE')
  loop
    execute format('revoke %s (%I) on table public.usuarios from %s',
                   v_col.privilege_type, v_col.column_name,
                   case when v_col.grantee = 'PUBLIC' then 'public' else 'anon' end);
  end loop;

  -- 4) authenticated y service_role conservan lo que tenian
  foreach v_rol in array array['authenticated', 'service_role'] loop
    foreach v_priv in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
      if (v_tenia ->> (v_rol || ':' || v_priv))::boolean
         and not has_table_privilege(v_rol, 'public.usuarios', v_priv) then
        execute format('grant %s on table public.usuarios to %I', v_priv, v_rol);
      end if;
    end loop;
  end loop;
end $$;

-- ------------------------------------------------------------
-- Verificacion (tambien en verificaciones/verificar_etapa25.sql)
-- ------------------------------------------------------------
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

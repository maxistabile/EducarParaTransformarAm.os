-- ============================================================
-- ETAPA 24 - RETIRAR fn_completar_usuario (ajuste incremental de etapa23)
-- TP Metodologia de Sistemas II (HU7, HU11, HU20 y acceso de HU41)
--
-- Contexto: etapa23 ya esta APLICADA (con seis funciones). Su unica
-- diferencia con la version final del bloque es fn_completar_usuario:
-- asignaba nombre, apellido y rol desde el navegador a una cuenta recien
-- creada. Ahora eso lo hace la Edge Function crear-usuario, que valida al
-- operador y aplica la jerarquia (Directivo no crea Admin ni Directivo).
-- Dejarla en la base seria una segunda via para asignar roles, asi que se
-- elimina con su firma exacta. Ninguna version de la web la usa: la
-- publicada no la conocia y la nueva ya no la llama.
--
-- Las otras cinco funciones de etapa23, los indices y los datos quedan
-- igual (no se recrea ni se modifica nada mas).
--
-- Correr en: Supabase -> SQL Editor, despues de etapa23 y en cualquier
-- momento antes de integrar la web nueva (secuencia en README, Etapa 24).
-- Idempotente. Solo ASCII. RLS sigue fuera de alcance (CLAUDE.md 3.1).
-- Al final: verificacion y un inventario de SOLO LECTURA de las demas
-- vias que pueden escribir perfiles o roles.
-- ============================================================

do $$
begin
  if to_regprocedure('public.fn_vincular_cuenta_alumno(bigint, uuid)') is null
     or to_regprocedure('public.fn_crear_legajo_alumno(jsonb, uuid, uuid)') is null then
    raise exception 'ETAPA24_REQUIERE_ETAPA23|Primero hay que ejecutar etapa23_vinculos_cuentas.sql';
  end if;
end $$;

-- Retiro explicito, con su firma exacta (no toca otras sobrecargas)
drop function if exists public.fn_completar_usuario(uuid, text, text, text);

-- ------------------------------------------------------------
-- Verificacion
-- ------------------------------------------------------------
select 'fn_completar_usuario retirada' as control,
       case when to_regprocedure('public.fn_completar_usuario(uuid, text, text, text)') is null
                 and not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                  where n.nspname = 'public' and p.proname = 'fn_completar_usuario')
            then 'OK' else 'REVISAR' end as estado
union all
select 'funciones de vinculacion (5)',
       case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname in (
                     'fn_vinc_exigir_gestion', 'fn_vincular_tutor', 'fn_vincular_cuenta_alumno',
                     'fn_vincular_cuenta_docente', 'fn_crear_legajo_alumno')) = 5
       then 'OK' else 'FALTA' end
union all
select 'indices una cuenta por legajo',
       case when to_regclass('public.uq_alumnos_id_usuario') is not null
             and to_regclass('public.uq_docentes_id_usuario') is not null then 'OK' else 'FALTA' end
union all
select 'anon sin permiso de ejecucion',
       case when not has_function_privilege('anon', 'public.fn_vincular_tutor(bigint, uuid, boolean)', 'execute')
             and not has_function_privilege('anon', 'public.fn_vincular_cuenta_alumno(bigint, uuid)', 'execute')
             and not has_function_privilege('anon', 'public.fn_vincular_cuenta_docente(bigint, uuid)', 'execute')
             and not has_function_privilege('anon', 'public.fn_crear_legajo_alumno(jsonb, uuid, uuid)', 'execute')
       then 'OK' else 'REVISAR' end;

-- ------------------------------------------------------------
-- Inventario (SOLO LECTURA): otras vias que pueden escribir perfiles o
-- roles. No se cambia nada: se informa para revisarlo.
-- ------------------------------------------------------------
-- I1. Funciones de public que escriben en usuarios (deberia listar solo
--     funciones conocidas; cualquier otra que asigne rol hay que revisarla)
select p.proname as funcion, pg_get_function_identity_arguments(p.oid) as argumentos,
       p.prosecdef as security_definer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.prosrc ~* '(update|insert\s+into)\s+(public\.)?usuarios'
 order by 1;

-- I2. Triggers sobre usuarios y sobre auth.users (el alta de Auth puede
--     crear el perfil con valores por defecto; crear-usuario lo completa)
select event_object_schema as esquema, event_object_table as tabla,
       trigger_name, action_timing, event_manipulation
  from information_schema.triggers
 where (event_object_schema = 'public' and event_object_table = 'usuarios')
    or (event_object_schema = 'auth' and event_object_table = 'users')
 order by 1, 2, 3;

-- I3. Escritura directa de usuarios por la API. Sin RLS (decision del
--     equipo, CLAUDE.md 3.1), si estos permisos estan en true una sesion
--     puede modificar perfiles y roles salteando la jerarquia: es la
--     limitacion aceptada, no se corrige aca.
select r.rol,
       has_table_privilege(r.rol, 'public.usuarios', 'UPDATE') as puede_update,
       has_table_privilege(r.rol, 'public.usuarios', 'INSERT') as puede_insert,
       has_table_privilege(r.rol, 'public.usuarios', 'DELETE') as puede_delete
  from (values ('anon'), ('authenticated')) as r(rol);

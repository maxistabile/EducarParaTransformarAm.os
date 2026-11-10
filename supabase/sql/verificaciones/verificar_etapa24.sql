-- ============================================================
-- VERIFICAR ETAPA 24 (SOLO LECTURA)
-- Los cuatro controles finales de etapa24_retirar_completar_usuario.sql,
-- para comprobarlos sin volver a ejecutar la migracion (el SQL Editor
-- solo muestra el ultimo resultado de un script). No modifica nada.
-- Se espera OK en las cuatro filas.
-- Solo ASCII.
-- ============================================================
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

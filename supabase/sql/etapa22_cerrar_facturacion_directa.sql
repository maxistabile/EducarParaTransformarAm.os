-- ============================================================
-- ETAPA 22 - TP Metodologia de Sistemas II (Parte 3)
--   Cierra la facturacion directa: solo Admin o Directivo emiten
--   facturas a mano (HU50).
--
-- Requiere: etapa21 (fn_generar_facturas_gestion) y que la web que la
--           usa YA este publicada (PR de HU50 etapa B, HU60 y HU61
--           integrado y desplegado en Vercel). Si se corre antes, el
--           boton "Generar facturas" de la web anterior deja de andar.
-- Correr en: Supabase -> SQL Editor. Idempotente y solo ASCII.
-- No cambia datos: solo permisos. Al final muestra una TABLA.
--
-- Por que: fn_generar_facturas tenia EXECUTE para authenticated, asi
-- que cualquier sesion (incluso un padre) podia emitir facturas por la
-- API. Desde aca solo la ejecutan service_role y las funciones que la
-- envuelven (fn_generar_facturas_gestion, que exige Admin o Directivo,
-- y fn_facturacion_programada, del cron), que son security definer.
-- RLS no cambia (CLAUDE.md 3.1).
-- ============================================================

do $$
begin
  if to_regprocedure('public.fn_generar_facturas_gestion(integer, integer)') is null then
    raise exception 'ETAPA22_REQUIERE_ETAPA21|Primero hay que ejecutar etapa21_avisos_facturacion.sql';
  end if;
end $$;

revoke all on function public.fn_generar_facturas(integer, integer, text) from public, anon, authenticated;
grant execute on function public.fn_generar_facturas(integer, integer, text) to service_role;

-- RESULTADO (solo lectura)
select 'fn_generar_facturas sin acceso de sesiones' as control,
       case when not has_function_privilege('authenticated', 'public.fn_generar_facturas(integer, integer, text)', 'execute')
             and not has_function_privilege('anon', 'public.fn_generar_facturas(integer, integer, text)', 'execute')
             and has_function_privilege('service_role', 'public.fn_generar_facturas(integer, integer, text)', 'execute')
            then 'OK' else 'FALLA' end as resultado,
       'anon y authenticated sin EXECUTE; service_role con EXECUTE' as detalle
union all
select 'Envoltorio de la web disponible',
       case when has_function_privilege('authenticated', 'public.fn_generar_facturas_gestion(integer, integer)', 'execute')
             and (select prosecdef from pg_proc
                   where oid = to_regprocedure('public.fn_generar_facturas_gestion(integer, integer)'))
            then 'OK' else 'FALLA' end,
       'fn_generar_facturas_gestion (Admin o Directivo)'
union all
select 'Facturacion programada sigue pudiendo emitir',
       case when (select prosecdef from pg_proc
                   where oid = to_regprocedure('public.fn_facturacion_programada(date)'))
            then 'OK' else 'FALLA' end,
       'fn_facturacion_programada es security definer';

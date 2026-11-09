-- ============================================================
-- ETAPA 19 - TP Metodologia de Sistemas II (Parte 3)
--   Correccion de HU54: dos envios simultaneos con la misma clave
--
-- Requiere: etapa18 (comprobantes) ya ejecutada. NO hace falta volver
--           a ejecutar etapa18.
-- Correr en: Supabase -> SQL Editor. Idempotente y solo ASCII.
-- No borra ni cambia datos. Al final muestra una TABLA con el
-- resultado. Despues, volver a correr
-- verificaciones/pruebas_etapa18.sql (tiene que seguir dando
-- PRUEBAS_ETAPA18_OK|16 controles).
--
-- Problema (reproducido con dos sesiones reales, bitacora 31 y 34):
--   fn_validar_solicitud lee la clave y despues, en OTRA sentencia,
--   valida los items. Con READ COMMITTED cada sentencia ve su propia
--   instantanea. Si un envio gemelo (misma clave, mismo usuario y misma
--   huella) se confirma entre las dos lecturas, la clave no aparece
--   pero sus items ya figuran En revision: la validacion devolvia
--   PAG_ITEM_NO_DISPONIBLE en vez del comprobante existente, y la app
--   descartaba el intento. No duplicaba datos.
--
-- Correccion minima (solo fn_validar_solicitud):
--   Si la validacion de items da PAG_ITEM_NO_DISPONIBLE, se vuelve a
--   leer la clave UNA vez (nueva instantanea):
--     * misma clave, usuario y huella -> el comprobante existente;
--     * misma clave con otro usuario u otra huella -> PAG_CLAVE_REUSADA;
--     * clave inexistente -> el mismo PAG_ITEM_NO_DISPONIBLE (conflicto
--       real: otra clave reservo el item).
--   No cambian la identidad, la pertenencia, la huella, los bloqueos
--   (la funcion sigue sin bloquear; fn_registrar_comprobante sigue
--   bloqueando factura -> cuotas), los permisos ni RLS.
-- ============================================================


-- ------------------------------------------------------------
-- 0) CONTROL PREVIO: etapa18 tiene que estar ejecutada
-- ------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.fn_validar_solicitud(uuid, uuid, bigint, bigint[], text)') is null
     or to_regprocedure('public.fn_validar_items_pago(bigint, bigint[])') is null
     or to_regclass('public.pago_items') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'pagos'
                       and column_name in ('clave', 'huella')
                     having count(*) = 2) then
    raise exception 'ETAPA19_REQUIERE_ETAPA18|Primero hay que ejecutar etapa18_comprobantes.sql';
  end if;
end $$;


-- ------------------------------------------------------------
-- 1) fn_validar_solicitud con la relectura de la clave
-- ------------------------------------------------------------
-- HU54, antes de tocar Storage: identidad, pertenencia actual de la
-- factura y si la clave ya corresponde a un envio. Solo lee.
--   {estado: 'existente', id_pago, estado_pago, archivo_path}
--   {estado: 'nuevo', id_alumno, total}
create or replace function public.fn_validar_solicitud(
  p_usuario uuid, p_clave uuid, p_id_factura bigint, p_items bigint[], p_huella text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_alumno bigint;
  v_pago   record;
  v_total  numeric(12,2);
begin
  perform public.fn_pago_actor(p_usuario, array['Padre']);

  select f.id_alumno into v_alumno
    from facturas f join alumnos a on a.id_alumno = f.id_alumno
   where f.id_factura = p_id_factura and a.id_usuario_padre = p_usuario;
  if v_alumno is null then
    raise exception 'PAG_FACTURA_AJENA';
  end if;

  if p_clave is null or coalesce(p_huella, '') = '' then
    raise exception 'PAG_SOLICITUD_INVALIDA';
  end if;

  select * into v_pago from pagos where clave = p_clave;
  if not found then
    begin
      v_total := public.fn_validar_items_pago(p_id_factura, p_items);
      return jsonb_build_object('estado', 'nuevo', 'id_alumno', v_alumno, 'total', v_total);
    exception when raise_exception then
      -- Un item "no disponible" puede ser de un envio gemelo con esta
      -- misma clave que se confirmo despues de leer la clave. Se vuelve a
      -- leer la clave una sola vez; si no esta, el conflicto es real y
      -- sale el error original.
      if sqlerrm not like 'PAG_ITEM_NO_DISPONIBLE%' then
        raise;
      end if;
      select * into v_pago from pagos where clave = p_clave;
      if not found then
        raise;
      end if;
    end;
  end if;

  -- La clave ya corresponde a un envio
  if v_pago.id_usuario_registra is distinct from p_usuario
     or v_pago.huella is distinct from p_huella then
    raise exception 'PAG_CLAVE_REUSADA';
  end if;
  return jsonb_build_object('estado', 'existente', 'id_pago', v_pago.id_pago,
                            'estado_pago', v_pago.estado,
                            'archivo_path', v_pago.archivo_path);
end $$;


-- ------------------------------------------------------------
-- 2) PERMISOS (los mismos de etapa18): solo service_role
-- ------------------------------------------------------------
revoke all on function public.fn_validar_solicitud(uuid, uuid, bigint, bigint[], text)
  from public, anon, authenticated;
grant execute on function public.fn_validar_solicitud(uuid, uuid, bigint, bigint[], text)
  to service_role;


-- ------------------------------------------------------------
-- 3) RESULTADO (solo lectura)
-- ------------------------------------------------------------
select 'fn_validar_solicitud con relectura de la clave' as control,
       case when p.prosrc like '%exception when raise_exception%'
             and p.prosrc like '%PAG_ITEM_NO_DISPONIBLE%'
            then 'OK' else 'FALLA' end as resultado,
       'Ante PAG_ITEM_NO_DISPONIBLE vuelve a leer la clave una vez' as detalle
  from pg_proc p
 where p.oid = to_regprocedure('public.fn_validar_solicitud(uuid, uuid, bigint, bigint[], text)')
union all
select 'Security definer y search_path fijo',
       case when p.prosecdef
             and 'search_path=public, pg_temp' = any (p.proconfig)
            then 'OK' else 'FALLA' end,
       coalesce(array_to_string(p.proconfig, '; '), 'sin configuracion')
  from pg_proc p
 where p.oid = to_regprocedure('public.fn_validar_solicitud(uuid, uuid, bigint, bigint[], text)')
union all
select 'Solo service_role ejecuta',
       case when not has_function_privilege('anon', p.oid, 'execute')
             and not has_function_privilege('authenticated', p.oid, 'execute')
             and has_function_privilege('service_role', p.oid, 'execute')
            then 'OK' else 'FALLA' end,
       'anon y authenticated sin EXECUTE; service_role con EXECUTE'
  from pg_proc p
 where p.oid = to_regprocedure('public.fn_validar_solicitud(uuid, uuid, bigint, bigint[], text)')
union all
select 'RLS de pagos sin cambios',
       case when c.relrowsecurity then 'ACTIVO' else 'INACTIVO' end,
       'Se espera INACTIVO (CLAUDE.md 3.1); esta etapa no lo toca'
  from pg_class c
 where c.oid = 'public.pagos'::regclass;

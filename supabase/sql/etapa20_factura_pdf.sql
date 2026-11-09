-- ============================================================
-- ETAPA 20 - TP Metodologia de Sistemas II (Parte 3)
--   RF11.5 (HU50, parte del PDF) y RF13.1 (HU57): datos de la
--   FACTURA para generar su PDF.
--
-- Requiere: etapa17 (facturas e items) y etapa18 (fn_pago_actor).
-- Correr en: Supabase -> SQL Editor. Idempotente y solo ASCII.
-- No borra ni cambia datos: solo crea una funcion de lectura. Al
-- final muestra una TABLA con el resultado. Despues correr
-- verificaciones/pruebas_etapa20.sql.
--
-- Como funciona:
--   * fn_datos_factura devuelve SOLO datos historicos de la factura
--     emitida: los copiados en facturas al emitir (alumno, DNI, curso,
--     periodo, emision, vencimiento, total) y sus items (descripcion,
--     importe, descuento, beca y neto). No lee alumnos ni valores
--     actuales para armar el documento: regenerar el PDF da el mismo
--     contenido.
--   * Acceso: el padre ACTUAL del alumno, o Admin o Directivo
--     (gestion). Docente y Alumno no. Se controla en cada llamada.
--   * No escribe: la factura emitida no se modifica (pdf_path queda
--     como esta). El PDF lo genera la Edge Function "pagos" en una
--     ruta fija del bucket PRIVADO pagos: facturas/<id_factura>.pdf.
--   * Solo la ejecuta service_role (la Edge Function), con
--     search_path fijo. RLS no cambia (CLAUDE.md 3.1).
--   * La programacion automatica (ultimo dia habil, feriados y
--     pg_cron) sigue pendiente: HU50 no queda completa.
-- ============================================================


-- ------------------------------------------------------------
-- 0) CONTROL PREVIO
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.facturas') is null or to_regclass('public.factura_items') is null then
    raise exception 'ETAPA20_REQUIERE_ETAPA17|Primero hay que ejecutar etapa17_facturacion.sql';
  end if;
  if to_regprocedure('public.fn_pago_actor(uuid, text[])') is null then
    raise exception 'ETAPA20_REQUIERE_ETAPA18|Primero hay que ejecutar etapa18_comprobantes.sql';
  end if;
end $$;


-- ------------------------------------------------------------
-- 1) DATOS DE LA FACTURA (solo lectura, solo historicos)
-- ------------------------------------------------------------
create or replace function public.fn_datos_factura(p_usuario uuid, p_id_factura bigint)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare
  v_rol     text;
  v_factura record;
begin
  v_rol := public.fn_pago_actor(p_usuario, array['Admin', 'Directivo', 'Padre']);

  select f.* into v_factura from facturas f where f.id_factura = p_id_factura;
  if not found then
    raise exception 'PAG_FACTURA_NO_EXISTE';
  end if;
  -- Pertenencia ACTUAL: el padre de hoy del alumno de la factura
  if v_rol = 'Padre' and not exists (select 1 from alumnos a
                                      where a.id_alumno = v_factura.id_alumno
                                        and a.id_usuario_padre = p_usuario) then
    raise exception 'PAG_FACTURA_AJENA';
  end if;

  return jsonb_build_object(
    'id_factura', v_factura.id_factura,
    'anio', v_factura.anio,
    'mes', v_factura.mes,
    'alumno', v_factura.alumno_nombre,
    'dni', v_factura.dni,
    'curso', v_factura.curso,
    'fecha_emision', v_factura.fecha_emision,
    'fecha_vencimiento', v_factura.fecha_vencimiento,
    'total', v_factura.total,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'concepto', fi.concepto, 'descripcion', fi.descripcion,
               'importe', fi.importe, 'descuento', fi.descuento,
               'porcentaje_beca', fi.porcentaje_beca, 'neto', fi.neto)
             order by fi.id_item)
        from factura_items fi
       where fi.id_factura = v_factura.id_factura), '[]'::jsonb));
end $$;


-- ------------------------------------------------------------
-- 2) PERMISOS: solo service_role
-- ------------------------------------------------------------
revoke all on function public.fn_datos_factura(uuid, bigint) from public, anon, authenticated;
grant execute on function public.fn_datos_factura(uuid, bigint) to service_role;


-- ------------------------------------------------------------
-- 3) RESULTADO (solo lectura)
-- ------------------------------------------------------------
select 'fn_datos_factura creada' as control,
       case when to_regprocedure('public.fn_datos_factura(uuid, bigint)') is not null
            then 'OK' else 'FALLA' end as resultado,
       'Datos historicos de la factura para su PDF' as detalle
union all
select 'Security definer y search_path fijo',
       case when p.prosecdef and 'search_path=public, pg_temp' = any (p.proconfig)
            then 'OK' else 'FALLA' end,
       coalesce(array_to_string(p.proconfig, '; '), 'sin configuracion')
  from pg_proc p
 where p.oid = to_regprocedure('public.fn_datos_factura(uuid, bigint)')
union all
select 'Solo service_role ejecuta',
       case when not has_function_privilege('anon', p.oid, 'execute')
             and not has_function_privilege('authenticated', p.oid, 'execute')
             and has_function_privilege('service_role', p.oid, 'execute')
            then 'OK' else 'FALLA' end,
       'anon y authenticated sin EXECUTE; service_role con EXECUTE'
  from pg_proc p
 where p.oid = to_regprocedure('public.fn_datos_factura(uuid, bigint)')
union all
select 'RLS de facturas sin cambios',
       case when c.relrowsecurity then 'ACTIVO' else 'INACTIVO' end,
       'Se espera INACTIVO (CLAUDE.md 3.1); esta etapa no lo toca'
  from pg_class c
 where c.oid = 'public.facturas'::regclass;

-- ============================================================
-- PRUEBAS DE LOS DATOS DE LA FACTURA PARA SU PDF (etapa20, HU57)
--
-- Correr en: Supabase -> SQL Editor, DESPUES de etapa20.
-- NO DEJA DATOS: todo corre en un solo bloque que siempre termina
-- con un error, asi la base vuelve atras.
--
-- RESULTADO
--   * Si todo pasa, el error es:
--       PRUEBAS_ETAPA20_OK|<n> controles ...   <- es a proposito
--   * Si algo falla, el error empieza con "FALLA Rn:" o es el error
--     inesperado tal cual. Copiarlo completo y avisar.
--
-- Necesita: 2 alumnos activos, un usuario Padre activo y un usuario
-- Admin o Directivo activo (existentes; no se crean usuarios). Usa el
-- periodo 2099-01 con sus propios valores.
-- ============================================================

do $prueba$
declare
  v_controles int := 0;
  v_alumnos   bigint[];
  a1 bigint; a2 bigint;
  f1 bigint; f2 bigint;
  v_padre uuid;
  v_admin uuid;
  v_otro  uuid;
  v_res   jsonb;
  v_res2  jsonb;
  v_antes jsonb;
begin
  -- ---------- Ayudas (temporales: se deshacen al final) ----------
  create function pg_temp.verificar(p_ok boolean, p_control text, p_detalle text)
  returns void language plpgsql as $f$
  begin
    if not coalesce(p_ok, false) then
      raise exception 'FALLA %: %', p_control, p_detalle;
    end if;
  end $f$;

  create function pg_temp.esperar_error(p_sql text, p_codigo text, p_control text)
  returns void language plpgsql as $f$
  begin
    begin
      execute p_sql;
    exception when raise_exception then
      if sqlerrm like p_codigo || '%' then return; end if;
      raise;
    end;
    raise exception 'FALLA %: se esperaba el error % y la operacion se completo',
      p_control, p_codigo;
  end $f$;

  -- ---------- Datos de prueba ----------
  select id_usuario into v_padre from usuarios
   where rol = 'Padre' and activo is distinct from false order by id_usuario limit 1;
  select id_usuario into v_admin from usuarios
   where rol in ('Admin', 'Directivo') and activo is distinct from false order by id_usuario limit 1;
  select id_usuario into v_otro from usuarios
   where rol not in ('Padre', 'Admin', 'Directivo') and activo is distinct from false
   order by id_usuario limit 1;
  perform pg_temp.verificar(v_padre is not null and v_admin is not null, 'R0',
    'se necesitan un usuario Padre y uno Admin o Directivo activos');

  select array_agg(id_alumno order by id_alumno) into v_alumnos
    from (select id_alumno::bigint as id_alumno from alumnos where activo
           order by id_alumno limit 2) x;
  perform pg_temp.verificar(coalesce(array_length(v_alumnos, 1), 0) = 2, 'R0',
    'se necesitan 2 alumnos activos');
  a1 := v_alumnos[1]; a2 := v_alumnos[2];

  -- a1 es hijo del Padre; a2 no tiene padre (factura ajena)
  update alumnos set id_usuario_padre = v_padre where id_alumno = a1;
  update alumnos set id_usuario_padre = null where id_alumno = a2;

  insert into valores_servicio (concepto, monto, vigente_desde)
  values ('Cuota', 10000, '2099-01-01'), ('Comedor', 5000, '2099-01-01');
  insert into valores_servicio (concepto, id_actividad, monto, vigente_desde)
  select distinct 'Deporte', g.id_actividad, 1000::numeric, date '2099-01-01'
    from inscripciones_deportivas i join grupos_deportivos g on g.id_grupo = i.id_grupo
   where i.activo;
  insert into valores_servicio (concepto, id_recorrido, monto, vigente_desde)
  select distinct 'Recorrido', t.id_recorrido, 1000::numeric, date '2099-01-01'
    from inscripciones_transporte t where t.activo;

  perform public.fn_generar_facturas(2099, 1);
  select id_factura into f1 from facturas where id_alumno = a1 and anio = 2099 and mes = 1;
  select id_factura into f2 from facturas where id_alumno = a2 and anio = 2099 and mes = 1;
  perform pg_temp.verificar(f1 is not null and f2 is not null, 'R0',
    'no se generaron las facturas de prueba');

  -- ---------- R1: el padre actual obtiene los datos de la factura ----------
  v_res := public.fn_datos_factura(v_padre, f1);
  perform pg_temp.verificar(
    (v_res ->> 'id_factura')::bigint = f1
    and (v_res ->> 'total')::numeric = (select total from facturas where id_factura = f1)
    and v_res ->> 'alumno' = (select alumno_nombre from facturas where id_factura = f1)
    and v_res ->> 'fecha_emision' = (select fecha_emision::text from facturas where id_factura = f1)
    and v_res ->> 'fecha_vencimiento' = '2099-01-10'
    and jsonb_array_length(v_res -> 'items')
        = (select count(*) from factura_items where id_factura = f1)
    and (select sum((x ->> 'neto')::numeric) from jsonb_array_elements(v_res -> 'items') x)
        = (v_res ->> 'total')::numeric,
    'R1', v_res::text);
  v_controles := v_controles + 1;

  -- ---------- R2: solo datos historicos ----------
  update alumnos set nombre = 'Cambiado despues' where id_alumno = a1;
  update valores_servicio set monto = monto * 3 where vigente_desde = '2099-01-01';
  v_res2 := public.fn_datos_factura(v_padre, f1);
  perform pg_temp.verificar(v_res = v_res2, 'R2',
    'cambiar el alumno o los valores no tiene que cambiar los datos de la factura');
  v_controles := v_controles + 1;

  -- ---------- R3: Admin o Directivo acceden; otro rol no ----------
  v_res2 := public.fn_datos_factura(v_admin, f2);
  perform pg_temp.verificar((v_res2 ->> 'id_factura')::bigint = f2, 'R3', v_res2::text);
  if v_otro is not null then
    perform pg_temp.esperar_error(format('select public.fn_datos_factura(%L, %s)', v_otro, f1),
      'PAG_SIN_PERMISO', 'R3');
  end if;
  v_controles := v_controles + 1;

  -- ---------- R4: pertenencia actual ----------
  perform pg_temp.esperar_error(format('select public.fn_datos_factura(%L, %s)', v_padre, f2),
    'PAG_FACTURA_AJENA', 'R4');
  update alumnos set id_usuario_padre = null where id_alumno = a1;
  perform pg_temp.esperar_error(format('select public.fn_datos_factura(%L, %s)', v_padre, f1),
    'PAG_FACTURA_AJENA', 'R4');
  update alumnos set id_usuario_padre = v_padre where id_alumno = a1;
  v_controles := v_controles + 1;

  -- ---------- R5: factura inexistente y usuario inexistente ----------
  perform pg_temp.esperar_error(format('select public.fn_datos_factura(%L, %s)', v_admin, -1),
    'PAG_FACTURA_NO_EXISTE', 'R5');
  perform pg_temp.esperar_error(format('select public.fn_datos_factura(%L, %s)',
    gen_random_uuid(), f1), 'PAG_SIN_PERMISO', 'R5');
  v_controles := v_controles + 1;

  -- ---------- R6: no modifica la factura emitida ----------
  select to_jsonb(f) into v_antes from facturas f where f.id_factura = f1;
  perform public.fn_datos_factura(v_padre, f1);
  perform public.fn_datos_factura(v_admin, f1);
  perform pg_temp.verificar(
    (select to_jsonb(f) from facturas f where f.id_factura = f1) = v_antes,
    'R6', 'leer los datos no tiene que cambiar la factura');
  v_controles := v_controles + 1;

  -- ---------- R7: permisos de la funcion ----------
  perform pg_temp.verificar(
    not has_function_privilege('anon', 'public.fn_datos_factura(uuid, bigint)', 'execute')
    and not has_function_privilege('authenticated', 'public.fn_datos_factura(uuid, bigint)', 'execute')
    and has_function_privilege('service_role', 'public.fn_datos_factura(uuid, bigint)', 'execute'),
    'R7', 'permisos distintos de los esperados');
  v_controles := v_controles + 1;

  raise exception 'PRUEBAS_ETAPA20_OK|% controles (R1 a R7%) - a proposito, para deshacer todo',
    v_controles, case when v_otro is null then '; sin usuario de otro rol para R3' else '' end;
end $prueba$;

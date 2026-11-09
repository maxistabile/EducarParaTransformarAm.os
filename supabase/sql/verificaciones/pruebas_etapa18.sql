-- ============================================================
-- PRUEBAS DE LOS COMPROBANTES DE PAGO (etapa18, HU54 a HU56)
--
-- Correr en: Supabase -> SQL Editor, DESPUES de etapa18.
-- NO DEJA DATOS: todo corre en un solo bloque que siempre termina
-- con un error, asi la base vuelve atras (valores, facturas, cuotas,
-- comprobantes, vinculos de prueba y avisos que se generen).
--
-- RESULTADO
--   * Si todo pasa, el error es:
--       PRUEBAS_ETAPA18_OK|<n> controles ...   <- es a proposito
--   * Si algo falla, el error empieza con "FALLA Qn:" o es el error
--     inesperado tal cual. Copiarlo completo y avisar.
--
-- Son pruebas SECUENCIALES (una sola sesion). La concurrencia real
-- (dos sesiones a la vez) se prueba aparte: ver supabase/sql/README.md.
--
-- Necesita: 4 alumnos activos, un usuario Padre activo y un usuario
-- Admin o Directivo activo (existentes; no se crean usuarios). Usa el
-- periodo 2099-01 con sus propios valores. Mientras dura la prueba,
-- asocia 3 alumnos al Padre elegido y le quita el padre al cuarto.
-- Los archivos no se suben: Storage lo maneja la Edge Function.
-- ============================================================

do $prueba$
declare
  v_controles int := 0;
  v_alumnos   bigint[];
  a1 bigint; a2 bigint; a3 bigint; a4 bigint;
  f1 bigint; f2 bigint; f3 bigint; f4 bigint;
  v_padre     uuid;
  v_admin     uuid;
  v_otro      uuid;
  i_cuota     bigint;
  i_comedor   bigint;
  i_cuota2    bigint;
  i_cuota3    bigint;
  i_cuota4    bigint;
  c1          bigint;
  v_res       jsonb;
  v_res2      jsonb;
  p1 integer; p2 integer; p3 integer;
  k1 uuid := gen_random_uuid();
  k2 uuid := gen_random_uuid();
  k3 uuid := gen_random_uuid();
  k4 uuid := gen_random_uuid();
  v_total     numeric;
  v_n         bigint;
  v_txt       text;
  v_neto_c    numeric;
  v_neto_m    numeric;
  v_saldo     numeric;
begin
  -- ---------- Ayudas (temporales: se deshacen al final) ----------
  create function pg_temp.verificar(p_ok boolean, p_control text, p_detalle text)
  returns void language plpgsql as $f$
  begin
    if not coalesce(p_ok, false) then
      raise exception 'FALLA %: %', p_control, p_detalle;
    end if;
  end $f$;

  -- Ejecuta p_sql y exige que falle con un mensaje que empiece con
  -- p_codigo. Cualquier otro error se vuelve a lanzar.
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
  perform pg_temp.verificar(v_padre is not null and v_admin is not null, 'Q0',
    'se necesitan un usuario Padre y uno Admin o Directivo activos');

  select array_agg(id_alumno order by id_alumno) into v_alumnos
    from (select id_alumno::bigint as id_alumno from alumnos where activo
           order by id_alumno limit 4) x;
  perform pg_temp.verificar(coalesce(array_length(v_alumnos, 1), 0) = 4, 'Q0',
    'se necesitan 4 alumnos activos');
  a1 := v_alumnos[1]; a2 := v_alumnos[2]; a3 := v_alumnos[3]; a4 := v_alumnos[4];

  -- a1, a2 y a3 son hijos del Padre; a4 no tiene padre (factura ajena)
  update alumnos set id_usuario_padre = v_padre where id_alumno in (a1, a2, a3);
  update alumnos set id_usuario_padre = null where id_alumno = a4;

  -- a1: sin beca y con comedor; a2: beca del 100 % (cuota Sin cargo)
  update becas set activo = false where id_alumno in (a1, a3, a4);
  insert into becas (id_alumno, porcentaje, activo) values (a2, 100, true)
  on conflict (id_alumno) do update set porcentaje = 100, activo = true;
  if not exists (select 1 from inscripciones_comedor where id_alumno = a1 and activo) then
    insert into inscripciones_comedor (id_alumno) values (a1);
  end if;

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
  select id_factura into f3 from facturas where id_alumno = a3 and anio = 2099 and mes = 1;
  select id_factura into f4 from facturas where id_alumno = a4 and anio = 2099 and mes = 1;
  select id_item, id_cuota, neto into i_cuota, c1, v_neto_c
    from factura_items where id_factura = f1 and concepto = 'Cuota';
  select id_item, neto into i_comedor, v_neto_m
    from factura_items where id_factura = f1 and concepto = 'Comedor';
  select id_item into i_cuota2 from factura_items where id_factura = f2 and concepto = 'Cuota';
  select id_item into i_cuota3 from factura_items where id_factura = f3 and concepto = 'Cuota';
  select id_item into i_cuota4 from factura_items where id_factura = f4 and concepto = 'Cuota';
  select total into v_total from facturas where id_factura = f1;
  perform pg_temp.verificar(i_cuota is not null and i_comedor is not null and v_neto_c > 0,
    'Q0', 'la factura de prueba no tiene Cuota y Comedor con importe');

  -- ---------- Q1: verificacion anticipada de una solicitud nueva ----------
  v_res := public.fn_validar_solicitud(v_padre, k1, f1, array[i_cuota], 'h1');
  perform pg_temp.verificar(v_res ->> 'estado' = 'nuevo' and (v_res ->> 'total')::numeric = v_neto_c,
    'Q1', 'resultado: ' || v_res::text);
  perform pg_temp.verificar(not exists (select 1 from pagos where clave = k1), 'Q1',
    'la verificacion no tiene que escribir');
  v_controles := v_controles + 1;

  -- ---------- Q2: registrar deja En revision y NO acredita ----------
  v_res := public.fn_registrar_comprobante(v_padre, k1, f1, array[i_cuota], 'h1',
             format('comprobantes/%s/%s/a.pdf', f1, k1), 'application/pdf');
  p1 := (v_res ->> 'id_pago')::int;
  perform pg_temp.verificar(v_res ->> 'estado_pago' = 'En revision'
    and (v_res ->> 'ya_existia')::boolean = false
    and (v_res ->> 'total')::numeric = v_neto_c, 'Q2', v_res::text);
  perform pg_temp.verificar((select estado_pago = 'En revision' and saldo = v_neto_c
                               from v_factura_items_saldo where id_item = i_cuota),
    'Q2', 'el item tiene que quedar En revision y con saldo');
  perform pg_temp.verificar((select cobrado = 0 and en_revision = v_neto_c
                               from v_facturas_saldo where id_factura = f1),
    'Q2', 'En revision no cuenta como cobrado');
  perform pg_temp.verificar((select estado from cuotas where id_cuota = c1) <> 'Pagada',
    'Q2', 'cargar no marca la cuota como pagada');
  v_controles := v_controles + 1;

  -- ---------- Q3: reintento con la misma clave y la misma huella ----------
  v_res2 := public.fn_registrar_comprobante(v_padre, k1, f1, array[i_cuota], 'h1',
              format('comprobantes/%s/%s/b.pdf', f1, k1), 'application/pdf');
  perform pg_temp.verificar((v_res2 ->> 'id_pago')::int = p1
    and (v_res2 ->> 'ya_existia')::boolean
    and v_res2 ->> 'archivo_path' = format('comprobantes/%s/%s/a.pdf', f1, k1),
    'Q3', 'el reintento tiene que devolver el mismo comprobante y su archivo: ' || v_res2::text);
  select count(*) into v_n from pagos where clave = k1;
  perform pg_temp.verificar(v_n = 1, 'Q3', 'hay ' || v_n || ' comprobantes con la clave');
  v_res2 := public.fn_validar_solicitud(v_padre, k1, f1, array[i_cuota], 'h1');
  perform pg_temp.verificar(v_res2 ->> 'estado' = 'existente'
    and (v_res2 ->> 'id_pago')::int = p1, 'Q3', v_res2::text);
  v_controles := v_controles + 1;

  -- ---------- Q4: la misma clave con otra solicitud se rechaza ----------
  perform pg_temp.esperar_error(format(
    'select public.fn_registrar_comprobante(%L, %L, %s, array[%s, %s]::bigint[], %L, %L, %L)',
    v_padre, k1, f1, i_cuota, i_comedor, 'h-otra',
    format('comprobantes/%s/%s/c.pdf', f1, k1), 'application/pdf'), 'PAG_CLAVE_REUSADA', 'Q4');
  perform pg_temp.esperar_error(format(
    'select public.fn_validar_solicitud(%L, %L, %s, array[%s]::bigint[], %L)',
    v_padre, k1, f1, i_cuota, 'h-otra'), 'PAG_CLAVE_REUSADA', 'Q4');
  v_controles := v_controles + 1;

  -- ---------- Q5: un item En revision no entra en otro comprobante ----------
  perform pg_temp.esperar_error(format(
    'select public.fn_registrar_comprobante(%L, %L, %s, array[%s]::bigint[], %L, %L, %L)',
    v_padre, k2, f1, i_cuota, 'h2', format('comprobantes/%s/%s/a.pdf', f1, k2),
    'application/pdf'), 'PAG_ITEM_NO_DISPONIBLE', 'Q5');
  v_controles := v_controles + 1;

  -- ---------- Q6: pertenencia y solicitud invalida ----------
  perform pg_temp.esperar_error(format(
    'select public.fn_validar_solicitud(%L, %L, %s, array[%s]::bigint[], %L)',
    v_padre, k2, f4, i_cuota4, 'h2'), 'PAG_FACTURA_AJENA', 'Q6');
  perform pg_temp.esperar_error(format(
    'select public.fn_registrar_comprobante(%L, %L, %s, array[%s]::bigint[], %L, %L, %L)',
    v_padre, k2, f4, i_cuota4, 'h2', format('comprobantes/%s/%s/a.pdf', f4, k2),
    'application/pdf'), 'PAG_FACTURA_AJENA', 'Q6');
  perform pg_temp.esperar_error(format(
    'select public.fn_validar_solicitud(%L, %L, %s, array[%s]::bigint[], %L)',
    v_padre, k2, f1, i_cuota3, 'h2'), 'PAG_ITEM_AJENO', 'Q6');
  perform pg_temp.esperar_error(format(
    'select public.fn_validar_solicitud(%L, %L, %s, array[%s, %s]::bigint[], %L)',
    v_padre, k2, f1, i_comedor, i_comedor, 'h2'), 'PAG_ITEMS_REPETIDOS', 'Q6');
  perform pg_temp.esperar_error(format(
    'select public.fn_validar_solicitud(%L, %L, %s, array[]::bigint[], %L)',
    v_padre, k2, f1, 'h2'), 'PAG_SIN_ITEMS', 'Q6');
  perform pg_temp.esperar_error(format(
    'select public.fn_registrar_comprobante(%L, %L, %s, array[%s]::bigint[], %L, %L, %L)',
    v_padre, k2, f1, i_comedor, 'h2', 'comprobantes/otra/ruta.pdf', 'application/pdf'),
    'PAG_SOLICITUD_INVALIDA', 'Q6');
  perform pg_temp.esperar_error(format(
    'select public.fn_validar_solicitud(%L, %L, %s, array[%s]::bigint[], %L)',
    v_admin, k2, f1, i_comedor, 'h2'), 'PAG_SIN_PERMISO', 'Q6');
  v_controles := v_controles + 1;

  -- ---------- Q7: Sin cargo (beca del 100 %) no se puede pagar ----------
  perform pg_temp.esperar_error(format(
    'select public.fn_validar_solicitud(%L, %L, %s, array[%s]::bigint[], %L)',
    v_padre, k2, f2, i_cuota2, 'h2'), 'PAG_ITEM_NO_DISPONIBLE', 'Q7');
  v_controles := v_controles + 1;

  -- ---------- Q8: Registrar pagos no paga una cuota En revision ----------
  perform pg_temp.esperar_error(format(
    'update cuotas set estado = %L, fecha_pago = current_date, metodo_pago = %L where id_cuota = %s',
    'Pagada', 'Transferencia', c1), 'CUO_EN_REVISION', 'Q8');
  v_controles := v_controles + 1;

  -- ---------- Q9: proteccion (solo funciones; datos inmutables) ----------
  perform pg_temp.esperar_error(format(
    'insert into pagos (id_cuota, monto_pagado) values (null, 1)'), 'PAG_SOLO_FUNCIONES', 'Q9');
  perform pg_temp.esperar_error(format(
    'update pagos set estado = %L where id_pago = %s', 'Aprobado', p1), 'PAG_SOLO_FUNCIONES', 'Q9');
  perform pg_temp.esperar_error(format('delete from pago_items where id_pago = %s', p1),
    'PAG_SOLO_FUNCIONES', 'Q9');
  perform set_config('app.pagos', 'on', true);
  perform pg_temp.esperar_error(format(
    'update pagos set archivo_path = %L where id_pago = %s', 'otro.pdf', p1), 'PAG_INMUTABLE', 'Q9');
  perform pg_temp.esperar_error(format(
    'update pagos set monto_pagado = 1 where id_pago = %s', p1), 'PAG_INMUTABLE', 'Q9');
  perform pg_temp.esperar_error(format(
    'update pago_items set importe = 1 where id_pago = %s', p1), 'PAG_INMUTABLE', 'Q9');
  perform pg_temp.esperar_error(format('delete from pagos where id_pago = %s', p1),
    'PAG_INMUTABLE', 'Q9');
  perform set_config('app.pagos', 'off', true);
  v_controles := v_controles + 1;

  -- ---------- Q10: revisar exige Admin o Directivo y motivo ----------
  perform pg_temp.esperar_error(format(
    'select public.fn_revisar_comprobante(%L, %s, true, null)', v_padre, p1), 'PAG_SIN_PERMISO', 'Q10');
  if v_otro is not null then
    perform pg_temp.esperar_error(format(
      'select public.fn_revisar_comprobante(%L, %s, true, null)', v_otro, p1), 'PAG_SIN_PERMISO', 'Q10');
  end if;
  perform pg_temp.esperar_error(format(
    'select public.fn_revisar_comprobante(%L, %s, false, %L)', v_admin, p1, ' no '), 'PAG_MOTIVO', 'Q10');
  v_controles := v_controles + 1;

  -- ---------- Q11: rechazar libera el item; repetir no cambia nada ----------
  v_res := public.fn_revisar_comprobante(v_admin, p1, false, 'El importe no coincide');
  perform pg_temp.verificar(v_res ->> 'estado_pago' = 'Rechazado', 'Q11', v_res::text);
  perform pg_temp.verificar((select motivo_rechazo = 'El importe no coincide'
                                    and fecha_revision is not null and id_usuario_revisa = v_admin
                               from pagos where id_pago = p1), 'Q11', 'faltan los datos del rechazo');
  perform pg_temp.verificar(not exists (select 1 from pago_items where id_pago = p1 and activo),
    'Q11', 'los items del rechazado tienen que quedar libres');
  perform pg_temp.verificar((select estado_pago = 'Pendiente' and saldo = v_neto_c
                               from v_factura_items_saldo where id_item = i_cuota),
    'Q11', 'el item rechazado vuelve a Pendiente');
  v_res := public.fn_revisar_comprobante(v_admin, p1, false, 'Otro motivo distinto');
  perform pg_temp.verificar((v_res ->> 'ya_revisado')::boolean
    and (select motivo_rechazo from pagos where id_pago = p1) = 'El importe no coincide',
    'Q11', 'repetir el rechazo no tiene que cambiar nada');
  perform pg_temp.esperar_error(format(
    'select public.fn_revisar_comprobante(%L, %s, true, null)', v_admin, p1), 'PAG_YA_REVISADO', 'Q11');
  v_res := public.fn_estado_clave(v_padre, k1);
  perform pg_temp.verificar(v_res ->> 'estado_pago' = 'Rechazado'
    and v_res ->> 'motivo_rechazo' = 'El importe no coincide', 'Q11', v_res::text);
  v_controles := v_controles + 1;

  -- ---------- Q12: aprobar acredita los items y la cuota ----------
  v_res := public.fn_registrar_comprobante(v_padre, k3, f1, array[i_cuota, i_comedor], 'h3',
             format('comprobantes/%s/%s/a.png', f1, k3), 'image/png');
  p3 := (v_res ->> 'id_pago')::int;
  perform pg_temp.verificar((v_res ->> 'total')::numeric = v_neto_c + v_neto_m, 'Q12',
    'el total lo calcula el servidor: ' || v_res::text);
  select saldo into v_saldo from v_facturas_saldo where id_factura = f1;
  v_res := public.fn_revisar_comprobante(v_admin, p3, true, null);
  perform pg_temp.verificar(v_res ->> 'estado_pago' = 'Aprobado', 'Q12', v_res::text);
  perform pg_temp.verificar((select estado = 'Pagada' and metodo_pago = 'Transferencia'
                                    and fecha_pago = (now() at time zone 'America/Argentina/Buenos_Aires')::date
                               from cuotas where id_cuota = c1),
    'Q12', 'la cuota tiene que quedar Pagada con la fecha de aprobacion y Transferencia');
  perform pg_temp.verificar((select bool_and(estado_pago = 'Pagado' and saldo = 0 and id_pago = p3)
                               from v_factura_items_saldo where id_item in (i_cuota, i_comedor)),
    'Q12', 'los items aprobados quedan Pagado y sin saldo');
  perform pg_temp.verificar((select saldo = v_saldo - v_neto_c - v_neto_m
                                    and cobrado = v_neto_c + v_neto_m and en_revision = 0
                                    and total = v_total
                               from v_facturas_saldo where id_factura = f1),
    'Q12', 'saldo, cobrado o total emitido incorrectos');
  v_res := public.fn_revisar_comprobante(v_admin, p3, true, null);
  perform pg_temp.verificar((v_res ->> 'ya_revisado')::boolean, 'Q12', 'aprobar dos veces');
  perform pg_temp.esperar_error(format(
    'select public.fn_revisar_comprobante(%L, %s, false, %L)', v_admin, p3, 'Motivo tardio'),
    'PAG_YA_REVISADO', 'Q12');
  perform pg_temp.esperar_error(format(
    'select public.fn_validar_solicitud(%L, %L, %s, array[%s]::bigint[], %L)',
    v_padre, gen_random_uuid(), f1, i_comedor, 'h9'), 'PAG_ITEM_NO_DISPONIBLE', 'Q12');
  -- Registrar pagos sobre la cuota ya aprobada no cambia su fecha ni metodo
  perform pg_temp.esperar_error(format(
    'update cuotas set estado = %L, fecha_pago = %L, metodo_pago = %L where id_cuota = %s',
    'Pagada', '2099-01-02', 'Transferencia', c1), 'CUO_PAGADA', 'Q12');
  v_controles := v_controles + 1;

  -- ---------- Q13: comprobante PDF solo de aprobados y con datos historicos ----------
  v_res := public.fn_datos_recibo(v_padre, p3);
  perform pg_temp.verificar(jsonb_array_length(v_res -> 'items') = 2
    and (v_res ->> 'total')::numeric = v_neto_c + v_neto_m
    and v_res ->> 'fecha_aprobacion' is not null, 'Q13', v_res::text);
  update alumnos set nombre = 'Cambiado despues' where id_alumno = a1;
  v_res2 := public.fn_datos_recibo(v_padre, p3);
  perform pg_temp.verificar(v_res = v_res2, 'Q13',
    'cambiar el alumno no tiene que cambiar el comprobante de pago');
  perform pg_temp.esperar_error(format('select public.fn_datos_recibo(%L, %s)', v_padre, p1),
    'PAG_SIN_RECIBO', 'Q13');
  perform pg_temp.esperar_error(format('select public.fn_guardar_recibo(%s, %L)', p3, 'recibos/otro.pdf'),
    'PAG_SOLICITUD_INVALIDA', 'Q13');
  perform pg_temp.esperar_error(format('select public.fn_guardar_recibo(%s, %L)', p1,
    format('recibos/%s.pdf', p1)), 'PAG_SIN_RECIBO', 'Q13');
  v_txt := public.fn_guardar_recibo(p3, format('recibos/%s.pdf', p3));
  perform pg_temp.verificar(v_txt = format('recibos/%s.pdf', p3)
    and public.fn_guardar_recibo(p3, format('recibos/%s.pdf', p3)) = v_txt
    and (select recibo_path from pagos where id_pago = p3) = v_txt,
    'Q13', 'el recibo se guarda una sola vez');
  v_controles := v_controles + 1;

  -- ---------- Q14: acceso al archivo y al recibo (pertenencia actual) ----------
  v_res := public.fn_datos_archivo(v_admin, p3);
  perform pg_temp.verificar(v_res ->> 'archivo_path' = format('comprobantes/%s/%s/a.png', f1, k3),
    'Q14', v_res::text);
  if v_otro is not null then
    perform pg_temp.esperar_error(format('select public.fn_datos_archivo(%L, %s)', v_otro, p3),
      'PAG_SIN_PERMISO', 'Q14');
  end if;
  update alumnos set id_usuario_padre = null where id_alumno = a1;
  perform pg_temp.esperar_error(format('select public.fn_datos_archivo(%L, %s)', v_padre, p3),
    'PAG_SIN_PERMISO', 'Q14');
  perform pg_temp.esperar_error(format('select public.fn_datos_recibo(%L, %s)', v_padre, p3),
    'PAG_SIN_PERMISO', 'Q14');
  v_res := public.fn_estado_clave(v_padre, k3);
  perform pg_temp.verificar(not (v_res ->> 'existe')::boolean, 'Q14',
    'un padre que ya no es el actual no consulta la clave');
  update alumnos set id_usuario_padre = v_padre where id_alumno = a1;
  v_controles := v_controles + 1;

  -- ---------- Q15: aprobar si la cuota ya figura pagada por otra via ----------
  v_res := public.fn_registrar_comprobante(v_padre, k4, f3, array[i_cuota3], 'h4',
             format('comprobantes/%s/%s/a.jpg', f3, k4), 'image/jpeg');
  p2 := (v_res ->> 'id_pago')::int;
  perform set_config('app.pagos', 'on', true);  -- simula un pago anterior a etapa18
  update cuotas c set estado = 'Pagada', fecha_pago = current_date, metodo_pago = 'Transferencia'
    from factura_items fi where fi.id_item = i_cuota3 and c.id_cuota = fi.id_cuota;
  perform set_config('app.pagos', 'off', true);
  perform pg_temp.esperar_error(format(
    'select public.fn_revisar_comprobante(%L, %s, true, null)', v_admin, p2), 'PAG_ITEM_YA_PAGADO', 'Q15');
  v_res := public.fn_revisar_comprobante(v_admin, p2, false, 'La cuota ya estaba pagada');
  perform pg_temp.verificar(v_res ->> 'estado_pago' = 'Rechazado', 'Q15', v_res::text);
  v_controles := v_controles + 1;

  -- ---------- Q16: permisos de las funciones y de las tablas ----------
  perform pg_temp.verificar(
    not has_function_privilege('authenticated',
      'public.fn_registrar_comprobante(uuid, uuid, bigint, bigint[], text, text, text)', 'execute')
    and not has_function_privilege('anon',
      'public.fn_revisar_comprobante(uuid, integer, boolean, text)', 'execute')
    and not has_function_privilege('authenticated',
      'public.fn_revisar_comprobante(uuid, integer, boolean, text)', 'execute')
    and has_function_privilege('service_role',
      'public.fn_revisar_comprobante(uuid, integer, boolean, text)', 'execute')
    and not has_table_privilege('authenticated', 'public.pagos', 'insert')
    and has_table_privilege('authenticated', 'public.pagos', 'select'),
    'Q16', 'permisos distintos de los esperados');
  v_controles := v_controles + 1;

  raise exception 'PRUEBAS_ETAPA18_OK|% controles (Q1 a Q16%) - a proposito, para deshacer todo',
    v_controles, case when v_otro is null then '; sin usuario de otro rol para Q10 y Q14' else '' end;
end $prueba$;

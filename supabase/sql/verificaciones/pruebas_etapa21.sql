-- ============================================================
-- PRUEBAS DE FACTURACION PROGRAMADA Y AVISOS (etapa21: HU50 etapa B,
-- HU60 y HU61)
--
-- Correr en: Supabase -> SQL Editor, DESPUES de etapa21.
-- NO DEJA DATOS: todo corre en un solo bloque que siempre termina con
-- un error, asi la base vuelve atras. NO envia correos ni programa
-- tareas: prueba la base (fechas, facturacion, composicion, deuda y el
-- registro de envios). Los correos se prueban con la Edge Function en
-- modo simulacion.
--
-- RESULTADO
--   * Si todo pasa, el error es:
--       PRUEBAS_ETAPA21_OK|<n> controles ...   <- es a proposito
--   * Si algo falla, el error empieza con "FALLA Sn:" o es el error
--     inesperado tal cual. Copiarlo completo y avisar.
--
-- Necesita: 3 alumnos activos, un usuario Padre activo y un usuario
-- Admin o Directivo activo (existentes; no se crean usuarios). Usa los
-- periodos de 2099 y 2100 con sus propios valores. El Padre elegido puede
-- tener otros hijos y puede haber otras familias: los controles calculan
-- lo esperado a partir de los datos (no suponen cuantos hijos hay).
-- ============================================================

do $prueba$
declare
  v_controles int := 0;
  v_alumnos   bigint[];
  a1 bigint; a2 bigint; a3 bigint;
  v_padre uuid;
  v_admin uuid;
  v_res   jsonb;
  v_res2  jsonb;
  v_padre_json jsonb;
  v_fecha date;
  v_dia   date;
  v_n     bigint;
  v_n2    bigint;
  v_antes jsonb;
  v_fac   record;
  v_items bigint[];
  v_pago  integer;
  v_env   bigint;
  v_total numeric;
  v_clave uuid;
  v_clave_txt text;
  v_estado text;
  v_esperado jsonb;
  v_rev_antes numeric;
  v_saldo_item numeric;
  v_obtenido jsonb;
  m       int;
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

  -- Sesion simulada para auth.uid() (como la manda PostgREST)
  create function pg_temp.sesion(p_usuario uuid)
  returns void language plpgsql as $f$
  begin
    perform set_config('request.jwt.claim.sub', coalesce(p_usuario::text, ''), true);
    perform set_config('request.jwt.claims',
      case when p_usuario is null then '' else json_build_object('sub', p_usuario)::text end, true);
  end $f$;

  -- ---------- Datos de prueba ----------
  select id_usuario into v_padre from usuarios
   where rol = 'Padre' and activo is distinct from false order by id_usuario limit 1;
  select id_usuario into v_admin from usuarios
   where rol in ('Admin', 'Directivo') and activo is distinct from false order by id_usuario limit 1;
  perform pg_temp.verificar(v_padre is not null and v_admin is not null, 'S0',
    'se necesitan un usuario Padre y uno Admin o Directivo activos');
  select array_agg(id_alumno order by id_alumno) into v_alumnos
    from (select id_alumno::bigint as id_alumno from alumnos where activo
           order by id_alumno limit 3) x;
  perform pg_temp.verificar(coalesce(array_length(v_alumnos, 1), 0) = 3, 'S0',
    'se necesitan 3 alumnos activos');
  a1 := v_alumnos[1]; a2 := v_alumnos[2]; a3 := v_alumnos[3];

  -- a1 y a2 son hijos del Padre (a2 con beca del 100 %); a3 no tiene padre
  update alumnos set id_usuario_padre = v_padre where id_alumno in (a1, a2);
  update alumnos set id_usuario_padre = null where id_alumno = a3;
  update becas set activo = false where id_alumno in (a1, a3);
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

  -- ---------- S1: dias habiles, fin de semana, feriado y fin de mes ----------
  perform pg_temp.verificar(public.fn_ultimo_dia_habil(2026, 5) = date '2026-05-29', 'S1',
    'mayo 2026: el 31 es domingo, el ultimo habil es el viernes 29');
  perform pg_temp.verificar(not public.fn_es_dia_habil(date '2026-11-23')
    and not public.fn_es_dia_habil(date '2026-11-28')
    and public.fn_es_dia_habil(date '2026-11-30'), 'S1', 'feriado, sabado y lunes habil');
  -- No laborables con fines turisticos de 2026 (Resolucion 164/2025)
  perform pg_temp.verificar(not public.fn_es_dia_habil(date '2026-03-23')
    and not public.fn_es_dia_habil(date '2026-07-10')
    and not public.fn_es_dia_habil(date '2026-12-07'), 'S1', 'no laborables de 2026 (Res. 164/2025)');
  for m in 1..12 loop
    v_dia := public.fn_ultimo_dia_habil(2099, m);
    perform pg_temp.verificar(public.fn_es_dia_habil(v_dia)
      and extract(month from v_dia) = m
      and not exists (select 1 from generate_series(v_dia + 1,
                        (make_date(2099, m, 1) + interval '1 month')::date - 1, interval '1 day') d
                       where public.fn_es_dia_habil(d::date)), 'S1',
      format('ultimo dia habil de %s/2099: %s', m, v_dia));
  end loop;
  -- Un feriado en el ultimo dia habil lo corre hacia atras
  v_dia := public.fn_ultimo_dia_habil(2099, 3);
  insert into feriados (fecha, descripcion, tipo, fuente) values (v_dia, 'Prueba', 'Feriado', 'Prueba');
  perform pg_temp.verificar(public.fn_ultimo_dia_habil(2099, 3) < v_dia, 'S1',
    'un feriado en el ultimo dia habil tiene que correrlo hacia atras');
  v_controles := v_controles + 1;

  -- ---------- S2: facturacion programada solo el ultimo dia habil ----------
  v_fecha := public.fn_ultimo_dia_habil(2099, 1);
  v_res := public.fn_facturacion_programada(v_fecha - 1);
  perform pg_temp.verificar((v_res ->> 'generada')::boolean = false
    and not exists (select 1 from facturas where anio = 2099 and mes = 2), 'S2', v_res::text);
  v_res := public.fn_facturacion_programada(v_fecha);
  select count(*) into v_n from facturas where anio = 2099 and mes = 2;
  perform pg_temp.verificar((v_res ->> 'generada')::boolean and (v_res ->> 'mes')::int = 2
    and v_n > 0 and v_n = (v_res -> 'resumen' ->> 'nuevas')::int
    and not exists (select 1 from facturas where anio = 2099 and mes = 2
                     and (origen <> 'Programada' or fecha_vencimiento <> date '2099-02-10')),
    'S2', v_res::text);
  -- Repetirla no duplica ni cambia lo emitido
  select jsonb_agg(to_jsonb(f) order by id_factura) into v_antes from facturas f where anio = 2099 and mes = 2;
  v_res := public.fn_facturacion_programada(v_fecha);
  perform pg_temp.verificar((v_res -> 'resumen' ->> 'nuevas')::int = 0
    and (select jsonb_agg(to_jsonb(f) order by id_factura) from facturas f where anio = 2099 and mes = 2) = v_antes,
    'S2', 'repetir no tiene que crear ni cambiar facturas: ' || v_res::text);
  v_controles := v_controles + 1;

  -- ---------- S3: cambio de anio ----------
  v_fecha := public.fn_ultimo_dia_habil(2099, 12);
  v_res := public.fn_facturacion_programada(v_fecha);
  perform pg_temp.verificar((v_res ->> 'anio')::int = 2100 and (v_res ->> 'mes')::int = 1
    and exists (select 1 from facturas where anio = 2100 and mes = 1
                 and fecha_vencimiento = date '2100-01-10'), 'S3', v_res::text);
  v_controles := v_controles + 1;

  -- ---------- S4: composicion mensual por hijo (HU60) ----------
  -- El Padre elegido puede tener OTROS hijos ademas de a1 y a2, y hay otras
  -- familias: lo esperado se calcula de las tablas (todas las facturas del
  -- periodo cuyos alumnos tienen hoy a ese padre), con sus conceptos e
  -- importes exactos, y se compara con lo que arma fn_avisos_mensual.
  v_res := public.fn_avisos_mensual(2099, 2);
  select x into v_padre_json from jsonb_array_elements(v_res) x
   where x ->> 'id_usuario_padre' = v_padre::text;
  select jsonb_agg(jsonb_build_object(
           'id_factura', f.id_factura, 'total', f.total,
           'items', (select jsonb_agg(jsonb_build_object('descripcion', fi.descripcion, 'neto', fi.neto)
                                      order by fi.id_item)
                       from factura_items fi where fi.id_factura = f.id_factura))
         order by f.id_factura)
    into v_esperado
    from facturas f join alumnos a on a.id_alumno = f.id_alumno
   where f.anio = 2099 and f.mes = 2 and a.id_usuario_padre = v_padre;
  select jsonb_agg(jsonb_build_object(
           'id_factura', (h ->> 'id_factura')::bigint, 'total', h -> 'total', 'items', h -> 'items')
         order by (h ->> 'id_factura')::bigint)
    into v_obtenido
    from jsonb_array_elements(v_padre_json -> 'hijos') h;
  perform pg_temp.verificar(v_padre_json is not null and v_obtenido = v_esperado, 'S4',
    'las facturas, conceptos e importes del padre no coinciden. Esperado: ' || coalesce(v_esperado::text, 'nada')
    || ' Obtenido: ' || coalesce(v_obtenido::text, 'nada'));
  -- a1 y a2 estan entre esos hijos, y el total es la suma exacta de sus facturas
  perform pg_temp.verificar(
    (select count(*) from jsonb_array_elements(v_esperado) e
      where (e ->> 'id_factura')::bigint in
            (select id_factura from facturas where anio = 2099 and mes = 2 and id_alumno in (a1, a2))) = 2
    and (v_padre_json ->> 'total')::numeric
        = (select sum((e ->> 'total')::numeric) from jsonb_array_elements(v_esperado) e), 'S4',
    'faltan a1 o a2, o el total no es la suma de las facturas del padre: ' || v_padre_json::text);
  -- Ajenos: cada familia lista solo facturas de sus hijos actuales, y a3
  -- (sin padre) no aparece en ninguna
  perform pg_temp.verificar(not exists (
      select 1 from jsonb_array_elements(v_res) x, jsonb_array_elements(x -> 'hijos') h
        join facturas f on f.id_factura = (h ->> 'id_factura')::bigint
        join alumnos al on al.id_alumno = f.id_alumno
       where al.id_usuario_padre is distinct from (x ->> 'id_usuario_padre')::uuid
          or f.id_alumno = a3
          or f.anio <> 2099 or f.mes <> 2), 'S4',
    'una familia incluye una factura que no es de sus hijos o del periodo');
  v_controles := v_controles + 1;

  -- ---------- S5: deuda del dia 20 (HU61) ----------
  -- Antes del vencimiento (10) la factura de febrero no es deuda
  v_res := public.fn_avisos_deuda(date '2099-02-09');
  perform pg_temp.verificar(not exists (select 1 from jsonb_array_elements(v_res) x,
                                          jsonb_array_elements(x -> 'items') i
                                         where i ->> 'factura' in (select 'F-' || lpad(id_factura::text, 6, '0')
                                                                    from facturas where anio = 2099 and mes = 2)),
    'S5', 'antes del vencimiento no hay deuda de ese periodo');
  v_res := public.fn_avisos_deuda(date '2099-02-20');
  select x into v_padre_json from jsonb_array_elements(v_res) x
   where x ->> 'id_usuario_padre' = v_padre::text;
  perform pg_temp.verificar(v_padre_json is not null and (v_padre_json ->> 'total')::numeric > 0
    and not exists (select 1 from jsonb_array_elements(v_padre_json -> 'items') i
                     where (i ->> 'saldo')::numeric <= 0), 'S5',
    'el padre con deuda tiene que figurar, sin renglones sin cargo: ' || coalesce(v_padre_json::text, 'no figura'));

  -- Un comprobante En revision no acredita: el total no baja y lo en
  -- revision sube exactamente el saldo de ese item (comparado con lo que
  -- el padre ya tenia: puede tener otros hijos y otras deudas)
  v_total := (v_padre_json ->> 'total')::numeric;
  v_rev_antes := (v_padre_json ->> 'en_revision')::numeric;
  select f.id_factura, array_agg(v.id_item order by v.id_item) as items into v_fac
    from facturas f join v_factura_items_saldo v on v.id_factura = f.id_factura
   where f.anio = 2099 and f.mes = 2 and f.id_alumno = a1 and v.saldo > 0
   group by f.id_factura;
  select saldo into v_saldo_item from v_factura_items_saldo where id_item = v_fac.items[1];
  v_clave := gen_random_uuid();
  v_res2 := public.fn_registrar_comprobante(v_padre, v_clave, v_fac.id_factura,
              array[v_fac.items[1]], 'h-s5',
              format('comprobantes/%s/%s/a.pdf', v_fac.id_factura, v_clave), 'application/pdf');
  v_res := public.fn_avisos_deuda(date '2099-02-20');
  select x into v_padre_json from jsonb_array_elements(v_res) x
   where x ->> 'id_usuario_padre' = v_padre::text;
  perform pg_temp.verificar((v_padre_json ->> 'total')::numeric = v_total
    and (v_padre_json ->> 'en_revision')::numeric = v_rev_antes + v_saldo_item, 'S5',
    format('el comprobante en revision tiene que seguir como deuda: total %s -> %s, en revision %s -> %s (item %s)',
           v_total, v_padre_json ->> 'total', v_rev_antes, v_padre_json ->> 'en_revision', v_saldo_item));
  -- Al aprobarlo baja la deuda exactamente ese saldo (pago parcial)
  perform public.fn_revisar_comprobante(v_admin, (v_res2 ->> 'id_pago')::int, true, null);
  v_res := public.fn_avisos_deuda(date '2099-02-20');
  select x into v_padre_json from jsonb_array_elements(v_res) x
   where x ->> 'id_usuario_padre' = v_padre::text;
  perform pg_temp.verificar(coalesce((v_padre_json ->> 'total')::numeric, 0) = v_total - v_saldo_item, 'S5',
    format('aprobar tiene que bajar la deuda en %s: %s -> %s', v_saldo_item, v_total, v_padre_json ->> 'total'));
  -- Pagar todo lo pendiente de 2099 de TODOS los hijos actuales del padre
  -- (a1, a2 y los que ya tuviera): no le queda ningun renglon de 2099
  for v_fac in
    select f.id_factura, array_agg(v.id_item order by v.id_item) as items
      from facturas f join v_factura_items_saldo v on v.id_factura = f.id_factura
     where f.id_alumno in (select id_alumno from alumnos where id_usuario_padre = v_padre)
       and f.anio = 2099 and v.saldo > 0 and v.estado_pago = 'Pendiente'
       and f.fecha_vencimiento <= date '2099-02-20'
     group by f.id_factura
  loop
    v_clave := gen_random_uuid();
    v_res2 := public.fn_registrar_comprobante(v_padre, v_clave, v_fac.id_factura, v_fac.items,
                'h-total-' || v_fac.id_factura,
                format('comprobantes/%s/%s/a.pdf', v_fac.id_factura, v_clave), 'application/pdf');
    perform public.fn_revisar_comprobante(v_admin, (v_res2 ->> 'id_pago')::int, true, null);
  end loop;
  v_res := public.fn_avisos_deuda(date '2099-02-20');
  select x into v_padre_json from jsonb_array_elements(v_res) x
   where x ->> 'id_usuario_padre' = v_padre::text
     and exists (select 1 from jsonb_array_elements(x -> 'items') i
                  where i ->> 'factura' in (select 'F-' || lpad(id_factura::text, 6, '0') from facturas
                                             where anio = 2099));
  perform pg_temp.verificar(v_padre_json is null, 'S5',
    'sin deuda de 2099 el padre no tiene que tener renglones de 2099: ' || coalesce(v_padre_json::text, ''));
  v_controles := v_controles + 1;

  -- ---------- S6: registro de envios (reserva, resultado y reintentos) ----------
  v_res := public.fn_aviso_reservar('Mensual', 2099, 2, v_padre, 'padre@prueba.test', '{"a":1}');
  perform pg_temp.verificar((v_res ->> 'reservado')::boolean and v_res ->> 'clave' like '%-1', 'S6', v_res::text);
  v_env := (v_res ->> 'id_envio')::bigint;
  v_res := public.fn_aviso_reservar('Mensual', 2099, 2, v_padre, 'padre@prueba.test', '{"a":1}');
  perform pg_temp.verificar(not (v_res ->> 'reservado')::boolean and v_res ->> 'motivo' = 'en_curso', 'S6', v_res::text);
  perform public.fn_aviso_registrar(v_env, 'Enviado', 'id-proveedor', null);
  v_res := public.fn_aviso_reservar('Mensual', 2099, 2, v_padre, 'padre@prueba.test', '{"a":2}');
  perform pg_temp.verificar(not (v_res ->> 'reservado')::boolean and v_res ->> 'motivo' = 'ya_enviado'
    and (select detalle from avisos_envios where id_envio = v_env) = '{"a":1}', 'S6', v_res::text);
  perform pg_temp.esperar_error(format('select public.fn_aviso_registrar(%s, %L, null, null)', v_env, 'Fallido'),
    'AVI_NO_RESERVADO', 'S6');
  -- Fallido: se reintenta con clave nueva, hasta 3 intentos
  v_res := public.fn_aviso_reservar('Deuda', 2099, 2, v_padre, 'padre@prueba.test', '{"d":1}');
  v_env := (v_res ->> 'id_envio')::bigint;
  perform public.fn_aviso_registrar(v_env, 'Fallido', null, 'rechazado_422');
  v_res := public.fn_aviso_reservar('Deuda', 2099, 2, v_padre, 'padre@prueba.test', '{"d":2}');
  perform pg_temp.verificar((v_res ->> 'reservado')::boolean and v_res ->> 'clave' like '%-2'
    and v_res -> 'detalle' = '{"d":2}', 'S6', v_res::text);
  perform public.fn_aviso_registrar(v_env, 'Fallido', null, 'rechazado_422');
  v_res := public.fn_aviso_reservar('Deuda', 2099, 2, v_padre, 'padre@prueba.test', '{"d":3}');
  perform public.fn_aviso_registrar(v_env, 'Fallido', null, 'rechazado_422');
  v_res := public.fn_aviso_reservar('Deuda', 2099, 2, v_padre, 'padre@prueba.test', '{"d":4}');
  perform pg_temp.verificar(v_res ->> 'motivo' = 'sin_reintentos', 'S6', v_res::text);
  -- Incierto: misma clave y mismo detalle dentro de 23 h; despues, revision manual
  v_res := public.fn_aviso_reservar('Mensual', 2099, 3, v_padre, 'padre@prueba.test', '{"i":1}');
  v_env := (v_res ->> 'id_envio')::bigint;
  perform public.fn_aviso_registrar(v_env, 'Incierto', null, 'sin_respuesta');
  v_res := public.fn_aviso_reservar('Mensual', 2099, 3, v_padre, 'padre@prueba.test', '{"i":2}');
  perform pg_temp.verificar((v_res ->> 'reservado')::boolean and (v_res ->> 'reintento_incierto')::boolean
    and v_res ->> 'clave' like '%-1' and v_res -> 'detalle' = '{"i":1}', 'S6', v_res::text);
  perform public.fn_aviso_registrar(v_env, 'Incierto', null, 'sin_respuesta');
  update avisos_envios set primer_intento = now() - interval '24 hours' where id_envio = v_env;
  v_res := public.fn_aviso_reservar('Mensual', 2099, 3, v_padre, 'padre@prueba.test', '{"i":3}');
  perform pg_temp.verificar(v_res ->> 'motivo' = 'incierto_revisar'
    and (select estado from avisos_envios where id_envio = v_env) = 'Incierto', 'S6', v_res::text);
  v_controles := v_controles + 1;

  -- ---------- S6b: un intento que pudo llegar al proveedor conserva su incertidumbre ----------
  -- Respuesta perdida -> envio deshabilitado (Omitido): queda Incierto, misma clave
  v_res := public.fn_aviso_reservar('Deuda', 2099, 5, v_padre, 'padre@prueba.test', '{"c":1}');
  v_env := (v_res ->> 'id_envio')::bigint;
  v_clave_txt := v_res ->> 'clave';
  perform public.fn_aviso_registrar(v_env, 'Incierto', null, 'sin_respuesta');
  v_res := public.fn_aviso_reservar('Deuda', 2099, 5, v_padre, 'otro@prueba.test', '{"c":2}');
  perform pg_temp.verificar((v_res ->> 'reservado')::boolean and v_res ->> 'clave' = v_clave_txt
    and v_res ->> 'email' = 'padre@prueba.test' and v_res -> 'detalle' = '{"c":1}', 'S6b', v_res::text);
  -- (la llamada y la consulta van en sentencias separadas: cada sentencia ve su instantanea)
  v_estado := public.fn_aviso_registrar(v_env, 'Omitido', null, 'envio_desactivado');
  perform pg_temp.verificar(v_estado = 'Incierto'
    and (select posible_envio and clave = v_clave_txt and motivo like 'posible_envio_previo/%'
           from avisos_envios where id_envio = v_env), 'S6b',
    'un Omitido despues de una respuesta perdida tiene que quedar Incierto: ' || coalesce(v_estado, ''));
  -- ... habilitado otra vez: misma clave, mismo destinatario y mismo contenido
  v_res := public.fn_aviso_reservar('Deuda', 2099, 5, v_padre, 'otro@prueba.test', '{"c":3}');
  perform pg_temp.verificar((v_res ->> 'reservado')::boolean and v_res ->> 'clave' = v_clave_txt
    and v_res ->> 'email' = 'padre@prueba.test' and v_res -> 'detalle' = '{"c":1}', 'S6b', v_res::text);
  -- ... error preparando el PDF (Fallido) o un 429 en el reintento: sigue Incierto, misma clave
  perform pg_temp.verificar(public.fn_aviso_registrar(v_env, 'Fallido', null, 'avi_pdf') = 'Incierto', 'S6b',
    'un error del PDF despues de una respuesta perdida tiene que quedar Incierto');
  v_res := public.fn_aviso_reservar('Deuda', 2099, 5, v_padre, 'otro@prueba.test', '{"c":4}');
  v_estado := public.fn_aviso_registrar(v_env, 'Fallido', null, 'limite_429');
  perform pg_temp.verificar(v_estado = 'Incierto'
    and (select clave from avisos_envios where id_envio = v_env) = v_clave_txt, 'S6b',
    'un 429 en el reintento no descarta el primer envio');
  -- ... y la ventana NO se reinicia: sigue contando desde el primer intento
  perform pg_temp.verificar((select primer_intento from avisos_envios where id_envio = v_env) = now(), 'S6b',
    'primer_intento no tiene que cambiar en los reintentos');
  update avisos_envios set primer_intento = now() - interval '24 hours' where id_envio = v_env;
  v_res := public.fn_aviso_reservar('Deuda', 2099, 5, v_padre, 'otro@prueba.test', '{"c":5}');
  perform pg_temp.verificar(v_res ->> 'motivo' = 'incierto_revisar'
    and (select estado = 'Incierto' and clave = v_clave_txt from avisos_envios where id_envio = v_env), 'S6b',
    'vencida la ventana sin confirmar, queda para revision manual: ' || v_res::text);
  -- Enviando abandonado (pudo haber llamado al proveedor): misma clave y luego Omitido -> Incierto
  v_res := public.fn_aviso_reservar('Deuda', 2099, 6, v_padre, 'padre@prueba.test', '{"e":1}');
  v_env := (v_res ->> 'id_envio')::bigint;
  v_clave_txt := v_res ->> 'clave';
  update avisos_envios set ultimo_intento = now() - interval '20 minutes' where id_envio = v_env;
  v_res := public.fn_aviso_reservar('Deuda', 2099, 6, v_padre, 'otro@prueba.test', '{"e":2}');
  perform pg_temp.verificar((v_res ->> 'reservado')::boolean and v_res ->> 'clave' = v_clave_txt
    and (v_res ->> 'reintento_incierto')::boolean
    and public.fn_aviso_registrar(v_env, 'Omitido', null, 'fuera_de_allowlist') = 'Incierto', 'S6b', v_res::text);
  -- Un fallo inicial SIN contacto previo sigue igual: Omitido y luego clave nueva
  v_res := public.fn_aviso_reservar('Deuda', 2099, 7, v_padre, 'padre@prueba.test', '{"f":1}');
  v_env := (v_res ->> 'id_envio')::bigint;
  perform pg_temp.verificar(public.fn_aviso_registrar(v_env, 'Omitido', null, 'envio_desactivado') = 'Omitido', 'S6b',
    'un Omitido sin contacto previo sigue Omitido');
  v_res := public.fn_aviso_reservar('Deuda', 2099, 7, v_padre, 'padre@prueba.test', '{"f":2}');
  perform pg_temp.verificar(v_res ->> 'clave' like '%-2' and v_res -> 'detalle' = '{"f":2}', 'S6b', v_res::text);
  v_controles := v_controles + 1;

  -- ---------- S7: facturacion manual solo Admin o Directivo ----------
  perform pg_temp.sesion(v_padre);
  perform pg_temp.esperar_error('select public.fn_generar_facturas_gestion(2099, 4)', 'PAG_SIN_PERMISO', 'S7');
  perform pg_temp.sesion(null);
  perform pg_temp.esperar_error('select public.fn_generar_facturas_gestion(2099, 4)', 'PAG_SIN_PERMISO', 'S7');
  perform pg_temp.sesion(v_admin);
  v_res := public.fn_generar_facturas_gestion(2099, 4);
  perform pg_temp.verificar((v_res ->> 'nuevas')::int > 0
    and exists (select 1 from facturas where anio = 2099 and mes = 4 and origen = 'Manual'), 'S7', v_res::text);
  perform pg_temp.sesion(null);
  v_controles := v_controles + 1;

  -- ---------- S8: el PDF usa los mismos datos por las dos vias ----------
  select id_factura into v_n from facturas where anio = 2099 and mes = 2 and id_alumno = a1;
  perform pg_temp.verificar(public.fn_datos_factura(v_padre, v_n) = public.fn_factura_historica(v_n),
    'S8', 'fn_datos_factura y fn_factura_historica tienen que dar lo mismo');
  v_controles := v_controles + 1;

  -- ---------- S9: permisos ----------
  perform pg_temp.verificar(
    not has_function_privilege('authenticated', 'public.fn_facturacion_programada(date)', 'execute')
    and not has_function_privilege('authenticated', 'public.fn_avisos_deuda(date)', 'execute')
    and not has_function_privilege('authenticated', 'public.fn_aviso_reservar(text, integer, integer, uuid, text, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.fn_generar_facturas_gestion(integer, integer)', 'execute')
    and has_function_privilege('authenticated', 'public.fn_generar_facturas_gestion(integer, integer)', 'execute')
    and has_function_privilege('service_role', 'public.fn_avisos_mensual(integer, integer)', 'execute')
    and not has_table_privilege('authenticated', 'public.avisos_envios', 'select'),
    'S9', 'permisos distintos de los esperados');
  v_controles := v_controles + 1;

  raise exception 'PRUEBAS_ETAPA21_OK|% controles (S1 a S9, con S6b) - a proposito, para deshacer todo',
    v_controles;
end $prueba$;

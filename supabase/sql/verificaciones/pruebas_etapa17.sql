-- ============================================================
-- PRUEBAS DE LA FACTURACION (etapa17, HU50 etapa A)
--
-- Correr en: Supabase -> SQL Editor, DESPUES de etapa17.
-- NO DEJA DATOS: todo corre en un solo bloque que siempre termina
-- con un error, asi la base vuelve atras (facturas, cuotas, valores,
-- becas e inscripciones de prueba, y los avisos que generen).
--
-- RESULTADO
--   * Si todo pasa, el error es:
--       PRUEBAS_ETAPA17_OK|<n> controles ...   <- es a proposito
--   * Si algo falla, el error empieza con "FALLA Pn:" o es el error
--     inesperado tal cual. Copiarlo completo y avisar.
--
-- Usa periodos de 2099 y sus propios valores al 01/01/2099:
-- Cuota $10.000, Comedor $5.000 y $1.000 por cada deporte y recorrido
-- en uso. Necesita 4 alumnos activos. Con la base del 08/11 se
-- esperan 12 controles (P12 usa la cuota impaga con Efectivo que
-- mostro el relevamiento).
-- Los errores esperados se capturan solo si son el codigo previsto;
-- cualquier otro error corta la prueba y se muestra.
-- ============================================================

do $prueba$
declare
  v_res        jsonb;
  v_n          bigint;
  v_m          bigint;
  v_controles  int := 0;
  v_activos    bigint;
  v_alumnos    bigint[];
  a1 bigint; a2 bigint; a3 bigint; a4 bigint;
  c1 bigint; c2 bigint; c3 bigint; c4 bigint;
  f1 bigint; f2 bigint; f3 bigint; f4 bigint;
  v_total      numeric;
  v_saldo      numeric;
  v_cobrado    numeric;
  v_estado     text;
  v_foto       text;
  v_foto2      text;
  v_efectivo   bigint;
  v_cuota      record;
  v_item       record;
  v_otros      numeric;
  v_legado     bigint;
  v_p12        text := 'ejecutado';
  v_anio_pasado int := extract(year from now() at time zone 'America/Argentina/Buenos_Aires')::int - 1;
begin
  -- ---------- Ayudas (temporales: se deshacen al final) ----------
  create function pg_temp.verificar(p_ok boolean, p_control text, p_detalle text)
  returns void language plpgsql as $f$
  begin
    if not coalesce(p_ok, false) then
      raise exception 'FALLA %: %', p_control, p_detalle;
    end if;
  end $f$;

  -- Ejecuta p_sql y exige que falle con el codigo p_codigo
  -- ('23503' = clave foranea). Cualquier otro error se vuelve a lanzar.
  create function pg_temp.esperar_error(p_sql text, p_codigo text, p_control text)
  returns void language plpgsql as $f$
  begin
    begin
      execute p_sql;
    exception
      when raise_exception then
        if sqlerrm like p_codigo || '%' then return; end if;
        raise;
      when foreign_key_violation then
        if p_codigo = '23503' then return; end if;
        raise;
    end;
    raise exception 'FALLA %: se esperaba el error % y la operacion se completo',
      p_control, p_codigo;
  end $f$;

  -- ---------- Datos de prueba ----------
  select count(*) into v_activos from alumnos where activo;
  -- Primero los que tienen menos servicios activos (a1 ideal: ninguno)
  select array_agg(id_alumno order by n, id_alumno) into v_alumnos
    from (select al.id_alumno::bigint as id_alumno,
                 (select count(*) from inscripciones_deportivas i
                   where i.id_alumno = al.id_alumno and i.activo)
                 + (select count(*) from inscripciones_transporte t
                     where t.id_alumno = al.id_alumno and t.activo) as n
            from alumnos al where al.activo) x;
  perform pg_temp.verificar(coalesce(array_length(v_alumnos, 1), 0) >= 4, 'P0',
    'se necesitan 4 alumnos activos para la prueba');
  a1 := v_alumnos[1]; a2 := v_alumnos[2]; a3 := v_alumnos[3]; a4 := v_alumnos[4];

  -- Valores propios al 01/01/2099
  insert into valores_servicio (concepto, monto, vigente_desde)
  values ('Cuota', 10000, '2099-01-01'), ('Comedor', 5000, '2099-01-01');
  insert into valores_servicio (concepto, id_actividad, monto, vigente_desde)
  select distinct 'Deporte', g.id_actividad, 1000::numeric, date '2099-01-01'
    from inscripciones_deportivas i join grupos_deportivos g on g.id_grupo = i.id_grupo
   where i.activo;
  insert into valores_servicio (concepto, id_recorrido, monto, vigente_desde)
  select distinct 'Recorrido', t.id_recorrido, 1000::numeric, date '2099-01-01'
    from inscripciones_transporte t where t.activo;

  -- a1: cuota de enero 2099 YA PAGADA antes de emitir + comedor activo
  insert into cuotas (id_alumno, mes, anio, monto_base, recargo, descuento,
                      fecha_vencimiento, estado, fecha_pago, metodo_pago)
  values (a1, 1, 2099, 10000, 0, 0, '2099-01-10', 'Pagada', '2098-12-20', 'Transferencia')
  returning id_cuota into c1;
  if not exists (select 1 from inscripciones_comedor where id_alumno = a1 and activo) then
    insert into inscripciones_comedor (id_alumno) values (a1);
  end if;

  -- a2: beca del 100 %; a3: beca del 50 %; a4: sin beca
  insert into becas (id_alumno, porcentaje, activo) values (a2, 100, true)
  on conflict (id_alumno) do update set porcentaje = 100, activo = true;
  insert into becas (id_alumno, porcentaje, activo) values (a3, 50, true)
  on conflict (id_alumno) do update set porcentaje = 50, activo = true;
  update becas set activo = false where id_alumno in (a1, a4);

  -- a4: comedor dado de baja ANTES del periodo (no se tiene que facturar)
  update inscripciones_comedor set activo = false, fecha_baja = '2098-12-15'
   where id_alumno = a4 and activo;
  if not exists (select 1 from inscripciones_comedor where id_alumno = a4) then
    insert into inscripciones_comedor (id_alumno, fecha_alta, activo, fecha_baja)
    values (a4, '2098-01-01', false, '2098-12-15');
  end if;

  select count(*) into v_efectivo from cuotas where metodo_pago = 'Efectivo';

  -- ---------- P1: una factura por alumno activo ----------
  v_res := public.fn_generar_facturas(2099, 1);
  perform pg_temp.verificar((v_res ->> 'nuevas')::bigint = v_activos, 'P1',
    format('nuevas = %s, alumnos activos = %s', v_res ->> 'nuevas', v_activos));
  perform pg_temp.verificar((v_res ->> 'cuotas_previas')::int = 1, 'P1',
    format('cuotas previas = %s, se esperaba 1', v_res ->> 'cuotas_previas'));
  select count(*), count(distinct id_alumno) into v_n, v_m
    from facturas where anio = 2099 and mes = 1;
  perform pg_temp.verificar(v_n = v_activos and v_m = v_activos, 'P1',
    'hay facturas duplicadas o faltan');
  v_controles := v_controles + 1;

  select id_factura into f1 from facturas where id_alumno = a1 and anio = 2099 and mes = 1;
  select id_factura into f2 from facturas where id_alumno = a2 and anio = 2099 and mes = 1;
  select id_factura into f3 from facturas where id_alumno = a3 and anio = 2099 and mes = 1;
  select id_factura into f4 from facturas where id_alumno = a4 and anio = 2099 and mes = 1;

  -- ---------- P2: total = suma de netos; vence el 10 ----------
  perform pg_temp.verificar(not exists (
      select 1 from facturas f
       where f.anio = 2099 and f.mes = 1
         and (f.total <> (select sum(i.neto) from factura_items i
                           where i.id_factura = f.id_factura)
              or f.fecha_vencimiento <> date '2099-01-10')),
    'P2', 'alguna factura no suma sus items o no vence el 10/01/2099');
  v_controles := v_controles + 1;

  -- ---------- P3: un item Cuota por factura, vinculado a su cuota ----------
  perform pg_temp.verificar(not exists (
      select 1 from facturas f
       where f.anio = 2099 and f.mes = 1
         and (select count(*) from factura_items i
               join cuotas c on c.id_cuota = i.id_cuota
              where i.id_factura = f.id_factura and i.concepto = 'Cuota'
                and c.id_alumno = f.id_alumno and c.anio = 2099 and c.mes = 1) <> 1),
    'P3', 'alguna factura no tiene exactamente un item Cuota vinculado a su cuota');
  perform pg_temp.verificar(not exists (
      select 1 from cuotas c
       where c.anio = 2099 and c.mes = 1 and c.id_cuota <> c1
         and (c.fecha_vencimiento <> date '2099-01-10' or c.recargo <> 0
              or c.estado not in ('Pendiente', 'Pagada'))),
    'P3', 'alguna cuota creada no vence el 10, tiene recargo o un estado inesperado');
  v_controles := v_controles + 1;

  -- ---------- P4: servicios = consulta independiente de inscripciones ----------
  -- Se compara en los dos sentidos: nada de mas y nada de menos.
  with facturados as (
    select f.id_alumno, i.concepto, coalesce(i.id_actividad, 0)::bigint as act,
           coalesce(i.id_recorrido, 0)::bigint as rec
      from factura_items i join facturas f on f.id_factura = i.id_factura
     where f.anio = 2099 and f.mes = 1 and i.concepto <> 'Cuota'),
  con_factura as (
    select id_alumno from facturas where anio = 2099 and mes = 1),
  esperados as (
    select d.id_alumno::bigint as id_alumno, 'Deporte'::text as concepto,
           g.id_actividad::bigint as act, 0::bigint as rec
      from inscripciones_deportivas d
      join grupos_deportivos g on g.id_grupo = d.id_grupo
     where d.id_alumno in (select id_alumno from con_factura)
       and d.fecha_alta < timestamptz '2099-02-01 00:00:00-03'
       and (d.activo or d.fecha_baja >= timestamptz '2099-01-01 00:00:00-03')
    union
    (select distinct on (t.id_alumno) t.id_alumno::bigint, 'Recorrido'::text,
            0::bigint, t.id_recorrido::bigint
       from inscripciones_transporte t
      where t.id_alumno in (select id_alumno from con_factura)
        and t.fecha_alta < timestamptz '2099-02-01 00:00:00-03'
        and (t.activo or t.fecha_baja >= timestamptz '2099-01-01 00:00:00-03')
      order by t.id_alumno, t.fecha_alta desc)
    union
    select c.id_alumno::bigint, 'Comedor'::text, 0::bigint, 0::bigint
      from inscripciones_comedor c
     where c.id_alumno in (select id_alumno from con_factura)
       and c.fecha_alta < timestamptz '2099-02-01 00:00:00-03'
       and (c.activo or c.fecha_baja >= timestamptz '2099-01-01 00:00:00-03'))
  select count(*) into v_n from (
    (select * from facturados except select * from esperados)
    union all
    (select * from esperados except select * from facturados)) dif;
  perform pg_temp.verificar(v_n = 0, 'P4',
    format('%s diferencia(s) entre los items de servicios y las inscripciones', v_n));
  perform pg_temp.verificar(not exists (
      select 1 from factura_items where id_factura = f4 and concepto = 'Comedor'),
    'P4', 'se facturo el comedor dado de baja antes del periodo');
  perform pg_temp.verificar(not exists (
      select 1 from factura_items where descuento <> 0 and concepto <> 'Cuota'
         and id_factura in (select id_factura from facturas where anio = 2099)),
    'P4', 'un servicio tiene descuento: la beca va solo sobre la cuota');
  v_controles := v_controles + 1;

  -- ---------- P5: cuota pagada ANTES de emitir (a1) ----------
  select * into v_item from v_factura_items_saldo
   where id_factura = f1 and concepto = 'Cuota';
  perform pg_temp.verificar(v_item.id_cuota = c1 and v_item.cuota_preexistente
      and v_item.importe = 10000 and v_item.descuento = 0
      and v_item.porcentaje_beca is null and v_item.estado_pago = 'Pagado'
      and v_item.saldo = 0, 'P5',
    'el item Cuota no tomo la cuota pagada tal cual');
  perform pg_temp.verificar(exists (
      select 1 from v_factura_items_saldo where id_factura = f1 and concepto = 'Comedor'
         and neto = 5000 and estado_pago = 'Pendiente' and saldo = 5000),
    'P5', 'falta el comedor de $5.000 pendiente');
  select coalesce(sum(neto), 0) into v_otros from factura_items
   where id_factura = f1 and concepto not in ('Cuota', 'Comedor');
  select total, cobrado, saldo, estado_cobro into v_total, v_cobrado, v_saldo, v_estado
    from v_facturas_saldo where id_factura = f1;
  perform pg_temp.verificar(v_total = 15000 + v_otros and v_cobrado = 10000
      and v_saldo = 5000 + v_otros and v_estado = 'Parcial', 'P5',
    format('total %s, cobrado %s, saldo %s, estado %s (otros servicios %s)',
           v_total, v_cobrado, v_saldo, v_estado, v_otros));
  select * into v_cuota from cuotas where id_cuota = c1;
  perform pg_temp.verificar(v_cuota.estado = 'Pagada' and v_cuota.monto_base = 10000
      and v_cuota.descuento = 0 and v_cuota.fecha_pago = date '2098-12-20'
      and v_cuota.metodo_pago = 'Transferencia' and not v_cuota.cubierta_por_beca,
    'P5', 'la cuota pagada se modifico al emitir');
  v_controles := v_controles + 1;

  -- ---------- P6: pago registrado DESPUES de emitir (a4) ----------
  select id_cuota into c4 from factura_items where id_factura = f4 and concepto = 'Cuota';
  select total, saldo into v_total, v_saldo from v_facturas_saldo where id_factura = f4;
  perform pg_temp.verificar(v_saldo = v_total, 'P6', 'antes del pago el saldo no es el total');
  update cuotas set estado = 'Pagada', fecha_pago = '2099-01-05', metodo_pago = 'Transferencia'
   where id_cuota = c4;
  perform pg_temp.verificar(
      (select saldo from v_facturas_saldo where id_factura = f4) = v_total - 10000
      and (select cobrado from v_facturas_saldo where id_factura = f4) = 10000
      and (select total from facturas where id_factura = f4) = v_total
      and (select estado_pago from v_factura_items_saldo
            where id_factura = f4 and concepto = 'Cuota') = 'Pagado', 'P6',
    'el pago posterior no se reconocio o cambio el total emitido');
  v_controles := v_controles + 1;

  -- ---------- P7: beca del 100 % (a2) ----------
  select c.* into v_cuota from cuotas c
    join factura_items i on i.id_cuota = c.id_cuota
   where i.id_factura = f2 and i.concepto = 'Cuota';
  c2 := v_cuota.id_cuota;
  perform pg_temp.verificar(v_cuota.estado = 'Pagada' and v_cuota.cubierta_por_beca
      and v_cuota.fecha_pago is null and v_cuota.metodo_pago is null
      and v_cuota.monto_base = 10000 and v_cuota.descuento = 10000, 'P7',
    'la cuota con beca del 100 % no quedo Pagada, cubierta por beca y sin fecha ni metodo');
  select * into v_item from v_factura_items_saldo where id_factura = f2 and concepto = 'Cuota';
  perform pg_temp.verificar(v_item.porcentaje_beca = 100 and v_item.neto = 0
      and v_item.estado_pago = 'Sin cargo' and v_item.saldo = 0
      and v_item.cubierta_por_beca and v_item.fecha_pago is null, 'P7',
    'el item con beca del 100 % no figura Sin cargo con neto 0');
  perform pg_temp.verificar(
      (select cobrado from v_facturas_saldo where id_factura = f2) = 0, 'P7',
    'la beca del 100 % se conto como dinero cobrado');
  v_controles := v_controles + 1;

  -- ---------- P8: beca del 50 % (a3); cambiarla despues no altera ----------
  select * into v_item from factura_items where id_factura = f3 and concepto = 'Cuota';
  c3 := v_item.id_cuota;
  perform pg_temp.verificar(v_item.porcentaje_beca = 50 and v_item.descuento = 5000
      and v_item.neto = 5000, 'P8', 'la beca del 50 % no dio $5.000 de descuento');
  update becas set porcentaje = 20 where id_alumno = a3;
  perform pg_temp.verificar(
      (select descuento from factura_items where id_factura = f3 and concepto = 'Cuota') = 5000
      and (select descuento from cuotas where id_cuota = c3) = 5000, 'P8',
    'cambiar la beca altero la factura o la cuota emitida');
  v_controles := v_controles + 1;

  -- ---------- P9: volver a generar y cambiar un valor no alteran nada ----------
  select string_agg(format('%s:%s', id_factura, total), ',' order by id_factura) into v_foto
    from facturas where anio = 2099;
  select v_foto || '|' || string_agg(format('%s:%s:%s', id_item, importe, descuento), ','
                                     order by id_item) into v_foto
    from factura_items where id_factura in (select id_factura from facturas where anio = 2099);
  v_res := public.fn_generar_facturas(2099, 1);
  perform pg_temp.verificar((v_res ->> 'nuevas')::int = 0
      and (v_res ->> 'ya_emitidas')::bigint = v_activos, 'P9',
    format('al repetir: %s', v_res));
  update valores_servicio set monto = 99999
   where concepto in ('Cuota', 'Comedor') and vigente_desde = '2099-01-01';
  v_res := public.fn_generar_facturas(2099, 1);
  select string_agg(format('%s:%s', id_factura, total), ',' order by id_factura) into v_foto2
    from facturas where anio = 2099;
  select v_foto2 || '|' || string_agg(format('%s:%s:%s', id_item, importe, descuento), ','
                                      order by id_item) into v_foto2
    from factura_items where id_factura in (select id_factura from facturas where anio = 2099);
  perform pg_temp.verificar((v_res ->> 'nuevas')::int = 0 and v_foto = v_foto2, 'P9',
    'repetir la generacion o cambiar un valor modifico facturas emitidas');
  update valores_servicio set monto = case concepto when 'Cuota' then 10000 else 5000 end
   where concepto in ('Cuota', 'Comedor') and vigente_desde = '2099-01-01';
  v_controles := v_controles + 1;

  -- ---------- P10: proteccion del vinculo y de lo emitido ----------
  -- Cuota facturada (c3, Pendiente): no cambia identidad ni importes
  perform pg_temp.esperar_error(format('update cuotas set mes = 2 where id_cuota = %s', c3),
    'CUO_FACTURADA', 'P10 mes');
  perform pg_temp.esperar_error(format('update cuotas set anio = 2098 where id_cuota = %s', c3),
    'CUO_FACTURADA', 'P10 anio');
  perform pg_temp.esperar_error(format('update cuotas set id_alumno = %s where id_cuota = %s', a4, c3),
    'CUO_FACTURADA', 'P10 alumno');
  perform pg_temp.esperar_error(format(
    'update cuotas set fecha_vencimiento = %L where id_cuota = %s', '2099-01-20', c3),
    'CUO_FACTURADA', 'P10 vencimiento');
  perform pg_temp.esperar_error(format('update cuotas set monto_base = 1 where id_cuota = %s', c3),
    'CUO_FACTURADA', 'P10 monto');
  perform pg_temp.esperar_error(format('update cuotas set descuento = 0 where id_cuota = %s', c3),
    'CUO_FACTURADA', 'P10 descuento');
  perform pg_temp.esperar_error(format('update cuotas set recargo = 100 where id_cuota = %s', c3),
    'CUO_FACTURADA', 'P10 recargo');
  perform pg_temp.esperar_error(format('delete from cuotas where id_cuota = %s', c3),
    '23503', 'P10 borrar cuota facturada');
  -- Generador anterior (upsert) sobre una cuota facturada pendiente
  perform pg_temp.esperar_error(format(
    'insert into cuotas (id_alumno, mes, anio, monto_base, recargo, descuento, fecha_vencimiento, estado) '
    'values (%s, 1, 2099, 15000, 0, 0, %L, %L) on conflict (id_alumno, mes, anio) do update '
    'set monto_base = excluded.monto_base, descuento = excluded.descuento, estado = excluded.estado',
    a3, '2099-01-10', 'Pendiente'), 'CUO_FACTURADA', 'P10 upsert anterior');
  -- Cuota pagada: no vuelve a pendiente (directo ni con el upsert anterior)
  perform pg_temp.esperar_error(format(
    'update cuotas set estado = %L where id_cuota = %s', 'Pendiente', c1),
    'CUO_PAGADA', 'P10 pagada a pendiente');
  perform pg_temp.esperar_error(format(
    'insert into cuotas (id_alumno, mes, anio, monto_base, recargo, descuento, fecha_vencimiento, estado) '
    'values (%s, 1, 2099, 15000, 0, 0, %L, %L) on conflict (id_alumno, mes, anio) do update '
    'set monto_base = excluded.monto_base, descuento = excluded.descuento, estado = excluded.estado',
    a1, '2099-01-10', 'Pendiente'), 'CUO_PAGADA', 'P10 upsert sobre pagada');
  -- Facturas e items: no se modifican, no se borran, no se crean a mano
  perform pg_temp.esperar_error(format('update facturas set total = total + 1 where id_factura = %s', f3),
    'FAC_EMITIDA', 'P10 total');
  perform pg_temp.esperar_error(format('delete from facturas where id_factura = %s', f3),
    'FAC_EMITIDA', 'P10 borrar factura');
  perform pg_temp.esperar_error(format(
    'update factura_items set importe = 1 where id_factura = %s and concepto = %L', f3, 'Cuota'),
    'FAC_EMITIDA', 'P10 importe item');
  perform pg_temp.esperar_error(format(
    'update factura_items set id_cuota = null where id_factura = %s and concepto = %L', f3, 'Cuota'),
    'FAC_EMITIDA', 'P10 vinculo item');
  perform pg_temp.esperar_error(format('delete from factura_items where id_factura = %s', f3),
    'FAC_EMITIDA', 'P10 borrar item');
  perform pg_temp.esperar_error(format(
    'insert into facturas (id_alumno, anio, mes, alumno_nombre, fecha_emision, fecha_vencimiento, total, origen) '
    'values (%s, 2099, 5, %L, current_date, %L, 1, %L)', a1, 'Prueba', '2099-05-10', 'Manual'),
    'FAC_SOLO_GENERADOR', 'P10 factura a mano');
  perform pg_temp.esperar_error(format(
    'insert into factura_items (id_factura, concepto, descripcion, importe) values (%s, %L, %L, 1)',
    f3, 'Comedor', 'Extra'), 'FAC_SOLO_GENERADOR', 'P10 item a mano');
  -- Solo transferencia para pagos nuevos
  perform pg_temp.esperar_error(format(
    'update cuotas set metodo_pago = %L where id_cuota = %s', 'Efectivo', c4),
    'CUO_METODO', 'P10 efectivo');
  -- Permitidos: procesar vencimientos y registrar el pago (c3)
  update cuotas set estado = 'Vencida' where id_cuota = c3;
  update cuotas set estado = 'Pagada', fecha_pago = '2099-01-15', metodo_pago = 'Transferencia'
   where id_cuota = c3;
  perform pg_temp.verificar(
      (select estado_pago from v_factura_items_saldo where id_factura = f3 and concepto = 'Cuota')
        = 'Pagado', 'P10', 'registrar el pago de una cuota facturada no se reflejo');
  -- Los pagos en efectivo anteriores se conservan
  perform pg_temp.verificar(
      (select count(*) from cuotas where metodo_pago = 'Efectivo') = v_efectivo, 'P10',
    'cambio la cantidad de pagos en efectivo registrados');
  v_controles := v_controles + 1;

  -- ---------- P11: valor faltante y periodos invalidos ----------
  -- Sin valor de Cuota para el periodo: no se emite ninguna factura
  begin
    update valores_servicio set vigente_desde = (vigente_desde + interval '100 years')::date
     where concepto = 'Cuota';
    v_res := public.fn_generar_facturas(2099, 2);
    raise exception 'FALLA P11: se emitieron facturas sin valor de cuota (%)', v_res;
  exception when raise_exception then
    if sqlerrm not like 'FAC_SIN_VALOR|01/02/2099|%Cuota mensual%' then raise; end if;
  end;
  perform pg_temp.verificar(not exists (select 1 from facturas where anio = 2099 and mes = 2)
      and exists (select 1 from valores_servicio where concepto = 'Cuota'
                     and vigente_desde = '2099-01-01'), 'P11',
    'quedaron facturas de febrero 2099 o no se deshizo el cambio de valores');
  perform pg_temp.esperar_error('select public.fn_generar_facturas(2099, 13)',
    'FAC_PERIODO|', 'P11 mes 13');
  perform pg_temp.esperar_error(format('select public.fn_generar_facturas(%s, 1)', v_anio_pasado),
    'FAC_PERIODO_PASADO', 'P11 periodo pasado');
  v_controles := v_controles + 1;

  -- ---------- P12: cuota anterior impaga con metodo Efectivo ----------
  -- En la base real (relevamiento del 08/11) hay una cuota impaga con
  -- metodo 'Efectivo' cargado antes de etapa17. Tiene que poder vencer y
  -- pagarse por transferencia: el trigger solo rechaza un metodo NUEVO.
  select id_cuota into v_legado from cuotas
   where metodo_pago = 'Efectivo' and estado in ('Pendiente', 'Vencida', 'En mora')
   order by id_cuota limit 1;
  if v_legado is null then
    v_p12 := 'omitido: no hay cuotas impagas con Efectivo';
  else
    update cuotas set estado = 'Vencida' where id_cuota = v_legado;
    update cuotas set estado = 'Pagada', fecha_pago = '2099-01-20', metodo_pago = 'Transferencia'
     where id_cuota = v_legado;
    perform pg_temp.verificar(
        (select estado = 'Pagada' and metodo_pago = 'Transferencia'
           from cuotas where id_cuota = v_legado), 'P12',
      'la cuota anterior con Efectivo no pudo vencer o pagarse por transferencia');
    v_controles := v_controles + 1;
  end if;

  -- ---------- Fin: error A PROPOSITO para deshacer todo ----------
  raise exception 'PRUEBAS_ETAPA17_OK|% controles (P1 a P12; P12 %). Alumnos activos: %. Total de enero 2099 del alumno con cuota previa: %. La base vuelve atras: no quedo ningun dato de prueba.',
    v_controles, v_p12, v_activos, (select total from facturas where id_factura = f1);
end
$prueba$;

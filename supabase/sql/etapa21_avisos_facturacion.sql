-- ============================================================
-- ETAPA 21 - TP Metodologia de Sistemas II (Parte 3)
--   RF11.5  Facturacion automatica (HU50, etapa B)
--   RF14.1  Correo del ultimo dia habil con la factura (HU60)
--   RF14.2  Aviso de deuda del dia 20 (HU61)
--   RNF9    Cada envio queda registrado y no se repite
--
-- Requiere: etapa17, etapa18 y etapa20.
-- Correr en: Supabase -> SQL Editor. Idempotente y solo ASCII.
-- No borra ni cambia facturas, cuotas ni pagos. NO programa ninguna
-- tarea: el cron se activa aparte (programar_avisos_cron.sql). Al
-- final muestra una TABLA con el resultado. Despues correr
-- verificaciones/pruebas_etapa21.sql.
--
-- Como funciona:
--   * feriados: calendario mantenible (fecha, descripcion, tipo y
--     fuente). Un dia es habil si no es sabado, domingo ni figura en
--     feriados. fn_ultimo_dia_habil(anio, mes) va hacia atras desde el
--     ultimo dia del mes.
--   * fn_facturacion_programada(fecha): solo si la fecha es el ultimo
--     dia habil de su mes, emite las facturas del mes SIGUIENTE con
--     fn_generar_facturas(..., 'Programada'): mismo generador, una
--     factura por alumno y periodo (no duplica) y vencimiento el 10.
--   * fn_avisos_mensual(anio, mes): por padre, la composicion por hijo
--     de las facturas del periodo (datos historicos) y el total.
--   * fn_avisos_deuda(fecha): por padre, la deuda por item de lo vencido
--     hasta esa fecha. Un comprobante En revision no acredita: sigue en
--     la deuda, marcado. Sin cargo no es deuda. Solo padres con deuda.
--   * avisos_envios: un registro por (tipo, anio, mes, padre). La
--     reserva (fn_aviso_reservar) es atomica: dos ejecuciones a la vez
--     no envian dos veces. Estados: Pendiente, Enviando, Enviado,
--     Fallido (el proveedor rechazo: no se envio), Incierto (respuesta
--     ambigua: puede haberse enviado) y Omitido (no se llamo al
--     proveedor: envio desactivado, fuera de la allowlist o sin correo).
--     Un Incierto solo se reintenta con la MISMA clave de idempotencia
--     y dentro de las 23 horas (el proveedor deduplica 24 h); despues
--     queda para revision manual, sin reenviar a ciegas.
--   * Seguridad: las funciones de avisos solo las ejecuta service_role
--     (la Edge Function "avisos", protegida con un secreto). La
--     facturacion manual de la web pasa a fn_generar_facturas_gestion,
--     que exige Admin o Directivo; fn_generar_facturas deja de estar
--     disponible para cualquier sesion (antes un padre podia llamarla
--     por la API). RLS no cambia (CLAUDE.md 3.1).
-- ============================================================


-- ------------------------------------------------------------
-- 0) CONTROL PREVIO
-- ------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.fn_generar_facturas(integer, integer, text)') is null then
    raise exception 'ETAPA21_REQUIERE_ETAPA17|Primero hay que ejecutar etapa17_facturacion.sql';
  end if;
  if to_regprocedure('public.fn_pago_actor(uuid, text[])') is null then
    raise exception 'ETAPA21_REQUIERE_ETAPA18|Primero hay que ejecutar etapa18_comprobantes.sql';
  end if;
  if to_regprocedure('public.fn_datos_factura(uuid, bigint)') is null then
    raise exception 'ETAPA21_REQUIERE_ETAPA20|Primero hay que ejecutar etapa20_factura_pdf.sql';
  end if;
end $$;


-- ------------------------------------------------------------
-- 1) FERIADOS (calendario mantenible)
-- ------------------------------------------------------------
-- Fuente: Ley 27.399 (feriados nacionales y dias no laborables; art. 6,
-- traslado de los feriados trasladables) y el calendario oficial que
-- publica el Ministerio del Interior en
-- https://www.argentina.gob.ar/interior/feriados-nacionales-<anio>.
-- Para mantenerlo: insertar o borrar filas. Los "dias no laborables con
-- fines turisticos" se fijan por decreto cada anio: cargarlos con tipo
-- 'No laborable' cuando se publiquen (ver el final de esta seccion).
create table if not exists feriados (
  fecha       date primary key,
  descripcion text not null,
  tipo        text not null check (tipo in ('Feriado', 'No laborable')),
  fuente      text not null
);

insert into feriados (fecha, descripcion, tipo, fuente) values
  ('2026-01-01', 'Anio Nuevo', 'Feriado', 'Ley 27.399'),
  ('2026-02-16', 'Carnaval', 'Feriado', 'Ley 27.399'),
  ('2026-02-17', 'Carnaval', 'Feriado', 'Ley 27.399'),
  ('2026-03-24', 'Dia Nacional de la Memoria por la Verdad y la Justicia', 'Feriado', 'Ley 27.399'),
  ('2026-04-02', 'Dia del Veterano y de los Caidos en la Guerra de Malvinas (y Jueves Santo)', 'Feriado', 'Ley 27.399'),
  ('2026-04-03', 'Viernes Santo', 'Feriado', 'Ley 27.399'),
  ('2026-05-01', 'Dia del Trabajador', 'Feriado', 'Ley 27.399'),
  ('2026-05-25', 'Dia de la Revolucion de Mayo', 'Feriado', 'Ley 27.399'),
  ('2026-06-15', 'Paso a la Inmortalidad del Gral. Guemes (trasladado del 17/06)', 'Feriado', 'Ley 27.399, art. 6'),
  ('2026-06-20', 'Paso a la Inmortalidad del Gral. Belgrano', 'Feriado', 'Ley 27.399'),
  ('2026-07-09', 'Dia de la Independencia', 'Feriado', 'Ley 27.399'),
  ('2026-08-17', 'Paso a la Inmortalidad del Gral. San Martin', 'Feriado', 'Ley 27.399, art. 6'),
  ('2026-10-12', 'Dia del Respeto a la Diversidad Cultural', 'Feriado', 'Ley 27.399, art. 6'),
  ('2026-11-23', 'Dia de la Soberania Nacional (trasladado del 20/11)', 'Feriado', 'Ley 27.399, art. 6'),
  ('2026-12-08', 'Inmaculada Concepcion de Maria', 'Feriado', 'Ley 27.399'),
  ('2026-12-25', 'Navidad', 'Feriado', 'Ley 27.399'),
  ('2027-01-01', 'Anio Nuevo', 'Feriado', 'Ley 27.399'),
  ('2027-02-08', 'Carnaval', 'Feriado', 'Ley 27.399'),
  ('2027-02-09', 'Carnaval', 'Feriado', 'Ley 27.399'),
  ('2027-03-24', 'Dia Nacional de la Memoria por la Verdad y la Justicia', 'Feriado', 'Ley 27.399'),
  ('2027-03-25', 'Jueves Santo', 'No laborable', 'Ley 27.399'),
  ('2027-03-26', 'Viernes Santo', 'Feriado', 'Ley 27.399'),
  ('2027-04-02', 'Dia del Veterano y de los Caidos en la Guerra de Malvinas', 'Feriado', 'Ley 27.399'),
  ('2027-05-01', 'Dia del Trabajador', 'Feriado', 'Ley 27.399'),
  ('2027-05-25', 'Dia de la Revolucion de Mayo', 'Feriado', 'Ley 27.399'),
  ('2027-06-20', 'Paso a la Inmortalidad del Gral. Belgrano', 'Feriado', 'Ley 27.399'),
  ('2027-06-21', 'Paso a la Inmortalidad del Gral. Guemes (trasladado del 17/06)', 'Feriado', 'Ley 27.399, art. 6'),
  ('2027-07-09', 'Dia de la Independencia', 'Feriado', 'Ley 27.399'),
  ('2027-08-16', 'Paso a la Inmortalidad del Gral. San Martin (trasladado del 17/08)', 'Feriado', 'Ley 27.399, art. 6'),
  ('2027-10-11', 'Dia del Respeto a la Diversidad Cultural (trasladado del 12/10)', 'Feriado', 'Ley 27.399, art. 6'),
  ('2027-11-20', 'Dia de la Soberania Nacional', 'Feriado', 'Ley 27.399, art. 6'),
  ('2027-12-08', 'Inmaculada Concepcion de Maria', 'Feriado', 'Ley 27.399'),
  ('2027-12-25', 'Navidad', 'Feriado', 'Ley 27.399')
on conflict (fecha) do nothing;
-- Dias no laborables con fines turisticos: se fijan por decreto cada
-- anio. Antes de activar el cron, revisar el calendario oficial y
-- cargarlos, por ejemplo:
--   insert into feriados (fecha, descripcion, tipo, fuente)
--   values ('AAAA-MM-DD', 'Dia no laborable con fines turisticos',
--           'No laborable', 'Decreto <numero>/<anio>')
--   on conflict (fecha) do nothing;


-- ------------------------------------------------------------
-- 2) DIAS HABILES (zona horaria argentina explicita)
-- ------------------------------------------------------------
-- Hoy en Argentina (la base y pg_cron trabajan en UTC).
create or replace function public.fn_hoy_argentina()
returns date language sql stable
set search_path = public, pg_temp as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date
$$;

create or replace function public.fn_es_dia_habil(p_fecha date)
returns boolean language sql stable
set search_path = public, pg_temp as $$
  select extract(isodow from p_fecha) < 6
     and not exists (select 1 from feriados f where f.fecha = p_fecha)
$$;

create or replace function public.fn_ultimo_dia_habil(p_anio integer, p_mes integer)
returns date language plpgsql stable
set search_path = public, pg_temp as $$
declare
  v_dia date;
begin
  if p_anio is null or p_mes is null or p_mes not between 1 and 12 then
    raise exception 'FAC_PERIODO|%|%', p_anio, p_mes;
  end if;
  v_dia := (make_date(p_anio, p_mes, 1) + interval '1 month')::date - 1;
  while not public.fn_es_dia_habil(v_dia) loop
    v_dia := v_dia - 1;
    if extract(month from v_dia) <> p_mes then
      raise exception 'FAC_SIN_DIA_HABIL|%|%', p_anio, p_mes;
    end if;
  end loop;
  return v_dia;
end $$;


-- ------------------------------------------------------------
-- 3) FACTURACION PROGRAMADA (HU50, etapa B)
-- ------------------------------------------------------------
-- Solo el ultimo dia habil del mes de p_fecha emite las facturas del
-- mes siguiente (cambio de anio incluido). Reutiliza fn_generar_facturas:
-- bloqueo por periodo y una factura por alumno y periodo, asi que
-- repetirla o correrla a la vez no duplica nada.
create or replace function public.fn_facturacion_programada(p_fecha date)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_ultimo date;
  v_sig    date;
begin
  if p_fecha is null then
    raise exception 'FAC_PERIODO|sin fecha';
  end if;
  v_ultimo := public.fn_ultimo_dia_habil(extract(year from p_fecha)::int,
                                         extract(month from p_fecha)::int);
  if p_fecha <> v_ultimo then
    return jsonb_build_object('generada', false, 'motivo', 'no_es_ultimo_dia_habil',
                              'ultimo_dia_habil', v_ultimo);
  end if;
  v_sig := (date_trunc('month', p_fecha) + interval '1 month')::date;
  return jsonb_build_object(
    'generada', true,
    'anio', extract(year from v_sig)::int,
    'mes', extract(month from v_sig)::int,
    'resumen', public.fn_generar_facturas(extract(year from v_sig)::int,
                                          extract(month from v_sig)::int, 'Programada'));
end $$;

-- Facturacion manual desde la web: solo Admin o Directivo (la sesion
-- que llama, auth.uid()). Reemplaza la llamada directa a
-- fn_generar_facturas, que deja de estar disponible para authenticated.
create or replace function public.fn_generar_facturas_gestion(p_anio integer, p_mes integer)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  perform public.fn_pago_actor(auth.uid(), array['Admin', 'Directivo']);
  return public.fn_generar_facturas(p_anio, p_mes, 'Manual');
end $$;


-- ------------------------------------------------------------
-- 4) DATOS HISTORICOS DE LA FACTURA (mismo contenido que etapa20)
-- ------------------------------------------------------------
-- fn_factura_historica: el documento de la factura sin controles de
-- usuario, solo para service_role (el PDF que se adjunta en HU60).
-- fn_datos_factura (etapa20) sigue igual para el usuario: controla y
-- despues usa esta misma funcion, asi el PDF es identico por las dos vias.
create or replace function public.fn_factura_historica(p_id_factura bigint)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare
  v_factura record;
begin
  select f.* into v_factura from facturas f where f.id_factura = p_id_factura;
  if not found then
    raise exception 'PAG_FACTURA_NO_EXISTE';
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

create or replace function public.fn_datos_factura(p_usuario uuid, p_id_factura bigint)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare
  v_rol    text;
  v_alumno bigint;
begin
  v_rol := public.fn_pago_actor(p_usuario, array['Admin', 'Directivo', 'Padre']);
  select f.id_alumno into v_alumno from facturas f where f.id_factura = p_id_factura;
  if not found then
    raise exception 'PAG_FACTURA_NO_EXISTE';
  end if;
  if v_rol = 'Padre' and not exists (select 1 from alumnos a
                                      where a.id_alumno = v_alumno
                                        and a.id_usuario_padre = p_usuario) then
    raise exception 'PAG_FACTURA_AJENA';
  end if;
  return public.fn_factura_historica(p_id_factura);
end $$;


-- ------------------------------------------------------------
-- 5) DESTINATARIOS Y COMPOSICION
-- ------------------------------------------------------------
-- Padre activo con al menos un hijo con factura en el periodo. La
-- composicion sale de la factura emitida (datos historicos). El correo
-- puede venir vacio: la Edge Function lo registra como Omitido.
create or replace function public.fn_avisos_mensual(p_anio integer, p_mes integer)
returns jsonb language sql stable security definer
set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(p order by p ->> 'id_usuario_padre'), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'id_usuario_padre', u.id_usuario,
               'email', u.email,
               'nombre', trim(coalesce(u.nombre, '') || ' ' || coalesce(u.apellido, '')),
               'anio', p_anio, 'mes', p_mes,
               'total', sum(f.total),
               'hijos', jsonb_agg(jsonb_build_object(
                          'id_factura', f.id_factura,
                          'alumno', f.alumno_nombre,
                          'vencimiento', f.fecha_vencimiento,
                          'total', f.total,
                          'items', (select coalesce(jsonb_agg(jsonb_build_object(
                                                        'descripcion', fi.descripcion, 'neto', fi.neto)
                                                      order by fi.id_item), '[]'::jsonb)
                                      from factura_items fi where fi.id_factura = f.id_factura))
                        order by f.alumno_nombre, f.id_factura)) as p
        from facturas f
        join alumnos a  on a.id_alumno = f.id_alumno
        join usuarios u on u.id_usuario = a.id_usuario_padre
       where f.anio = p_anio and f.mes = p_mes
         and u.rol = 'Padre' and u.activo is distinct from false
       group by u.id_usuario, u.email, u.nombre, u.apellido
    ) x
$$;

-- Deuda al p_fecha: items con saldo de facturas vencidas hasta esa fecha
-- (Pendiente o En revision: En revision no acredita) y cuotas
-- heredadas sin factura, impagas y con importe, vencidas. Sin cargo
-- (neto 0) no es deuda. Solo padres con deuda.
create or replace function public.fn_avisos_deuda(p_fecha date)
returns jsonb language sql stable security definer
set search_path = public, pg_temp as $$
  with renglones as (
    select a.id_usuario_padre as padre, a.id_alumno,
           f.alumno_nombre as alumno, v.anio, v.mes, v.descripcion,
           v.saldo, (v.estado_pago = 'En revision') as en_revision,
           'F-' || lpad(v.id_factura::text, 6, '0') as factura
      from v_factura_items_saldo v
      join facturas f on f.id_factura = v.id_factura
      join alumnos a  on a.id_alumno = v.id_alumno
     where v.saldo > 0 and v.estado_pago in ('Pendiente', 'En revision')
       and f.fecha_vencimiento <= p_fecha
    union all
    select a.id_usuario_padre, a.id_alumno,
           a.apellido || ', ' || a.nombre, c.anio, c.mes, 'Cuota mensual',
           c.monto_base + coalesce(c.recargo, 0) - coalesce(c.descuento, 0), false, null
      from cuotas c
      join alumnos a on a.id_alumno = c.id_alumno
     where c.estado in ('Pendiente', 'Vencida', 'En mora')
       and c.monto_base + coalesce(c.recargo, 0) - coalesce(c.descuento, 0) > 0
       and coalesce(c.fecha_vencimiento, make_date(c.anio, c.mes, 10)) <= p_fecha
       and not exists (select 1 from factura_items fi where fi.id_cuota = c.id_cuota)
  )
  select coalesce(jsonb_agg(p order by p ->> 'id_usuario_padre'), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'id_usuario_padre', u.id_usuario,
               'email', u.email,
               'nombre', trim(coalesce(u.nombre, '') || ' ' || coalesce(u.apellido, '')),
               'total', sum(r.saldo),
               'en_revision', coalesce(sum(r.saldo) filter (where r.en_revision), 0),
               'items', jsonb_agg(jsonb_build_object(
                          'alumno', r.alumno, 'anio', r.anio, 'mes', r.mes,
                          'descripcion', r.descripcion, 'saldo', r.saldo,
                          'en_revision', r.en_revision, 'factura', r.factura)
                        order by r.alumno, r.anio, r.mes, r.descripcion)) as p
        from renglones r
        join usuarios u on u.id_usuario = r.padre
       where u.rol = 'Padre' and u.activo is distinct from false
       group by u.id_usuario, u.email, u.nombre, u.apellido
      having sum(r.saldo) > 0
    ) x
$$;


-- ------------------------------------------------------------
-- 6) REGISTRO DE ENVIOS (RNF9) Y RESERVA ATOMICA
-- ------------------------------------------------------------
create table if not exists avisos_envios (
  id_envio         bigint generated always as identity primary key,
  tipo             text    not null check (tipo in ('Mensual', 'Deuda')),
  anio             integer not null check (anio between 2020 and 2100),
  mes              integer not null check (mes between 1 and 12),
  id_usuario_padre uuid    not null references usuarios(id_usuario),
  email            text,
  estado           text    not null check (estado in
                     ('Pendiente', 'Enviando', 'Enviado', 'Fallido', 'Incierto', 'Omitido')),
  intentos         integer not null default 0,
  clave            text    not null,
  detalle          jsonb   not null,
  id_proveedor     text,
  motivo           text,
  primer_intento   timestamptz,
  ultimo_intento   timestamptz,
  enviado_en       timestamptz,
  creado           timestamptz not null default now(),
  constraint uq_aviso_padre_periodo unique (tipo, anio, mes, id_usuario_padre)
);

-- Reserva un envio para este intento. Solo una ejecucion lo obtiene,
-- aunque corran varias a la vez (fila bloqueada FOR UPDATE).
--   reservado=false: ya_enviado | en_curso | incierto_revisar | sin_reintentos
--   reservado=true:  clave (Idempotency-Key), email y detalle a enviar.
-- Un Incierto (o un Enviando abandonado) se reintenta con la MISMA clave
-- y el MISMO detalle, dentro de las 23 h del primer intento; despues
-- queda Incierto para revision manual. Fallido, Omitido y Pendiente no
-- llegaron al proveedor: se reintentan con una clave nueva y los datos
-- actuales (Fallido, hasta 3 intentos).
create or replace function public.fn_aviso_reservar(
  p_tipo text, p_anio integer, p_mes integer, p_padre uuid, p_email text, p_detalle jsonb)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v record;
  v_base text := format('aviso-%s-%s-%s-%s', lower(p_tipo), p_anio, lpad(p_mes::text, 2, '0'), p_padre);
begin
  insert into avisos_envios (tipo, anio, mes, id_usuario_padre, email, estado, clave, detalle)
  values (p_tipo, p_anio, p_mes, p_padre, p_email, 'Pendiente', v_base || '-1', p_detalle)
  on conflict (tipo, anio, mes, id_usuario_padre) do nothing;

  select * into v from avisos_envios
   where tipo = p_tipo and anio = p_anio and mes = p_mes and id_usuario_padre = p_padre
     for update;

  if v.estado = 'Enviado' then
    return jsonb_build_object('reservado', false, 'motivo', 'ya_enviado', 'id_envio', v.id_envio);
  end if;
  if v.estado = 'Enviando' and v.ultimo_intento > now() - interval '15 minutes' then
    return jsonb_build_object('reservado', false, 'motivo', 'en_curso', 'id_envio', v.id_envio);
  end if;

  if v.estado in ('Incierto', 'Enviando') then
    if v.primer_intento is null or v.primer_intento < now() - interval '23 hours' then
      update avisos_envios set estado = 'Incierto', motivo = coalesce(motivo, 'sin_confirmacion')
       where id_envio = v.id_envio;
      return jsonb_build_object('reservado', false, 'motivo', 'incierto_revisar', 'id_envio', v.id_envio);
    end if;
    -- Reintento seguro: misma clave y mismo detalle (el proveedor deduplica)
    update avisos_envios
       set estado = 'Enviando', intentos = intentos + 1, ultimo_intento = now()
     where id_envio = v.id_envio;
    return jsonb_build_object('reservado', true, 'id_envio', v.id_envio, 'clave', v.clave,
                              'email', v.email, 'detalle', v.detalle, 'reintento_incierto', true);
  end if;

  if v.estado = 'Fallido' and v.intentos >= 3 then
    return jsonb_build_object('reservado', false, 'motivo', 'sin_reintentos', 'id_envio', v.id_envio);
  end if;

  -- Pendiente, Omitido o Fallido: no llego al proveedor; datos actuales y clave nueva
  update avisos_envios
     set estado = 'Enviando', intentos = intentos + 1,
         clave = v_base || '-' || (intentos + 1),
         email = p_email, detalle = p_detalle, motivo = null,
         primer_intento = now(), ultimo_intento = now()
   where id_envio = v.id_envio
  returning * into v;
  return jsonb_build_object('reservado', true, 'id_envio', v.id_envio, 'clave', v.clave,
                            'email', v.email, 'detalle', v.detalle, 'reintento_incierto', false);
end $$;

-- Resultado de un intento reservado (solo desde Enviando).
create or replace function public.fn_aviso_registrar(
  p_id_envio bigint, p_estado text, p_id_proveedor text, p_motivo text)
returns text language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_estado text;
begin
  if p_estado not in ('Enviado', 'Fallido', 'Incierto', 'Omitido') then
    raise exception 'AVI_ESTADO|%', p_estado;
  end if;
  update avisos_envios
     set estado = p_estado,
         id_proveedor = coalesce(p_id_proveedor, id_proveedor),
         motivo = p_motivo,
         enviado_en = case when p_estado = 'Enviado' then now() else enviado_en end
   where id_envio = p_id_envio and estado = 'Enviando'
  returning estado into v_estado;
  if v_estado is null then
    raise exception 'AVI_NO_RESERVADO|%', p_id_envio;
  end if;
  return v_estado;
end $$;


-- ------------------------------------------------------------
-- 7) PERMISOS
-- ------------------------------------------------------------
--   * Avisos, facturacion programada y datos internos: solo
--     service_role (la Edge Function "avisos").
--   * fn_generar_facturas: ya no la ejecuta authenticated (una sesion
--     comun podia emitir facturas por la API). La web usa
--     fn_generar_facturas_gestion, que exige Admin o Directivo.
--   * feriados y avisos_envios: sin acceso para anon ni authenticated
--     (avisos_envios guarda correos).
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.fn_hoy_argentina()',
    'public.fn_es_dia_habil(date)',
    'public.fn_ultimo_dia_habil(integer, integer)',
    'public.fn_facturacion_programada(date)',
    'public.fn_factura_historica(bigint)',
    'public.fn_datos_factura(uuid, bigint)',
    'public.fn_avisos_mensual(integer, integer)',
    'public.fn_avisos_deuda(date)',
    'public.fn_aviso_reservar(text, integer, integer, uuid, text, jsonb)',
    'public.fn_aviso_registrar(bigint, text, text, text)',
    'public.fn_generar_facturas(integer, integer, text)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

revoke all on function public.fn_generar_facturas_gestion(integer, integer) from public, anon;
grant execute on function public.fn_generar_facturas_gestion(integer, integer) to authenticated, service_role;

revoke all on table feriados, avisos_envios from anon, authenticated;
grant all on table feriados, avisos_envios to service_role;


-- ------------------------------------------------------------
-- 8) RESULTADO (solo lectura)
-- ------------------------------------------------------------
select 'Calendario de feriados' as control,
       case when (select count(*) from feriados where fecha between '2026-01-01' and '2027-12-31') >= 30
            then 'OK' else 'FALLA' end as resultado,
       (select count(*) from feriados)::text || ' fechas cargadas (2026 y 2027); revisar los no laborables por decreto' as detalle
union all
select 'Ultimo dia habil (ejemplos)',
       case when public.fn_ultimo_dia_habil(2026, 5) = date '2026-05-29'
             and public.fn_ultimo_dia_habil(2026, 11) = date '2026-11-30'
            then 'OK' else 'FALLA' end,
       'mayo 2026 -> 29/05 (31 es domingo); noviembre 2026 -> 30/11'
union all
select 'Tabla avisos_envios',
       case when to_regclass('public.avisos_envios') is not null
             and to_regclass('public.uq_aviso_padre_periodo') is not null
            then 'OK' else 'FALLA' end,
       'Un registro por tipo, periodo y padre'
union all
select 'Funciones de avisos: solo service_role',
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')
                          and not has_function_privilege('authenticated', p.oid, 'execute')
                          and has_function_privilege('service_role', p.oid, 'execute'))
            then 'OK' else 'FALLA' end,
       'anon y authenticated sin EXECUTE (incluye fn_generar_facturas)'
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public'
   and p.proname in ('fn_facturacion_programada', 'fn_factura_historica', 'fn_avisos_mensual',
                     'fn_avisos_deuda', 'fn_aviso_reservar', 'fn_aviso_registrar',
                     'fn_generar_facturas', 'fn_datos_factura')
union all
select 'Facturacion manual solo con rol',
       case when has_function_privilege('authenticated',
                   'public.fn_generar_facturas_gestion(integer, integer)', 'execute')
             and (select prosecdef from pg_proc
                   where oid = to_regprocedure('public.fn_generar_facturas_gestion(integer, integer)'))
            then 'OK' else 'FALLA' end,
       'fn_generar_facturas_gestion exige Admin o Directivo'
union all
select 'Tablas sin acceso publico',
       case when not has_table_privilege('authenticated', 'public.avisos_envios', 'select')
             and not has_table_privilege('anon', 'public.avisos_envios', 'select')
            then 'OK' else 'FALLA' end,
       'avisos_envios guarda correos: solo service_role'
union all
select 'Cron NO programado por esta etapa',
       'INFO',
       'Se activa aparte con programar_avisos_cron.sql'
union all
select 'RLS sin cambios',
       case when c.relrowsecurity then 'ACTIVO' else 'INACTIVO' end,
       'Se espera INACTIVO (CLAUDE.md 3.1); esta etapa no lo toca'
  from pg_class c
 where c.oid = 'public.facturas'::regclass;

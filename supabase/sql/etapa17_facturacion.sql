-- ============================================================
-- ETAPA 17 - TP Metodologia de Sistemas II (Parte 3)
--   RF11.5  Factura mensual por alumno (HU50) - ETAPA A, PARCIAL
--
-- Requiere: etapa4 (becas), etapa6 (cuotas), etapa14 (inscripciones)
--           y etapa16 (valores_servicio).
-- ANTES: correr verificaciones/relevamiento_cuotas.sql y contrastarlo
--        con lo esperado (la tabla cuotas no se crea en el repo).
-- Correr en: Supabase -> SQL Editor. Idempotente y solo ASCII.
-- No borra datos. A cuotas solo le agrega la columna
-- cubierta_por_beca (en false para todas las filas existentes), un
-- control y un trigger.
-- Al final muestra una TABLA con el resultado.
--
-- Como conviven factura y cuota:
--   * La cuota es la deuda del concepto "Cuota"; la factura la agrupa
--     con los servicios. El item Cuota APUNTA a su fila de cuotas:
--     hay una sola deuda por alumno y periodo.
--   * Hay un solo generador: fn_generar_facturas. Si la cuota del
--     periodo ya existia, la factura la toma tal cual (importe,
--     descuento, estado y pago) y no la modifica.
--   * Beca: solo sobre la cuota, la activa al emitir, copiada en el
--     item. Del 100 %: cuota 'Pagada' marcada cubierta_por_beca, neto
--     0, sin fecha ni metodo de pago (no es dinero cobrado).
--   * Los importes se copian al emitir: un valor o una beca que
--     cambian despues no alteran facturas emitidas.
--   * Facturas e items no se modifican ni se borran. Volver a generar
--     solo emite para los alumnos que todavia no tienen factura.
--   * Una cuota pagada no vuelve a otro estado. Una cuota facturada no
--     cambia alumno, periodo, vencimiento ni importes. Se permite
--     registrar el pago y procesar vencimientos.
--   * Pagos nuevos solo por transferencia; los anteriores se conservan.
--   * El saldo se calcula en v_facturas_saldo y v_factura_items_saldo
--     (contrato para HU51 a HU56): total emitido <> saldo pendiente.
--
-- Etapa B (pendiente): ultimo dia habil, pg_cron y PDF.
-- Sin RLS ni politicas: decision del equipo (CLAUDE.md, seccion 3.1).
-- Los mensajes de error empiezan con un codigo (ej. FAC_SIN_VALOR|...)
-- que la pantalla traduce a un texto claro.
-- ============================================================


-- ------------------------------------------------------------
-- 0) CONTROL PREVIO: si algo no coincide, se corta aca y no se
--    aplica ningun cambio.
-- ------------------------------------------------------------
do $$
declare
  v_txt text;
begin
  select string_agg(c, ', ') into v_txt
    from unnest(array['id_cuota', 'id_alumno', 'mes', 'anio', 'monto_base', 'recargo',
                      'descuento', 'fecha_vencimiento', 'estado', 'fecha_pago',
                      'metodo_pago']) as c
   where not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'cuotas'
                        and column_name = c);
  if v_txt is not null then
    raise exception 'ETAPA17_PREVIO|A cuotas le faltan columnas: %. No se aplico ningun cambio.', v_txt;
  end if;

  -- Columnas obligatorias que la facturacion no completaria al crear una cuota
  select string_agg(column_name::text, ', ') into v_txt
    from information_schema.columns
   where table_schema = 'public' and table_name = 'cuotas'
     and is_nullable = 'NO' and column_default is null and is_identity = 'NO'
     and column_name not in ('id_alumno', 'mes', 'anio', 'monto_base', 'recargo',
                             'descuento', 'fecha_vencimiento', 'estado',
                             'cubierta_por_beca');
  if v_txt is not null then
    raise exception 'ETAPA17_PREVIO|cuotas tiene columnas obligatorias sin valor por defecto: %. Avisar antes de seguir.', v_txt;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.cuotas'::regclass and contype = 'p'
       and conkey = array[(select attnum from pg_attribute
                            where attrelid = 'public.cuotas'::regclass
                              and attname = 'id_cuota')]) then
    raise exception 'ETAPA17_PREVIO|cuotas no tiene PRIMARY KEY en id_cuota. No se aplico ningun cambio.';
  end if;

  if not exists (
    select 1 from pg_index i
     where i.indrelid = 'public.cuotas'::regclass and i.indisunique
       and i.indpred is null and i.indexprs is null
       and (select array_agg(a.attname::text order by a.attname::text)
              from pg_attribute a
             where a.attrelid = i.indrelid and a.attnum = any (i.indkey::int2[]))
           = array['anio', 'id_alumno', 'mes']) then
    raise exception 'ETAPA17_PREVIO|cuotas no tiene clave unica (id_alumno, mes, anio). No se aplico ningun cambio.';
  end if;

  -- Triggers que no son de esta etapa: hay que revisarlos antes
  select string_agg(tgname::text, ', ') into v_txt
    from pg_trigger
   where tgrelid = 'public.cuotas'::regclass and not tgisinternal
     and tgname <> 'trg_controlar_cuota';
  if v_txt is not null then
    raise exception 'ETAPA17_PREVIO|cuotas tiene triggers no previstos: %. Avisar antes de seguir.', v_txt;
  end if;

  -- La generacion usa tablas temporales con el rol del usuario
  if not has_database_privilege('authenticated', current_database(), 'TEMPORARY') then
    raise exception 'ETAPA17_PREVIO|El rol authenticated no puede crear tablas temporales. Avisar antes de seguir.';
  end if;
end $$;


-- ------------------------------------------------------------
-- 1) CUOTAS: marca de "cubierta por beca" (beca del 100 %)
--    Las filas existentes quedan en false: no cambia ningun dato.
-- ------------------------------------------------------------
alter table cuotas
  add column if not exists cubierta_por_beca boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.cuotas'::regclass
                    and conname = 'chk_cuota_cubierta_por_beca') then
    alter table cuotas add constraint chk_cuota_cubierta_por_beca check (
      not cubierta_por_beca
      or (estado = 'Pagada' and fecha_pago is null and metodo_pago is null
          and monto_base + coalesce(recargo, 0) - coalesce(descuento, 0) = 0));
  end if;
end $$;


-- ------------------------------------------------------------
-- 2) FACTURAS: una por alumno y periodo; datos copiados al emitir
-- ------------------------------------------------------------
create table if not exists facturas (
  id_factura        bigint generated always as identity primary key,
  id_alumno         bigint  not null references alumnos(id_alumno),
  anio              integer not null check (anio between 2020 and 2100),
  mes               integer not null check (mes between 1 and 12),
  alumno_nombre     text    not null,
  dni               text,
  curso             text,
  fecha_emision     date    not null,
  fecha_vencimiento date    not null,
  total             numeric(12,2) not null check (total >= 0),
  origen            text    not null check (origen in ('Manual', 'Programada')),
  id_usuario_emisor uuid,
  pdf_path          text,
  fecha_registro    timestamptz not null default now(),
  constraint uq_factura_alumno_periodo unique (id_alumno, anio, mes),
  constraint chk_factura_vencimiento check (fecha_vencimiento = make_date(anio, mes, 10))
);

create index if not exists idx_facturas_periodo on facturas (anio, mes);


-- ------------------------------------------------------------
-- 3) ITEMS: importe copiado; el item Cuota apunta a su cuota
-- ------------------------------------------------------------
create table if not exists factura_items (
  id_item            bigint generated always as identity primary key,
  id_factura         bigint  not null references facturas(id_factura),
  concepto           text    not null
                     check (concepto in ('Cuota', 'Deporte', 'Recorrido', 'Comedor')),
  id_cuota           bigint  references cuotas(id_cuota),
  cuota_preexistente boolean not null default false,
  id_actividad       bigint  references actividades_extracurriculares(id_actividad),
  id_recorrido       integer references recorridos(id_recorrido),
  id_valor           bigint  references valores_servicio(id_valor),
  descripcion        text    not null,
  importe            numeric(12,2) not null check (importe >= 0),
  porcentaje_beca    numeric(5,2) check (porcentaje_beca > 0 and porcentaje_beca <= 100),
  descuento          numeric(12,2) not null default 0,
  neto               numeric(12,2) generated always as (importe - descuento) stored,
  constraint chk_item_descuento check (descuento >= 0 and descuento <= importe),
  constraint chk_item_referencia check (
    (concepto = 'Cuota' and id_cuota is not null
       and id_actividad is null and id_recorrido is null) or
    (concepto = 'Deporte' and id_actividad is not null
       and id_cuota is null and id_recorrido is null
       and descuento = 0 and porcentaje_beca is null) or
    (concepto = 'Recorrido' and id_recorrido is not null
       and id_cuota is null and id_actividad is null
       and descuento = 0 and porcentaje_beca is null) or
    (concepto = 'Comedor' and id_cuota is null
       and id_actividad is null and id_recorrido is null
       and descuento = 0 and porcentaje_beca is null))
);

create unique index if not exists uq_item_cuota
  on factura_items (id_cuota) where id_cuota is not null;
create unique index if not exists uq_item_concepto
  on factura_items (id_factura, concepto, coalesce(id_actividad, 0), coalesce(id_recorrido, 0));
create index if not exists idx_items_factura on factura_items (id_factura);


-- ------------------------------------------------------------
-- 4) SERVICIO ACTIVO EN EL PERIODO
--    Estuvo activo algun dia del mes, en hora de Argentina.
-- ------------------------------------------------------------
create or replace function public.fn_activa_en_periodo(
  p_alta timestamptz, p_activo boolean, p_baja timestamptz, p_desde date, p_hasta date)
returns boolean language sql stable as $$
  select coalesce(
    (p_alta at time zone 'America/Argentina/Buenos_Aires')::date <= p_hasta
    and (p_activo
         or (p_baja at time zone 'America/Argentina/Buenos_Aires')::date >= p_desde),
    false)
$$;


-- ------------------------------------------------------------
-- 5) GENERACION DE FACTURAS (unico generador de cuotas y facturas)
--    select public.fn_generar_facturas(2026, 12);
-- ------------------------------------------------------------
create or replace function public.fn_generar_facturas(
  p_anio integer, p_mes integer, p_origen text default 'Manual')
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_hoy    date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_desde  date;
  v_hasta  date;
  v_venc   date;
  v_faltan text;
  v_res    jsonb;
begin
  if p_anio is null or p_mes is null or p_mes not between 1 and 12
     or p_anio not between 2020 and 2100 then
    raise exception 'FAC_PERIODO|%|%', p_anio, p_mes;
  end if;
  if p_origen is null or p_origen not in ('Manual', 'Programada') then
    raise exception 'FAC_ORIGEN|%', p_origen;
  end if;
  v_desde := make_date(p_anio, p_mes, 1);
  v_hasta := (v_desde + interval '1 month')::date - 1;
  v_venc  := make_date(p_anio, p_mes, 10);
  if v_desde < date_trunc('month', v_hoy)::date then
    raise exception 'FAC_PERIODO_PASADO|%', to_char(v_desde, 'MM/YYYY');
  end if;

  -- Una sola generacion por periodo a la vez (manual o programada)
  perform pg_advisory_xact_lock(17050, p_anio * 100 + p_mes);
  -- Solo con esta marca los triggers dejan crear facturas e items
  perform set_config('app.generando_facturas', 'on', true);

  drop table if exists pg_temp._fac_alumnos, pg_temp._fac_renglones,
                       pg_temp._fac_cuotas_creadas, pg_temp._fac_nuevas;

  -- Alumnos activos que todavia no tienen la factura del periodo
  create temp table _fac_alumnos on commit drop as
  select al.id_alumno::bigint as id_alumno,
         al.apellido || ', ' || al.nombre as alumno_nombre,
         al.dni::text as dni,
         nullif(concat_ws(' ', cu.nivel, cu.grado_anio, cu.division), '') as curso
    from alumnos al
    left join cursos cu on cu.id_curso = al.id_curso
   where al.activo
     and not exists (select 1 from facturas f
                      where f.id_alumno = al.id_alumno
                        and f.anio = p_anio and f.mes = p_mes);

  -- Bloquea sus cuotas del periodo ANTES de leerlas: un pago o un
  -- cambio simultaneo espera a que termine la emision.
  perform 1 from cuotas c
   where c.anio = p_anio and c.mes = p_mes
     and c.id_alumno in (select a.id_alumno from _fac_alumnos a)
     for update;

  create temp table _fac_renglones (
    id_alumno       bigint  not null,
    concepto        text    not null,
    id_cuota        bigint,
    cuota_previa    boolean not null default false,
    id_actividad    bigint,
    id_recorrido    integer,
    id_valor        bigint,
    descripcion     text    not null,
    importe         numeric(12,2),
    porcentaje_beca numeric(5,2),
    descuento       numeric(12,2) not null default 0
  ) on commit drop;

  -- a) La cuota del periodo ya existia: se respeta tal cual.
  --    No se completa el porcentaje con la beca actual.
  insert into _fac_renglones (id_alumno, concepto, id_cuota, cuota_previa,
                              descripcion, importe, descuento)
  select a.id_alumno, 'Cuota', c.id_cuota, true, 'Cuota mensual',
         c.monto_base + coalesce(c.recargo, 0), coalesce(c.descuento, 0)
    from _fac_alumnos a
    join cuotas c on c.id_alumno = a.id_alumno and c.anio = p_anio and c.mes = p_mes;

  -- b) Cuota nueva: valor vigente al primer dia del mes y beca activa
  insert into _fac_renglones (id_alumno, concepto, id_valor, descripcion,
                              importe, porcentaje_beca, descuento)
  select a.id_alumno, 'Cuota', v.id_valor, 'Cuota mensual', v.monto, b.porcentaje,
         coalesce(round(v.monto * b.porcentaje / 100, 2), 0)
    from _fac_alumnos a
    left join lateral (
      select x.id_valor, x.monto from valores_servicio x
       where x.concepto = 'Cuota' and x.vigente_desde <= v_desde
       order by x.vigente_desde desc limit 1) v on true
    left join becas b on b.id_alumno = a.id_alumno and b.activo
   where not exists (select 1 from _fac_renglones r where r.id_alumno = a.id_alumno);

  -- c) Un item por deporte
  insert into _fac_renglones (id_alumno, concepto, id_actividad, id_valor,
                              descripcion, importe)
  select distinct on (i.id_alumno, g.id_actividad)
         i.id_alumno, 'Deporte', g.id_actividad, v.id_valor,
         'Deporte: ' || ae.nombre, v.monto
    from inscripciones_deportivas i
    join _fac_alumnos a on a.id_alumno = i.id_alumno
    join grupos_deportivos g on g.id_grupo = i.id_grupo
    join actividades_extracurriculares ae on ae.id_actividad = g.id_actividad
    left join lateral (
      select x.id_valor, x.monto from valores_servicio x
       where x.concepto = 'Deporte' and x.id_actividad = g.id_actividad
         and x.vigente_desde <= v_desde
       order by x.vigente_desde desc limit 1) v on true
   where public.fn_activa_en_periodo(i.fecha_alta, i.activo, i.fecha_baja, v_desde, v_hasta)
   order by i.id_alumno, g.id_actividad, i.fecha_alta desc;

  -- d) Transporte: solo si estuvo inscripto ese mes (el recorrido mas reciente)
  insert into _fac_renglones (id_alumno, concepto, id_recorrido, id_valor,
                              descripcion, importe)
  select distinct on (t.id_alumno)
         t.id_alumno, 'Recorrido', t.id_recorrido, v.id_valor,
         'Transporte: ' || r.nombre, v.monto
    from inscripciones_transporte t
    join _fac_alumnos a on a.id_alumno = t.id_alumno
    join recorridos r on r.id_recorrido = t.id_recorrido
    left join lateral (
      select x.id_valor, x.monto from valores_servicio x
       where x.concepto = 'Recorrido' and x.id_recorrido = t.id_recorrido
         and x.vigente_desde <= v_desde
       order by x.vigente_desde desc limit 1) v on true
   where public.fn_activa_en_periodo(t.fecha_alta, t.activo, t.fecha_baja, v_desde, v_hasta)
   order by t.id_alumno, t.fecha_alta desc;

  -- e) Comedor
  insert into _fac_renglones (id_alumno, concepto, id_valor, descripcion, importe)
  select distinct on (c.id_alumno)
         c.id_alumno, 'Comedor', v.id_valor, 'Comedor', v.monto
    from inscripciones_comedor c
    join _fac_alumnos a on a.id_alumno = c.id_alumno
    left join lateral (
      select x.id_valor, x.monto from valores_servicio x
       where x.concepto = 'Comedor' and x.vigente_desde <= v_desde
       order by x.vigente_desde desc limit 1) v on true
   where public.fn_activa_en_periodo(c.fecha_alta, c.activo, c.fecha_baja, v_desde, v_hasta)
   order by c.id_alumno, c.fecha_alta desc;

  -- Si falta un valor necesario, no se emite NINGUNA factura
  select string_agg(distinct descripcion, ', ' order by descripcion) into v_faltan
    from _fac_renglones where importe is null;
  if v_faltan is not null then
    raise exception 'FAC_SIN_VALOR|%|%', to_char(v_desde, 'DD/MM/YYYY'), v_faltan;
  end if;

  -- Cuotas nuevas. Neto 0 (beca del 100 %): 'Pagada' y cubierta por
  -- beca, sin fecha ni metodo de pago.
  create temp table _fac_cuotas_creadas (id_cuota bigint) on commit drop;
  with creadas as (
    insert into cuotas (id_alumno, mes, anio, monto_base, recargo, descuento,
                        fecha_vencimiento, estado, cubierta_por_beca)
    select r.id_alumno, p_mes, p_anio, r.importe, 0, r.descuento, v_venc,
           case when r.importe - r.descuento = 0 then 'Pagada' else 'Pendiente' end,
           r.importe - r.descuento = 0
      from _fac_renglones r
     where r.concepto = 'Cuota' and not r.cuota_previa
    on conflict (id_alumno, mes, anio) do nothing
    returning id_cuota)
  insert into _fac_cuotas_creadas select id_cuota from creadas;

  -- Vuelve a bloquear (incluye las recien creadas) y copia el importe
  -- de la fila real: cuota e item no pueden quedar distintos.
  perform 1 from cuotas c
   where c.anio = p_anio and c.mes = p_mes
     and c.id_alumno in (select a.id_alumno from _fac_alumnos a)
     for update;

  update _fac_renglones r
     set id_cuota        = c.id_cuota,
         importe         = c.monto_base + coalesce(c.recargo, 0),
         descuento       = coalesce(c.descuento, 0),
         cuota_previa    = r.cuota_previa
                           or c.id_cuota not in (select id_cuota from _fac_cuotas_creadas),
         porcentaje_beca = case when c.id_cuota in (select id_cuota from _fac_cuotas_creadas)
                                then r.porcentaje_beca end
    from cuotas c
   where r.concepto = 'Cuota'
     and c.id_alumno = r.id_alumno and c.anio = p_anio and c.mes = p_mes;

  if exists (select 1 from _fac_renglones where concepto = 'Cuota' and id_cuota is null) then
    raise exception 'FAC_CUOTA_SIN_VINCULO|%', to_char(v_desde, 'MM/YYYY');
  end if;

  -- Facturas (una por alumno y periodo) e items de las nuevas
  create temp table _fac_nuevas (
    id_factura bigint, id_alumno bigint, total numeric(12,2)) on commit drop;
  with nuevas as (
    insert into facturas (id_alumno, anio, mes, alumno_nombre, dni, curso,
                          fecha_emision, fecha_vencimiento, total, origen,
                          id_usuario_emisor)
    select a.id_alumno, p_anio, p_mes, a.alumno_nombre, a.dni, a.curso,
           v_hoy, v_venc,
           (select sum(r.importe - r.descuento) from _fac_renglones r
             where r.id_alumno = a.id_alumno),
           p_origen, auth.uid()
      from _fac_alumnos a
    on conflict (id_alumno, anio, mes) do nothing
    returning id_factura, id_alumno, total)
  insert into _fac_nuevas select id_factura, id_alumno, total from nuevas;

  insert into factura_items (id_factura, concepto, id_cuota, cuota_preexistente,
                             id_actividad, id_recorrido, id_valor, descripcion,
                             importe, porcentaje_beca, descuento)
  select n.id_factura, r.concepto, r.id_cuota, r.cuota_previa,
         r.id_actividad, r.id_recorrido, r.id_valor, r.descripcion,
         r.importe, r.porcentaje_beca, r.descuento
    from _fac_nuevas n
    join _fac_renglones r on r.id_alumno = n.id_alumno
   order by n.id_factura,
            case r.concepto when 'Cuota' then 1 when 'Deporte' then 2
                            when 'Recorrido' then 3 else 4 end,
            r.descripcion;

  perform set_config('app.generando_facturas', 'off', true);

  select jsonb_build_object(
           'periodo', to_char(v_desde, 'YYYY-MM'),
           'nuevas', (select count(*) from _fac_nuevas),
           'ya_emitidas', (select count(*) from facturas f
                            where f.anio = p_anio and f.mes = p_mes)
                          - (select count(*) from _fac_nuevas),
           'cuotas_previas', (select count(*) from _fac_renglones r
                               join _fac_nuevas n on n.id_alumno = r.id_alumno
                              where r.concepto = 'Cuota' and r.cuota_previa),
           'total', coalesce((select sum(n.total) from _fac_nuevas n), 0))
    into v_res;
  return v_res;
end $$;


-- ------------------------------------------------------------
-- 6) PROTECCIONES
-- ------------------------------------------------------------
-- Facturas e items: se crean solo desde fn_generar_facturas y no se
-- modifican ni se borran. Unica excepcion: completar el PDF una vez.
create or replace function public.fn_proteger_facturacion()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('app.generando_facturas', true), '') <> 'on' then
      raise exception 'FAC_SOLO_GENERADOR|%', tg_table_name;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and tg_table_name = 'facturas'
     and (to_jsonb(old) ->> 'pdf_path') is null
     and (to_jsonb(new) - 'pdf_path') = (to_jsonb(old) - 'pdf_path') then
    return new;
  end if;

  raise exception 'FAC_EMITIDA|%', to_jsonb(old) ->> 'id_factura';
end $$;

drop trigger if exists trg_proteger_facturas on facturas;
create trigger trg_proteger_facturas
  before insert or update or delete on facturas
  for each row execute function public.fn_proteger_facturacion();

drop trigger if exists trg_proteger_factura_items on factura_items;
create trigger trg_proteger_factura_items
  before insert or update or delete on factura_items
  for each row execute function public.fn_proteger_facturacion();

-- Cuotas: solo transferencia para pagos nuevos; una pagada no vuelve
-- atras; una facturada no cambia alumno, periodo, vencimiento ni
-- importes. Registrar el pago y procesar vencimientos sigue permitido.
create or replace function public.fn_controlar_cuota()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.metodo_pago is not null and new.metodo_pago <> 'Transferencia' then
      raise exception 'CUO_METODO|%', new.metodo_pago;
    end if;
    return new;
  end if;

  if new.metodo_pago is distinct from old.metodo_pago
     and new.metodo_pago is not null and new.metodo_pago <> 'Transferencia' then
    raise exception 'CUO_METODO|%', new.metodo_pago;
  end if;

  if old.estado = 'Pagada' and new.estado is distinct from 'Pagada' then
    raise exception 'CUO_PAGADA|%|%', old.mes, old.anio;
  end if;

  if (new.id_alumno, new.mes, new.anio, new.fecha_vencimiento, new.monto_base,
      new.recargo, new.descuento, new.cubierta_por_beca)
     is distinct from
     (old.id_alumno, old.mes, old.anio, old.fecha_vencimiento, old.monto_base,
      old.recargo, old.descuento, old.cubierta_por_beca) then
    if exists (select 1 from factura_items fi where fi.id_cuota = old.id_cuota) then
      raise exception 'CUO_FACTURADA|%|%', old.mes, old.anio;
    end if;
    if old.estado = 'Pagada' then
      raise exception 'CUO_PAGADA|%|%', old.mes, old.anio;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_controlar_cuota on cuotas;
create trigger trg_controlar_cuota
  before insert or update on cuotas
  for each row execute function public.fn_controlar_cuota();


-- ------------------------------------------------------------
-- 7) SALDO (contrato para HU51 a HU56)
--    total emitido (fijo) <> saldo pendiente (se calcula en vivo).
--    * Sin cargo: neto 0 (por ejemplo, beca del 100 %). No es deuda
--      ni dinero cobrado.
--    * Pagado: la Cuota cuando cuotas.estado = 'Pagada', aunque el
--      pago se registre despues de emitir.
--    * Pendiente: el resto. Los servicios, hasta que HU54/HU55 sumen
--      los comprobantes (create or replace view).
--    La deuda de un periodo con factura se lee de aca: la cuota no se
--    suma por fuera de sus items.
-- ------------------------------------------------------------
create or replace view v_factura_items_saldo as
select fi.id_item, fi.id_factura, f.id_alumno, f.anio, f.mes, f.fecha_vencimiento,
       fi.concepto, fi.id_cuota, fi.cuota_preexistente, fi.id_actividad,
       fi.id_recorrido, fi.descripcion, fi.importe, fi.porcentaje_beca,
       fi.descuento, fi.neto,
       coalesce(c.cubierta_por_beca, false) as cubierta_por_beca,
       case when fi.neto = 0 then 'Sin cargo'
            when fi.concepto = 'Cuota' and c.estado = 'Pagada' then 'Pagado'
            else 'Pendiente' end as estado_pago,
       case when fi.neto > 0 and fi.concepto = 'Cuota' and c.estado = 'Pagada'
            then c.fecha_pago end as fecha_pago,
       case when fi.neto = 0 or (fi.concepto = 'Cuota' and c.estado = 'Pagada')
            then 0::numeric(12,2) else fi.neto end as saldo
  from factura_items fi
  join facturas f on f.id_factura = fi.id_factura
  left join cuotas c on c.id_cuota = fi.id_cuota;

create or replace view v_facturas_saldo as
select f.id_factura, f.id_alumno, f.anio, f.mes, f.alumno_nombre, f.dni, f.curso,
       f.fecha_emision, f.fecha_vencimiento, f.total, f.origen, f.pdf_path,
       coalesce(sum(i.neto) filter (where i.estado_pago = 'Pagado'), 0)::numeric(12,2)
         as cobrado,
       coalesce(sum(i.saldo), 0)::numeric(12,2) as saldo,
       case
         when f.total = 0 then 'Sin cargo'
         when coalesce(sum(i.saldo), 0) = 0 then 'Pagada'
         when (now() at time zone 'America/Argentina/Buenos_Aires')::date
              > f.fecha_vencimiento then 'Vencida'
         when coalesce(sum(i.neto) filter (where i.estado_pago = 'Pagado'), 0) > 0
              then 'Parcial'
         else 'Pendiente'
       end as estado_cobro
  from facturas f
  left join v_factura_items_saldo i on i.id_factura = f.id_factura
 group by f.id_factura;


-- ------------------------------------------------------------
-- 8) PERMISOS: hace falta sesion iniciada (no es RLS ni control por rol)
-- ------------------------------------------------------------
revoke all on function public.fn_generar_facturas(integer, integer, text) from public, anon;
grant execute on function public.fn_generar_facturas(integer, integer, text)
  to authenticated, service_role;
revoke all on table facturas, factura_items, v_facturas_saldo, v_factura_items_saldo
  from anon;
grant select on table v_facturas_saldo, v_factura_items_saldo
  to authenticated, service_role;


-- ------------------------------------------------------------
-- 9) RESULTADO (solo lectura)
-- ------------------------------------------------------------
select 'Tablas facturas y factura_items' as control,
       case when to_regclass('public.facturas') is not null
             and to_regclass('public.factura_items') is not null
            then 'OK' else 'FALLA' end as resultado,
       'Una factura por alumno y periodo, con items copiados' as detalle
union all
select 'Columna cuotas.cubierta_por_beca',
       case when exists (select 1 from information_schema.columns
                          where table_schema = 'public' and table_name = 'cuotas'
                            and column_name = 'cubierta_por_beca')
            then 'OK' else 'FALLA' end,
       'Beca del 100 %: Pagada, neto 0, sin fecha ni metodo'
union all
select 'Triggers de proteccion',
       case when count(*) = 3 then 'OK' else 'FALLA' end,
       count(*)::text || ' de 3 (facturas, items y cuotas)'
  from pg_trigger
 where tgname in ('trg_proteger_facturas', 'trg_proteger_factura_items',
                  'trg_controlar_cuota')
union all
select 'Funcion fn_generar_facturas',
       case when to_regprocedure('public.fn_generar_facturas(integer,integer,text)')
                 is not null then 'OK' else 'FALLA' end,
       'select public.fn_generar_facturas(anio, mes);'
union all
select 'Vistas de saldo',
       case when to_regclass('public.v_facturas_saldo') is not null
             and to_regclass('public.v_factura_items_saldo') is not null
            then 'OK' else 'FALLA' end,
       'v_facturas_saldo y v_factura_items_saldo'
union all
select 'Sin sesion no se genera',
       case when has_function_privilege('anon',
                   'public.fn_generar_facturas(integer,integer,text)', 'execute')
            then 'FALLA' else 'OK' end,
       'El rol anon no puede ejecutar la generacion'
union all
select 'Sin sesion no se leen facturas',
       case when has_table_privilege('anon', 'public.facturas', 'select')
            then 'FALLA' else 'OK' end,
       'El rol anon no puede leer facturas'
union all
select 'RLS en facturas (informativo)',
       case when relrowsecurity then 'ACTIVO' else 'INACTIVO' end,
       case when relrowsecurity then 'Avisar al equipo'
            else 'Esperado para esta demo (CLAUDE.md, seccion 3.1)' end
  from pg_class where oid = to_regclass('public.facturas')
union all
select 'Cuotas por estado', 'INFO',
       coalesce(string_agg(estado || ': ' || n, ', ' order by estado), '(sin cuotas)')
  from (select coalesce(estado, '(nulo)') as estado, count(*)::text as n
          from cuotas group by 1) x
union all
select 'Pagos en Efectivo conservados', 'INFO',
       count(*)::text || ' cuota(s); no se modifican'
  from cuotas where metodo_pago = 'Efectivo'
union all
select 'Facturas emitidas', 'INFO', count(*)::text || ' factura(s)'
  from facturas;

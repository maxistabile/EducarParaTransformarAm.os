-- ============================================================
-- ETAPA 18 - TP Metodologia de Sistemas II (Parte 3)
--   RF12.4  Cargar el comprobante de transferencia (HU54)
--   RF12.5  Aprobar o rechazar el comprobante (HU55)
--   RF12.6  Emitir el comprobante de pago en PDF (HU56)
--
-- Requiere: etapa17 (facturas, items, vistas de saldo y
--           fn_controlar_cuota).
-- ANTES: correr verificaciones/relevamiento_etapa18.sql y pasar el
--        resultado (todo en OK o INFO).
-- Correr en: Supabase -> SQL Editor. Idempotente y solo ASCII.
-- No borra datos. Al final muestra una TABLA con el resultado.
--
-- Como funciona:
--   * Reutiliza la tabla pagos (vacia): cada fila nueva es UN
--     comprobante de transferencia cargado por el padre, para uno o
--     mas items de UNA factura (pago_items). Una factura admite varios
--     comprobantes. Las filas viejas por cuota (id_cuota) no existen.
--   * Estados: 'En revision' -> 'Aprobado' o 'Rechazado'. Cargar un
--     archivo NO acredita el pago: el item sigue con saldo hasta que se
--     aprueba. El padre no anula; la administracion rechaza con motivo
--     y el item queda libre.
--   * Un item esta en un solo comprobante no rechazado (indice unico
--     parcial). No se puede pagar un item Sin cargo, Pagado o En
--     revision.
--   * Al aprobar, los items quedan pagados; el item Cuota marca su
--     cuota Pagada (fecha de aprobacion, Transferencia), igual que
--     Registrar pagos, y la web queda coherente. Total emitido y
--     facturas no cambian.
--   * Idempotencia: cada envio tiene una clave (uuid) y una huella
--     (SHA-256 de usuario, factura, items y archivo). La misma clave con
--     la misma huella devuelve el mismo comprobante; con otra, se
--     rechaza (PAG_CLAVE_REUSADA).
--   * Concurrencia: todas las operaciones bloquean en el mismo orden,
--     factura -> pago -> cuotas (por id_cuota). Registrar pagos (web)
--     solo bloquea la cuota.
--   * El archivo y el PDF van a un bucket PRIVADO (pagos). Solo los
--     maneja la Edge Function "pagos" con la service role; no hay
--     politicas en storage.objects.
--   * Las funciones solo las ejecuta service_role (la Edge Function,
--     que verifica el usuario con auth.getUser). Validan rol, estado
--     activo y pertenencia en cada operacion.
--
-- Sin RLS (CLAUDE.md, seccion 3.1): pagos y pago_items se pueden LEER
-- con sesion iniciada (la app filtra por alumno); escribir solo se
-- puede desde estas funciones (trigger de proteccion).
-- Los mensajes de error empiezan con un codigo (PAG_...|...) que la
-- pantalla traduce a un texto claro.
-- ============================================================


-- ------------------------------------------------------------
-- 0) CONTROL PREVIO: si algo no coincide, se corta aca y no se
--    aplica ningun cambio.
-- ------------------------------------------------------------
do $$
declare
  v_txt text;
  b     record;
begin
  if to_regclass('public.facturas') is null
     or to_regclass('public.factura_items') is null
     or to_regprocedure('public.fn_controlar_cuota()') is null then
    raise exception 'ETAPA18_PREVIO|Falta etapa17 (facturas, items o fn_controlar_cuota).';
  end if;

  if to_regclass('public.pagos') is null then
    raise exception 'ETAPA18_PREVIO|No existe la tabla pagos.';
  end if;

  -- Primera vez: pagos tiene que estar vacia
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'pagos'
                    and column_name = 'huella')
     and exists (select 1 from public.pagos) then
    raise exception 'ETAPA18_PREVIO|La tabla pagos tiene filas. Avisar antes de seguir.';
  end if;

  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'pagos'
                    and column_name = 'id_cuota' and is_nullable = 'YES') then
    raise exception 'ETAPA18_PREVIO|pagos.id_cuota no acepta nulos.';
  end if;

  select string_agg(c, ', ') into v_txt
    from unnest(array['id_pago', 'monto_pagado', 'fecha_pago', 'metodo_pago',
                      'id_usuario_registra']) c
   where not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'pagos'
                        and column_name = c);
  if v_txt is not null then
    raise exception 'ETAPA18_PREVIO|A pagos le faltan columnas: %', v_txt;
  end if;

  -- Columnas nuevas que ya existan con otro tipo
  select string_agg(n.col || ' (' || c.udt_name || ')', ', ') into v_txt
    from (values ('id_factura', 'int8'), ('id_alumno', 'int8'), ('estado', 'text'),
                 ('clave', 'uuid'), ('huella', 'text'), ('archivo_path', 'text'),
                 ('archivo_tipo', 'text'), ('motivo_rechazo', 'text'),
                 ('fecha_revision', 'timestamptz'), ('id_usuario_revisa', 'uuid'),
                 ('recibo_path', 'text')) n(col, udt)
    join information_schema.columns c
      on c.table_schema = 'public' and c.table_name = 'pagos' and c.column_name = n.col
   where c.udt_name <> n.udt;
  if v_txt is not null then
    raise exception 'ETAPA18_PREVIO|Columnas de pagos con otro tipo: %', v_txt;
  end if;

  -- Bucket: si ya existe, tiene que ser privado y con los limites previstos
  select * into b from storage.buckets where id = 'pagos';
  if found and (b.public
                or b.file_size_limit is distinct from 5242880
                or b.allowed_mime_types is null
                or not (b.allowed_mime_types @> array['image/jpeg', 'image/png', 'application/pdf']
                        and array['image/jpeg', 'image/png', 'application/pdf'] @> b.allowed_mime_types)) then
    raise exception 'ETAPA18_BUCKET|El bucket pagos ya existe con otra configuracion (public: %, limite: %, tipos: %). No se modifica: decidir con el equipo.',
      b.public, b.file_size_limit, b.allowed_mime_types;
  end if;
end $$;


-- ------------------------------------------------------------
-- 1) BUCKET PRIVADO (5 MB; JPG, PNG y PDF). Sin politicas.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pagos', 'pagos', false, 5242880,
        array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;


-- ------------------------------------------------------------
-- 2) PAGOS: cada fila nueva es un comprobante de transferencia
--    Se reutilizan monto_pagado (total calculado aca), fecha_pago
--    (fecha de carga), metodo_pago (Transferencia) e
--    id_usuario_registra (el padre).
-- ------------------------------------------------------------
alter table pagos
  add column if not exists id_factura        bigint references facturas(id_factura),
  add column if not exists id_alumno         bigint references alumnos(id_alumno),
  add column if not exists estado            text,
  add column if not exists clave             uuid,
  add column if not exists huella            text,
  add column if not exists archivo_path      text,
  add column if not exists archivo_tipo      text,
  add column if not exists motivo_rechazo    text,
  add column if not exists fecha_revision    timestamptz,
  add column if not exists id_usuario_revisa uuid references usuarios(id_usuario),
  add column if not exists recibo_path       text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.pagos'::regclass and conname = 'chk_pago_comprobante') then
    alter table pagos add constraint chk_pago_comprobante check (
      id_factura is null
      or (id_alumno is not null and id_cuota is null
          and estado in ('En revision', 'Aprobado', 'Rechazado')
          and clave is not null and huella is not null
          and archivo_path is not null
          and archivo_tipo in ('image/jpeg', 'image/png', 'application/pdf')
          and metodo_pago = 'Transferencia'
          and id_usuario_registra is not null
          and monto_pagado > 0));
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.pagos'::regclass and conname = 'chk_pago_revision') then
    alter table pagos add constraint chk_pago_revision check (
      (estado is distinct from 'En revision'
         or (fecha_revision is null and id_usuario_revisa is null and motivo_rechazo is null))
      and (estado is distinct from 'Aprobado'
         or (fecha_revision is not null and id_usuario_revisa is not null and motivo_rechazo is null))
      and (estado is distinct from 'Rechazado'
         or (fecha_revision is not null and id_usuario_revisa is not null
             and length(trim(coalesce(motivo_rechazo, ''))) >= 5))
      and (recibo_path is null or estado = 'Aprobado'));
  end if;
end $$;

create unique index if not exists uq_pagos_clave on pagos (clave) where clave is not null;
create index if not exists idx_pagos_alumno on pagos (id_alumno);
create index if not exists idx_pagos_factura on pagos (id_factura);


-- ------------------------------------------------------------
-- 3) PAGO_ITEMS: que items paga cada comprobante
--    importe = saldo del item al cargar (copiado).
--    activo = false cuando el comprobante se rechaza.
-- ------------------------------------------------------------
create table if not exists pago_items (
  id_pago integer not null references pagos(id_pago),
  id_item bigint  not null references factura_items(id_item),
  importe numeric(12,2) not null check (importe > 0),
  activo  boolean not null default true,
  primary key (id_pago, id_item)
);

-- Un item esta en UN solo comprobante no rechazado: ultima barrera
-- contra pagar o acreditar dos veces (doble clic, reintentos o cargas
-- simultaneas).
create unique index if not exists uq_pago_item_activo on pago_items (id_item) where activo;


-- ------------------------------------------------------------
-- 4) PROTECCION: se escribe solo desde las funciones de esta etapa.
--    Despues de insertar, solo cambian el estado y los datos de la
--    revision, activo (al rechazar) y recibo_path (una vez).
-- ------------------------------------------------------------
create or replace function public.fn_proteger_pagos()
returns trigger language plpgsql
set search_path = public, pg_temp as $$
declare
  v_libres text[];
begin
  if coalesce(current_setting('app.pagos', true), '') <> 'on' then
    raise exception 'PAG_SOLO_FUNCIONES|%', tg_table_name;
  end if;
  if tg_op = 'INSERT' then
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'PAG_INMUTABLE|%', tg_table_name;
  end if;

  if tg_table_name = 'pagos' then
    v_libres := array['estado', 'motivo_rechazo', 'fecha_revision',
                      'id_usuario_revisa', 'recibo_path'];
    if (to_jsonb(new) - v_libres) <> (to_jsonb(old) - v_libres) then
      raise exception 'PAG_INMUTABLE|pagos';
    end if;
    if new.estado is distinct from old.estado and old.estado <> 'En revision' then
      raise exception 'PAG_YA_REVISADO|%', old.estado;
    end if;
    if old.recibo_path is not null and new.recibo_path is distinct from old.recibo_path then
      raise exception 'PAG_INMUTABLE|recibo';
    end if;
  else
    if (to_jsonb(new) - 'activo') <> (to_jsonb(old) - 'activo')
       or (new.activo and not old.activo) then
      raise exception 'PAG_INMUTABLE|pago_items';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_proteger_pagos on pagos;
create trigger trg_proteger_pagos
  before insert or update or delete on pagos
  for each row execute function public.fn_proteger_pagos();

drop trigger if exists trg_proteger_pago_items on pago_items;
create trigger trg_proteger_pago_items
  before insert or update or delete on pago_items
  for each row execute function public.fn_proteger_pagos();


-- ------------------------------------------------------------
-- 5) FUNCIONES (solo service_role; las llama la Edge Function "pagos"
--    con el usuario ya verificado). security definer y search_path fijo.
-- ------------------------------------------------------------

-- Usuario activo con uno de los roles: devuelve el rol.
-- Como la web y la app, solo activo = false cuenta como desactivado.
create or replace function public.fn_pago_actor(p_usuario uuid, p_roles text[])
returns text language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare
  v_rol text;
begin
  select u.rol into v_rol
    from usuarios u
   where u.id_usuario = p_usuario and u.activo is distinct from false;
  if v_rol is null or not (v_rol = any (p_roles)) then
    raise exception 'PAG_SIN_PERMISO';
  end if;
  return v_rol;
end $$;

-- Items de la factura disponibles para un comprobante nuevo: devuelve
-- el total (suma de sus netos). Se llama con la factura y las cuotas ya
-- bloqueadas (registro) o sin bloqueo (verificacion anticipada).
create or replace function public.fn_validar_items_pago(p_id_factura bigint, p_items bigint[])
returns numeric language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_item  record;
  v_total numeric(12,2) := 0;
begin
  if p_items is null or cardinality(p_items) = 0 then
    raise exception 'PAG_SIN_ITEMS';
  end if;
  if (select count(distinct x) from unnest(p_items) x) <> cardinality(p_items)
     or exists (select 1 from unnest(p_items) x where x is null) then
    raise exception 'PAG_ITEMS_REPETIDOS';
  end if;

  for v_item in
    select x as id_pedido, fi.id_item, fi.id_factura, fi.concepto, fi.descripcion,
           fi.neto, c.estado as estado_cuota
      from unnest(p_items) x
      left join factura_items fi on fi.id_item = x
      left join cuotas c on c.id_cuota = fi.id_cuota
  loop
    if v_item.id_item is null or v_item.id_factura <> p_id_factura then
      raise exception 'PAG_ITEM_AJENO|%', v_item.id_pedido;
    end if;
    if v_item.neto <= 0
       or (v_item.concepto = 'Cuota' and v_item.estado_cuota = 'Pagada')
       or exists (select 1 from pago_items pi
                   where pi.id_item = v_item.id_item and pi.activo) then
      raise exception 'PAG_ITEM_NO_DISPONIBLE|%', v_item.descripcion;
    end if;
    v_total := v_total + v_item.neto;
  end loop;
  return v_total;
end $$;

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
  if found then
    if v_pago.id_usuario_registra is distinct from p_usuario
       or v_pago.huella is distinct from p_huella then
      raise exception 'PAG_CLAVE_REUSADA';
    end if;
    return jsonb_build_object('estado', 'existente', 'id_pago', v_pago.id_pago,
                              'estado_pago', v_pago.estado,
                              'archivo_path', v_pago.archivo_path);
  end if;

  return jsonb_build_object('estado', 'nuevo', 'id_alumno', v_alumno,
                            'total', public.fn_validar_items_pago(p_id_factura, p_items));
end $$;

-- HU54: registra el comprobante en una sola transaccion.
-- Bloquea factura -> cuotas (por id_cuota) y recien entonces valida
-- todo sobre las filas bloqueadas. Si la clave ya existe con la misma
-- huella, devuelve ese comprobante sin cambiar nada.
create or replace function public.fn_registrar_comprobante(
  p_usuario uuid, p_clave uuid, p_id_factura bigint, p_items bigint[],
  p_huella text, p_path text, p_tipo text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_alumno     bigint;
  v_total      numeric(12,2);
  v_pago       record;
  v_id_pago    integer;
  v_restriccion text;
begin
  perform public.fn_pago_actor(p_usuario, array['Padre']);

  select f.id_alumno into v_alumno
    from facturas f where f.id_factura = p_id_factura
     for update;
  if v_alumno is null
     or not exists (select 1 from alumnos a
                     where a.id_alumno = v_alumno and a.id_usuario_padre = p_usuario) then
    raise exception 'PAG_FACTURA_AJENA';
  end if;

  if p_clave is null or coalesce(p_huella, '') = '' then
    raise exception 'PAG_SOLICITUD_INVALIDA';
  end if;

  -- Reintento: misma clave
  select * into v_pago from pagos where clave = p_clave;
  if found then
    if v_pago.id_usuario_registra is distinct from p_usuario
       or v_pago.huella is distinct from p_huella then
      raise exception 'PAG_CLAVE_REUSADA';
    end if;
    return jsonb_build_object('id_pago', v_pago.id_pago, 'estado_pago', v_pago.estado,
                              'archivo_path', v_pago.archivo_path,
                              'total', v_pago.monto_pagado, 'ya_existia', true);
  end if;

  if p_path is null
     or p_path not like 'comprobantes/' || p_id_factura || '/' || p_clave || '/%'
     or p_tipo is null or p_tipo not in ('image/jpeg', 'image/png', 'application/pdf') then
    raise exception 'PAG_SOLICITUD_INVALIDA';
  end if;

  -- Cuotas de los items elegidos, en orden (mismo orden que la revision)
  perform 1 from cuotas c
    join factura_items fi on fi.id_cuota = c.id_cuota
   where fi.id_item = any (p_items) and fi.id_factura = p_id_factura
   order by c.id_cuota
     for update of c;

  v_total := public.fn_validar_items_pago(p_id_factura, p_items);

  perform set_config('app.pagos', 'on', true);
  begin
    insert into pagos (id_factura, id_alumno, estado, clave, huella, archivo_path,
                       archivo_tipo, monto_pagado, metodo_pago, id_usuario_registra)
    values (p_id_factura, v_alumno, 'En revision', p_clave, p_huella, p_path,
            p_tipo, v_total, 'Transferencia', p_usuario)
    returning id_pago into v_id_pago;

    insert into pago_items (id_pago, id_item, importe)
    select v_id_pago, fi.id_item, fi.neto
      from factura_items fi where fi.id_item = any (p_items);
  exception when unique_violation then
    get stacked diagnostics v_restriccion = constraint_name;
    perform set_config('app.pagos', 'off', true);
    if v_restriccion = 'uq_pagos_clave' then
      -- Otra solicitud con la misma clave registro primero
      select * into v_pago from pagos where clave = p_clave;
      if v_pago.id_usuario_registra is distinct from p_usuario
         or v_pago.huella is distinct from p_huella then
        raise exception 'PAG_CLAVE_REUSADA';
      end if;
      return jsonb_build_object('id_pago', v_pago.id_pago, 'estado_pago', v_pago.estado,
                                'archivo_path', v_pago.archivo_path,
                                'total', v_pago.monto_pagado, 'ya_existia', true);
    end if;
    raise exception 'PAG_ITEM_NO_DISPONIBLE|otro comprobante';
  end;
  perform set_config('app.pagos', 'off', true);

  return jsonb_build_object('id_pago', v_id_pago, 'estado_pago', 'En revision',
                            'archivo_path', p_path, 'total', v_total, 'ya_existia', false);
end $$;

-- Recuperar un envio cuya respuesta se perdio: el padre pregunta por su
-- clave. {existe: false} o {existe: true, id_pago, estado_pago, id_factura}
create or replace function public.fn_estado_clave(p_usuario uuid, p_clave uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare
  v_pago record;
begin
  perform public.fn_pago_actor(p_usuario, array['Padre']);
  select p.* into v_pago
    from pagos p join alumnos a on a.id_alumno = p.id_alumno
   where p.clave = p_clave and p.id_usuario_registra = p_usuario
     and a.id_usuario_padre = p_usuario;
  if not found then
    return jsonb_build_object('existe', false);
  end if;
  return jsonb_build_object('existe', true, 'id_pago', v_pago.id_pago,
                            'estado_pago', v_pago.estado, 'id_factura', v_pago.id_factura,
                            'motivo_rechazo', v_pago.motivo_rechazo);
end $$;

-- HU55: aprobar o rechazar (Admin o Directivo).
-- Bloquea factura -> pago -> cuotas. Repetir la misma decision no hace
-- nada (doble clic); otra decision sobre un pago ya revisado falla.
create or replace function public.fn_revisar_comprobante(
  p_usuario uuid, p_id_pago integer, p_aprobar boolean, p_motivo text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_factura bigint;
  v_pago    record;
  v_desc    text;
  v_hoy     date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  perform public.fn_pago_actor(p_usuario, array['Admin', 'Directivo']);
  if p_aprobar is null then
    raise exception 'PAG_SOLICITUD_INVALIDA';
  end if;

  select id_factura into v_factura from pagos where id_pago = p_id_pago;
  if v_factura is null then
    raise exception 'PAG_NO_EXISTE';
  end if;
  perform 1 from facturas where id_factura = v_factura for update;
  select * into v_pago from pagos where id_pago = p_id_pago for update;

  if v_pago.estado <> 'En revision' then
    if (p_aprobar and v_pago.estado = 'Aprobado')
       or (not p_aprobar and v_pago.estado = 'Rechazado') then
      return jsonb_build_object('id_pago', p_id_pago, 'estado_pago', v_pago.estado,
                                'ya_revisado', true);
    end if;
    raise exception 'PAG_YA_REVISADO|%', v_pago.estado;
  end if;

  perform 1 from cuotas c
    join factura_items fi on fi.id_cuota = c.id_cuota
    join pago_items pi on pi.id_item = fi.id_item
   where pi.id_pago = p_id_pago
   order by c.id_cuota
     for update of c;

  perform set_config('app.pagos', 'on', true);

  if not p_aprobar then
    if length(trim(coalesce(p_motivo, ''))) < 5 then
      raise exception 'PAG_MOTIVO';
    end if;
    update pagos set estado = 'Rechazado', motivo_rechazo = trim(p_motivo),
                     fecha_revision = now(), id_usuario_revisa = p_usuario
     where id_pago = p_id_pago;
    update pago_items set activo = false where id_pago = p_id_pago;
  else
    select fi.descripcion into v_desc
      from pago_items pi
      join factura_items fi on fi.id_item = pi.id_item
      join cuotas c on c.id_cuota = fi.id_cuota
     where pi.id_pago = p_id_pago and c.estado = 'Pagada'
     limit 1;
    if v_desc is not null then
      raise exception 'PAG_ITEM_YA_PAGADO|%', v_desc;
    end if;
    update pagos set estado = 'Aprobado', fecha_revision = now(),
                     id_usuario_revisa = p_usuario
     where id_pago = p_id_pago;
    update cuotas c set estado = 'Pagada', fecha_pago = v_hoy, metodo_pago = 'Transferencia'
      from factura_items fi, pago_items pi
     where pi.id_pago = p_id_pago and fi.id_item = pi.id_item and c.id_cuota = fi.id_cuota;
  end if;

  perform set_config('app.pagos', 'off', true);
  return jsonb_build_object('id_pago', p_id_pago,
                            'estado_pago', case when p_aprobar then 'Aprobado' else 'Rechazado' end,
                            'ya_revisado', false);
end $$;

-- Quien puede ver un comprobante: Admin, Directivo o el padre ACTUAL
-- del alumno. Devuelve el pago o falla con PAG_SIN_PERMISO.
create or replace function public.fn_datos_archivo(p_usuario uuid, p_id_pago integer)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare
  v_rol  text;
  v_pago record;
begin
  v_rol := public.fn_pago_actor(p_usuario, array['Admin', 'Directivo', 'Padre']);
  select p.* into v_pago from pagos p where p.id_pago = p_id_pago and p.id_factura is not null;
  if not found then
    raise exception 'PAG_NO_EXISTE';
  end if;
  if v_rol = 'Padre' and not exists (select 1 from alumnos a
                                      where a.id_alumno = v_pago.id_alumno
                                        and a.id_usuario_padre = p_usuario) then
    raise exception 'PAG_SIN_PERMISO';
  end if;
  return jsonb_build_object('id_pago', v_pago.id_pago, 'estado_pago', v_pago.estado,
                            'archivo_path', v_pago.archivo_path,
                            'archivo_tipo', v_pago.archivo_tipo,
                            'recibo_path', v_pago.recibo_path);
end $$;

-- HU56: datos del comprobante de pago, SOLO historicos (copiados en la
-- factura al emitir y en pago_items al cargar) y la fecha de
-- aprobacion. No lee alumnos ni valores actuales: regenerarlo da el
-- mismo contenido. Solo pagos aprobados.
create or replace function public.fn_datos_recibo(p_usuario uuid, p_id_pago integer)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare
  v_acceso jsonb;
  v_res    jsonb;
begin
  v_acceso := public.fn_datos_archivo(p_usuario, p_id_pago);
  if v_acceso ->> 'estado_pago' <> 'Aprobado' then
    raise exception 'PAG_SIN_RECIBO';
  end if;

  select jsonb_build_object(
           'id_pago', p.id_pago,
           'id_factura', f.id_factura,
           'anio', f.anio, 'mes', f.mes,
           'alumno', f.alumno_nombre, 'dni', f.dni, 'curso', f.curso,
           'total', p.monto_pagado,
           'metodo', p.metodo_pago,
           'fecha_carga', p.fecha_pago,
           'fecha_aprobacion', p.fecha_revision,
           'recibo_path', p.recibo_path,
           'items', (select jsonb_agg(jsonb_build_object(
                              'concepto', fi.concepto, 'descripcion', fi.descripcion,
                              'importe', pi.importe) order by fi.id_item)
                       from pago_items pi join factura_items fi on fi.id_item = pi.id_item
                      where pi.id_pago = p.id_pago))
    into v_res
    from pagos p join facturas f on f.id_factura = p.id_factura
   where p.id_pago = p_id_pago;
  return v_res;
end $$;

-- HU56: completa recibo_path una sola vez (ruta fija por pago).
create or replace function public.fn_guardar_recibo(p_id_pago integer, p_path text)
returns text language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_pago record;
begin
  if p_path is distinct from 'recibos/' || p_id_pago || '.pdf' then
    raise exception 'PAG_SOLICITUD_INVALIDA';
  end if;
  select * into v_pago from pagos where id_pago = p_id_pago for update;
  if not found or v_pago.estado is distinct from 'Aprobado' then
    raise exception 'PAG_SIN_RECIBO';
  end if;
  if v_pago.recibo_path is not null then
    return v_pago.recibo_path;
  end if;
  perform set_config('app.pagos', 'on', true);
  update pagos set recibo_path = p_path where id_pago = p_id_pago;
  perform set_config('app.pagos', 'off', true);
  return p_path;
end $$;


-- ------------------------------------------------------------
-- 6) CUOTAS: Registrar pagos (web) no puede marcar Pagada una cuota
--    cuyo item tiene un comprobante En revision, ni cambiar la fecha o
--    el metodo de una cuota ya pagada. Es el mismo cuerpo de etapa17
--    con esos dos controles agregados. El UPDATE ya tiene bloqueada la
--    cuota; el registro de un comprobante bloquea la misma fila antes
--    de validar: nunca pasan los dos.
-- ------------------------------------------------------------
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

  -- Nuevo en etapa18: una cuota pagada no cambia su fecha ni su metodo
  -- (Registrar pagos no filtra por estado: evita registrar dos veces el
  -- mismo pago si coincide con una aprobacion).
  if old.estado = 'Pagada'
     and (new.fecha_pago, new.metodo_pago) is distinct from (old.fecha_pago, old.metodo_pago) then
    raise exception 'CUO_PAGADA|%|%', old.mes, old.anio;
  end if;

  if new.estado = 'Pagada' and old.estado is distinct from 'Pagada'
     and coalesce(current_setting('app.pagos', true), '') <> 'on'
     and to_regclass('public.pago_items') is not null
     and exists (select 1
                   from factura_items fi
                   join pago_items pi on pi.id_item = fi.id_item and pi.activo
                   join pagos p on p.id_pago = pi.id_pago
                  where fi.id_cuota = new.id_cuota and p.estado = 'En revision') then
    raise exception 'CUO_EN_REVISION|%|%', old.mes, old.anio;
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


-- ------------------------------------------------------------
-- 7) SALDO (contrato de etapa17, ampliado para HU54 a HU56)
--    Mismas columnas y en el mismo orden; las nuevas, al final.
--    * Pagado: la cuota Pagada (por administracion o por un
--      comprobante aprobado) o el item en un comprobante Aprobado.
--    * En revision: el item en un comprobante En revision. NO esta
--      acreditado: sigue sumando al saldo.
--    * Sin cargo (neto 0) nunca es deuda ni dinero cobrado.
-- ------------------------------------------------------------
create or replace view v_factura_items_saldo as
select fi.id_item, fi.id_factura, f.id_alumno, f.anio, f.mes, f.fecha_vencimiento,
       fi.concepto, fi.id_cuota, fi.cuota_preexistente, fi.id_actividad,
       fi.id_recorrido, fi.descripcion, fi.importe, fi.porcentaje_beca,
       fi.descuento, fi.neto,
       coalesce(c.cubierta_por_beca, false) as cubierta_por_beca,
       case when fi.neto = 0 then 'Sin cargo'
            when (fi.concepto = 'Cuota' and c.estado = 'Pagada') or pa.estado = 'Aprobado'
              then 'Pagado'
            when pa.estado = 'En revision' then 'En revision'
            else 'Pendiente' end as estado_pago,
       case when fi.neto > 0 and pa.estado = 'Aprobado'
              then (pa.fecha_revision at time zone 'America/Argentina/Buenos_Aires')::date
            when fi.neto > 0 and fi.concepto = 'Cuota' and c.estado = 'Pagada'
              then c.fecha_pago end as fecha_pago,
       case when fi.neto = 0 or (fi.concepto = 'Cuota' and c.estado = 'Pagada')
                 or pa.estado = 'Aprobado'
            then 0::numeric(12,2) else fi.neto end as saldo,
       pa.id_pago
  from factura_items fi
  join facturas f on f.id_factura = fi.id_factura
  left join cuotas c on c.id_cuota = fi.id_cuota
  left join lateral (
    select p.id_pago, p.estado, p.fecha_revision
      from pago_items pi join pagos p on p.id_pago = pi.id_pago
     where pi.id_item = fi.id_item and pi.activo
  ) pa on true;

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
       end as estado_cobro,
       coalesce(sum(i.neto) filter (where i.estado_pago = 'En revision'), 0)::numeric(12,2)
         as en_revision
  from facturas f
  left join v_factura_items_saldo i on i.id_factura = f.id_factura
 group by f.id_factura;


-- ------------------------------------------------------------
-- 8) PERMISOS Y REALTIME
--    * Funciones: solo service_role. Supabase da EXECUTE a anon y
--      authenticated por defecto: se quita explicitamente.
--    * pagos y pago_items: authenticated solo lee (sin RLS, cualquier
--      usuario con sesion puede leerlas por la API: limite aceptado,
--      CLAUDE.md 3.1). anon, nada.
--    * pagos en supabase_realtime: el padre ve el cambio sin recargar.
-- ------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.fn_pago_actor(uuid, text[])',
    'public.fn_validar_items_pago(bigint, bigint[])',
    'public.fn_validar_solicitud(uuid, uuid, bigint, bigint[], text)',
    'public.fn_registrar_comprobante(uuid, uuid, bigint, bigint[], text, text, text)',
    'public.fn_estado_clave(uuid, uuid)',
    'public.fn_revisar_comprobante(uuid, integer, boolean, text)',
    'public.fn_datos_archivo(uuid, integer)',
    'public.fn_datos_recibo(uuid, integer)',
    'public.fn_guardar_recibo(integer, text)',
    'public.fn_proteger_pagos()']
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

revoke all on table pagos, pago_items from anon;
revoke insert, update, delete, truncate on table pagos, pago_items from authenticated;
grant select on table pagos, pago_items to authenticated;
grant all on table pagos, pago_items to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime'
                        and schemaname = 'public' and tablename = 'pagos') then
    alter publication supabase_realtime add table public.pagos;
  end if;
end $$;


-- ------------------------------------------------------------
-- 9) RESULTADO (solo lectura)
-- ------------------------------------------------------------
select 'Bucket pagos privado' as control,
       case when exists (select 1 from storage.buckets
                          where id = 'pagos' and not public and file_size_limit = 5242880
                            and allowed_mime_types @> array['image/jpeg', 'image/png', 'application/pdf']
                            and array['image/jpeg', 'image/png', 'application/pdf'] @> allowed_mime_types)
            then 'OK' else 'FALLA' end as resultado,
       'Privado, 5 MB, JPG/PNG/PDF; sin politicas nuevas' as detalle
union all
select 'Columnas nuevas de pagos',
       case when count(*) = 11 then 'OK' else 'FALLA' end,
       count(*)::text || ' de 11 con el tipo esperado'
  from information_schema.columns c
  join (values ('id_factura', 'int8'), ('id_alumno', 'int8'), ('estado', 'text'),
               ('clave', 'uuid'), ('huella', 'text'), ('archivo_path', 'text'),
               ('archivo_tipo', 'text'), ('motivo_rechazo', 'text'),
               ('fecha_revision', 'timestamptz'), ('id_usuario_revisa', 'uuid'),
               ('recibo_path', 'text')) n(col, udt)
    on c.column_name = n.col and c.udt_name = n.udt
 where c.table_schema = 'public' and c.table_name = 'pagos'
union all
select 'Tabla pago_items e indice unico',
       case when to_regclass('public.pago_items') is not null
             and to_regclass('public.uq_pago_item_activo') is not null
             and to_regclass('public.uq_pagos_clave') is not null
            then 'OK' else 'FALLA' end,
       'Un item en un solo comprobante no rechazado; una clave por envio'
union all
select 'Triggers de proteccion',
       case when count(*) = 2 then 'OK' else 'FALLA' end,
       count(*)::text || ' de 2 (pagos y pago_items)'
  from pg_trigger where tgname in ('trg_proteger_pagos', 'trg_proteger_pago_items')
union all
select 'Funciones: security definer y search_path',
       case when count(*) filter (where p.prosecdef
                                    and exists (select 1 from unnest(p.proconfig) cfg
                                                 where cfg like 'search_path=%')) = 9
            then 'OK' else 'FALLA' end,
       count(*) filter (where p.prosecdef)::text || ' de 9 security definer'
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public'
   and p.proname in ('fn_pago_actor', 'fn_validar_items_pago', 'fn_validar_solicitud',
                     'fn_registrar_comprobante', 'fn_estado_clave', 'fn_revisar_comprobante',
                     'fn_datos_archivo', 'fn_datos_recibo', 'fn_guardar_recibo')
union all
select 'Funciones: solo service_role',
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')
                          and not has_function_privilege('authenticated', p.oid, 'execute')
                          and has_function_privilege('service_role', p.oid, 'execute'))
            then 'OK' else 'FALLA' end,
       'anon y authenticated sin EXECUTE; service_role con EXECUTE'
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public'
   and p.proname in ('fn_pago_actor', 'fn_validar_items_pago', 'fn_validar_solicitud',
                     'fn_registrar_comprobante', 'fn_estado_clave', 'fn_revisar_comprobante',
                     'fn_datos_archivo', 'fn_datos_recibo', 'fn_guardar_recibo')
union all
select 'pagos: authenticated solo lee',
       case when has_table_privilege('authenticated', 'public.pagos', 'select')
             and not has_table_privilege('authenticated', 'public.pagos', 'insert')
             and not has_table_privilege('authenticated', 'public.pago_items', 'update')
             and not has_table_privilege('anon', 'public.pagos', 'select')
            then 'OK' else 'FALLA' end,
       'Sin sesion no se lee; con sesion solo lectura'
union all
select 'Vistas de saldo con En revision',
       case when exists (select 1 from information_schema.columns
                          where table_schema = 'public' and table_name = 'v_facturas_saldo'
                            and column_name = 'en_revision')
             and exists (select 1 from information_schema.columns
                          where table_schema = 'public' and table_name = 'v_factura_items_saldo'
                            and column_name = 'id_pago')
            then 'OK' else 'FALLA' end,
       'Columnas nuevas al final: en_revision e id_pago'
union all
select 'Realtime: pagos publicada',
       case when exists (select 1 from pg_publication_tables
                          where pubname = 'supabase_realtime'
                            and schemaname = 'public' and tablename = 'pagos')
            then 'OK' else 'FALLA' end,
       'Si FALLA, revisar que exista la publicacion supabase_realtime'
union all
select 'RLS en pagos (informativo)',
       case when relrowsecurity then 'ACTIVO' else 'INACTIVO' end,
       case when relrowsecurity then 'Avisar al equipo'
            else 'Esperado para esta demo (CLAUDE.md, seccion 3.1)' end
  from pg_class where oid = to_regclass('public.pagos')
union all
select 'Comprobantes cargados', 'INFO',
       coalesce(string_agg(estado || ': ' || n, ', ' order by estado), '(ninguno)')
  from (select estado, count(*)::text as n from pagos
         where id_factura is not null group by 1) x;

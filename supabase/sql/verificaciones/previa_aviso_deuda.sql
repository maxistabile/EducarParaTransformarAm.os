-- ============================================================
-- PREVIA DE LA PRUEBA CONTROLADA DEL AVISO DE DEUDA (HU61) - SOLO LECTURA
--
-- Antes de pedirle a la Edge Function "avisos" que rehaga un dia 20
-- pasado (recuperar), muestra que se mandaria. No envia, no reserva y
-- no modifica nada: fn_avisos_deuda es STABLE y solo lee.
--
-- Como usarlo (Supabase -> SQL Editor):
--   1. Reemplazar <correo_del_equipo> por el correo autorizado (el de
--      EMAIL_ALLOWLIST) SOLO en el editor; no guardarlo en el repo.
--   2. La fecha es el ultimo dia 20 pasado: 2026-10-20. Si se usa otro,
--      cambiarlo en las tres consultas.
--
-- Que tiene que dar para que la prueba sirva:
--   P1. del_equipo = 1: el padre con ese correo tiene deuda vencida a
--       esa fecha. Si da 0, la prueba no le mandaria nada (ver la guia).
--   P2. El detalle de ese padre: total e items, sin datos de otros.
--   P3. Que no haya ya un envio de Deuda de ese periodo para ese
--       correo (si esta Enviado, la funcion no lo repite: RNF9).
--   otros_padres: cuantos registros "Omitido" dejaria la prueba (a
--   ellos no se les envia nada: estan fuera de la allowlist).
-- Solo ASCII.
-- ============================================================

-- P1. Destinatarios a esa fecha
with d as (
  select jsonb_array_elements(public.fn_avisos_deuda(date '2026-10-20')) as p
)
select count(*) as destinatarios,
       count(*) filter (where lower(p ->> 'email') = lower('<correo_del_equipo>')) as del_equipo,
       count(*) filter (where lower(coalesce(p ->> 'email', '')) <> lower('<correo_del_equipo>')) as otros_padres
  from d;

-- P2. Lo que recibiria el correo del equipo
with d as (
  select jsonb_array_elements(public.fn_avisos_deuda(date '2026-10-20')) as p
)
select p ->> 'nombre' as padre, (p ->> 'total')::numeric as total,
       (p ->> 'en_revision')::numeric as en_revision,
       jsonb_array_length(p -> 'items') as items, p -> 'items' as detalle
  from d
 where lower(p ->> 'email') = lower('<correo_del_equipo>');

-- P3. Envios de Deuda ya registrados para ese periodo
select estado, motivo, intentos, enviado_en,
       (lower(email) = lower('<correo_del_equipo>')) as es_del_equipo
  from avisos_envios
 where tipo = 'Deuda' and anio = 2026 and mes = 10
 order by es_del_equipo desc, creado desc;

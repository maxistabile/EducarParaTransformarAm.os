-- ============================================================
-- PROGRAMAR LA FACTURACION Y LOS AVISOS (pg_cron) - HU50 etapa B,
-- HU60 y HU61
--
-- Se corre A MANO y una sola vez, cuando el equipo decide activarlo:
-- DESPUES de etapa21, de publicar la Edge Function "avisos" y de
-- probarla en modo simulacion (supabase/functions/README.md).
-- Para apagarlo: desprogramar_avisos_cron.sql.
--
-- Requisitos (se hacen a mano, ANTES de correr este script):
--   1. Extensiones pg_cron y pg_net activas
--      (Dashboard -> Database -> Extensions).
--   2. Dos secretos en Vault, creados en el SQL Editor SIN guardar los
--      valores en el repo:
--        select vault.create_secret('https://<ref>.supabase.co/functions/v1/avisos', 'avisos_url');
--        select vault.create_secret('<el mismo valor que el secret AVISOS_CLAVE>', 'avisos_clave');
--
-- Horario: pg_cron de Supabase trabaja en UTC. Argentina es UTC-3 todo
-- el anio (sin horario de verano), asi que 12, 16 y 20 UTC son las 9,
-- 13 y 17 de Argentina. La Edge Function calcula la fecha en
-- America/Argentina/Buenos_Aires y decide sola: el ultimo dia habil
-- factura el mes siguiente y manda el correo con la factura; el dia 20
-- manda el aviso de deuda; los demas dias no hace nada. Correr tres
-- veces por dia no duplica: solo reintenta lo que quedo pendiente.
-- Solo ASCII. Idempotente: si ya estaba programado, lo reemplaza.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'AVISOS_FALTA_PG_CRON|Activar la extension pg_cron (Database -> Extensions)';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'AVISOS_FALTA_PG_NET|Activar la extension pg_net (Database -> Extensions)';
  end if;
  if to_regprocedure('public.fn_aviso_reservar(text, integer, integer, uuid, text, jsonb)') is null then
    raise exception 'AVISOS_REQUIERE_ETAPA21|Primero hay que ejecutar etapa21_avisos_facturacion.sql';
  end if;
  if (select count(*) from vault.decrypted_secrets where name in ('avisos_url', 'avisos_clave')) <> 2 then
    raise exception 'AVISOS_FALTA_SECRETO|Crear avisos_url y avisos_clave en Vault (ver el encabezado)';
  end if;
end $$;

-- Dispara la Edge Function con el secreto de Vault (nunca queda escrito
-- en el job ni en el repo). Solo la usa pg_cron.
create or replace function public.fn_avisos_disparar()
returns bigint language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_url   text;
  v_clave text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'avisos_url';
  select decrypted_secret into v_clave from vault.decrypted_secrets where name = 'avisos_clave';
  return net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-avisos-clave', v_clave),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
end $$;
revoke all on function public.fn_avisos_disparar() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname in ('avisos-09', 'avisos-13', 'avisos-17');
select cron.schedule('avisos-09', '0 12 * * *', 'select public.fn_avisos_disparar()');
select cron.schedule('avisos-13', '0 16 * * *', 'select public.fn_avisos_disparar()');
select cron.schedule('avisos-17', '0 20 * * *', 'select public.fn_avisos_disparar()');

-- Resultado: tres tareas activas
select jobname, schedule, active, command
  from cron.job
 where jobname like 'avisos-%'
 order by jobname;

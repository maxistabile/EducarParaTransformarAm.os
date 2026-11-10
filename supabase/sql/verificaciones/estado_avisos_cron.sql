-- ============================================================
-- ESTADO DEL CRON DE AVISOS (HU50 etapa B, HU60 y HU61) - SOLO LECTURA
--
-- Sirve para comprobar una EJECUCION PROGRAMADA (no la invocacion
-- manual). No programa, no desprograma, no dispara la funcion y no lee
-- secretos de Vault. Se corre en Supabase -> SQL Editor despues de un
-- horario del cron: 9, 13 o 17 de Argentina (12, 16 o 20 UTC).
--
-- Que se espera ver:
--   C1. Los tres jobs (avisos-09, avisos-13, avisos-17) activos.
--   C2. Al menos una corrida con status 'succeeded' cuyo start_time sea
--       posterior a la activacion y coincida con un horario programado
--       (minuto 0 de las 12, 16 o 20 UTC). Una invocacion manual desde
--       SQL NO aparece aca: esta tabla solo registra corridas de pg_cron.
--   C3. La respuesta HTTP de la Edge Function para esa corrida
--       (status_code 200 y "ok":true en el contenido). net._http_response
--       guarda las respuestas pocas horas: revisarla el mismo dia.
--   C4. Los dias que no son el ultimo dia habil ni el 20, la funcion
--       responde ok y no envia nada: avisos_envios no cambia. Eso es
--       correcto; la corrida igual prueba que el cron funciona.
-- Solo ASCII.
-- ============================================================

-- C1. Jobs programados
select jobid, jobname, schedule, active
  from cron.job
 where jobname in ('avisos-09', 'avisos-13', 'avisos-17')
 order by jobname;

-- C2. Ultimas corridas registradas por pg_cron
select j.jobname, d.runid, d.status, d.return_message,
       d.start_time, d.end_time
  from cron.job j
  join cron.job_run_details d on d.jobid = j.jobid
 where j.jobname in ('avisos-09', 'avisos-13', 'avisos-17')
 order by d.start_time desc
 limit 10;

-- Si C2 no devuelve filas: comprobar que el registro de corridas este
-- activo (se espera 'on') y que la hora del servidor sea posterior a un
-- horario programado.
show cron.log_run;
select now() as ahora_utc,
       now() at time zone 'America/Argentina/Buenos_Aires' as ahora_argentina;

-- C3. Respuestas HTTP recientes de pg_net (sin encabezados ni claves)
select id, status_code, left(content::text, 200) as contenido, created
  from net._http_response
 order by created desc
 limit 5;

-- Envios registrados (solo conteos; sin correos)
select tipo, anio, mes, estado, count(*) as envios
  from avisos_envios
 group by tipo, anio, mes, estado
 order by anio desc, mes desc, tipo, estado;

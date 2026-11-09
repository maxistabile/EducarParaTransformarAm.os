-- ============================================================
-- APAGAR LA FACTURACION Y LOS AVISOS PROGRAMADOS (pg_cron)
-- Se corre a mano. No borra datos: solo quita las tareas.
-- Solo ASCII. Idempotente.
-- ============================================================
select cron.unschedule(jobid) from cron.job where jobname in ('avisos-09', 'avisos-13', 'avisos-17');

-- Resultado: no tiene que quedar ninguna fila
select jobname, schedule, active from cron.job where jobname like 'avisos-%';

-- ════════════════════════════════════════════════════════════════
-- ETAPA 6 — Registro de pagos de cuotas
-- Correr en: Supabase → SQL Editor
-- ════════════════════════════════════════════════════════════════

-- Agregar campos de pago a la tabla cuotas
alter table cuotas
  add column if not exists fecha_pago   date,
  add column if not exists metodo_pago  text
    check (metodo_pago in ('Efectivo', 'Transferencia', 'Tarjeta de débito', 'Tarjeta de crédito', 'Cheque', 'Otro'));

-- Índice para consultas frecuentes de cuotas pendientes
create index if not exists idx_cuotas_estado
  on cuotas(estado);

create index if not exists idx_cuotas_alumno_mes
  on cuotas(id_alumno, anio, mes);

-- ════════════════════════════════════════════════════════════════
-- ETAPA 7 — Bolsa de empleos institucional
-- Correr en: Supabase → SQL Editor
-- ════════════════════════════════════════════════════════════════

create table if not exists empleos (
  id_empleo         bigint generated always as identity primary key,
  titulo            text not null,
  descripcion       text,
  area              text,
  requisitos        text,
  tipo_contrato     text check (tipo_contrato in (
                      'Full-time', 'Part-time', 'Pasantía', 'Suplencia', 'Temporal')),
  activo            boolean not null default true,
  fecha_publicacion date    not null default current_date,
  fecha_cierre      date,
  fecha_registro    timestamptz not null default now()
);

-- Si la tabla ya existe sin tipo_contrato, correr:
alter table empleos
  add column if not exists tipo_contrato text
    check (tipo_contrato in ('Full-time', 'Part-time', 'Pasantía', 'Suplencia', 'Temporal'));

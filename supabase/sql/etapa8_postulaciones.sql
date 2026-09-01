-- ════════════════════════════════════════════════════════════════
-- ETAPA 8 — Postulaciones a empleos
-- Correr en: Supabase → SQL Editor
-- ════════════════════════════════════════════════════════════════

create table if not exists postulaciones (
  id_postulacion    bigint generated always as identity primary key,
  id_empleo         bigint not null references empleos(id_empleo) on delete cascade,
  nombre            text not null,
  apellido          text not null,
  email             text not null,
  telefono          text,
  mensaje           text,
  estado            text not null default 'Recibida'
                    check (estado in ('Recibida', 'En revisión', 'Entrevista', 'Seleccionada', 'Rechazada')),
  fecha_postulacion timestamptz not null default now()
);

-- Si la tabla ya existe sin el campo estado, correr:
alter table postulaciones
  add column if not exists estado text not null default 'Recibida'
    check (estado in ('Recibida', 'En revisión', 'Entrevista', 'Seleccionada', 'Rechazada'));

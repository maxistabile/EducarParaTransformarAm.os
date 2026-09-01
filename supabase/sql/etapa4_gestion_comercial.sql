-- ════════════════════════════════════════════════════════════════
-- ETAPA 4 — R4 · Gestión comercial: becas, sueldos y compras
-- Correr en: Supabase → SQL Editor
-- ════════════════════════════════════════════════════════════════
--
-- NOTA: asume que alumnos.id_alumno es bigint. Si tu tabla usa
-- integer, reemplazá "bigint" por "integer" en id_alumno.
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- Becas: porcentaje de descuento por alumno (una beca por alumno)
-- ────────────────────────────────────────────────────────────────
create table if not exists becas (
  id_beca            bigint generated always as identity primary key,
  id_alumno          bigint not null
                     references alumnos(id_alumno) on delete cascade,
  porcentaje         numeric(5,2) not null
                     check (porcentaje > 0 and porcentaje <= 100),
  motivo             text,
  activo             boolean not null default true,
  fecha_otorgamiento date not null default current_date,
  unique (id_alumno)
);

-- ────────────────────────────────────────────────────────────────
-- Sueldos del personal
-- ────────────────────────────────────────────────────────────────
create table if not exists sueldos (
  id_sueldo      bigint generated always as identity primary key,
  id_usuario     uuid references usuarios(id_usuario) on delete set null,
  mes            int  not null check (mes between 1 and 12),
  anio           int  not null,
  monto          numeric(12,2) not null check (monto >= 0),
  estado         text not null default 'Pendiente'
                 check (estado in ('Pendiente', 'Pagado')),
  fecha_pago     date,
  fecha_registro timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────
-- Compras de insumos para laboratorios y enfermería
-- ────────────────────────────────────────────────────────────────
create table if not exists compras_insumos (
  id_compra      bigint generated always as identity primary key,
  descripcion    text not null,
  destino        text not null check (destino in (
                   'Laboratorio de computación',
                   'Laboratorio de física',
                   'Laboratorio de química',
                   'Enfermería')),
  cantidad       int  not null default 1 check (cantidad > 0),
  monto          numeric(12,2) not null check (monto >= 0),
  proveedor      text,
  fecha_compra   date not null default current_date,
  fecha_registro timestamptz not null default now()
);
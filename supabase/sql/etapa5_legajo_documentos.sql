-- ════════════════════════════════════════════════════════════════
-- ETAPA 5 — R1 / R3 · Legajo digital: documentación del alumno
-- Correr en: Supabase → SQL Editor
-- ════════════════════════════════════════════════════════════════
--
-- NOTA: asume que alumnos.id_alumno es bigint. Si tu tabla usa
-- integer, reemplazá "bigint" por "integer" en id_alumno.
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- Documentación adjunta al legajo de cada alumno
-- ────────────────────────────────────────────────────────────────
create table if not exists documentos_alumno (
  id_documento bigint generated always as identity primary key,
  id_alumno    bigint not null
               references alumnos(id_alumno) on delete cascade,
  nombre       text not null,
  tipo         text,
  url_archivo  text not null,
  fecha_carga  timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════
-- IMPORTANTE — Crear el bucket de Storage para los documentos:
--
--   1. Supabase → Storage → New bucket
--   2. Nombre del bucket:  documentos-alumnos
--   3. Marcalo como "Public bucket" (para poder abrir los archivos
--      con un enlace directo, igual que el bucket de la galería).
--
-- Sin ese bucket, la subida de documentos fallará.
-- ════════════════════════════════════════════════════════════════
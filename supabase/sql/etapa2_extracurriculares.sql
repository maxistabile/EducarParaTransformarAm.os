-- ════════════════════════════════════════════════════════════════
-- ETAPA 2 — R2 · Servicios extracurriculares con control de cupos
-- Correr en: Supabase → SQL Editor
-- ════════════════════════════════════════════════════════════════
--
-- NOTA SOBRE TIPOS: estas tablas asumen que `alumnos.id_alumno` es
-- de tipo bigint (int8). Si tu tabla `alumnos` usa integer (int4),
-- reemplazá "bigint" por "integer" en la columna id_alumno.
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- Catálogo de actividades (idiomas y deportes)
-- ────────────────────────────────────────────────────────────────
create table if not exists actividades_extracurriculares (
  id_actividad  bigint generated always as identity primary key,
  nombre        text    not null,
  tipo          text    not null check (tipo in ('Idioma', 'Deporte')),
  descripcion   text,
  cupo_maximo   int     not null default 20 check (cupo_maximo > 0),
  activo        boolean not null default true
);

-- ────────────────────────────────────────────────────────────────
-- Inscripciones de alumnos a actividades
--   Cancelar una inscripción = borrar la fila.
--   El UNIQUE evita que un alumno se anote dos veces a lo mismo.
-- ────────────────────────────────────────────────────────────────
create table if not exists inscripciones_actividades (
  id_inscripcion_act bigint generated always as identity primary key,
  id_actividad       bigint not null
                     references actividades_extracurriculares(id_actividad)
                     on delete cascade,
  id_alumno          bigint not null
                     references alumnos(id_alumno)
                     on delete cascade,
  fecha_inscripcion  timestamptz not null default now(),
  unique (id_actividad, id_alumno)
);

-- ────────────────────────────────────────────────────────────────
-- Bloqueo automático de cupo
--   Antes de insertar, verifica que no se haya alcanzado el máximo.
--   Si está completo, rechaza la inscripción.
-- ────────────────────────────────────────────────────────────────
create or replace function fn_check_cupo_actividad()
returns trigger
language plpgsql
as $$
declare
  v_cupo     int;
  v_actuales int;
begin
  select cupo_maximo into v_cupo
    from actividades_extracurriculares
    where id_actividad = new.id_actividad;

  select count(*) into v_actuales
    from inscripciones_actividades
    where id_actividad = new.id_actividad;

  if v_actuales >= v_cupo then
    raise exception 'Cupo completo para esta actividad';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_cupo on inscripciones_actividades;
create trigger trg_check_cupo
  before insert on inscripciones_actividades
  for each row execute function fn_check_cupo_actividad();

-- ────────────────────────────────────────────────────────────────
-- Carga inicial: 3 idiomas + 8 disciplinas deportivas (R2)
-- ────────────────────────────────────────────────────────────────
insert into actividades_extracurriculares (nombre, tipo, descripcion, cupo_maximo)
values
  ('Inglés',        'Idioma',  'Taller de idioma inglés',        25),
  ('Portugués',     'Idioma',  'Taller de idioma portugués',     25),
  ('Francés',       'Idioma',  'Taller de idioma francés',       25),
  ('Atletismo',     'Deporte', 'Disciplina de atletismo',        20),
  ('Natación',      'Deporte', 'Disciplina de natación',         20),
  ('Fútbol',        'Deporte', 'Disciplina de fútbol',           22),
  ('Artes marciales','Deporte','Disciplina de artes marciales',  18),
  ('Vóleibol',      'Deporte', 'Disciplina de vóleibol',         20),
  ('Danza',         'Deporte', 'Disciplina de danza',            20),
  ('Básquet',       'Deporte', 'Disciplina de básquet',          20),
  ('Ajedrez',       'Deporte', 'Disciplina de ajedrez',          16)
on conflict do nothing;
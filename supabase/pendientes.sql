-- ============================================================
-- SQL PENDIENTE - proyecto AMIFOS (solo ASCII, sin emojis/tildes)
-- Correr en el SQL Editor de Supabase.
-- ============================================================


-- ------------------------------------------------------------
-- PENDIENTE 1 - Bloque 2: cupo de cursos + anti-duplicado
-- Para que no se asigne un alumno a un curso lleno, ni se
-- inscriba dos veces a la misma actividad.
-- ------------------------------------------------------------

create or replace function public.check_cupo_curso()
returns trigger language plpgsql as $$
declare cap int; ocupados int;
begin
  if new.id_curso is null then return new; end if;
  if tg_op = 'UPDATE' and new.id_curso is not distinct from old.id_curso then
    return new;
  end if;
  perform 1 from cursos where id_curso = new.id_curso for update;
  select capacidad_maxima into cap from cursos where id_curso = new.id_curso;
  select count(*) into ocupados from alumnos
    where id_curso = new.id_curso and activo = true
      and (tg_op <> 'UPDATE' or id_alumno <> new.id_alumno);
  if cap is not null and ocupados >= cap then
    raise exception 'Cupo completo';
  end if;
  return new;
end $$;

drop trigger if exists trg_cupo_curso on alumnos;
create trigger trg_cupo_curso
  before insert or update of id_curso on alumnos
  for each row execute function public.check_cupo_curso();

do $$ begin
  alter table inscripciones_actividades
    add constraint uq_insc_act unique (id_actividad, id_alumno);
exception when duplicate_table or duplicate_object then null; end $$;


-- ------------------------------------------------------------
-- PENDIENTE 2 - Bloque 3: fecha de nacimiento + NOT NULL
-- (el dni_chk ya esta aplicado)
-- ------------------------------------------------------------

do $$ begin
  alter table inscripciones alter column nombre_aspirante set not null;
  alter table inscripciones alter column dni_aspirante set not null;
exception when others then null; end $$;

alter table inscripciones drop constraint if exists nac_chk;
alter table inscripciones
  add constraint nac_chk check (fecha_nacimiento_aspirante <= current_date) not valid;


-- ------------------------------------------------------------
-- TEST (opcional) - verifica que el cupo de cursos rechaza.
-- Usa un curso existente: lo deja "lleno" un instante, intenta
-- agregar un alumno (debe fallar) y restaura todo. No persiste nada.
-- Mira el resultado en la pestania Messages/Notices.
-- ------------------------------------------------------------

create or replace function pg_temp.test_cupo_curso() returns text
language plpgsql as $$
declare
  v_curso int;
  v_cap   int;
  v_cnt   int;
  v_ok    boolean := false;
begin
  -- tomar cualquier curso existente
  select id_curso, capacidad_maxima into v_curso, v_cap
  from cursos order by id_curso limit 1;
  if v_curso is null then
    return 'SIN DATOS: no hay cursos para probar.';
  end if;

  -- alumnos activos que tiene hoy
  select count(*) into v_cnt from alumnos
  where id_curso = v_curso and activo = true;

  -- dejarlo lleno: capacidad = ocupados actuales
  update cursos set capacidad_maxima = v_cnt where id_curso = v_curso;

  -- intentar agregar un alumno -> el trigger DEBE rechazarlo
  begin
    insert into alumnos (nombre, apellido, dni, fecha_nacimiento, id_curso, activo)
    values ('Test','Cupo','TESTCUPO_X','2015-01-01', v_curso, true);
    v_ok := false;  -- si entro, NO bloqueo
  exception when others then
    if sqlerrm like '%Cupo completo%' then
      v_ok := true;
    else
      update cursos set capacidad_maxima = v_cap where id_curso = v_curso;
      raise;
    end if;
  end;

  -- limpiar (por si llego a entrar) y restaurar capacidad original
  delete from alumnos where dni = 'TESTCUPO_X';
  update cursos set capacidad_maxima = v_cap where id_curso = v_curso;

  if v_ok then
    return 'OK: el trigger rechazo la asignacion con Cupo completo.';
  else
    return 'FALLA: el trigger NO bloqueo el cupo.';
  end if;
end $$;

select pg_temp.test_cupo_curso() as resultado;

-- ═══════════════════════════════════════════════════════════════════════════
-- Backfill: docentes existentes sin fila en `docentes`
-- (usuarios con rol Docente creados antes de que el panel insertara la fila).
-- Correr una vez en el SQL editor de Supabase.
--
-- Nota: `docentes.dni` es UNIQUE. Para docentes sin DNI usamos NULL (Postgres
-- permite múltiples NULL en columnas UNIQUE, pero NO múltiples ''), así que
-- primero permitimos NULL en la columna.
-- ═══════════════════════════════════════════════════════════════════════════
alter table docentes alter column dni drop not null;

insert into docentes (id_usuario, dni, activo)
select u.id_usuario, null, true
from usuarios u
where u.rol = 'Docente'
  and not exists (
    select 1 from docentes d where d.id_usuario = u.id_usuario
  );

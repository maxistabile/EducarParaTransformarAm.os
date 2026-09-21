-- ============================================================
-- ETAPA 9 - TP Metodologia de Sistemas II - MODULO ALUMNOS (RF1)
-- Historias de usuario HU7 a HU10.
-- Correr en: Supabase -> SQL Editor, ANTES de subir el frontend.
--
-- Es idempotente: se puede correr mas de una vez sin romper nada.
-- Solo ASCII (sin tildes ni emojis), igual que pendientes.sql.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Campos minimos que pide el enunciado para cada alumno
--    Ya existian: nombre, apellido, dni (UNIQUE), fecha_nacimiento,
--    id_curso, activo (= "estado del alumno") y direccion
--    (= "domicilio"). Solo faltan legajo, telefono y email.
--    `telefono_emergencia` NO se reutiliza: es el telefono del
--    contacto de emergencia, no el del alumno.
-- ------------------------------------------------------------
alter table alumnos add column if not exists legajo   text;
alter table alumnos add column if not exists telefono text;
alter table alumnos add column if not exists email    text;


-- ------------------------------------------------------------
-- 2) Legajo automatico: A00001, A00002, ...
--    Lo asigna la base, asi que TODAS las altas existentes
--    (GestionAlumnos y el alta desde GestionUsuarios) lo
--    reciben sin tener que modificar su codigo.
-- ------------------------------------------------------------
create sequence if not exists alumnos_legajo_seq;

create or replace function public.fn_nuevo_legajo_alumno()
returns text language plpgsql as $$
declare n bigint := nextval('alumnos_legajo_seq');
begin
  -- greatest(): si algun dia se superan 99999 no se trunca el numero
  return 'A' || lpad(n::text, greatest(5, length(n::text)), '0');
end $$;

-- Backfill de los alumnos ya cargados, en orden de alta (id)
do $$
declare r record;
begin
  for r in select id_alumno from alumnos
           where legajo is null order by id_alumno loop
    update alumnos set legajo = public.fn_nuevo_legajo_alumno()
     where id_alumno = r.id_alumno;
  end loop;
end $$;

alter table alumnos alter column legajo set default public.fn_nuevo_legajo_alumno();
alter table alumnos alter column legajo set not null;
create unique index if not exists uq_alumnos_legajo on alumnos(legajo);


-- ------------------------------------------------------------
-- 3) AJUSTE AL TRIGGER DE CUPO EXISTENTE (trg_cupo_curso)
--
--    Por que: el modulo ahora permite ACTIVAR / DESACTIVAR
--    alumnos (RF1.4). El trigger original solo controlaba el
--    cupo cuando cambiaba id_curso, entonces reactivar un alumno
--    en un curso lleno lo dejaba pasar.
--
--    Cambio: tambien se controla al pasar de inactivo a activo.
--    Todo lo demas queda igual (mismo mensaje 'Cupo completo',
--    mismo lock de la fila del curso, mismo conteo de activos).
-- ------------------------------------------------------------
create or replace function public.check_cupo_curso()
returns trigger language plpgsql as $$
declare cap int; ocupados int;
begin
  if new.id_curso is null then return new; end if;
  -- Un alumno inactivo no ocupa lugar en el curso
  if new.activo is false then return new; end if;
  -- En un UPDATE solo se controla si cambia el curso o si se reactiva
  if tg_op = 'UPDATE'
     and new.id_curso is not distinct from old.id_curso
     and old.activo is not false then
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
  before insert or update of id_curso, activo on alumnos
  for each row execute function public.check_cupo_curso();


-- ------------------------------------------------------------
-- VERIFICACION (opcional). No persiste nada.
-- Mira el resultado en la pestania Messages / Notices.
-- Al terminar restaura la secuencia: no deja huecos en los legajos.
-- ------------------------------------------------------------
do $$
declare v_leg text; v_last bigint; v_called boolean;
begin
  select last_value, is_called into v_last, v_called from alumnos_legajo_seq;
  insert into alumnos (nombre, apellido, dni, fecha_nacimiento, activo)
  values ('Test', 'Legajo', 'TEST_RF1_X', '2015-01-01', false)
  returning legajo into v_leg;

  if v_leg ~ '^A[0-9]{5,}$' then
    raise notice 'OK 1/2: legajo asignado automaticamente (%)', v_leg;
  else
    raise notice 'FALLA 1/2: el legajo no se genero bien (%)', v_leg;
  end if;

  -- DNI duplicado: lo rechaza la restriccion existente alumnos_dni_key
  begin
    insert into alumnos (nombre, apellido, dni, fecha_nacimiento, activo)
    values ('Test', 'Duplicado', 'TEST_RF1_X', '2015-01-01', false);
    raise notice 'FALLA 2/2: se permitio un DNI duplicado';
  exception when unique_violation then
    raise notice 'OK 2/2: el DNI duplicado fue rechazado';
  end;

  delete from alumnos where dni = 'TEST_RF1_X';
  perform setval('alumnos_legajo_seq', v_last, v_called);
end $$;

-- ============================================================
-- ETAPA 11 - TP Metodologia de Sistemas II - MODULO PROFESORES (RF2)
-- Historias de usuario HU11 a HU14.
-- Correr en: Supabase -> SQL Editor, ANTES de subir el frontend.
-- Idempotente y solo ASCII.
--
-- Datos minimos del profesor segun el enunciado y donde viven:
--   legajo            -> docentes.legajo      (NUEVO, automatico)
--   dni               -> docentes.dni         (ya existia, UNIQUE)
--   especialidad      -> docentes.especialidad (ya existia)
--   estado            -> docentes.activo      (ya existia)
--   nombre, apellido,
--   email, telefono   -> usuarios             (ya existian)
--
-- docentes.dni sigue aceptando NULL en la base porque los docentes
-- cargados antes quedaron sin DNI (ver pendientes.sql). El sistema
-- ahora lo exige al registrar y al editar, asi se van completando.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Legajo automatico: D00001, D00002, ...
--    Lo asigna la base, asi que el alta existente desde
--    Usuarios (crearRegistroDocente) lo recibe sin cambios.
-- ------------------------------------------------------------
alter table docentes add column if not exists legajo text;

create sequence if not exists docentes_legajo_seq;

create or replace function public.fn_nuevo_legajo_docente()
returns text language plpgsql as $$
declare n bigint := nextval('docentes_legajo_seq');
begin
  return 'D' || lpad(n::text, greatest(5, length(n::text)), '0');
end $$;

-- Backfill de los docentes ya cargados, en orden de alta (id)
do $$
declare r record;
begin
  for r in select id_docente from docentes
           where legajo is null order by id_docente loop
    update docentes set legajo = public.fn_nuevo_legajo_docente()
     where id_docente = r.id_docente;
  end loop;
end $$;

alter table docentes alter column legajo set default public.fn_nuevo_legajo_docente();
alter table docentes alter column legajo set not null;
create unique index if not exists uq_docentes_legajo on docentes(legajo);


-- ------------------------------------------------------------
-- VERIFICACION (opcional). No persiste nada y restaura la
-- secuencia al terminar. Mira el resultado en Messages.
-- ------------------------------------------------------------
do $$
declare v_leg text; v_last bigint; v_called boolean;
        v_sin_dni int;
begin
  select last_value, is_called into v_last, v_called from docentes_legajo_seq;

  insert into docentes (dni, activo) values ('TEST_RF2_X', false)
  returning legajo into v_leg;
  if v_leg ~ '^D[0-9]{5,}$' then
    raise notice 'OK 1/2: legajo asignado automaticamente (%)', v_leg;
  else
    raise notice 'FALLA 1/2: el legajo no se genero bien (%)', v_leg;
  end if;

  -- DNI duplicado: lo rechaza la restriccion existente docentes_dni_key
  begin
    insert into docentes (dni, activo) values ('TEST_RF2_X', false);
    raise notice 'FALLA 2/2: se permitio un DNI duplicado';
  exception when unique_violation then
    raise notice 'OK 2/2: el DNI duplicado fue rechazado';
  end;

  delete from docentes where dni = 'TEST_RF2_X';
  perform setval('docentes_legajo_seq', v_last, v_called);

  select count(*) into v_sin_dni from docentes where dni is null;
  if v_sin_dni > 0 then
    raise notice 'INFO: hay % docente(s) sin DNI. Completalos desde Docentes -> Editar.', v_sin_dni;
  end if;
end $$;

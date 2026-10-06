-- ============================================================
-- ETAPA 12 - TP Metodologia de Sistemas II - MODULO ACADEMICO
--   RF3.1 / RF3.2  Niveles            (HU3, HU4)
--   RF3.3 / RF3.4  Cursos             (HU5, HU6)
--   RF3.5 / RF3.6  Materias           (HU15, HU16)
--   RF3.7 / RF3.8  Horarios           (HU17, HU18)
--   RF2.5          Asignaciones       (HU19)
--
-- Correr en: Supabase -> SQL Editor, ANTES de subir el frontend.
-- Idempotente y solo ASCII (las letras con tilde van como \u00XX).
-- Si ya hay datos duplicados NO falla: avisa en Messages que
-- corregir, y se vuelve a correr cuando este resuelto.
-- ============================================================


-- ------------------------------------------------------------
-- 1) NIVELES (RF3.1, RF3.2)
--    Regla de la institucion: existen SOLO tres niveles.
--    Inicial:    Sala de 3, Sala de 4, Sala de 5
--    Primario:   1er a 7mo grado
--    Secundario: 1er a 5to anio
-- ------------------------------------------------------------
create table if not exists niveles (
  id_nivel    serial primary key,
  nombre      varchar not null unique
              check (nombre in ('Inicial', 'Primario', 'Secundario')),
  descripcion text,
  orden       int not null default 0,
  activo      boolean not null default true
);

insert into niveles (nombre, descripcion, orden) values
  ('Inicial',    E'Salas de 3, 4 y 5 a\u00f1os',   1),
  ('Primario',   E'De 1er grado a 7mo grado',     2),
  ('Secundario', E'De 1er a\u00f1o a 5to a\u00f1o', 3)
on conflict (nombre) do nothing;

-- Cada curso pertenece a un nivel REGISTRADO (clave foranea).
-- cursos.nivel sigue siendo texto, asi que ninguna consulta
-- existente del sistema cambia.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_cursos_nivel') then
    alter table cursos add constraint fk_cursos_nivel
      foreign key (nivel) references niveles(nombre) on update cascade;
  end if;
end $$;


-- ------------------------------------------------------------
-- 2) CURSOS sin duplicados (RF3.3)
--    No puede haber dos cursos con el mismo nivel, grado y
--    division. Ignora mayusculas y espacios ("1er grado" = "1ER GRADO ").
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from cursos
             group by nivel, lower(btrim(grado_anio)), upper(btrim(division))
             having count(*) > 1) then
    raise notice 'ATENCION: hay cursos duplicados (mismo nivel, grado y division). Corregirlos y volver a correr el bloque 2.';
  else
    create unique index if not exists uq_cursos_nivel_grado_div
      on cursos (nivel, lower(btrim(grado_anio)), upper(btrim(division)));
  end if;
end $$;


-- ------------------------------------------------------------
-- 3) MATERIAS sin duplicados (RF3.5)
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from materias
             group by lower(btrim(nombre)) having count(*) > 1) then
    raise notice 'ATENCION: hay materias con el mismo nombre. Corregirlas y volver a correr el bloque 3.';
  else
    create unique index if not exists uq_materias_nombre
      on materias (lower(btrim(nombre)));
  end if;
end $$;


-- ------------------------------------------------------------
-- 4) ASIGNACIONES sin duplicados (RF2.5)
--    El mismo docente no puede tener dos veces la misma materia en
--    el mismo curso y periodo (entre las asignaciones activas).
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from asignaciones where activo is not false
             group by id_docente, id_materia, id_curso, coalesce(id_periodo, 0)
             having count(*) > 1) then
    raise notice 'ATENCION: hay asignaciones repetidas. Corregirlas y volver a correr el bloque 4.';
  else
    create unique index if not exists uq_asignaciones_doc_mat_cur
      on asignaciones (id_docente, id_materia, id_curso, coalesce(id_periodo, 0))
      where activo is not false;
  end if;
end $$;


-- ------------------------------------------------------------
-- 5) HORARIOS (RF3.7, RF3.8)
-- 5a) La hora de fin tiene que ser posterior a la de inicio.
--     NOT VALID: no revisa filas viejas, pero si todas las nuevas
--     y las que se modifiquen.
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_horarios_fin_mayor') then
    alter table horarios add constraint chk_horarios_fin_mayor
      check (hora_fin > hora_inicio) not valid;
  end if;
end $$;

-- 5b) Sin superposicion de horarios dentro de un mismo curso.
create or replace function public.check_superposicion_horario()
returns trigger language plpgsql as $$
declare
  v_curso int;
  v_materia text;
  v_ini time;
  v_fin time;
begin
  if new.id_asignacion is null then
    raise exception 'El horario debe estar asociado a una asignacion';
  end if;

  select id_curso into v_curso from asignaciones
   where id_asignacion = new.id_asignacion;
  if v_curso is null then return new; end if;

  -- Bloquea el curso: dos cargas simultaneas no pueden pisarse
  perform 1 from cursos where id_curso = v_curso for update;

  select m.nombre, h.hora_inicio, h.hora_fin
    into v_materia, v_ini, v_fin
    from horarios h
    join asignaciones a on a.id_asignacion = h.id_asignacion
    left join materias m on m.id_materia = a.id_materia
   where a.id_curso = v_curso
     and a.activo is not false
     and h.dia_semana = new.dia_semana
     and h.id_horario is distinct from new.id_horario
     and h.hora_inicio < new.hora_fin
     and new.hora_inicio < h.hora_fin
   limit 1;

  if found then
    raise exception 'Superposicion de horario: el curso ya tiene % de % a %',
      coalesce(v_materia, 'otra materia'),
      to_char(v_ini, 'HH24:MI'), to_char(v_fin, 'HH24:MI');
  end if;
  return new;
end $$;

drop trigger if exists trg_superposicion_horario on horarios;
create trigger trg_superposicion_horario
  before insert or update of id_asignacion, dia_semana, hora_inicio, hora_fin
  on horarios
  for each row execute function public.check_superposicion_horario();


-- ------------------------------------------------------------
-- VERIFICACION (opcional). No modifica datos.
-- Mira el resultado en la pestania Messages.
-- ------------------------------------------------------------
do $$
declare v_n int;
begin
  select count(*) into v_n from niveles;
  if v_n = 3 then raise notice 'OK 1/6: niveles registrados (3)';
  else raise notice 'FALLA 1/6: hay % niveles (deberian ser 3)', v_n; end if;

  if exists (select 1 from pg_constraint where conname = 'fk_cursos_nivel')
  then raise notice 'OK 2/6: cada curso apunta a un nivel registrado';
  else raise notice 'FALLA 2/6: falta la clave foranea fk_cursos_nivel'; end if;

  if exists (select 1 from pg_indexes where indexname = 'uq_cursos_nivel_grado_div')
  then raise notice 'OK 3/6: control de cursos duplicados activo';
  else raise notice 'PENDIENTE 3/6: corregir cursos duplicados (ver ATENCION arriba)'; end if;

  if exists (select 1 from pg_indexes where indexname = 'uq_materias_nombre')
  then raise notice 'OK 4/6: control de materias duplicadas activo';
  else raise notice 'PENDIENTE 4/6: corregir materias duplicadas (ver ATENCION arriba)'; end if;

  if exists (select 1 from pg_indexes where indexname = 'uq_asignaciones_doc_mat_cur')
  then raise notice 'OK 5/6: control de asignaciones duplicadas activo';
  else raise notice 'PENDIENTE 5/6: corregir asignaciones repetidas (ver ATENCION arriba)'; end if;

  if exists (select 1 from pg_trigger where tgname = 'trg_superposicion_horario')
  then raise notice 'OK 6/6: control de superposicion de horarios activo';
  else raise notice 'FALLA 6/6: falta el trigger de horarios'; end if;

  -- Informativo: cursos con el grado escrito fuera de la lista estandar
  select count(*) into v_n from cursos
   where lower(btrim(grado_anio)) not in (
     'sala de 3', 'sala de 4', 'sala de 5',
     '1er grado', '2do grado', '3er grado', '4to grado',
     '5to grado', '6to grado', '7mo grado',
     E'1er a\u00f1o', E'2do a\u00f1o', E'3er a\u00f1o', E'4to a\u00f1o', E'5to a\u00f1o');
  if v_n > 0 then
    raise notice 'INFO: hay % curso(s) con el grado escrito de otra forma. Se pueden corregir desde Cursos -> Editar.', v_n;
  end if;
end $$;

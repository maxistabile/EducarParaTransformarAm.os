-- ============================================================
-- ETAPA 14 - TP Metodologia de Sistemas II
--   RF4  Gestion deportiva      (HU21 a HU24)
--   RF5  Transporte y comedor   (HU25 a HU29)
--
-- Requiere: etapa12 (niveles) y etapa13 (fn_texto_normalizado).
-- Correr en: Supabase -> SQL Editor, ANTES de subir el frontend.
-- Idempotente y solo ASCII. No borra ningun dato.
-- Al final muestra una TABLA con el resultado.
--
-- Reglas de negocio que controla la base:
--   * Cada deporte puede tener varios grupos segun nivel y horario,
--     y cada grupo tiene un profesor responsable.
--   * Un alumno puede estar como maximo en DOS deportes a la vez.
--   * Sin conflictos de horario entre los deportes de un alumno.
--   * El alumno solo entra a grupos de su nivel, sin pasar el cupo.
--   * El transporte tiene CUATRO recorridos; un recorrido por alumno.
--   * Una inscripcion activa al comedor por alumno.
--   * Sin inscripciones duplicadas.
--   * Dar de baja = la inscripcion queda inactiva (no se borra),
--     asi los reportes conservan el historial de uso.
--
-- Los mensajes de error empiezan con un codigo (ej. DEP_MAX2|...)
-- que la pantalla traduce a un texto claro para el usuario.
-- ============================================================

drop table if exists _resultado_etapa14;
create temp table _resultado_etapa14 (orden serial, resultado text, detalle text);


-- ------------------------------------------------------------
-- 1) DEPORTES (RF4.1): sin nombres repetidos dentro del mismo tipo
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from actividades_extracurriculares
             group by tipo, public.fn_texto_normalizado(nombre) having count(*) > 1) then
    insert into _resultado_etapa14 (resultado, detalle) values ('REVISAR',
      'Hay actividades con el mismo nombre y tipo: corregirlas y volver a correr el script');
  else
    create unique index if not exists uq_actividades_tipo_nombre
      on actividades_extracurriculares (tipo, public.fn_texto_normalizado(nombre));
    insert into _resultado_etapa14 (resultado, detalle)
      values ('OK', 'Control de deportes duplicados activo');
  end if;
end $$;


-- ------------------------------------------------------------
-- 2) GRUPOS DEPORTIVOS (RF4.2)
-- ------------------------------------------------------------
create table if not exists grupos_deportivos (
  id_grupo     serial primary key,
  id_actividad bigint  not null references actividades_extracurriculares(id_actividad),
  nivel        varchar not null references niveles(nombre) on update cascade,
  id_docente   integer not null references docentes(id_docente),
  dias         varchar[] not null,
  hora_inicio  time not null,
  hora_fin     time not null,
  cupo         integer not null default 20,
  activo       boolean not null default true,
  constraint chk_grupo_horario check (hora_fin > hora_inicio),
  constraint chk_grupo_cupo    check (cupo between 1 and 200),
  constraint chk_grupo_dias    check (
    cardinality(dias) between 1 and 6
    and dias <@ array['Lunes', 'Martes', E'Miércoles', 'Jueves',
                      'Viernes', E'Sábado']::varchar[])
);

-- Dos rangos se superponen si comparten un dia y se cruzan las horas
create or replace function public.fn_horarios_se_cruzan(
  d1 varchar[], i1 time, f1 time, d2 varchar[], i2 time, f2 time)
returns boolean language sql immutable as $$
  select d1 && d2 and i1 < f2 and i2 < f1
$$;

create or replace function public.check_grupo_deportivo()
returns trigger language plpgsql as $$
declare
  v_tipo text; v_activos int; v_alumno text; v_otro text;
begin
  select tipo into v_tipo from actividades_extracurriculares
   where id_actividad = new.id_actividad;
  if v_tipo is distinct from 'Deporte' then
    raise exception 'GRP_NO_DEPORTE';
  end if;

  if (tg_op = 'INSERT' or new.id_docente is distinct from old.id_docente)
     and not exists (select 1 from docentes
                      where id_docente = new.id_docente and activo is not false) then
    raise exception 'GRP_DOCENTE_INACTIVO';
  end if;

  if tg_op = 'UPDATE' then
    select count(*) into v_activos from inscripciones_deportivas
     where id_grupo = new.id_grupo and activo;

    if v_activos > 0 then
      -- Con alumnos inscriptos no se puede cambiar el deporte ni el nivel,
      -- ni desactivar el grupo (primero hay que darlos de baja)
      if new.id_actividad <> old.id_actividad or new.nivel <> old.nivel
         or (new.activo is false and old.activo is not false) then
        raise exception 'GRP_CON_INSCRIPTOS|%', v_activos;
      end if;
      if new.cupo < v_activos then
        raise exception 'GRP_CUPO_MENOR|%', v_activos;
      end if;
      -- Un cambio de horario no puede generar conflictos a los inscriptos
      if new.dias is distinct from old.dias
         or new.hora_inicio <> old.hora_inicio or new.hora_fin <> old.hora_fin then
        select al.apellido || ', ' || al.nombre, ae.nombre into v_alumno, v_otro
          from inscripciones_deportivas i
          join alumnos al on al.id_alumno = i.id_alumno
          join inscripciones_deportivas o
            on o.id_alumno = i.id_alumno and o.activo and o.id_grupo <> new.id_grupo
          join grupos_deportivos g on g.id_grupo = o.id_grupo
          join actividades_extracurriculares ae on ae.id_actividad = g.id_actividad
         where i.id_grupo = new.id_grupo and i.activo
           and public.fn_horarios_se_cruzan(new.dias, new.hora_inicio, new.hora_fin,
                                             g.dias, g.hora_inicio, g.hora_fin)
         limit 1;
        if found then
          raise exception 'GRP_CHOQUE_ALUMNO|%|%', v_alumno, v_otro;
        end if;
      end if;
    end if;
  end if;
  return new;
end $$;


-- ------------------------------------------------------------
-- 3) INSCRIPCIONES DEPORTIVAS (RF4.3, RF4.4)
-- ------------------------------------------------------------
create table if not exists inscripciones_deportivas (
  id_inscripcion_dep serial primary key,
  id_alumno  integer not null references alumnos(id_alumno),
  id_grupo   integer not null references grupos_deportivos(id_grupo),
  fecha_alta timestamptz not null default now(),
  activo     boolean not null default true,
  fecha_baja timestamptz
);
create unique index if not exists uq_insc_dep_alumno_grupo
  on inscripciones_deportivas (id_alumno, id_grupo) where activo;

-- El trigger del grupo usa esta tabla, por eso se crea despues de ella
drop trigger if exists trg_check_grupo_deportivo on grupos_deportivos;
create trigger trg_check_grupo_deportivo
  before insert or update on grupos_deportivos
  for each row execute function public.check_grupo_deportivo();

create or replace function public.check_inscripcion_deportiva()
returns trigger language plpgsql as $$
declare
  v_al_activo boolean; v_al_nivel text; v_alumno text;
  g record; v_dep text; v_dep_activo boolean;
  v_otros int; v_lista text; v_ocupados int;
  c record;
begin
  -- Dar de baja: siempre se permite
  if new.activo is false then
    if new.fecha_baja is null then new.fecha_baja := now(); end if;
    return new;
  end if;
  -- Reactivar una baja anterior
  if tg_op = 'UPDATE' and old.activo is false then new.fecha_baja := null; end if;
  -- Un UPDATE que no cambia nada relevante no se vuelve a controlar
  if tg_op = 'UPDATE' and old.activo and new.id_grupo = old.id_grupo
     and new.id_alumno = old.id_alumno then
    return new;
  end if;

  -- Bloquea al alumno: dos inscripciones simultaneas no pasan el limite
  perform 1 from alumnos where id_alumno = new.id_alumno for update;

  select al.activo is not false, cu.nivel, al.apellido || ', ' || al.nombre
    into v_al_activo, v_al_nivel, v_alumno
    from alumnos al left join cursos cu on cu.id_curso = al.id_curso
   where al.id_alumno = new.id_alumno;
  if not v_al_activo then raise exception 'ALU_INACTIVO|%', v_alumno; end if;
  if v_al_nivel is null then raise exception 'ALU_SIN_CURSO|%', v_alumno; end if;

  select * into g from grupos_deportivos where id_grupo = new.id_grupo for update;
  select nombre, activo into v_dep, v_dep_activo
    from actividades_extracurriculares where id_actividad = g.id_actividad;
  if not g.activo or not v_dep_activo then
    raise exception 'DEP_INACTIVO|%', v_dep;
  end if;
  if g.nivel <> v_al_nivel then
    raise exception 'DEP_NIVEL|%|%', g.nivel, v_al_nivel;
  end if;

  -- Ya esta en este mismo deporte (en este u otro grupo)
  if exists (select 1 from inscripciones_deportivas i
               join grupos_deportivos gg on gg.id_grupo = i.id_grupo
              where i.id_alumno = new.id_alumno and i.activo
                and i.id_inscripcion_dep is distinct from new.id_inscripcion_dep
                and gg.id_actividad = g.id_actividad) then
    raise exception 'DEP_REPETIDO|%', v_dep;
  end if;

  -- Maximo dos deportes simultaneos
  select count(*), string_agg(ae.nombre, ', ' order by ae.nombre)
    into v_otros, v_lista
    from inscripciones_deportivas i
    join grupos_deportivos gg on gg.id_grupo = i.id_grupo
    join actividades_extracurriculares ae on ae.id_actividad = gg.id_actividad
   where i.id_alumno = new.id_alumno and i.activo
     and i.id_inscripcion_dep is distinct from new.id_inscripcion_dep;
  if v_otros >= 2 then raise exception 'DEP_MAX2|%', v_lista; end if;

  -- Sin conflictos de horario con sus otros deportes
  select ae.nombre, array_to_string(gg.dias, ', ') as dias,
         to_char(gg.hora_inicio, 'HH24:MI') as ini, to_char(gg.hora_fin, 'HH24:MI') as fin
    into c
    from inscripciones_deportivas i
    join grupos_deportivos gg on gg.id_grupo = i.id_grupo
    join actividades_extracurriculares ae on ae.id_actividad = gg.id_actividad
   where i.id_alumno = new.id_alumno and i.activo
     and i.id_inscripcion_dep is distinct from new.id_inscripcion_dep
     and public.fn_horarios_se_cruzan(g.dias, g.hora_inicio, g.hora_fin,
                                       gg.dias, gg.hora_inicio, gg.hora_fin)
   limit 1;
  if found then
    raise exception 'DEP_CHOQUE|%|%|%|%', c.nombre, c.dias, c.ini, c.fin;
  end if;

  -- Cupo del grupo
  select count(*) into v_ocupados from inscripciones_deportivas
   where id_grupo = new.id_grupo and activo
     and id_inscripcion_dep is distinct from new.id_inscripcion_dep;
  if v_ocupados >= g.cupo then raise exception 'DEP_CUPO|%', v_dep; end if;

  return new;
end $$;

drop trigger if exists trg_check_inscripcion_deportiva on inscripciones_deportivas;
create trigger trg_check_inscripcion_deportiva
  before insert or update on inscripciones_deportivas
  for each row execute function public.check_inscripcion_deportiva();

-- Los deportes ya no se inscriben en la tabla general de actividades
-- (sin grupo ni horario no se pueden controlar las reglas).
-- Los idiomas siguen funcionando igual que antes.
create or replace function public.check_actividad_solo_idiomas()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from actividades_extracurriculares
              where id_actividad = new.id_actividad and tipo = 'Deporte') then
    raise exception 'ACT_DEPORTE_POR_GRUPO';
  end if;
  return new;
end $$;

drop trigger if exists trg_actividad_solo_idiomas on inscripciones_actividades;
create trigger trg_actividad_solo_idiomas
  before insert on inscripciones_actividades
  for each row execute function public.check_actividad_solo_idiomas();


-- ------------------------------------------------------------
-- 4) RECORRIDOS DE TRANSPORTE (RF5.1): son exactamente cuatro
-- ------------------------------------------------------------
create table if not exists recorridos (
  id_recorrido serial primary key,
  numero       integer not null unique check (numero between 1 and 4),
  nombre       varchar not null,
  descripcion  text,
  activo       boolean not null default true
);
create unique index if not exists uq_recorridos_nombre
  on recorridos (public.fn_texto_normalizado(nombre));

insert into recorridos (numero, nombre, descripcion) values
  (1, 'Recorrido 1', 'Paradas y horarios a definir por la institucion'),
  (2, 'Recorrido 2', 'Paradas y horarios a definir por la institucion'),
  (3, 'Recorrido 3', 'Paradas y horarios a definir por la institucion'),
  (4, 'Recorrido 4', 'Paradas y horarios a definir por la institucion')
on conflict (numero) do nothing;


-- ------------------------------------------------------------
-- 5) INSCRIPCIONES A TRANSPORTE (RF5.2, RF5.4) Y COMEDOR (RF5.3, RF5.5)
-- ------------------------------------------------------------
create table if not exists inscripciones_transporte (
  id_inscripcion_tra serial primary key,
  id_alumno    integer not null references alumnos(id_alumno),
  id_recorrido integer not null references recorridos(id_recorrido),
  fecha_alta   timestamptz not null default now(),
  activo       boolean not null default true,
  fecha_baja   timestamptz
);
create unique index if not exists uq_transporte_alumno_activo
  on inscripciones_transporte (id_alumno) where activo;

create table if not exists inscripciones_comedor (
  id_inscripcion_com serial primary key,
  id_alumno  integer not null references alumnos(id_alumno),
  fecha_alta timestamptz not null default now(),
  activo     boolean not null default true,
  fecha_baja timestamptz
);
create unique index if not exists uq_comedor_alumno_activo
  on inscripciones_comedor (id_alumno) where activo;

-- Controles comunes: alumno activo, fecha de baja, recorrido activo
create or replace function public.check_inscripcion_servicio()
returns trigger language plpgsql as $$
declare v_al_activo boolean; v_alumno text; v_rec text; v_rec_activo boolean;
begin
  if new.activo is false then
    if new.fecha_baja is null then new.fecha_baja := now(); end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and old.activo is false then new.fecha_baja := null; end if;

  select activo is not false, apellido || ', ' || nombre into v_al_activo, v_alumno
    from alumnos where id_alumno = new.id_alumno;
  if not v_al_activo then raise exception 'ALU_INACTIVO|%', v_alumno; end if;

  if tg_table_name = 'inscripciones_transporte' then
    select nombre, activo into v_rec, v_rec_activo
      from recorridos where id_recorrido = (to_jsonb(new) ->> 'id_recorrido')::int;
    if not v_rec_activo then raise exception 'TRA_RECORRIDO_INACTIVO|%', v_rec; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_check_insc_transporte on inscripciones_transporte;
create trigger trg_check_insc_transporte
  before insert or update on inscripciones_transporte
  for each row execute function public.check_inscripcion_servicio();

drop trigger if exists trg_check_insc_comedor on inscripciones_comedor;
create trigger trg_check_insc_comedor
  before insert or update on inscripciones_comedor
  for each row execute function public.check_inscripcion_servicio();

-- Un recorrido con alumnos inscriptos no se puede desactivar
create or replace function public.check_recorrido()
returns trigger language plpgsql as $$
declare v_n int;
begin
  if new.activo is false and old.activo is not false then
    select count(*) into v_n from inscripciones_transporte
     where id_recorrido = new.id_recorrido and activo;
    if v_n > 0 then raise exception 'TRA_CON_INSCRIPTOS|%', v_n; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_check_recorrido on recorridos;
create trigger trg_check_recorrido
  before update on recorridos
  for each row execute function public.check_recorrido();


-- ------------------------------------------------------------
-- 6) RESULTADO
-- ------------------------------------------------------------
insert into _resultado_etapa14 (resultado, detalle)
select 'OK', 'Grupos deportivos e inscripciones con reglas (maximo 2, sin cruces, nivel y cupo)'
 where exists (select 1 from pg_trigger where tgname = 'trg_check_inscripcion_deportiva');

insert into _resultado_etapa14 (resultado, detalle)
select 'OK', format('Recorridos de transporte registrados: %s', count(*)) from recorridos;

insert into _resultado_etapa14 (resultado, detalle)
select 'OK', 'Inscripciones a transporte y comedor sin duplicados'
 where exists (select 1 from pg_indexes where indexname = 'uq_comedor_alumno_activo')
   and exists (select 1 from pg_indexes where indexname = 'uq_transporte_alumno_activo');

-- Informativo: inscripciones a deportes hechas con el sistema anterior
-- (sin grupo). No se borran; conviene inscribirlos en su grupo desde Deportes.
insert into _resultado_etapa14 (resultado, detalle)
select 'INFO', format('%s %s (%s): inscripcion a %s del sistema anterior, sin grupo. Inscribirlo en un grupo desde Deportes',
                      al.apellido, al.nombre, al.dni, ae.nombre)
  from inscripciones_actividades ia
  join actividades_extracurriculares ae on ae.id_actividad = ia.id_actividad
  join alumnos al on al.id_alumno = ia.id_alumno
 where ae.tipo = 'Deporte'
 order by al.apellido;

select resultado, detalle from _resultado_etapa14 order by orden;

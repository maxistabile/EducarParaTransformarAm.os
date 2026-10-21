-- ============================================================
-- ETAPA 15 - TP Metodologia de Sistemas II
--   RF9  Funcionalidad que genera valor (desafio) - HU40
--   Notificacion automatica al padre cuando se registra, modifica
--   o da de baja una inscripcion de su hijo a deportes, transporte
--   o comedor.
--
-- Patron Observer: cada tabla de inscripciones es el "sujeto"; el
-- trigger es el "observador" que reacciona a cada cambio y deja el
-- aviso en `notificaciones`, que el padre ve en su portal. Funciona
-- igual si la inscripcion la hace el administrador o el propio padre.
--
-- Si el alumno no tiene padre asociado, el aviso va al usuario del
-- alumno. Si por algun motivo no se puede guardar el aviso, la
-- inscripcion se registra igual (el aviso nunca la bloquea).
--
-- Requiere: etapa14. Correr en: Supabase -> SQL Editor.
-- Idempotente y solo ASCII (las tildes van como \u00XX).
-- ============================================================

create or replace function public.fn_notificar_inscripcion()
returns trigger language plpgsql as $$
declare
  v_dest   uuid;
  v_alumno text;
  v_titulo text;
  v_msg    text;
  v_dep    text;
  v_hor    text;
  v_prof   text;
  v_rec    text;
  v_evento text;  -- 'alta' | 'baja' | 'cambio'
begin
  if tg_op = 'INSERT' and new.activo then
    v_evento := 'alta';
  elsif tg_op = 'UPDATE' and old.activo and new.activo is false then
    v_evento := 'baja';
  elsif tg_op = 'UPDATE' and old.activo is false and new.activo then
    v_evento := 'alta';
  elsif tg_op = 'UPDATE' and tg_table_name = 'inscripciones_transporte'
        and old.activo and new.activo
        and (to_jsonb(new) ->> 'id_recorrido') <> (to_jsonb(old) ->> 'id_recorrido') then
    v_evento := 'cambio';
  else
    return null;
  end if;

  select coalesce(id_usuario_padre, id_usuario), nombre || ' ' || apellido
    into v_dest, v_alumno
    from alumnos where id_alumno = new.id_alumno;
  if v_dest is null then return null; end if;

  if tg_table_name = 'inscripciones_deportivas' then
    select ae.nombre,
           array_to_string(g.dias, ', ') || ' de ' || to_char(g.hora_inicio, 'HH24:MI')
             || ' a ' || to_char(g.hora_fin, 'HH24:MI'),
           u.nombre || ' ' || u.apellido
      into v_dep, v_hor, v_prof
      from grupos_deportivos g
      join actividades_extracurriculares ae on ae.id_actividad = g.id_actividad
      left join docentes d on d.id_docente = g.id_docente
      left join usuarios u on u.id_usuario = d.id_usuario
     where g.id_grupo = (to_jsonb(new) ->> 'id_grupo')::int;
    if v_evento = 'alta' then
      v_titulo := E'Inscripci\u00f3n a ' || v_dep;
      v_msg := E'Se registr\u00f3 la inscripci\u00f3n de ' || v_alumno || ' en ' || v_dep
               || ' (' || v_hor || coalesce(', Prof. ' || v_prof, '') || ').';
    else
      v_titulo := 'Baja de ' || v_dep;
      v_msg := E'Se registr\u00f3 la baja de ' || v_alumno || ' en ' || v_dep || '.';
    end if;

  elsif tg_table_name = 'inscripciones_transporte' then
    select nombre into v_rec from recorridos
     where id_recorrido = (to_jsonb(new) ->> 'id_recorrido')::int;
    if v_evento = 'alta' then
      v_titulo := E'Inscripci\u00f3n al transporte';
      v_msg := E'Se registr\u00f3 la inscripci\u00f3n de ' || v_alumno
               || ' al servicio de transporte (' || v_rec || ').';
    elsif v_evento = 'cambio' then
      v_titulo := 'Cambio de recorrido';
      v_msg := E'Se cambi\u00f3 el recorrido de transporte de ' || v_alumno || ' a ' || v_rec || '.';
    else
      v_titulo := 'Baja del transporte';
      v_msg := E'Se registr\u00f3 la baja de ' || v_alumno || ' en el servicio de transporte.';
    end if;

  else  -- inscripciones_comedor
    if v_evento = 'alta' then
      v_titulo := E'Inscripci\u00f3n al comedor';
      v_msg := E'Se registr\u00f3 la inscripci\u00f3n de ' || v_alumno || ' al servicio de comedor.';
    else
      v_titulo := 'Baja del comedor';
      v_msg := E'Se registr\u00f3 la baja de ' || v_alumno || ' en el servicio de comedor.';
    end if;
  end if;

  begin
    insert into notificaciones (id_usuario_destino, titulo, mensaje, tipo, leida)
    values (v_dest, v_titulo, v_msg, 'Novedad', false);
  exception when others then
    raise warning 'No se pudo guardar la notificacion: %', sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists trg_notificar_insc_deportiva on inscripciones_deportivas;
create trigger trg_notificar_insc_deportiva
  after insert or update of activo on inscripciones_deportivas
  for each row execute function public.fn_notificar_inscripcion();

drop trigger if exists trg_notificar_insc_transporte on inscripciones_transporte;
create trigger trg_notificar_insc_transporte
  after insert or update of activo, id_recorrido on inscripciones_transporte
  for each row execute function public.fn_notificar_inscripcion();

drop trigger if exists trg_notificar_insc_comedor on inscripciones_comedor;
create trigger trg_notificar_insc_comedor
  after insert or update of activo on inscripciones_comedor
  for each row execute function public.fn_notificar_inscripcion();


-- ------------------------------------------------------------
-- RESULTADO
-- ------------------------------------------------------------
select case when count(*) = 3 then 'OK' else 'FALLA' end as resultado,
       format('Notificaciones automaticas activas en %s de 3 tablas de inscripciones', count(*)) as detalle
  from pg_trigger
 where tgname in ('trg_notificar_insc_deportiva', 'trg_notificar_insc_transporte',
                  'trg_notificar_insc_comedor');

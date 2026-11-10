-- ============================================================
-- ETAPA 23 - ALTAS Y VINCULACION DE CUENTAS Y LEGAJOS
-- TP Metodologia de Sistemas II (HU7, HU11, HU20 y acceso de HU41)
--
-- Correr en: Supabase -> SQL Editor, ANTES de publicar la web que usa
-- estas funciones (el alta de tutor y alumno pasa a usarlas).
-- Antes: verificaciones/relevamiento_etapa23.sql (solo lectura).
-- Despues: verificaciones/pruebas_etapa23.sql (no deja datos).
--
-- Que agrega (reutiliza alumnos.id_usuario, alumnos.id_usuario_padre y
-- docentes.id_usuario; no crea tablas ni un modelo paralelo):
--   1) Una cuenta no puede quedar vinculada a dos legajos: indices
--      unicos parciales en alumnos.id_usuario y docentes.id_usuario.
--      Si ya hubiera duplicados, el script se DETIENE sin modificar nada.
--   2) Funciones para vincular, que comprueban en el servidor que quien
--      las llama (auth.uid()) sea Admin o Directivo activo, y el rol de
--      la cuenta elegida:
--        fn_vincular_tutor          alumno existente <-> usuario Padre
--        fn_vincular_cuenta_alumno  legajo de alumno <-> usuario Alumno
--        fn_vincular_cuenta_docente legajo de docente <-> usuario Docente
--        fn_crear_legajo_alumno     alta del legajo con su cuenta y su
--                                   tutor (opcionales), sin duplicar
--        fn_completar_usuario       nombre, apellido y rol de una cuenta
--                                   recien creada y todavia sin vinculos
--   Ninguna cambia correos ni contrasenias (eso vive en Supabase Auth).
--
-- APLICADA en Supabase el 10/11/2026 (informado por el equipo: cinco
-- controles finales OK). NO MODIFICAR este archivo: los cambios
-- posteriores van en etapas nuevas. fn_completar_usuario se retira en
-- etapa24_retirar_completar_usuario.sql (crear-usuario guarda nombre,
-- apellido y rol en el servidor con su propio control de permisos).
--
-- Errores (el frontend los traduce): VIN_SIN_PERMISO, VIN_ROL_INVALIDO,
-- VIN_ALUMNO_INEXISTENTE, VIN_DOCENTE_INEXISTENTE, VIN_USUARIO_INEXISTENTE,
-- VIN_TUTOR_EXISTENTE, VIN_ALUMNO_CON_CUENTA, VIN_DOCENTE_CON_CUENTA,
-- VIN_CUENTA_OCUPADA, VIN_DNI_EXISTENTE y VIN_DATOS_INCOMPLETOS.
--
-- RLS sigue fuera de alcance (CLAUDE.md 3.1): no se habilita ni se
-- modifica. Idempotente. Solo ASCII. Al final, consulta de verificacion.
-- ============================================================

-- ------------------------------------------------------------
-- 0) Control previo: una cuenta vinculada a mas de un legajo
-- ------------------------------------------------------------
do $$
declare
  v_alumnos  int;
  v_docentes int;
begin
  select count(*) into v_alumnos from (
    select id_usuario from alumnos where id_usuario is not null
     group by id_usuario having count(*) > 1) x;
  select count(*) into v_docentes from (
    select id_usuario from docentes where id_usuario is not null
     group by id_usuario having count(*) > 1) x;
  if v_alumnos > 0 or v_docentes > 0 then
    raise exception 'ETAPA23_DUPLICADOS|cuentas con mas de un legajo: alumnos=%, docentes=%. No se modifico nada: revisar con verificaciones/relevamiento_etapa23.sql',
      v_alumnos, v_docentes;
  end if;
end $$;

-- ------------------------------------------------------------
-- 1) Una cuenta, un legajo
-- ------------------------------------------------------------
create unique index if not exists uq_alumnos_id_usuario
  on alumnos (id_usuario) where id_usuario is not null;
create unique index if not exists uq_docentes_id_usuario
  on docentes (id_usuario) where id_usuario is not null;

-- ------------------------------------------------------------
-- 2) Quien llama tiene que ser Admin o Directivo activo
-- ------------------------------------------------------------
create or replace function public.fn_vinc_exigir_gestion()
returns uuid language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (
       select 1 from usuarios
        where id_usuario = v_uid and rol in ('Admin', 'Directivo')
          and activo is distinct from false) then
    raise exception 'VIN_SIN_PERMISO|Solo Admin o Directivo pueden vincular cuentas y legajos';
  end if;
  return v_uid;
end $$;

-- ------------------------------------------------------------
-- 3) Alumno existente <-> tutor (usuario Padre) existente
--    Si ya tiene otro tutor, exige p_reemplazar = true (la pantalla
--    muestra el vinculo actual y pide confirmacion).
-- ------------------------------------------------------------
create or replace function public.fn_vincular_tutor(
  p_id_alumno bigint, p_id_padre uuid, p_reemplazar boolean default false)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_actual uuid;
begin
  perform public.fn_vinc_exigir_gestion();
  select id_usuario_padre into v_actual from alumnos
   where id_alumno = p_id_alumno for update;
  if not found then
    raise exception 'VIN_ALUMNO_INEXISTENTE|El alumno no existe';
  end if;
  if not exists (select 1 from usuarios where id_usuario = p_id_padre
                    and rol = 'Padre' and activo is distinct from false) then
    raise exception 'VIN_ROL_INVALIDO|La cuenta elegida no es un tutor activo';
  end if;
  if v_actual = p_id_padre then
    return jsonb_build_object('ok', true, 'sin_cambios', true);
  end if;
  if v_actual is not null and not coalesce(p_reemplazar, false) then
    raise exception 'VIN_TUTOR_EXISTENTE|El alumno ya tiene otro tutor: confirmar el reemplazo';
  end if;
  update alumnos set id_usuario_padre = p_id_padre where id_alumno = p_id_alumno;
  return jsonb_build_object('ok', true, 'reemplazado', v_actual is not null);
end $$;

-- ------------------------------------------------------------
-- 4) Legajo de alumno <-> cuenta Alumno disponible
-- ------------------------------------------------------------
create or replace function public.fn_vincular_cuenta_alumno(
  p_id_alumno bigint, p_id_usuario uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_actual uuid;
begin
  perform public.fn_vinc_exigir_gestion();
  select id_usuario into v_actual from alumnos
   where id_alumno = p_id_alumno for update;
  if not found then
    raise exception 'VIN_ALUMNO_INEXISTENTE|El alumno no existe';
  end if;
  if not exists (select 1 from usuarios where id_usuario = p_id_usuario and rol = 'Alumno') then
    raise exception 'VIN_ROL_INVALIDO|La cuenta elegida no tiene rol Alumno';
  end if;
  if v_actual = p_id_usuario then
    return jsonb_build_object('ok', true, 'sin_cambios', true);
  end if;
  if v_actual is not null then
    raise exception 'VIN_ALUMNO_CON_CUENTA|El alumno ya tiene una cuenta de acceso';
  end if;
  if exists (select 1 from alumnos where id_usuario = p_id_usuario) then
    raise exception 'VIN_CUENTA_OCUPADA|La cuenta ya esta vinculada a otro legajo';
  end if;
  begin
    update alumnos set id_usuario = p_id_usuario where id_alumno = p_id_alumno;
  exception when unique_violation then
    raise exception 'VIN_CUENTA_OCUPADA|La cuenta ya esta vinculada a otro legajo';
  end;
  return jsonb_build_object('ok', true);
end $$;

-- ------------------------------------------------------------
-- 5) Legajo de docente <-> cuenta Docente disponible
-- ------------------------------------------------------------
create or replace function public.fn_vincular_cuenta_docente(
  p_id_docente bigint, p_id_usuario uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_actual uuid;
begin
  perform public.fn_vinc_exigir_gestion();
  select id_usuario into v_actual from docentes
   where id_docente = p_id_docente for update;
  if not found then
    raise exception 'VIN_DOCENTE_INEXISTENTE|El docente no existe';
  end if;
  if not exists (select 1 from usuarios where id_usuario = p_id_usuario and rol = 'Docente') then
    raise exception 'VIN_ROL_INVALIDO|La cuenta elegida no tiene rol Docente';
  end if;
  if v_actual = p_id_usuario then
    return jsonb_build_object('ok', true, 'sin_cambios', true);
  end if;
  if v_actual is not null then
    raise exception 'VIN_DOCENTE_CON_CUENTA|El docente ya tiene una cuenta de acceso';
  end if;
  if exists (select 1 from docentes where id_usuario = p_id_usuario) then
    raise exception 'VIN_CUENTA_OCUPADA|La cuenta ya esta vinculada a otro legajo';
  end if;
  begin
    update docentes set id_usuario = p_id_usuario where id_docente = p_id_docente;
  exception when unique_violation then
    raise exception 'VIN_CUENTA_OCUPADA|La cuenta ya esta vinculada a otro legajo';
  end;
  return jsonb_build_object('ok', true);
end $$;

-- ------------------------------------------------------------
-- 6) Alta del legajo de un alumno, con su cuenta y su tutor opcionales
--    p_datos: nombre, apellido, dni, fecha_nacimiento, id_curso
--    (obligatorios) y obra_social, direccion, telefono, email.
--    Reintento: si el DNI ya tiene legajo con ESA misma cuenta, devuelve
--    ese legajo (existente = true) en lugar de duplicarlo. Si el DNI ya
--    existe por otro camino, no lo toca: VIN_DNI_EXISTENTE.
-- ------------------------------------------------------------
create or replace function public.fn_crear_legajo_alumno(
  p_datos jsonb, p_id_usuario uuid default null, p_id_padre uuid default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_dni       text := nullif(trim(p_datos ->> 'dni'), '');
  v_existente record;
  v_id        bigint;
  v_legajo    text;
begin
  perform public.fn_vinc_exigir_gestion();
  if nullif(trim(p_datos ->> 'nombre'), '') is null
     or nullif(trim(p_datos ->> 'apellido'), '') is null
     or v_dni is null
     or nullif(p_datos ->> 'fecha_nacimiento', '') is null
     or nullif(p_datos ->> 'id_curso', '') is null then
    raise exception 'VIN_DATOS_INCOMPLETOS|Faltan nombre, apellido, DNI, fecha de nacimiento o curso';
  end if;
  if p_id_usuario is not null and not exists (
       select 1 from usuarios where id_usuario = p_id_usuario and rol = 'Alumno') then
    raise exception 'VIN_ROL_INVALIDO|La cuenta elegida no tiene rol Alumno';
  end if;
  if p_id_padre is not null and not exists (
       select 1 from usuarios where id_usuario = p_id_padre
          and rol = 'Padre' and activo is distinct from false) then
    raise exception 'VIN_ROL_INVALIDO|La cuenta elegida no es un tutor activo';
  end if;

  select id_alumno, legajo, id_usuario, id_usuario_padre into v_existente
    from alumnos where dni = v_dni for update;
  if found then
    if p_id_usuario is not null and v_existente.id_usuario = p_id_usuario
       and (p_id_padre is null or v_existente.id_usuario_padre = p_id_padre) then
      return jsonb_build_object('ok', true, 'existente', true,
        'id_alumno', v_existente.id_alumno, 'legajo', v_existente.legajo);
    end if;
    raise exception 'VIN_DNI_EXISTENTE|Ya existe un legajo con ese DNI';
  end if;
  if p_id_usuario is not null and exists (select 1 from alumnos where id_usuario = p_id_usuario) then
    raise exception 'VIN_CUENTA_OCUPADA|La cuenta ya esta vinculada a otro legajo';
  end if;

  begin
    insert into alumnos (nombre, apellido, dni, fecha_nacimiento, id_curso,
                         id_usuario, id_usuario_padre, obra_social, direccion,
                         telefono, email)
    values (trim(p_datos ->> 'nombre'), trim(p_datos ->> 'apellido'), v_dni,
            (p_datos ->> 'fecha_nacimiento')::date, (p_datos ->> 'id_curso')::integer,
            p_id_usuario, p_id_padre,
            nullif(trim(p_datos ->> 'obra_social'), ''),
            nullif(trim(p_datos ->> 'direccion'), ''),
            nullif(trim(p_datos ->> 'telefono'), ''),
            nullif(trim(p_datos ->> 'email'), ''))
    returning id_alumno, legajo into v_id, v_legajo;
  exception when unique_violation then
    raise exception 'VIN_DNI_EXISTENTE|Ya existe un legajo con ese DNI o la cuenta ya esta vinculada';
  end;
  return jsonb_build_object('ok', true, 'existente', false,
    'id_alumno', v_id, 'legajo', v_legajo);
end $$;

-- ------------------------------------------------------------
-- 7) Datos de una cuenta RECIEN creada (crear-usuario la deja sin
--    nombre y con un rol por defecto). Solo roles Alumno, Padre o
--    Docente, y solo si la cuenta todavia no tiene vinculos: asi no
--    sirve para cambiar el rol de una cuenta en uso ni de Admin/Directivo.
-- ------------------------------------------------------------
create or replace function public.fn_completar_usuario(
  p_id_usuario uuid, p_nombre text, p_apellido text, p_rol text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_rol text;
begin
  perform public.fn_vinc_exigir_gestion();
  if p_rol not in ('Alumno', 'Padre', 'Docente') then
    raise exception 'VIN_ROL_INVALIDO|Rol no permitido para una cuenta nueva';
  end if;
  select rol into v_rol from usuarios where id_usuario = p_id_usuario for update;
  if not found then
    raise exception 'VIN_USUARIO_INEXISTENTE|La cuenta no existe';
  end if;
  if v_rol in ('Admin', 'Directivo') then
    raise exception 'VIN_SIN_PERMISO|No se modifican cuentas de gestion';
  end if;
  if exists (select 1 from alumnos where id_usuario = p_id_usuario or id_usuario_padre = p_id_usuario)
     or exists (select 1 from docentes where id_usuario = p_id_usuario) then
    raise exception 'VIN_CUENTA_OCUPADA|La cuenta ya tiene vinculos: no se modifica';
  end if;
  update usuarios
     set nombre = trim(p_nombre), apellido = trim(p_apellido), rol = p_rol
   where id_usuario = p_id_usuario;
  return jsonb_build_object('ok', true);
end $$;

-- ------------------------------------------------------------
-- 8) Permisos: solo sesiones iniciadas (el control de rol esta adentro)
-- ------------------------------------------------------------
revoke all on function public.fn_vinc_exigir_gestion() from public, anon;
revoke all on function public.fn_vincular_tutor(bigint, uuid, boolean) from public, anon;
revoke all on function public.fn_vincular_cuenta_alumno(bigint, uuid) from public, anon;
revoke all on function public.fn_vincular_cuenta_docente(bigint, uuid) from public, anon;
revoke all on function public.fn_crear_legajo_alumno(jsonb, uuid, uuid) from public, anon;
revoke all on function public.fn_completar_usuario(uuid, text, text, text) from public, anon;
grant execute on function public.fn_vinc_exigir_gestion() to authenticated;
grant execute on function public.fn_vincular_tutor(bigint, uuid, boolean) to authenticated;
grant execute on function public.fn_vincular_cuenta_alumno(bigint, uuid) to authenticated;
grant execute on function public.fn_vincular_cuenta_docente(bigint, uuid) to authenticated;
grant execute on function public.fn_crear_legajo_alumno(jsonb, uuid, uuid) to authenticated;
grant execute on function public.fn_completar_usuario(uuid, text, text, text) to authenticated;

-- ------------------------------------------------------------
-- 9) Verificacion
-- ------------------------------------------------------------
select 'indice uq_alumnos_id_usuario' as control,
       case when to_regclass('public.uq_alumnos_id_usuario') is not null then 'OK' else 'FALTA' end as estado
union all
select 'indice uq_docentes_id_usuario',
       case when to_regclass('public.uq_docentes_id_usuario') is not null then 'OK' else 'FALTA' end
union all
select 'funciones (6)',
       case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname in (
                     'fn_vinc_exigir_gestion', 'fn_vincular_tutor', 'fn_vincular_cuenta_alumno',
                     'fn_vincular_cuenta_docente', 'fn_crear_legajo_alumno', 'fn_completar_usuario')) = 6
       then 'OK' else 'FALTA' end
union all
select 'anon sin permiso de ejecucion',
       case when not has_function_privilege('anon', 'public.fn_vincular_tutor(bigint, uuid, boolean)', 'execute')
             and not has_function_privilege('anon', 'public.fn_crear_legajo_alumno(jsonb, uuid, uuid)', 'execute')
             and not has_function_privilege('anon', 'public.fn_completar_usuario(uuid, text, text, text)', 'execute')
       then 'OK' else 'REVISAR' end
union all
select 'authenticated con permiso de ejecucion',
       case when has_function_privilege('authenticated', 'public.fn_vincular_cuenta_alumno(bigint, uuid)', 'execute')
             and has_function_privilege('authenticated', 'public.fn_vincular_cuenta_docente(bigint, uuid)', 'execute')
       then 'OK' else 'REVISAR' end;

-- ============================================================
-- PRUEBAS DE ETAPA 23 (vinculos de cuentas y legajos)
--
-- Correr en: Supabase -> SQL Editor, DESPUES de etapa23.
-- NO DEJA DATOS: todo corre en un solo bloque que siempre termina con
-- un error, asi la base vuelve atras. No crea cuentas de Auth ni toca
-- contrasenias: usa cuentas existentes y legajos de prueba (DNI 9923xxxx).
--
-- RESULTADO
--   * Si todo pasa, el error es:
--       PRUEBAS_ETAPA23_OK|<n> controles ...   <- es a proposito
--   * Si algo falla, el error empieza con "FALLA Vn:" o es el error
--     inesperado tal cual. Copiarlo completo y avisar.
--
-- Necesita (existentes): un usuario Admin o Directivo activo, un usuario
-- Padre activo, un usuario Alumno y un curso. Si hay un usuario Docente
-- y un segundo Padre, prueba tambien esos casos.
-- ============================================================

do $prueba$
declare
  v_controles int := 0;
  v_admin  uuid;
  v_padre  uuid;
  v_padre2 uuid;
  v_cuenta uuid;     -- usuario Alumno de la base
  v_docu   uuid;     -- usuario Docente de la base
  v_curso  integer;
  v_orig   bigint;   -- legajo al que estaba vinculada v_cuenta (si habia)
  t1 bigint; t2 bigint; v_doc bigint;
  v_res jsonb;
  v_datos jsonb;
  v_cod  text;
begin
  -- ---------- Ayudas (temporales: se deshacen al final) ----------
  create function pg_temp.verificar(p_ok boolean, p_control text, p_detalle text)
  returns void language plpgsql as $f$
  begin
    if not coalesce(p_ok, false) then
      raise exception 'FALLA %: %', p_control, p_detalle;
    end if;
  end $f$;

  create function pg_temp.sesion(p_usuario uuid)
  returns void language plpgsql as $f$
  begin
    perform set_config('request.jwt.claim.sub', coalesce(p_usuario::text, ''), true);
    perform set_config('request.jwt.claims',
      case when p_usuario is null then '' else json_build_object('sub', p_usuario)::text end, true);
  end $f$;

  -- Ejecuta y devuelve el codigo de error (lo anterior al '|'), o 'OK'
  create function pg_temp.codigo(p_sql text)
  returns text language plpgsql as $f$
  begin
    execute p_sql;
    return 'OK';
  exception when others then
    return split_part(sqlerrm, '|', 1);
  end $f$;

  -- ---------- Datos existentes ----------
  select id_usuario into v_admin from usuarios
   where rol in ('Admin', 'Directivo') and activo is distinct from false order by id_usuario limit 1;
  select id_usuario into v_padre from usuarios
   where rol = 'Padre' and activo is distinct from false order by id_usuario limit 1;
  select id_usuario into v_padre2 from usuarios
   where rol = 'Padre' and activo is distinct from false and id_usuario <> v_padre order by id_usuario limit 1;
  select id_usuario into v_cuenta from usuarios where rol = 'Alumno' order by id_usuario limit 1;
  select id_usuario into v_docu from usuarios where rol = 'Docente' order by id_usuario limit 1;
  select id_curso into v_curso from cursos order by id_curso limit 1;
  perform pg_temp.verificar(v_admin is not null and v_padre is not null and v_cuenta is not null
    and v_curso is not null, 'V0', 'faltan un Admin/Directivo, un Padre, un usuario Alumno o un curso');

  -- Si la cuenta Alumno ya tenia legajo, se libera SOLO dentro de esta prueba
  select id_alumno into v_orig from alumnos where id_usuario = v_cuenta;
  if v_orig is not null then
    update alumnos set id_usuario = null where id_alumno = v_orig;
  end if;

  v_datos := jsonb_build_object('nombre', 'Prueba', 'apellido', 'Etapa Veintitres',
    'dni', '99230001', 'fecha_nacimiento', '2015-03-01', 'id_curso', v_curso);

  -- V1. Sin sesion de gestion: rechazado
  perform pg_temp.sesion(v_padre);
  perform pg_temp.verificar(pg_temp.codigo(format(
    'select public.fn_crear_legajo_alumno(%L::jsonb, null, null)', v_datos)) = 'VIN_SIN_PERMISO',
    'V1', 'un Padre no puede crear legajos');
  v_controles := v_controles + 1;

  perform pg_temp.sesion(v_admin);

  -- V2. Datos incompletos: no inventa valores
  perform pg_temp.verificar(pg_temp.codigo(format(
    'select public.fn_crear_legajo_alumno(%L::jsonb, null, null)', v_datos - 'id_curso')) = 'VIN_DATOS_INCOMPLETOS',
    'V2', 'sin curso tiene que pedir el dato');
  v_controles := v_controles + 1;

  -- V3. Cuenta con rol incorrecto (un Padre como cuenta del alumno)
  perform pg_temp.verificar(pg_temp.codigo(format(
    'select public.fn_crear_legajo_alumno(%L::jsonb, %L::uuid, null)', v_datos, v_padre)) = 'VIN_ROL_INVALIDO',
    'V3', 'un Padre no puede ser la cuenta del alumno');
  v_controles := v_controles + 1;

  -- V4. Alta con cuenta Alumno y tutor; reintento: mismo legajo, sin duplicar
  v_res := public.fn_crear_legajo_alumno(v_datos, v_cuenta, v_padre);
  t1 := (v_res ->> 'id_alumno')::bigint;
  perform pg_temp.verificar((v_res ->> 'existente')::boolean = false and t1 is not null, 'V4', 'alta: ' || v_res::text);
  v_res := public.fn_crear_legajo_alumno(v_datos, v_cuenta, v_padre);
  perform pg_temp.verificar((v_res ->> 'existente')::boolean and (v_res ->> 'id_alumno')::bigint = t1
    and (select count(*) from alumnos where dni = '99230001') = 1, 'V4', 'reintento duplico: ' || v_res::text);
  v_controles := v_controles + 1;

  -- V5. Mismo DNI por otro camino (sin cuenta): no lo toca
  perform pg_temp.verificar(pg_temp.codigo(format(
    'select public.fn_crear_legajo_alumno(%L::jsonb, null, null)', v_datos)) = 'VIN_DNI_EXISTENTE',
    'V5', 'DNI existente tiene que rechazarse');
  v_controles := v_controles + 1;

  -- V6. La misma cuenta no puede quedar en otro legajo
  v_res := public.fn_crear_legajo_alumno(v_datos || jsonb_build_object('dni', '99230002'), null, null);
  t2 := (v_res ->> 'id_alumno')::bigint;
  perform pg_temp.verificar(pg_temp.codigo(format(
    'select public.fn_vincular_cuenta_alumno(%s, %L::uuid)', t2, v_cuenta)) = 'VIN_CUENTA_OCUPADA',
    'V6', 'una cuenta ya vinculada no se puede vincular a otro legajo');
  perform pg_temp.verificar(pg_temp.codigo(format(
    'update alumnos set id_usuario = %L::uuid where id_alumno = %s', v_cuenta, t2)) <> 'OK',
    'V6', 'el indice unico tiene que impedir el doble vinculo');
  v_controles := v_controles + 1;

  -- V7. Vincular cuenta: rol y legajo con cuenta
  perform pg_temp.verificar(pg_temp.codigo(format(
    'select public.fn_vincular_cuenta_alumno(%s, %L::uuid)', t2, v_padre)) = 'VIN_ROL_INVALIDO',
    'V7', 'un Padre no se vincula como cuenta del alumno');
  perform pg_temp.verificar(pg_temp.codigo(format(
    'select public.fn_vincular_cuenta_alumno(%s, %L::uuid)', t1, v_cuenta)) = 'OK',
    'V7', 'vincular la misma cuenta al mismo legajo es idempotente');
  update alumnos set id_usuario = null where id_alumno = t1;
  v_cod := pg_temp.codigo(format('select public.fn_vincular_cuenta_alumno(%s, %L::uuid)', t2, v_cuenta));
  perform pg_temp.verificar(v_cod = 'OK' and (select id_usuario from alumnos where id_alumno = t2) = v_cuenta,
    'V7', 'una cuenta libre se vincula al legajo sin cuenta');
  v_controles := v_controles + 1;

  -- V8. Tutor: rol, mismo tutor y reemplazo con confirmacion
  perform pg_temp.verificar(pg_temp.codigo(format(
    'select public.fn_vincular_tutor(%s, %L::uuid, false)', t2, v_cuenta)) = 'VIN_ROL_INVALIDO',
    'V8', 'una cuenta Alumno no puede ser tutor');
  v_cod := pg_temp.codigo(format('select public.fn_vincular_tutor(%s, %L::uuid, false)', t2, v_padre));
  perform pg_temp.verificar(v_cod = 'OK' and (select id_usuario_padre from alumnos where id_alumno = t2) = v_padre,
    'V8', 'asociar un tutor a un alumno sin tutor');
  if v_padre2 is not null then
    v_cod := pg_temp.codigo(format('select public.fn_vincular_tutor(%s, %L::uuid, false)', t2, v_padre2));
    perform pg_temp.verificar(v_cod = 'VIN_TUTOR_EXISTENTE' and (select id_usuario_padre from alumnos where id_alumno = t2) = v_padre,
      'V8', 'sin confirmacion no se reemplaza el tutor');
    v_cod := pg_temp.codigo(format('select public.fn_vincular_tutor(%s, %L::uuid, true)', t2, v_padre2));
    perform pg_temp.verificar(v_cod = 'OK' and (select id_usuario_padre from alumnos where id_alumno = t2) = v_padre2,
      'V8', 'con confirmacion se reemplaza');
  end if;
  v_controles := v_controles + 1;

  -- V9. Docente (si hay un usuario Docente)
  if v_docu is not null then
    insert into docentes (dni, activo) values ('99230009', false)
      returning id_docente into v_doc;
    perform pg_temp.verificar(pg_temp.codigo(format(
      'select public.fn_vincular_cuenta_docente(%s, %L::uuid)', v_doc, v_padre)) = 'VIN_ROL_INVALIDO',
      'V9', 'un Padre no se vincula como docente');
    if exists (select 1 from docentes where id_usuario = v_docu) then
      perform pg_temp.verificar(pg_temp.codigo(format(
        'select public.fn_vincular_cuenta_docente(%s, %L::uuid)', v_doc, v_docu)) = 'VIN_CUENTA_OCUPADA',
        'V9', 'una cuenta Docente con legajo no se vincula a otro');
    else
      perform pg_temp.verificar(pg_temp.codigo(format(
        'select public.fn_vincular_cuenta_docente(%s, %L::uuid)', v_doc, v_docu)) = 'OK',
        'V9', 'una cuenta Docente libre se vincula');
    end if;
    v_controles := v_controles + 1;
  end if;

  raise exception 'PRUEBAS_ETAPA23_OK|% controles (V1 a V9) - a proposito, para deshacer todo', v_controles;
end $prueba$;

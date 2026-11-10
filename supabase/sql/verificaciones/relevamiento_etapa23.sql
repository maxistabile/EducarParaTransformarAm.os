-- ============================================================
-- RELEVAMIENTO ANTES DE ETAPA 23 (vinculos de cuentas y legajos)
-- SOLO LECTURA: no crea, no modifica ni borra nada.
-- Correr en Supabase -> SQL Editor y pasar el resultado al equipo.
-- No copiar correos a archivos versionados.
-- Solo ASCII.
-- ============================================================

-- R1. Columnas que usa etapa23 (tipo y si aceptan nulos)
select table_name, column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'alumnos' and column_name in
          ('id_alumno', 'id_usuario', 'id_usuario_padre', 'dni', 'legajo',
           'fecha_nacimiento', 'id_curso', 'obra_social', 'direccion', 'telefono', 'email'))
     or (table_name = 'docentes' and column_name in ('id_docente', 'id_usuario', 'dni', 'legajo'))
     or (table_name = 'usuarios' and column_name in ('id_usuario', 'email', 'rol', 'activo')))
 order by table_name, column_name;

-- R2. Restricciones e indices existentes (unicos y claves foraneas)
select conrelid::regclass as tabla, conname, pg_get_constraintdef(oid) as definicion
  from pg_constraint
 where conrelid in ('public.alumnos'::regclass, 'public.docentes'::regclass, 'public.usuarios'::regclass)
   and contype in ('u', 'f', 'p')
 order by 1, 2;
select tablename, indexname, indexdef
  from pg_indexes
 where schemaname = 'public' and tablename in ('alumnos', 'docentes', 'usuarios')
 order by 1, 2;

-- R3. Triggers sobre esas tablas
select event_object_table as tabla, trigger_name, action_timing, event_manipulation
  from information_schema.triggers
 where event_object_schema = 'public' and event_object_table in ('alumnos', 'docentes', 'usuarios')
 order by 1, 2;

-- R4. Cuentas vinculadas a mas de un legajo (etapa23 se detiene si hay)
select 'alumnos' as tabla, id_usuario, count(*) as legajos
  from alumnos where id_usuario is not null group by id_usuario having count(*) > 1
union all
select 'docentes', id_usuario, count(*)
  from docentes where id_usuario is not null group by id_usuario having count(*) > 1;

-- R5. Vinculos con un rol que no corresponde (solo informa)
select 'alumno con cuenta de otro rol' as caso, count(*) as cantidad
  from alumnos a join usuarios u on u.id_usuario = a.id_usuario where u.rol <> 'Alumno'
union all
select 'alumno con tutor de otro rol', count(*)
  from alumnos a join usuarios u on u.id_usuario = a.id_usuario_padre where u.rol <> 'Padre'
union all
select 'docente con cuenta de otro rol', count(*)
  from docentes d join usuarios u on u.id_usuario = d.id_usuario where u.rol <> 'Docente';

-- R6. Faltantes (los resuelve la pantalla de vinculos)
select 'alumnos sin cuenta de acceso' as caso, count(*) as cantidad from alumnos where id_usuario is null
union all
select 'alumnos sin tutor asociado', count(*) from alumnos where id_usuario_padre is null
union all
select 'usuarios Alumno sin legajo', count(*) from usuarios u
 where u.rol = 'Alumno' and not exists (select 1 from alumnos a where a.id_usuario = u.id_usuario)
union all
select 'docentes sin cuenta', count(*) from docentes where id_usuario is null
union all
select 'usuarios Docente sin legajo', count(*) from usuarios u
 where u.rol = 'Docente' and not exists (select 1 from docentes d where d.id_usuario = u.id_usuario)
union all
select 'usuarios Padre sin hijos', count(*) from usuarios u
 where u.rol = 'Padre' and not exists (select 1 from alumnos a where a.id_usuario_padre = u.id_usuario);

-- R7. Funciones de etapa23 que ya existan (deberia dar 0 filas)
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in (
   'fn_vinc_exigir_gestion', 'fn_vincular_tutor', 'fn_vincular_cuenta_alumno',
   'fn_vincular_cuenta_docente', 'fn_crear_legajo_alumno', 'fn_completar_usuario');

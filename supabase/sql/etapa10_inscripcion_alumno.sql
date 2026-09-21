-- ============================================================
-- ETAPA 10 - TP Metodologia de Sistemas II - ALTA DE ALUMNO
-- DESDE LA PREINSCRIPCION (RF1.1)
--
-- El alta principal de alumnos es: preinscripcion publica ->
-- aprobacion -> Registrar (Usuarios). Para que los alumnos que
-- entran por ese camino tengan los datos minimos del TP, la
-- preinscripcion ahora pide el domicilio del aspirante.
--
-- Telefono y correo NO se agregan: ya se piden como datos de
-- contacto del tutor (telefono_tutor, email_tutor) y se usan
-- como contacto del alumno al registrarlo.
--
-- Correr en: Supabase -> SQL Editor, ANTES de subir el frontend.
-- Requiere haber corrido etapa9_modulo_alumnos.sql.
-- Idempotente y solo ASCII.
-- ============================================================

alter table inscripciones add column if not exists direccion_aspirante text;


-- ------------------------------------------------------------
-- VERIFICACION (opcional). Mira el resultado en Messages.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'inscripciones'
               and column_name = 'direccion_aspirante') then
    raise notice 'OK 1/2: inscripciones.direccion_aspirante existe';
  else
    raise notice 'FALLA 1/2: no se creo inscripciones.direccion_aspirante';
  end if;

  if exists (select 1 from information_schema.columns
             where table_name = 'alumnos' and column_name = 'legajo') then
    raise notice 'OK 2/2: etapa9 aplicada (alumnos.legajo existe)';
  else
    raise notice 'FALLA 2/2: falta correr etapa9_modulo_alumnos.sql primero';
  end if;
end $$;

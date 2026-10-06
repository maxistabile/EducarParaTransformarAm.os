-- ============================================================
-- ETAPA 13 - TP Metodologia de Sistemas II - CORRECCION DE DUPLICADOS
-- Corrige dos problemas detectados al probar la etapa 12:
--
-- 1) CURSOS: el control ignoraba mayusculas, pero no textos que se ven
--    iguales y estan guardados distinto: doble espacio en el medio,
--    la enie guardada como "n + tilde suelta", o el espacio "duro"
--    que viene al copiar desde Word.
-- 2) MATERIAS: si ya habia materias repetidas, la etapa 12 no creo el
--    control (lo avisaba con un mensaje que el editor de Supabase no
--    muestra). Por eso se pudieron crear varias "Artes".
--
-- Que hace este script:
--   a) Compara textos "normalizados" (mismos espacios, misma forma de
--      la enie y las tildes, sin importar mayusculas).
--   b) Borra SOLO los duplicados que no se usan en ningun lado (sin
--      alumnos, asignaciones, horarios, asistencias ni calificaciones).
--      Nunca borra un registro en uso: esos los informa para revisar.
--   c) Unifica la escritura de los grados con la lista oficial.
--   d) Crea los controles con la comparacion normalizada.
--   e) Al final MUESTRA UNA TABLA con todo lo que hizo.
--
-- Correr en: Supabase -> SQL Editor. Idempotente y solo ASCII.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Funcion que normaliza un texto para compararlo
-- ------------------------------------------------------------
--    translate() pasa a minuscula las letras con tilde y la enie a mano,
--    porque lower() no siempre lo hace: depende de la configuracion
--    regional del servidor (con "C" deja "MATEMATICA" con la A tildada).
create or replace function public.fn_texto_normalizado(t text)
returns text language sql immutable as $$
  select lower(translate(btrim(regexp_replace(
           replace(normalize(coalesce(t, ''), NFC), E'\u200b', ''),
           E'[[:space:]\u00a0\u2007\u202f]+', ' ', 'g')),
           E'\u00c1\u00c9\u00cd\u00d3\u00da\u00dc\u00d1\u00c0\u00c8\u00cc\u00d2\u00d9',
           E'\u00e1\u00e9\u00ed\u00f3\u00fa\u00fc\u00f1\u00e0\u00e8\u00ec\u00f2\u00f9'))
$$;

-- Registro de lo que hace el script (se muestra al final)
drop table if exists _resultado_etapa13;
create temp table _resultado_etapa13 (
  orden serial, resultado text, detalle text
);


-- ------------------------------------------------------------
-- 2) MATERIAS repetidas: se conserva la mas usada (o la mas antigua)
-- ------------------------------------------------------------
do $$
declare g record; r record; v_keep int;
begin
  for g in select public.fn_texto_normalizado(nombre) k from materias
           group by 1 having count(*) > 1 loop
    select m.id_materia into v_keep from materias m
     where public.fn_texto_normalizado(m.nombre) = g.k
     order by (select count(*) from asignaciones a where a.id_materia = m.id_materia) desc,
              m.id_materia
     limit 1;
    for r in select id_materia, nombre from materias
             where public.fn_texto_normalizado(nombre) = g.k
               and id_materia <> v_keep loop
      if exists (select 1 from asignaciones where id_materia = r.id_materia) then
        insert into _resultado_etapa13 (resultado, detalle) values ('REVISAR',
          format('Materia repetida "%s" (id %s) tiene asignaciones: unificar a mano con la id %s', r.nombre, r.id_materia, v_keep));
      else
        delete from materias where id_materia = r.id_materia;
        insert into _resultado_etapa13 (resultado, detalle) values ('BORRADA',
          format('Materia repetida sin uso: "%s" (id %s). Se conserva la id %s', r.nombre, r.id_materia, v_keep));
      end if;
    end loop;
  end loop;
end $$;


-- ------------------------------------------------------------
-- 3) CURSOS repetidos: mismo nivel + grado + division
--    Se conserva el que tiene alumnos o asignaciones (o el mas antiguo)
-- ------------------------------------------------------------
do $$
declare g record; r record; v_keep int;
begin
  for g in select nivel,
                  public.fn_texto_normalizado(grado_anio) kg,
                  public.fn_texto_normalizado(division) kd
             from cursos group by 1, 2, 3 having count(*) > 1 loop
    select c.id_curso into v_keep from cursos c
     where c.nivel = g.nivel
       and public.fn_texto_normalizado(c.grado_anio) = g.kg
       and public.fn_texto_normalizado(c.division) = g.kd
     order by (select count(*) from alumnos al where al.id_curso = c.id_curso)
            + (select count(*) from asignaciones a where a.id_curso = c.id_curso) desc,
              c.id_curso
     limit 1;
    for r in select id_curso, grado_anio, division from cursos c
             where c.nivel = g.nivel
               and public.fn_texto_normalizado(c.grado_anio) = g.kg
               and public.fn_texto_normalizado(c.division) = g.kd
               and c.id_curso <> v_keep loop
      if exists (select 1 from alumnos where id_curso = r.id_curso)
         or exists (select 1 from asignaciones where id_curso = r.id_curso) then
        insert into _resultado_etapa13 (resultado, detalle) values ('REVISAR',
          format('Curso repetido %s "%s" %s (id %s) tiene alumnos o asignaciones: unificar a mano con la id %s',
                 g.nivel, r.grado_anio, r.division, r.id_curso, v_keep));
      else
        delete from cursos where id_curso = r.id_curso;
        insert into _resultado_etapa13 (resultado, detalle) values ('BORRADO',
          format('Curso repetido sin uso: %s "%s" %s (id %s). Se conserva la id %s',
                 g.nivel, r.grado_anio, r.division, r.id_curso, v_keep));
      end if;
    end loop;
  end loop;
end $$;


-- ------------------------------------------------------------
-- 4) ASIGNACIONES repetidas (activas): se conserva la que tiene uso
-- ------------------------------------------------------------
do $$
declare g record; r record; v_keep int;
begin
  for g in select id_docente, id_materia, id_curso, coalesce(id_periodo, 0) p
             from asignaciones where activo is not false
            group by 1, 2, 3, 4 having count(*) > 1 loop
    select a.id_asignacion into v_keep from asignaciones a
     where a.activo is not false and a.id_docente = g.id_docente
       and a.id_materia = g.id_materia and a.id_curso = g.id_curso
       and coalesce(a.id_periodo, 0) = g.p
     order by (select count(*) from horarios h where h.id_asignacion = a.id_asignacion)
            + (select count(*) from asistencias s where s.id_asignacion = a.id_asignacion)
            + (select count(*) from calificaciones c where c.id_asignacion = a.id_asignacion) desc,
              a.id_asignacion
     limit 1;
    for r in select id_asignacion from asignaciones a
             where a.activo is not false and a.id_docente = g.id_docente
               and a.id_materia = g.id_materia and a.id_curso = g.id_curso
               and coalesce(a.id_periodo, 0) = g.p and a.id_asignacion <> v_keep loop
      if exists (select 1 from horarios where id_asignacion = r.id_asignacion)
         or exists (select 1 from asistencias where id_asignacion = r.id_asignacion)
         or exists (select 1 from calificaciones where id_asignacion = r.id_asignacion) then
        insert into _resultado_etapa13 (resultado, detalle) values ('REVISAR',
          format('Asignacion repetida (id %s) tiene horarios, asistencias o notas: unificar a mano con la id %s',
                 r.id_asignacion, v_keep));
      else
        delete from asignaciones where id_asignacion = r.id_asignacion;
        insert into _resultado_etapa13 (resultado, detalle) values ('BORRADA',
          format('Asignacion repetida sin uso (id %s). Se conserva la id %s', r.id_asignacion, v_keep));
      end if;
    end loop;
  end loop;
end $$;


-- ------------------------------------------------------------
-- 5) Unificar la escritura de los grados con la lista oficial
--    ("1er  Ano" con doble espacio -> "1er anio" tal como lo carga el sistema)
-- ------------------------------------------------------------
do $$
declare s record; r record;
begin
  for s in select * from (values
      ('Inicial', 'Sala de 3'), ('Inicial', 'Sala de 4'), ('Inicial', 'Sala de 5'),
      ('Primario', '1er grado'), ('Primario', '2do grado'), ('Primario', '3er grado'),
      ('Primario', '4to grado'), ('Primario', '5to grado'), ('Primario', '6to grado'),
      ('Primario', '7mo grado'),
      ('Secundario', E'1er a\u00f1o'), ('Secundario', E'2do a\u00f1o'), ('Secundario', E'3er a\u00f1o'),
      ('Secundario', E'4to a\u00f1o'), ('Secundario', E'5to a\u00f1o')
    ) v(nivel, canon) loop
    for r in select id_curso, grado_anio from cursos c
             where c.nivel = s.nivel
               and public.fn_texto_normalizado(c.grado_anio) = public.fn_texto_normalizado(s.canon)
               and c.grado_anio <> s.canon
               and not exists (select 1 from cursos c2
                               where c2.id_curso <> c.id_curso and c2.nivel = c.nivel
                                 and c2.grado_anio = s.canon
                                 and public.fn_texto_normalizado(c2.division)
                                   = public.fn_texto_normalizado(c.division)) loop
      update cursos set grado_anio = s.canon where id_curso = r.id_curso;
      insert into _resultado_etapa13 (resultado, detalle) values ('UNIFICADO',
        format('Curso id %s: grado "%s" -> "%s"', r.id_curso, r.grado_anio, s.canon));
    end loop;
  end loop;
end $$;


-- ------------------------------------------------------------
-- 6) Controles con comparacion normalizada.
--    Si todavia quedara algun duplicado en uso, el control anterior
--    se mantiene y se informa para revisar.
-- ------------------------------------------------------------
do $$
begin
  begin
    drop index if exists uq_cursos_nivel_grado_div;
    create unique index uq_cursos_nivel_grado_div on cursos
      (nivel, public.fn_texto_normalizado(grado_anio), public.fn_texto_normalizado(division));
    insert into _resultado_etapa13 (resultado, detalle)
      values ('OK', 'Control de cursos duplicados activo (con texto normalizado)');
  exception when unique_violation then
    insert into _resultado_etapa13 (resultado, detalle)
      values ('PENDIENTE', 'Quedan cursos repetidos en uso: ver las filas REVISAR');
  end;

  begin
    drop index if exists uq_materias_nombre;
    create unique index uq_materias_nombre on materias
      (public.fn_texto_normalizado(nombre));
    insert into _resultado_etapa13 (resultado, detalle)
      values ('OK', 'Control de materias duplicadas activo (con texto normalizado)');
  exception when unique_violation then
    insert into _resultado_etapa13 (resultado, detalle)
      values ('PENDIENTE', 'Quedan materias repetidas en uso: ver las filas REVISAR');
  end;

  begin
    create unique index if not exists uq_asignaciones_doc_mat_cur on asignaciones
      (id_docente, id_materia, id_curso, coalesce(id_periodo, 0))
      where activo is not false;
    insert into _resultado_etapa13 (resultado, detalle)
      values ('OK', 'Control de asignaciones duplicadas activo');
  exception when unique_violation then
    insert into _resultado_etapa13 (resultado, detalle)
      values ('PENDIENTE', 'Quedan asignaciones repetidas en uso: ver las filas REVISAR');
  end;
end $$;

-- Informativo: cursos con un grado que no esta en la lista oficial
insert into _resultado_etapa13 (resultado, detalle)
select 'INFO', format('Curso id %s (%s %s): grado "%s" fuera de la lista oficial. Corregir desde Cursos -> Editar',
                      id_curso, nivel, division, grado_anio)
  from cursos
 where public.fn_texto_normalizado(grado_anio) not in (
   'sala de 3', 'sala de 4', 'sala de 5',
   '1er grado', '2do grado', '3er grado', '4to grado', '5to grado', '6to grado', '7mo grado',
   E'1er a\u00f1o', E'2do a\u00f1o', E'3er a\u00f1o', E'4to a\u00f1o', E'5to a\u00f1o');


-- ------------------------------------------------------------
-- 7) RESULTADO (esta tabla es lo que muestra el editor de Supabase)
-- ------------------------------------------------------------
select resultado, detalle from _resultado_etapa13 order by orden;

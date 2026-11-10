-- ============================================================
-- DATOS PARA LA COEVALUACION (tercer parcial) - SOLO LECTURA
--
-- Muestra si la base ya tiene los casos que conviene mostrar en la
-- demo. No crea, no modifica ni borra nada: solo SELECT.
-- Se corre en Supabase -> SQL Editor. El resultado queda en el editor;
-- no copiar correos ni datos a archivos versionados.
--
-- Casos buscados:
--   D1. Un padre activo con dos hijos o mas.
--   D2. Una factura pendiente (sin pagos acreditados y con saldo).
--   D3. Una factura parcial (algo acreditado y saldo pendiente).
--   D4. Una factura saldada (total > 0 y saldo 0).
--   D5. Comprobantes En revision, Aprobado y Rechazado (con motivo).
--   D6. Datos para los listados web: deportes y transporte facturados.
-- La ultima consulta resume cada caso como OK o FALTA.
-- Solo ASCII.
-- ============================================================

-- D1. Padres activos con dos hijos o mas
select u.id_usuario, u.email, count(a.id_alumno) as hijos
  from usuarios u
  join alumnos a on a.id_usuario_padre = u.id_usuario
 where u.rol = 'Padre' and u.activo
 group by u.id_usuario, u.email
having count(a.id_alumno) >= 2
 order by hijos desc
 limit 10;

-- D2 a D4. Facturas por situacion de cobro, con el padre del alumno
select case
         when v.total = 0 then 'Sin cargo'
         when v.saldo = 0 then 'Saldada'
         when v.cobrado > 0 then 'Parcial'
         else 'Pendiente'
       end as situacion,
       v.id_factura, v.anio, v.mes, v.alumno_nombre, v.total, v.cobrado,
       v.en_revision, v.saldo, v.fecha_vencimiento, u.email as padre
  from v_facturas_saldo v
  join alumnos a on a.id_alumno = v.id_alumno
  left join usuarios u on u.id_usuario = a.id_usuario_padre
 order by situacion, v.anio desc, v.mes desc
 limit 40;

-- D5. Comprobantes por estado (el padre ve todos los de sus hijos)
select p.estado, p.id_pago, p.id_factura, p.monto_pagado,
       p.fecha_pago, p.fecha_revision, p.motivo_rechazo,
       (p.recibo_path is not null) as tiene_pdf_de_pago, u.email as padre
  from pagos p
  join alumnos a on a.id_alumno = p.id_alumno
  left join usuarios u on u.id_usuario = a.id_usuario_padre
 where p.id_factura is not null
 order by p.estado, p.fecha_pago desc
 limit 30;

-- Resumen: OK si existe al menos un caso
select 'D1 padre con dos hijos' as caso,
       case when exists (
         select 1 from alumnos a join usuarios u on u.id_usuario = a.id_usuario_padre
          where u.rol = 'Padre' and u.activo
          group by a.id_usuario_padre having count(*) >= 2)
       then 'OK' else 'FALTA' end as estado
union all
select 'D2 factura pendiente',
       case when exists (select 1 from v_facturas_saldo where total > 0 and cobrado = 0 and saldo > 0)
       then 'OK' else 'FALTA' end
union all
select 'D3 factura parcial',
       case when exists (select 1 from v_facturas_saldo where cobrado > 0 and saldo > 0)
       then 'OK' else 'FALTA' end
union all
select 'D4 factura saldada',
       case when exists (select 1 from v_facturas_saldo where total > 0 and saldo = 0)
       then 'OK' else 'FALTA' end
union all
select 'D5 comprobante En revision',
       case when exists (select 1 from pagos where estado = 'En revision') then 'OK' else 'FALTA' end
union all
select 'D5 comprobante Aprobado',
       case when exists (select 1 from pagos where estado = 'Aprobado') then 'OK' else 'FALTA' end
union all
select 'D5 comprobante Rechazado con motivo',
       case when exists (select 1 from pagos where estado = 'Rechazado' and motivo_rechazo is not null)
       then 'OK' else 'FALTA' end
union all
select 'D6 item de deporte facturado',
       case when exists (select 1 from factura_items where id_actividad is not null) then 'OK' else 'FALTA' end
union all
select 'D6 item de transporte facturado',
       case when exists (select 1 from factura_items where id_recorrido is not null) then 'OK' else 'FALTA' end;

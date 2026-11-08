# SQL de los cambios — Educar Para Transformar

Scripts para ejecutar en **Supabase → SQL Editor**, en orden.
Cada archivo corresponde a una etapa de implementación de los requerimientos.

| Archivo | Requerimientos | Qué crea |
|---|---|---|
| `etapa1_quick_wins.sql` | R10, R11 | Columnas nuevas en `inscripciones` + tabla `mensajes_contacto` |
| `etapa2_extracurriculares.sql` | R2 | Tablas `actividades_extracurriculares` e `inscripciones_actividades` + control de cupo + carga inicial |
| `etapa3_reservas.sql` | R5 | Tablas `instalaciones` y `reservas_instalaciones` + control de solapamiento + carga inicial |
| `etapa4_gestion_comercial.sql` | R4 | Tablas `becas`, `sueldos`, `compras_insumos` |
| `etapa5_legajo_documentos.sql` | R1, R3 | Tabla `documentos_alumno` |
| `etapa9_modulo_alumnos.sql` | TP Met. II · RF1 (HU7–HU10) | Legajo automático, teléfono y email en `alumnos` (domicilio = `direccion`, ya existía) + ajuste de `trg_cupo_curso` al reactivar |
| `etapa10_inscripcion_alumno.sql` | TP Met. II · RF1.1 | `direccion_aspirante` en `inscripciones`: la preinscripción pide el domicilio |
| `etapa11_modulo_profesores.sql` | TP Met. II · RF2 (HU11–HU14) | Legajo automático en `docentes` (teléfono = `usuarios.telefono`, ya existía) |
| `etapa12_modulo_academico.sql` | TP Met. II · RF3 + RF2.5 (HU3–HU6, HU15–HU19) | Tabla `niveles` (solo 3) con clave foránea desde `cursos`; sin cursos, materias ni asignaciones duplicados; horarios sin superposición por curso |
| `etapa13_correccion_duplicados.sql` | Corrección de la etapa 12 | Compara textos normalizados (espacios, tildes, ñ, mayúsculas); borra duplicados sin uso; unifica los grados con la lista oficial; muestra el resultado como tabla |
| `etapa14_deportes_servicios.sql` | TP Met. II · RF4 y RF5 (HU21–HU29) | Grupos deportivos por nivel y horario con profesor responsable; máximo 2 deportes sin cruces; 4 recorridos de transporte; comedor; bajas que conservan historial |
| `etapa15_notificaciones_inscripciones.sql` | TP Met. II · RF9 (HU40) | Aviso automático al padre al inscribir, cambiar o dar de baja a su hijo en deportes, transporte o comedor (patrón Observer con triggers) |
| `etapa16_valores.sql` | TP Met. II · Parte 3 · RF11.1–RF11.4 (HU46–HU49) | Tabla `valores_servicio`: valores de cuota, cada deporte, cada recorrido y comedor, con fecha de vigencia. Un valor por concepto, referencia y fecha (corregir = reemplazar el de esa fecha). Sin RLS (decisión del equipo) |
| `etapa17_facturacion.sql` | TP Met. II · Parte 3 · RF11.5 (HU50, **etapa A, parcial**) | Tablas `facturas` y `factura_items`, `fn_generar_facturas` (único generador de cuotas y facturas), protecciones, columna `cuotas.cubierta_por_beca` y vistas de saldo. Antes: `verificaciones/relevamiento_cuotas.sql` |

## Etapa 17 — Facturación (HU50, etapa A)

La tabla `cuotas` no se crea en ningún script del repo, así que **antes** de
`etapa17` hay que relevar cómo está en la base. Orden:

1. **`verificaciones/relevamiento_cuotas.sql`** (solo lectura). Comparar con
   "LO ESPERADO" del encabezado del archivo. Si algo no coincide (por ejemplo,
   un trigger en `cuotas`, otra columna obligatoria o falta la clave única
   `(id_alumno, mes, anio)`), avisar antes de seguir.
   *Resultado del 08/11:* compatible con `etapa17`. Diferencias sin impacto:
   `estado` es `varchar` y acepta nulos, `id_alumno` acepta nulos,
   `fecha_vencimiento` es obligatoria, hay una columna `created_at` y la FK a
   alumnos es `ON DELETE CASCADE`. Diferencia a revisar: existe una tabla
   `pagos` con FK a `cuotas` (`ON DELETE RESTRICT`) que el código no usa.
2. **`verificaciones/relevamiento_pagos.sql`** (solo lectura). Muestra si
   `pagos` tiene datos y si alguna función, vista o tarea programada escribe en
   `cuotas` por fuera de la aplicación. Comparar con "LO ESPERADO".
   *Resultado del 08/11:* coincide. `pagos` está vacía, sin triggers ni
   actividad. Ninguna función, vista ni tarea programada escribe en `cuotas`
   (pg_cron no está instalado). No hay cuotas sin alumno y `authenticated`
   puede crear tablas temporales. **`etapa17` queda lista para ejecutar.**
   `pagos` (con `monto_pagado`, `nro_comprobante` e `id_usuario_registra`)
   queda para evaluar en HU53 a HU55 antes de crear tablas nuevas.
3. **`etapa17_facturacion.sql`**. Empieza con un control previo que corta el
   script sin aplicar nada si `cuotas` no es como se espera. Al final muestra
   una tabla: todo tiene que dar `OK`.
4. **`verificaciones/pruebas_etapa17.sql`**. Termina **siempre con un error a
   propósito** para que la base vuelva atrás y no quede ningún dato. Si todo
   pasa, el error es `PRUEBAS_ETAPA17_OK|12 controles ...`. Cualquier otro
   error es una falla: copiarlo completo.

Cómo conviven factura y cuota:
- La cuota es la deuda del concepto "Cuota". La factura la agrupa con los
  servicios y su ítem Cuota **apunta** a la fila de `cuotas`: una sola deuda
  por alumno y período.
- `select public.fn_generar_facturas(anio, mes);` emite para los alumnos
  activos que no tienen factura del período. Si la cuota ya existía, la toma
  tal cual. Repetirla no duplica ni modifica nada. No acepta meses anteriores
  al actual. Si falta un valor, no emite ninguna factura.
- Beca: solo sobre la cuota, la activa al emitir. Del 100 %: cuota `Pagada`
  con `cubierta_por_beca`, neto 0, sin fecha ni método de pago.
- Facturas e ítems no se modifican ni se borran. Una cuota pagada no vuelve
  atrás. Una cuota facturada no cambia alumno, período, vencimiento ni
  importes. Registrar el pago y procesar vencimientos siguen permitidos.
  Pagos nuevos: solo transferencia.

**Contrato de saldo (para HU51 a HU56):** el total emitido es fijo y el saldo
se calcula en `v_facturas_saldo` y `v_factura_items_saldo`. Un ítem con neto
0 es "Sin cargo" (no es deuda ni dinero cobrado). La Cuota figura "Pagado"
cuando `cuotas.estado = 'Pagada'`, aunque el pago se registre después de
emitir. Los servicios quedan "Pendiente" hasta que HU54 y HU55 sumen los
comprobantes (`create or replace view`). La deuda de un período con factura
se lee de estas vistas: la cuota **no se suma por fuera** de sus ítems.

**Etapa B (pendiente):** último día hábil con feriados, pg_cron y PDF.

## Pasos manuales adicionales

### Storage (Etapa 5 — documentación del legajo)
Crear un bucket en **Supabase → Storage**:
- Nombre: `documentos-alumnos`
- Marcarlo como **Public bucket**

### Etapa 6 — Notificaciones automáticas (R6)
No requiere SQL: usa la tabla `notificaciones` que ya existía.
Las notificaciones se generan solas al tomar asistencia (inasistencia),
cargar calificaciones, procesar vencimientos de cuotas y publicar
noticias marcadas como comunicado.

### Etapa 7 — Perfil padre/tutor (R8)
No requiere SQL. Para usar el perfil de padre/tutor:
1. Crear el usuario del padre/madre en la gestión de usuarios con
   rol **`Padre`** (o `Tutor`).
2. Al registrar al alumno, indicar ese email en "Email del padre/tutor"
   para que quede vinculado (`id_usuario_padre`).

Cuando ese usuario inicie sesión, el portal le mostrará los datos de
su/s hijo/s (con un selector si tiene más de uno). El estudiante, con
su propio usuario, sigue viendo únicamente sus datos.

## Nota sobre tipos
Los scripts asumen que `alumnos.id_alumno` es `bigint`. Si tu tabla
usa `integer`, reemplazá `bigint` por `integer` en las columnas
`id_alumno` de los scripts de las etapas 2, 4 y 5.
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
| `etapa18_comprobantes.sql` | TP Met. II · Parte 3 · RF12.4–RF12.6 (HU54–HU56) | Reutiliza `pagos` como comprobante de transferencia (+ tabla `pago_items`), bucket privado `pagos`, funciones solo para `service_role` (las usa la Edge Function `pagos`), protecciones, control en `fn_controlar_cuota`, vistas de saldo con "En revision" y `pagos` en Realtime. Antes: `verificaciones/relevamiento_etapa18.sql` |
| `etapa19_validar_solicitud_concurrente.sql` | TP Met. II · Parte 3 · corrección de HU54 | `fn_validar_solicitud`: dos envíos simultáneos con la misma clave devuelven el mismo comprobante (antes, el gemelo podía recibir `PAG_ITEM_NO_DISPONIBLE`). Requiere `etapa18`; no hace falta volver a ejecutarla |
| `etapa20_factura_pdf.sql` | TP Met. II · Parte 3 · RF13.1 (HU57) y parte del PDF de RF11.5 (HU50) | `fn_datos_factura`: datos históricos de la factura emitida para generar su PDF (padre actual, Admin o Directivo; solo `service_role`). No escribe ni modifica facturas |

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

*Ejecución del 08/11 (informada por el equipo):* `etapa17` con todos los
controles en `OK` y 0 facturas emitidas. La prueba transaccional dio
`PRUEBAS_ETAPA17_OK|12 controles (P1 a P12; P12 ejecutado)` con 20 alumnos
activos, sin dejar datos.

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

## Etapa 18 — Comprobantes de pago (HU54 a HU56)

Orden (lo ejecuta el equipo; la IA no corre SQL en Supabase):

1. **`verificaciones/relevamiento_etapa18.sql`** (solo lectura). Todo tiene
   que dar `OK` o `INFO`; cualquier `AVISAR` se pasa antes de seguir. Comprueba
   que `pagos` siga vacía, que `id_cuota` acepte nulos, el check de
   `metodo_pago`, que no haya columnas, tablas ni funciones con los nombres
   nuevos, la configuración del bucket `pagos` si ya existe, la publicación
   `supabase_realtime` y cuántos Admin, Directivo y Padre activos hay.
2. **`etapa18_comprobantes.sql`**. El control previo corta sin aplicar nada si
   `pagos` tiene filas, si `id_cuota` no acepta nulos, si una columna nueva ya
   existe con otro tipo o si el bucket `pagos` existe y no es privado, de 5 MB
   y JPG/PNG/PDF (`ETAPA18_BUCKET`: no lo modifica, se decide con el equipo).
   Al final muestra una tabla: todo `OK` (RLS figura `INACTIVO`, como se
   espera).
3. **`verificaciones/pruebas_etapa18.sql`**. Como la de `etapa17`: termina
   **siempre con un error a propósito** y no deja datos. Si todo pasa:
   `PRUEBAS_ETAPA18_OK|16 controles (Q1 a Q16)`. Necesita 4 alumnos activos,
   un Padre y un Admin o Directivo activos (no crea usuarios).
4. Después: crear la Edge Function `pagos` (ver `supabase/functions/README.md`).

Cómo funciona:
- Cada fila nueva de `pagos` es **un comprobante de transferencia** para uno o
  más ítems de **una** factura (`pago_items`). Una factura admite varios
  comprobantes. Se reutilizan `monto_pagado` (total calculado por la base),
  `fecha_pago` (fecha de carga), `metodo_pago` (Transferencia) e
  `id_usuario_registra` (el padre).
- Estados: `En revision` → `Aprobado` o `Rechazado` (con motivo de 5
  caracteres o más). Cargar no acredita: el ítem sigue en el saldo. El padre
  no anula; la administración rechaza y el ítem queda libre.
- Un ítem está en un solo comprobante no rechazado (índice único parcial). No
  se puede pagar un ítem Sin cargo, Pagado o En revisión. Las cuotas
  heredadas sin factura se siguen pagando solo con "Registrar pagos".
- Aprobar marca los ítems pagados y la cuota `Pagada` (fecha de aprobación,
  Transferencia). Total emitido y facturas no cambian.
- `fn_controlar_cuota` suma dos controles: "Registrar pagos" no puede pagar
  una cuota con un comprobante En revisión (`CUO_EN_REVISION`), y una cuota
  pagada no cambia su fecha ni su método (`CUO_PAGADA`).
- **Idempotencia:** cada envío tiene una clave y una huella (usuario, factura,
  ítems y contenido del archivo). La misma clave con la misma huella devuelve
  el mismo comprobante; con otra, `PAG_CLAVE_REUSADA`.
- **Concurrencia:** todas las operaciones bloquean en el mismo orden (factura
  → pago → cuotas por `id_cuota`); "Registrar pagos" solo bloquea la cuota.
- **Archivos:** bucket privado `pagos`, sin políticas en `storage.objects`.
  Solo la Edge Function (service role) sube, firma y genera el PDF.
- **Permisos:** las funciones solo las ejecuta `service_role` (se quita
  EXECUTE a `public`, `anon` y `authenticated`) y tienen `search_path` fijo.
  `authenticated` solo **lee** `pagos` y `pago_items`; escribir solo se puede
  desde las funciones (trigger `PAG_SOLO_FUNCIONES`).
- **Sin RLS (CLAUDE.md 3.1):** cualquier usuario con sesión puede leer
  `pagos` y `pago_items` por la API y suscribirse a sus cambios en Realtime.
  Los archivos solo se abren con URLs firmadas que entrega la Edge Function
  después de controlar rol y pertenencia.

*Verificado por la IA el 09/11 (no en Supabase):* el SQL en PGlite (PostgreSQL
en memoria) con un esquema **simulado** de `pagos` igual al relevado el 08/11:
`etapa18` dos veces, la prueba (16 de 16), `pruebas_etapa17` con `etapa18`
aplicada (12 de 12) y 7 errores introducidos a propósito que la prueba
detecta. **Concurrencia real** con PostgreSQL 17.6 local y dos sesiones a la
vez (10 casos: misma clave, mismo ítem, carga contra "Registrar pagos" en los
dos órdenes, dos aprobaciones, aprobar contra rechazar en los dos órdenes,
aprobar contra "Registrar pagos" y dos operaciones sobre la misma factura sin
bloqueo mutuo). Sin el bloqueo de la cuota, dos de esos casos fallan.

*Ejecutado por el equipo en Supabase el 09/11 (informado por el equipo):*
relevamiento compatible, `etapa18` con todos los controles en `OK` y RLS
`INACTIVO`, y `pruebas_etapa18` con `PRUEBAS_ETAPA18_OK|16 controles`.

## Etapa 19 — Envíos simultáneos con la misma clave (corrección de HU54)

Orden (lo ejecuta el equipo; la IA no corre SQL en Supabase):

1. **`etapa19_validar_solicitud_concurrente.sql`**. Requiere `etapa18` ya
   ejecutada (si no, corta con `ETAPA19_REQUIERE_ETAPA18` sin aplicar nada).
   Solo reemplaza `fn_validar_solicitud` y vuelve a dejar sus permisos. Al
   final muestra una tabla: todo `OK` y RLS `INACTIVO`.
2. **`verificaciones/pruebas_etapa18.sql`** otra vez, como regresión: tiene
   que seguir dando `PRUEBAS_ETAPA18_OK|16 controles`.

No hace falta volver a publicar la Edge Function `pagos`: no cambia.

Qué corrige: `fn_validar_solicitud` lee la clave y después, en otra
sentencia, valida los ítems. Con READ COMMITTED cada sentencia ve su
propia instantánea: si un envío gemelo (misma clave, usuario y huella) se
confirmaba entre las dos lecturas, la clave no aparecía pero los ítems ya
figuraban En revisión, y el gemelo recibía `PAG_ITEM_NO_DISPONIBLE`. Ahora,
ante ese error, se vuelve a leer **solo la clave, una vez**:
- misma clave, usuario y huella → el comprobante existente;
- misma clave con otra huella u otro usuario → `PAG_CLAVE_REUSADA`;
- clave inexistente → el mismo `PAG_ITEM_NO_DISPONIBLE` (otra clave reservó
  el ítem: conflicto real).

No cambian la identidad, la pertenencia, la huella, los bloqueos
(`fn_registrar_comprobante` sigue bloqueando factura → cuotas), los
permisos (solo `service_role`, `search_path` fijo) ni RLS.

*Verificado por la IA el 09/11 (no en Supabase):* prueba concurrente con
sesiones reales en PostgreSQL 17.6 local y coordinación explícita (un
advisory lock detiene a la segunda sesión justo después de leer la clave,
confirmado en `pg_locks`). Sin `etapa19` falla (el gemelo recibe
`PAG_ITEM_NO_DISPONIBLE`); con `etapa19` pasa, y siguen bien la clave con
otra huella, las claves distintas sobre el mismo ítem y las regresiones
(concurrencia 10 de 10, `pruebas_etapa18` 16 de 16, `pruebas_etapa17` 12
de 12 y la Edge Function 13 de 13).

*Ejecutado por el equipo en Supabase el 09/11 (informado por el equipo):*
`etapa19` y la repetición de `pruebas_etapa18` dieron el resultado esperado.
El recorrido manual de esta corrección **no se hizo** (decisión del equipo).

## Etapa 20 — Datos de la factura para su PDF (HU57; parte del PDF de HU50)

Orden (lo ejecuta el equipo; la IA no corre SQL en Supabase):

1. **`etapa20_factura_pdf.sql`**. Requiere `etapa17` y `etapa18` (si faltan,
   corta con `ETAPA20_REQUIERE_ETAPA17` o `ETAPA20_REQUIERE_ETAPA18`). Solo
   crea `fn_datos_factura` y sus permisos. Al final muestra una tabla: todo
   `OK` y RLS `INACTIVO`.
2. **`verificaciones/pruebas_etapa20.sql`**: termina **siempre con un error a
   propósito** y no deja datos. Si todo pasa:
   `PRUEBAS_ETAPA20_OK|7 controles (R1 a R7)`. Necesita 2 alumnos activos,
   un Padre y un Admin o Directivo activos (no crea usuarios).
3. Después: volver a publicar la Edge Function `pagos` (acción `factura`).

Cómo funciona:
- `fn_datos_factura(usuario, id_factura)` devuelve solo datos **históricos**:
  los copiados en `facturas` al emitir (alumno, DNI, curso, período, emisión,
  vencimiento y total) y sus ítems (descripción, importe, descuento, beca y
  neto). No arma el documento con alumnos ni valores actuales.
- Acceso: el padre **actual** del alumno, o Admin y Directivo. Docente y
  Alumno no (`PAG_SIN_PERMISO`); otro padre, `PAG_FACTURA_AJENA`; factura
  inexistente, `PAG_FACTURA_NO_EXISTE`.
- **No escribe**: la factura emitida no cambia (`pdf_path` queda como está).
  El PDF lo genera la Edge Function en la ruta fija `facturas/<id>.pdf` del
  bucket privado `pagos`, una sola vez y sin upsert.
- Solo la ejecuta `service_role`, con `search_path` fijo. RLS no cambia.
- HU50 sigue **parcial**: falta la programación automática (último día
  hábil, feriados y pg_cron).

*Verificado por la IA el 09/11 (no en Supabase):* en PGlite con el esquema
simulado, `etapa20` dos veces (idempotente) y `pruebas_etapa20` 7 de 7; con
`etapa17` a `etapa19` siguen `pruebas_etapa17` 12 de 12 y `pruebas_etapa18`
16 de 16.

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
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
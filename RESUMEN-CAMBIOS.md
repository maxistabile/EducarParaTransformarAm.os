# Resumen de cambios — Educar Para Transformar

Sesión de corrección de bugs y features sobre la SPA React + Supabase.

**Contexto importante:** es una **app de muestra para la facultad**. Se decidió dejar
**RLS apagada** en toda la base (salvo `mensajes_contacto`); las reglas de
permisos/jerarquía/bloqueo se implementan **client-side (UX)**. Las reglas de
integridad de datos sí se dejan en la base (triggers/constraints), porque no
dependen de RLS y son robustas.

---

## Estado de los 12 ítems

| #  | Ítem | Estado | Dónde |
|----|------|--------|-------|
| 1  | Usuario desactivado podía iniciar sesión | ✅ Resuelto (client-side) | `Login.tsx`, `AdminPanel.tsx`, `StudentPortal.tsx` |
| 2  | Asignar alumno a curso sin respetar cupo | ✅ Resuelto (trigger, testeado) | `pendientes.sql` |
| 3  | Directivo podía desactivar a otro directivo | ✅ Resuelto (client-side) | `AdminPanel.tsx` |
| 4  | Accesos directos del dashboard no funcionaban | ✅ Resuelto | `AdminPanel.tsx` |
| 5  | No había vista de detalle de noticias | ✅ Resuelto | `NoticiaDetalle.tsx`, `App.tsx`, `Home.tsx` |
| 6  | Rechazar inscripción redirigía a registro | ✅ Resuelto | `AdminPanel.tsx` |
| 7  | No se podían eliminar noticias (solo ocultar) | ✅ Resuelto | `AdminPanel.tsx` |
| 8  | ERROR 409 al recargar el perfil | ⚠️ No reproducible en el código actual | — |
| 9  | Docente no podía ver el legajo del alumno | ✅ Resuelto (sección nueva) | `AdminPanel.tsx` |
| 10 | Galería solo aceptaba URL, no archivos | ✅ Ya estaba implementado | `AdminPanel.tsx` |
| 11 | Formulario de preinscripción sin validación | ✅ Resuelto (JS + DB) | `Home.tsx`, `pendientes.sql` |
| 12 | No había notificaciones automáticas | ✅ Resuelto (Edge Function email) | `supabase/functions/enviar-notificacion` |

**Extra:** las imágenes de **noticias** ahora se suben directo al Storage de Supabase
(antes solo se pegaba un link).

---

## Detalle por ítem

### 1 — Usuario desactivado no entra
- `Login.tsx`: `redirectByRole` ahora lee `rol, activo`; si `activo === false`
  hace `signOut()` y muestra "Tu usuario está desactivado".
- `AdminPanel.tsx`: al montar, si el perfil viene `activo === false` → `signOut()`
  + redirect a `/login`.
- `StudentPortal.tsx` (`loadAll`): mismo chequeo; `signOut()` y el guard de render
  redirige a `/login`.
- *Nota:* es validación de UX (con RLS apagada se puede saltear por la anon key).
  Suficiente para la demo.

### 2 — Cupo de cursos
- Trigger `trg_cupo_curso` + función `check_cupo_curso()` en la tabla `alumnos`:
  rechaza con `'Cupo completo'` si el curso llegó a `capacidad_maxima`. Atómico
  (lockea la fila del curso para evitar race conditions).
- El cupo de **actividades** ya estaba cubierto por el trigger existente `trg_check_cupo`.
- Constraint `uq_insc_act` (unique) para que un alumno no se inscriba 2 veces a la
  misma actividad.
- **Testeado OK** con el bloque de prueba de `pendientes.sql`.

### 3 — Jerarquía al desactivar
- `AdminPanel.tsx`: `GestionUsuarios` recibe `rolActor={perfil.rol}`. Nueva función
  `puedeGestionar(rolObjetivo)`: Admin gestiona a todos; Directivo no puede a Admin
  ni a otro Directivo. Si no puede, el botón "Desactivar/Activar" se reemplaza por "—".

### 4 — Accesos directos del dashboard
- `AdminPanel.tsx`: el `Dashboard` recibe `onIr={setActiveNav}` y cada tarjeta de
  "Accesos rápidos" tiene `onClick={() => onIr(item.key)}`. Antes no tenían handler.

### 5 — Detalle de noticias
- `NoticiaDetalle.tsx` (nuevo): lee `/noticias/:id`, trae la noticia (incluye
  `contenido`), con estados de carga / no encontrada / volver.
- `App.tsx`: ruta `<Route path='/noticias/:id' element={<NoticiaDetalle />} />`.
- `Home.tsx`: la card de noticia ahora navega al detalle al hacer click.

### 6 — Rechazo de inscripción
- `AdminPanel.tsx`: el botón "Registrar" (que llevaba a la pantalla de alta de
  usuario) ahora solo aparece cuando `estado === 'Aprobada' && !id_alumno_creado`.
  Rechazar ya no ofrece ninguna acción que redirija a registro.

### 7 — Eliminar noticias
- `AdminPanel.tsx`: nueva función `eliminar(id)` con `confirm()` +
  `supabase.from('noticias').delete()`. Botón "Eliminar" junto a "Ocultar/Publicar".

### 8 — ERROR 409 al recargar el perfil
- **No reproducible.** Se revisaron todas las escrituras (`insert/upsert/update`)
  de `StudentPortal.tsx` y `AdminPanel.tsx` + el historial git: ninguna se dispara
  al montar/recargar; todas están detrás de un botón. El 409 reportado venía de un
  estado que ya no está en el código.
- Si reaparece: capturar en DevTools → Network la request con status 409 (URL +
  método + body) para identificar la línea exacta.

### 9 — Legajo para docente
- `AdminPanel.tsx`: nueva entrada de menú "📁 Legajos" en `NAV_DOCENTE` y componente
  `LegajosDocente`. El docente elige una de sus asignaciones, ve los alumnos de ese
  curso y abre el legajo (reutiliza el componente `LegajoAlumno`). Solo accede a los
  alumnos de los cursos que dicta.

### 10 — Galería con upload
- Ya estaba implementado: `supabase.storage.from('galeria-imagenes').upload(...)`
  con fallback a URL. No requirió cambios de código (solo verificar que el bucket
  exista y sea público).

### 11 — Validación de preinscripción
- `Home.tsx` (`InscripcionForm` → `validar()`):
  - Nombre / apellido / tutor: mínimo 2 caracteres y **solo letras** (acentos, ñ,
    ü, espacios, guion, apóstrofo).
  - DNI: 7 a 9 dígitos numéricos.
  - Fecha de nacimiento: válida y no futura.
  - Email: formato `algo@algo.dominio`.
  - Teléfono: opcional; si se completa, formato válido y 7–15 dígitos reales.
  - Nivel: obligatorio.
- En la base (`pendientes.sql`): `dni_chk` (aplicado), `nac_chk`, NOT NULL en
  `nombre_aspirante` y `dni_aspirante`.

### 12 — Notificaciones automáticas (email)
- `supabase/functions/enviar-notificacion/index.ts` (nuevo): Edge Function que
  resuelve los emails de los destinatarios desde `usuarios` (service role) y envía
  con **Resend**. Plantilla HTML con la marca del colegio. Ignora emails internos
  `@alumno.local`.
- `AdminPanel.tsx` (`notificarFamilias`): tras insertar la notificación in-app,
  invoca la función (best-effort: si no está desplegada o falla, no rompe el flujo).
- Cubre automáticamente los 4 eventos que ya usaban `notificarFamilias`:
  **inasistencia, calificaciones, cuota vencida y comunicados**.

### Extra — Imágenes de noticias al Storage
- `AdminPanel.tsx` (`GestionNoticias`): input `type='file'` + subida a
  `noticias-imagenes` con `getPublicUrl`. Sigue disponible la opción de pegar URL
  (se deshabilita si se eligió un archivo).

---

## Archivos creados

- `frontend/src/NoticiaDetalle.tsx` — vista pública de detalle de noticia.
- `supabase/functions/enviar-notificacion/index.ts` — Edge Function de email.
- `supabase/pendientes.sql` — SQL de cupos + validación de preinscripción + test.
- `RESUMEN-CAMBIOS.md` — este documento.

## Archivos modificados

- `frontend/src/App.tsx` — ruta de detalle de noticias.
- `frontend/src/Home.tsx` — navegación al detalle + validación de preinscripción.
- `frontend/src/Login.tsx` — chequeo de `activo` en login.
- `frontend/src/StudentPortal.tsx` — chequeo de `activo` al cargar.
- `frontend/src/AdminPanel.tsx` — ítems 1, 3, 4, 6, 7, 9, 12 + upload de noticias.
- `deploy-edge-functions.sh` — agrega el deploy de `enviar-notificacion`.

---

## SQL aplicado en Supabase

- ✅ `dni_chk` en `inscripciones` (DNI 7–9 dígitos).
- ✅ `trg_cupo_curso` (+ función) — testeado OK.
- ✅ `uq_insc_act` (anti-duplicado en actividades).
- RLS: **apagada a propósito** (decisión de la demo).

### SQL pendiente de correr (en `supabase/pendientes.sql`)
- `nac_chk` (fecha de nacimiento no futura) + NOT NULL en `inscripciones`
  (si no se corrió aún).

---

## Tareas pendientes de tu lado (no son código)

1. **Storage — crear buckets públicos** (si no existen):
   ```sql
   insert into storage.buckets (id, name, public) values
     ('noticias-imagenes','noticias-imagenes', true),
     ('galeria-imagenes','galeria-imagenes', true)
   on conflict (id) do nothing;
   ```
2. **Desplegar la Edge Function de email:**
   - `./deploy-edge-functions.sh` (o `supabase functions deploy enviar-notificacion`).
   - Configurar secrets: `RESEND_API_KEY` (de https://resend.com) y, opcional,
     `EMAIL_FROM`.
   - Sin dominio verificado en Resend, el `from` por defecto solo entrega a tu
     propio email verificado (alcanza para mostrarlo en la defensa).
3. **Correr el SQL pendiente** de `supabase/pendientes.sql` (nac_chk + NOT NULL).

---

## Verificación

- `vite build` ✅ en cada cambio (sin errores).
- Errores de `tsc --noEmit`: solo **preexistentes** (`noUnusedLocals` en
  `LoginAdmin`, `MODALIDADES`, `menuOpen`, etc.), ajenos a estos cambios; no afectan
  el build (`build` = `vite build`, sin paso de `tsc`).

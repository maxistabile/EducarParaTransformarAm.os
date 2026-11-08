# CLAUDE.md — Educar para Transformar (Grupo 13 · Am.os)

Guía para trabajar en este repositorio con Claude Code. Leela completa antes de proponer o hacer cambios.

- **Equipo:** Stabile, Maximiliano (dueño del repo, `maxistabile`) · Jara, Agostina (`agostinaj1`)
- **Materia:** Metodología de Sistemas II – TUP 2026 (UTN FRRe) – Comisión 1 (tarde)
- **Idioma:** todo en **español rioplatense** (interfaz, mensajes de commit, PR, documentación y comentarios).
- **App web en producción:** https://educarparatransformar.vercel.app

---

## 1. Estado del proyecto (al 08/11/2026)

| Parte del TPI | Estado |
|---|---|
| Parte 1 – Página web institucional | ✅ Terminada (Metodología I) |
| Parte 2 – Sistema de gestión web (RF1 a RF9, HU1 a HU40) | ✅ Terminado, desplegado y evaluado (27/10) |
| TP Unidad 4 – CI/CD y optimización | ✅ Entregado |
| TP Unidad 5 – Pruebas y calidad | ✅ Entregado |
| **Parte 3 – Aplicación móvil integrada con IA** | ⏳ **En curso: se hace como PWA (no app nativa).** En `main`: base de la PWA (PR #15), manifiesto (PR #18), HU41, HU42 y parte de HU45 (PR #19), HU43 y HU44 (PR #24) y HU46 a HU49 (PR #27). HU45 no queda completa: ver sección 3.1. **HU50 en curso, parcial** (etapa A en `feat/HU50-facturacion`; la etapa B, pendiente). |

### Fechas que no se mueven
- **09/11/2026 – Cierre de desarrollo:** integración, pruebas integrales y despliegue final de la PWA (según el plan).
- **10/11/2026 – Testing / coevaluación:** la PWA tiene que estar **terminada y funcionando**. La consigna dice 11/11, pero el plan y el cronograma de la cátedra dicen 10/11: **se trabaja con el 10/11**. Ese día también hay que **mostrar en la aplicación lo trabajado en la Unidad 4**.
- **11/11 – 16/11:** corrección de defectos del testing + Informe de uso de IA.
- **17/11/2026 – 3.ª instancia (entrega total):** web + PWA + **informe de uso de IA** + **bitácora de IA** + documentación + bitácora del tablero Kanban.
- Recuperatorios: 24/11 y 01/12.

### Atraso respecto del plan
El plan ubica las HU41 a HU57 en los sprints M1 a M4 (ya vencidos) y las HU58 a HU66 en M5 (02/11 – 06/11). Al 08/11 falta el grueso de las historias: HU50 completa (etapa B) y de HU51 a HU66. Por eso: PR chicos, reutilizar todo lo que ya existe y seguir el **orden de implementación de la sección 7.4**, que prioriza lo que se ve en el testing.

---

## 2. Stack y estructura del repositorio

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite, React Router, Tailwind |
| Backend | Supabase: Auth, PostgREST, Edge Functions (Deno), Storage |
| Base de datos | PostgreSQL en Supabase (reglas de negocio con constraints y triggers) |
| Despliegue | Vercel: producción en cada merge a `main`, preview por rama/PR |
| Calidad | ESLint, Husky + lint-staged, Vitest, Cypress, GitHub Actions, Codacy |

```
/
├── .github/
│   ├── workflows/ci.yml            CI: lint → pruebas (JUnit) → build; guarda artefactos
│   └── pull_request_template.md    Plantilla de PR con checklist del autor y del revisor
├── .vscode/                        ESLint en VS Code (workingDirectories: frontend)
├── .codacy.yml                     Excluye e2e/ del análisis de Codacy
├── frontend/                       App web (React + Vite)
│   ├── src/App.tsx                 Rutas: / · /noticias/:id · /login · /admin · /portal
│   ├── src/Home.tsx                Sitio público + preinscripción
│   ├── src/Login.tsx               Login y redirección por rol
│   ├── src/AdminPanel.tsx          Panel de gestión (+12.000 líneas, ver deuda técnica)
│   ├── src/StudentPortal.tsx       Portal de alumno y tutor (ya muestra cuotas)
│   ├── src/validacionesAlumno.ts   Validaciones de RF1 (+ .test.ts con 8 pruebas Vitest)
│   ├── src/reglasServicios.ts      Mensajes y helpers de deportes/servicios
│   ├── src/reportes.ts             Lógica de reportes (RF8)
│   ├── .husky/pre-commit           Hook: lint-staged (ESLint sobre archivos staged)
│   └── .env.example                Variables necesarias (el .env NO se versiona)
├── e2e/                            Cypress (proyecto aparte, contra producción)
│   ├── cypress.config.js           baseUrl de producción; credenciales vía cy.task
│   ├── credenciales.example.json   Plantilla; credenciales.json está en .gitignore
│   └── cypress/e2e/                cp01-acceso-por-rol.cy.js · regresion-inicio.cy.js
└── supabase/
    ├── sql/etapaN_*.sql            Migraciones manuales, en orden (ver README)
    ├── functions/crear-usuario     Alta de usuarios (service role)
    └── functions/enviar-notificacion  Mails con Resend
```

---

## 3. Roles y control de acceso

| Rol (valor en `usuarios.rol`) | Entra a | Notas |
|---|---|---|
| `Admin`, `Directivo` | `/admin` (menú completo) | |
| `Docente` | `/admin` (menú reducido) | |
| `Padre` (en la interfaz: "Tutor") | `/portal` | Ve solo a sus hijos (`alumnos.id_usuario_padre`) |
| `Alumno` | `/portal` | |

- Hoy el control por rol se hace **en el frontend** (Login.tsx, AdminPanel.tsx, StudentPortal.tsx).
- La PWA habla directo con Supabase y también controla el rol en el frontend (`frontend/src/app/reglasAuthApp.ts`, `RutasProtegidas.tsx`).

### 3.1. Limitación aceptada: RLS fuera del alcance (decisión del equipo, 05/11/2026)
La aplicación se presenta como una **demo académica con datos ficticios y sin usuarios reales**. El equipo decidió no implementar Row Level Security para simplificar el proyecto. Esta decisión reemplaza las indicaciones anteriores que pedían implementarlo.

- HU45 conserva implementados el menú, las rutas y los comportamientos existentes, pero **no queda completamente cumplida** respecto del aislamiento de datos en la base.
- **RNF7 no puede darse por completamente cumplido** sin esa protección.
- Los filtros y controles del frontend **no garantizan el aislamiento de datos ante consultas directas a la API**.
- La demo debe usar **datos ficticios y comprobantes inventados**.
- Se mantienen la autenticación, las validaciones de archivos, la protección de secretos y el Storage privado cuando corresponda.

Reglas para el desarrollo: no habilitar, deshabilitar ni modificar RLS o políticas existentes; no agregar RLS en las tablas nuevas; no reemplazarlo por otro sistema de autorización en el backend; conservar las validaciones, los filtros por usuario, los menús y las rutas por rol que ya existen.

---

## 4. Flujo de trabajo (obligatorio)

`main` está **protegida**: PR obligatorio, **1 aprobación del otro integrante**, check **"Tests y build"** en verde, **sin excepciones** ni para el dueño.

1. **Issue** en GitHub con responsable → tarjeta en el tablero **Kanban** (GitHub Projects: Todo / In Progress / Done).
2. **Rama corta por cambio**: `feat/…`, `fix/…`, `test/…`, `chore/…`, `docs/…`, `perf/…`, `ci/…`. Si la rama corresponde a una HU, **el nombre incluye su ID** (lo fija el plan): `feat/HU54-comprobante`, `feat/HU41-45-auth-app`. Se pueden agrupar HU chicas relacionadas en un mismo PR.
3. **Commits con Conventional Commits** en español: `feat: …`, `fix: …`, `test: …`, `chore: …`, `docs: …`, `refactor: …`, `perf: …`, `ci: …`.
4. **PR** hacia `main` con la plantilla completa y `Closes #n`. PR **pequeños y con un solo objetivo**.
5. Checks automáticos: **CI** (lint, pruebas, build, artefactos), **Codacy**, **Vercel preview**.
6. **El otro integrante revisa** (en el preview de Vercel) y aprueba → merge → Vercel publica → la Issue se cierra y la tarjeta pasa a Done.

**Definition of Done (plan, sección 10.5):** criterios de aceptación cumplidos, validaciones probadas, integrado a `main` con revisión del otro integrante, tarjeta actualizada y demostrable. **Agregado para la app:** toda solución generada con IA queda registrada en la bitácora de IA (sección 8) y la revisa el otro integrante antes de integrarse.

Reglas para Claude Code:
- **Nunca** hacer push a `main`, ni `git commit --no-verify`, ni `--force`.
- **No mergear PR**: lo hace el equipo después de la revisión humana.
- Antes de commitear, correr en `frontend/`: `npm run lint` (0 errores), `npm test` y `npm run build`.
- Si una tarea es grande o tiene una decisión de diseño, **explicar el plan y esperar el OK** antes de escribir código.

---

## 5. Base de datos y backend

- **Migraciones:** scripts `supabase/sql/etapaN_*.sql`, que **el equipo ejecuta a mano** en Supabase → SQL Editor, en orden. La próxima es **`etapa18_…`**. Antes de `etapa17` se corre `verificaciones/relevamiento_cuotas.sql` (la tabla `cuotas` no se crea en el repo).
  - Cada script debe ser **idempotente** (`if not exists`, `create or replace`) e incluir al final una **consulta de verificación**.
  - Documentar cada script nuevo en `supabase/sql/README.md`.
  - **Claude Code no ejecuta SQL contra la base de producción**: escribe el script y el equipo lo corre.
- **Reglas de negocio en la base** (constraints y triggers): legajo automático, DNI único, cupo de curso, máximo 2 deportes sin cruces de horario, 4 recorridos, sin duplicados, notificaciones al padre (etapa 15, patrón Observer).
- **Tablas existentes relevantes para la Parte 3:** `cuotas` (con `id_alumno`, `anio`, `mes`, `estado`, `fecha_pago`, `metodo_pago`), `notificaciones`, `alumnos`, `usuarios`, inscripciones a deportes, transporte y comedor (etapa 14), `becas`. Revisar los scripts antes de crear tablas nuevas: **reutilizar antes que agregar**.
  - `cuotas.metodo_pago` acepta `'Efectivo'` en el check de etapa6, pero desde `etapa17` un trigger rechaza un método **nuevo** distinto de `Transferencia`; los pagos anteriores en efectivo se conservan.
- **Edge Functions:** `crear-usuario` y `enviar-notificacion` (Resend). Se despliegan a mano (`DEPLOY_MANUAL.md`, `deploy-edge-functions.sh`).
  - Secrets en Supabase: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAILS_HABILITADOS`, `EMAIL_ALLOWLIST`.
  - La **service role key** solo vive en los secrets de Supabase; nunca en el frontend ni en el repo.

---

## 6. Calidad y pruebas

| Herramienta | Cómo se usa | Detalle |
|---|---|---|
| ESLint | `cd frontend && npm run lint` | **0 errores**, 57 advertencias heredadas (deuda técnica: 5 reglas pasadas a `warn` en `eslint.config.js`). No agregar errores nuevos. |
| Husky + lint-staged | Automático en cada commit | Script `prepare`: `cd .. && husky frontend/.husky`. **Cada integrante corre `npm install` en `frontend/` una vez** para activarlo. |
| Vitest | `cd frontend && npm test` | Pruebas `*.test.ts` junto al código. Al agregar reglas de negocio nuevas en TS, separarlas en un archivo propio y probarlas. |
| Cypress | `cd e2e && npx cypress run` | Contra producción; **pruebas de solo lectura** (no crear datos). Credenciales en `e2e/credenciales.json` (local, ignorado). Usar `cy.task('credenciales', rol)`, no `Cypress.env()` (deprecado). |
| GitHub Actions | `.github/workflows/ci.yml` | Job **"Tests y build"** (check obligatorio). Si se agrega una app nueva, sumar su job sin romper el existente. |
| Codacy | Check en cada PR | `.codacy.yml` excluye `e2e/**`. |

---

## 7. Parte 3 – PWA (lo que hay que construir)

Fuente principal: **[`docs/plan-app-movil.md`](docs/plan-app-movil.md)**, el extracto en Markdown del plan de trabajo (RF10–RF15, RNF6–RNF10 y **HU41–HU66 con sus tareas y criterios de aceptación**, en la sección 16.3). **Antes de implementar una HU, leer su fila en ese archivo. Ante cualquier duda de alcance, mandan sus criterios de aceptación.** Esta sección es solo un resumen.

### 7.1. Arquitectura (decidida en el plan)
- La PWA es **un segundo cliente dentro del mismo proyecto React** (`frontend/`): **`vite-plugin-pwa`** (manifiesto + service worker), **mismo despliegue en Vercel**, misma CI, **misma base y mismos servicios de Supabase**. No se crean datos ni servicios paralelos.
- **Carpeta propia dentro de `frontend/`** con sus rutas y su manifiesto (propuesta: `frontend/src/app/` con rutas bajo **`/app`**).
- Usuarios de la app: **Padre y Alumno**. Los roles de gestión (Admin, Directivo, Docente) que entren a `/app` se **redirigen a la web** (`/admin`).
- Pantallas mobile-first desde **360 px** de ancho, instalable en Android e iOS (RNF6). Identidad visual: **#5B35C5**, fondo **#F7F6FC**, tipografía **Nunito**.
- Componentes nuevos: bucket **privado** de Storage para comprobantes y facturas, Edge Functions de **facturación** y **correo**, **pg_cron** para los disparos programados, **Supabase Realtime** para los cambios de estado de los pagos, PDF generado en Edge Functions.

### 7.2. Patrones de diseño (del plan; aplicarlos de verdad, se evalúan)
| Patrón | Cómo se aplica en el código |
|---|---|
| **Singleton** | Un único cliente de Supabase (`frontend/src/lib/supabase.ts`) que usan la web y la PWA. Ninguna pantalla llama a `createClient`. |
| **Facade** | Servicios por módulo en `frontend/src/servicios/`: **`ServicioAuth`** (ya existe), **`ServicioCuotas`**, **`ServicioPagos`**, **`ServicioFacturas`**. Ejemplo: `registrarPago()` sube el archivo a Storage, crea el comprobante y lo asocia a la factura y a los ítems. **Las pantallas nunca consultan tablas directo.** |
| **Observer** | El estado del comprobante es el sujeto. Al aprobar/rechazar, se enteran la pantalla de cuotas del padre (**Realtime**, sin recargar), el panel de validación y el proceso de correos. Ya existe un Observer con triggers en la etapa 15: seguir esa línea. |

### 7.3. Requerimientos e historias (HU41 a HU66)
| Épica | HU | Canal | Resp. | Contenido |
|---|---|---|---|---|
| RF10 Autenticación en la app | HU41–HU45 | App | Agostina | Login, logout (sin volver con "Atrás"), recuperar contraseña por correo (Supabase Auth), cambiar contraseña (mín. 8 caracteres), menú y rutas por rol. El aislamiento de datos en la base queda fuera de alcance (sección 3.1). |
| RF11 Valores y facturación | HU46–HU50 | Web + automático | Maximiliano | Valor de cuota (con **fecha de vigencia**, no afecta facturas ya emitidas), valor de cada deporte, de cada recorrido y del comedor (> 0; Admin y Directivo, que comparten la gestión). **HU50:** factura mensual automática por alumno. |
| RF12 Cuotas y pagos | HU51–HU56 | App + web | Agos (51–54) / Maxi (55–56) | Cuotas pendientes (vencidas destacadas), pagadas, historial de pagos; elegir ítems y **subir comprobante**; **aprobar/rechazar con motivo** en la web; **emitir comprobante de pago en PDF**. |
| RF13 Consultas por alumno | HU57–HU59 | App | Agostina | Facturas + comprobantes por período (desde ≤ hasta), historial de deuda por ítem y mes, inscripciones (solo lectura; el alumno ve solo las suyas). |
| RF14 Correos automáticos | HU60–HU61 | Automático | Maximiliano | Último día hábil (con feriados): total, composición y **factura PDF adjunta**. Día 20: deuda por ítem solo a quien no completó el pago. |
| RF15 Listados de pagos (web) | HU62–HU66 | Web | Maxi (62–64) / Agos (65–66) | Ingresos por período; pagos completos e incompletos por período, **por año del pago y por año de cursado**; pagos por deporte/nivel/horario/profesor (reusar HU38); pagos por recorrido (reusar HU39). |

**Reglas de negocio (plan 10.5 y consigna):**
- **Una factura por alumno y por mes**, se genera el **último día hábil** del mes **para el mes siguiente** y **vence el día 10**. Ítems: cuota + cada deporte activo + transporte (solo si está inscripto ese mes) + comedor.
- **Solo transferencia** (sin efectivo ni pasarela). Desde `etapa17` la base rechaza un pago nuevo que no sea transferencia.
- **Una factura admite varios comprobantes.** No se puede pagar un ítem ya pagado. Al subirlo queda **"En revisión"**.
- Archivos **JPG, PNG o PDF de hasta 5 MB**, con errores claros (RNF8).
- **Sin recargo por mora.**
- Comprobantes y facturas: solo los ve **el padre del alumno y el administrador** (RNF7). Se usa bucket privado; sin RLS, esto no queda garantizado en la base (sección 3.1). **El alumno no ve pagos.**
- Cada envío de correo se **registra con su resultado** y **no se repite** para el mismo padre y período (RNF9).

**Tablas nuevas previstas** (etapa16 en adelante; revisar antes `cuotas`, `notificaciones` y `becas` para **reutilizar** lo que sirva): valores (con vigencia), facturas, ítems de factura, comprobantes de pago, registro de envíos.

### 7.4. Orden de implementación sugerido (por el atraso)
Cada paso es un PR (o pocos). Priorizar que el flujo **"consultar cuota → pagar → cargar comprobante → aprobar"** funcione de punta a punta para el testing.
1. ✅ **Base:** Singleton del cliente de Supabase + `vite-plugin-pwa` + layout móvil y rutas `/app` (PR #15 y #18).
2. **HU41–HU45:** ✅ HU41, HU42 y parte de HU45 (PR #19); ✅ HU43 y HU44 (PR #24). HU45 no queda completa (sección 3.1).
3. **etapa16 en adelante (SQL), en scripts separados por bloque:** ✅ valores (`etapa16`); facturas, ítems y corrección de `'Efectivo'` (`etapa17`, HU50 etapa A); faltan comprobantes, envíos y bucket privado.
4. ✅ **HU46–HU49:** valores en `gestion/GestionValores.tsx`, para Admin y Directivo (PR #27).
5. **HU50:** facturación, **parcial**. Etapa A: `fn_generar_facturas` (invocable a mano o desde la sección Facturación), único generador de cuotas y facturas; la cuota del período es el ítem Cuota de su factura; el saldo se lee de `v_facturas_saldo` y `v_factura_items_saldo` (contrato para HU51 a HU56). Etapa B, pendiente: último día hábil con feriados, pg_cron y PDF bajo demanda reutilizable por HU60.
6. **HU51–HU53 y HU59:** consultas del padre/alumno en la app.
7. **HU54 → HU55 → HU56:** carga de comprobante, aprobación en la web (con Realtime) y comprobante PDF.
8. **HU57 y HU58:** facturas por período y deuda por ítem.
9. **HU60 y HU61:** correos programados, reutilizando `enviar-notificacion` / Resend. Probar con **fechas simuladas** (parámetro de fecha) y `EMAIL_ALLOWLIST`.
10. **HU62–HU66:** listados de pagos en la web.

### 7.5. Informe de uso de IA (17/11)
Cinco apartados: (1) relación entre web y app; (2) bitácora de IA; (3) IA vs. conocimiento del sistema; (4) tabla "Sin IA / Con IA" (generación de código, tiempo, comprensión, detección de errores, documentación, aprendizaje, integración, seguridad, mantenimiento, calidad); (5) reflexión crítica con 10 preguntas.

---

## 8. Bitácora de IA (obligatoria, evaluada el 17/11)

El plan define la bitácora como una **planilla compartida en Google Drive** que se actualiza en cada revisión de sprint. Como Claude Code no escribe en Drive, el registro de trabajo vive en **`docs/bitacora-ia.md`** (crearlo si no existe) y el equipo lo pasa a la planilla. **Después de cada tarea en la que intervenga la IA, agregar una fila.** No reconstruirla al final.

| Nº | Fecha | Problema | Prompt utilizado (resumen) | Herramienta de IA | Respuesta de IA (resumen) | ¿Funcionó? (Sí / Parcialmente / No) | Modificaciones realizadas por el equipo | Resultado (Correcto / Reemplazado / …) |
|---|---|---|---|---|---|---|---|---|

- **Herramientas:** Claude Code (desktop), Claude (chat), Copilot Code Review.
- Registrar con honestidad lo que **no funcionó** y lo que **el equipo tuvo que corregir**: la consigna evalúa cómo se usó la IA, no solo el resultado.
- La consigna exige que el equipo **entienda y pueda justificar** todo el código generado: explicar los cambios importantes antes de aplicarlos.

---

## 9. Seguridad y archivos que no se suben

- **Nunca** commitear `frontend/.env`, `e2e/credenciales.json`, claves ni contraseñas. La `anon key` de Supabase es pública por diseño; la **service role key**, no.
- Las variables del frontend están en Vercel (Settings → Environment Variables, marcadas como *Sensitive*: no se pueden ver ni copiar después de guardadas). Los valores originales están en Supabase → Project Settings → API.
- No crear datos de prueba en producción desde pruebas automáticas. Para datos de demo, usar registros claramente marcados (por ejemplo "Prueba Unidad Cuatro", DNI 40111222).

---

## 10. Problemas conocidos y soluciones (Windows / PowerShell)

- **Terminal:** usar PowerShell. En Git Bash, `tar` no abre `.zip` (usar `unzip -o`).
- **Recuperar `frontend/.env`** (el PR #5 lo borró de las copias locales al hacer pull):
  `git restore --source=a930733 -- frontend/.env` (no usar `git show … > archivo` en PowerShell: cambia la codificación).
- **Aviso LF/CRLF:** es normal en Windows; no afecta.
- **npm:** si `npm i` falla con `edgesOut` (bug de npm 10), usar `npx npm@11 i …`.
- **Plantilla de PR:** GitHub la toma de `main`; en un PR que la modifica no se carga sola.
- **Protección de main:** un check nuevo solo puede marcarse como obligatorio después de que corrió una vez.
- **Codacy** marca "main branch is not protected" aunque lo está (configuración de la app de Codacy); la evidencia real es la regla de GitHub.
- **Cypress** descarga unos 500 MB en el primer `npm install`; hacerlo con buena conexión.

---

## 11. Deuda técnica registrada

- 57 advertencias de ESLint (React Hooks, `any`, variables sin uso): corregir de a poco.
- `AdminPanel.tsx` de más de 12.000 líneas: dividirlo en módulos cuando se toque.
- Control de acceso solo en el frontend: limitación aceptada para esta demo (sección 3.1).
- Edge Functions y migraciones se despliegan a mano.
- Accesibilidad 56 y SEO 75 en PageSpeed; bundle de JS de 776 kB (lazy loading pendiente).
- 25 vulnerabilidades informadas por `npm audit` al 05/11/2026 (4 bajas, 13 moderadas y 8 altas), pendientes de revisión en la Issue #21. No correr `audit fix` sin probar.
- `supabase/functions/crear-usuario/index.ts` está casi entero comentado en el repo (55 de 65 líneas), así que no coincide con una función que esté funcionando. **No redesplegarla desde ese archivo:** `DEPLOY_MANUAL.md` indica copiarlo tal cual y eso podría romper el alta de usuarios. Antes hay que comparar el repo con lo desplegado.
- El alta de alumnos usa el DNI como contraseña (`AdminPanel.tsx`), que puede tener 7 dígitos. Subir a 8 la longitud mínima global de Supabase Auth podría romper esas altas: revisarlo antes de cambiar ese ajuste.

---

## 12. Documentación de referencia

En el Proyecto de Claude ("Educar Para Transformar App Movil"):
- `TP-Metodologia-3.pdf`: enunciado del TPI (Parte 3 = PWA).
- `Plan_de_Trabajo_Proyecto_Met2_Grupo13_Amos_Web_y_Movil.docx`: plan completo (en el repo está el extracto de la parte móvil: `docs/plan-app-movil.md`). Secciones 1–9 = web (HU1–HU40); **secciones 10–17 = PWA** (RF10–RF15, HU41–HU66 con criterios de aceptación, sprints M0–M5, patrones).
- `Informe de avance - Sistema de gestion web - Grupo 13.docx`: decisiones de la parte web.
- `Unidad_4_Parte_2_Grupo_13_Amos.docx`, `TP_Unidad_5_Stabile.docx`: CI/CD, calidad y pruebas.

En el repo: **`docs/plan-app-movil.md`** (plan de la PWA y criterios de aceptación), `docs/bitacora-ia.md`, `README.md`, `supabase/sql/README.md`, `DEPLOY_MANUAL.md` y la **Wiki** (página Home).

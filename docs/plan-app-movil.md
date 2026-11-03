# Plan de trabajo – Parte Aplicación Móvil (PWA)

> Extracto de `Plan_de_Trabajo_Proyecto_Met2_Grupo13_Amos_Web_y_Movil.docx` (secciones 10, 12, 16 y 17), convertido a Markdown para que Claude Code lo pueda leer. Se omitieron los objetivos SMART, las horas por etapa, el Gantt, el PERT y las figuras.
> **Fuente de verdad:** el documento original. Si se modifica el plan, actualizar también este archivo.
> Grupo 13 – Am.os · Jara, Agostina · Stabile, Maximiliano · Metodología de Sistemas II – TUP 2026

*Esta parte se agrega al plan de la parte web (secciones 1 a 9). Se mantienen sin cambios, y rigen para la app: los requerimientos no funcionales RNF1 a RNF5, las columnas del tablero Kanban y la Definition of Done (con el agregado indicado en 10.5) y la organización semanal de los sprints.*

**RNF de la web que siguen vigentes:** RNF1 Seguridad (sesión autenticada y HTTPS) · RNF2 Rendimiento (consultas en ≤ 3 s) · RNF3 Usabilidad (obligatorios y errores claros) · RNF4 Compatibilidad (computadora y móvil) · RNF5 Organizativo (React, TypeScript, Supabase, PostgreSQL y el mismo repo).

## 10. DESCRIPCIÓN DEL PROYECTO – APLICACIÓN MÓVIL
### 10.1. Enunciado del problema
La Dirección necesita ampliar el sistema de gestión con una aplicación móvil que centralice la gestión de cuotas, comedor, deportes y transporte. El sistema web ya registra las inscripciones a esos servicios, pero su módulo de pagos es muy simple: no calcula lo que debe abonar cada familia, no emite facturas ni comprobantes y no permite hacer el seguimiento de la deuda.

Como los pagos se realizan solo por transferencia bancaria, los padres necesitan consultar desde el celular qué deben pagar, cargar el comprobante de la transferencia y conocer el estado de la deuda de cada hijo. La administración, a su vez, necesita validar esos pagos, enviar avisos automáticos por correo y obtener listados de ingresos y pagos.

La aplicación se desarrollará como una Progressive Web App (PWA) dentro del mismo repositorio, con la misma base de datos y los mismos servicios de Supabase de la web, de modo que no se duplique información. Según la consigna, el equipo utilizará Inteligencia Artificial (Claude) como herramienta de apoyo y registrará su uso en una bitácora.

### 10.2. Requerimientos
#### Requerimientos funcionales
Los requerimientos surgen de la Parte 3 del enunciado y continúan la numeración de la web (RF10 en adelante). Cada requerimiento principal funciona como épica y agrupa **subrequerimientos** verificables. La columna Canal indica dónde se usa cada función.

| **ID** | **Subrequerimiento** | **Canal** | **Prioridad** |
| --- | --- | --- | --- |
| **RF10. Autenticación en la aplicación móvil (Módulo 1)** | | | |
| **RF10.1** | El sistema debe permitir que un padre o un alumno activo inicie sesión en la aplicación móvil con sus credenciales. | App | Mandatoria |
| **RF10.2** | El sistema debe permitir que el usuario cierre su sesión en la aplicación móvil. | App | Mandatoria |
| **RF10.3** | El sistema debe permitir que el usuario recupere su contraseña mediante un enlace enviado a su correo electrónico. | App | Mandatoria |
| **RF10.4** | El sistema debe permitir que el usuario con sesión iniciada cambie su contraseña. | App | Mandatoria |
| **RF10.5** | El sistema debe permitir que cada usuario acceda en la aplicación únicamente a las funciones de su rol (padre o alumno). | App | Mandatoria |
| **RF11. Valores y facturación** | | | |
| **RF11.1** | El sistema debe permitir al administrador establecer el valor de la cuota mensual. | Web | Mandatoria |
| **RF11.2** | El sistema debe permitir al administrador establecer el valor mensual de cada deporte. | Web | Mandatoria |
| **RF11.3** | El sistema debe permitir al administrador establecer el valor mensual de cada recorrido de transporte. | Web | Mandatoria |
| **RF11.4** | El sistema debe permitir al administrador establecer el valor mensual del servicio de comedor. | Web | Mandatoria |
| **RF11.5** | El sistema debe generar automáticamente una factura mensual por alumno con el detalle de la cuota, los deportes, el transporte y el comedor que tenga activos. | Automático | Mandatoria |
| **RF12. Gestión de cuotas y pagos (Módulo 2)** | | | |
| **RF12.1** | El sistema debe permitir al padre consultar las cuotas pendientes de cada hijo con su importe, vencimiento y estado. | App | Mandatoria |
| **RF12.2** | El sistema debe permitir al padre consultar las cuotas pagadas de cada hijo. | App | Mandatoria |
| **RF12.3** | El sistema debe permitir al padre consultar el historial de pagos de cada hijo. | App | Mandatoria |
| **RF12.4** | El sistema debe permitir al padre seleccionar los ítems de una factura a pagar y cargar el comprobante de la transferencia asociado a esa factura. | App | Mandatoria |
| **RF12.5** | El sistema debe permitir al administrador aprobar o rechazar cada comprobante de pago cargado. | Web | Mandatoria |
| **RF12.6** | El sistema debe emitir un comprobante de pago cuando el administrador aprueba un pago. | Automático | Mandatoria |
| **RF13. Consultas por alumno en la aplicación** | | | |
| **RF13.1** | El sistema debe permitir al padre listar las facturas de cada hijo y sus comprobantes asociados en un período de fechas. | App | Mandatoria |
| **RF13.2** | El sistema debe permitir al padre consultar el historial de deuda de cada hijo discriminado por ítem de pago. | App | Mandatoria |
| **RF13.3** | El sistema debe permitir al padre consultar las inscripciones de cada hijo a deportes, transporte y comedor, y al alumno consultar las propias. | App | Mandatoria |
| **RF14. Avisos automáticos por correo** | | | |
| **RF14.1** | El sistema debe enviar a cada padre, el último día hábil de cada mes, un correo con el total a abonar, su composición y la factura adjunta. | Automático | Mandatoria |
| **RF14.2** | El sistema debe enviar a cada padre, el día 20 de cada mes, un correo con la deuda pendiente cuando no haya completado el pago. | Automático | Mandatoria |
| **RF15. Listados de pagos en la web** | | | |
| **RF15.1** | El sistema debe permitir al administrador generar el listado de ingresos por período de tiempo. | Web | Mandatoria |
| **RF15.2** | El sistema debe permitir al administrador generar el listado de pagos completos por período, discriminado por año del pago y por año de cursado del alumno. | Web | Mandatoria |
| **RF15.3** | El sistema debe permitir al administrador generar el listado de pagos incompletos por período, discriminado por año del pago y por año de cursado del alumno. | Web | Mandatoria |
| **RF15.4** | El sistema debe permitir al administrador generar el listado de pagos de alumnos por deporte, nivel, horario y profesor a cargo. | Web | Mandatoria |
| **RF15.5** | El sistema debe permitir al administrador generar el listado de pagos de alumnos por recorrido del servicio de transporte. | Web | Mandatoria |

#### Requerimientos no funcionales nuevos
Se mantienen RNF1 a RNF5 de la parte web y se agregan los siguientes:

| **ID** | **Tipo** | **Especificación** |
| --- | --- | --- |
| **RNF6** | Compatibilidad | La aplicación debe poder instalarse como PWA desde el navegador en Android e iOS y adaptarse a pantallas desde 360 px de ancho. |
| **RNF7** | Seguridad | Los comprobantes y las facturas solo pueden ser vistos por el padre del alumno y por el administrador (Storage privado y políticas RLS). |
| **RNF8** | Usabilidad | La carga de comprobantes admite archivos JPG, PNG o PDF de hasta 5 MB e informa con claridad los errores. |
| **RNF9** | Confiabilidad | Cada envío automático de correo queda registrado con su resultado y no se repite para el mismo padre y período. |
| **RNF10** | Organizativo | El uso de IA se registra en la bitácora de IA con el formato definido por la cátedra. |

### 10.3. Clasificación del tipo de sistema de información
Se mantiene la clasificación de la parte web: un Sistema de Procesamiento de Transacciones (TPS) con características de Sistema de Información Gerencial (MIS). La aplicación móvil agrega nuevas transacciones (facturación mensual, carga y aprobación de comprobantes y emisión de comprobantes de pago) y nuevos listados de ingresos y pagos para la Dirección (RF15), que refuerzan el componente gerencial.

### 10.4. Arquitectura de la información
La PWA es un nuevo canal de acceso para padres y alumnos. Comparte el control de acceso por rol y la fuente única de datos con el sistema web, que se amplía con las funciones del administrador (valores, validación de pagos y listados). Los procesos automáticos de facturación y correo se ejecutan en el servidor, sin intervención del usuario.

### 10.5. Arquitectura de la aplicación de software
Se mantiene la arquitectura cliente-servidor en capas (SPA + BaaS) de la parte web. La PWA es un nuevo cliente de la capa de presentación, construido dentro del mismo proyecto React: comparte el cliente de Supabase, las fachadas de servicios y los tipos, y agrega un manifiesto y un service worker para poder instalarse en el celular. En la tabla se indican solo los cambios.

| **Elemento** | **Cambio respecto de la parte web** |
| --- | --- |
| **Tipo de arquitectura** | Se mantiene: cliente-servidor en capas (SPA + BaaS), ahora con dos clientes (web de gestión y PWA) sobre el mismo backend. |
| **Aplicación de los principios** | Se refuerza la reutilización: la app usa las mismas fachadas y la misma base; no se crean servicios ni datos paralelos. |
| **Componentes** | Se agregan la PWA (manifiesto y service worker), el bucket privado de comprobantes en Storage, las Edge Functions de facturación y correo, y el programador de tareas pg_cron. |
| **Componentes funcionales** | Se agregan Autenticación móvil, Valores, Facturación, Pagos y comprobantes, Consultas por alumno, Avisos por correo y Listados de pagos. |
| **Conectores** | Se agregan pg_cron → Edge Functions (disparo programado), Edge Functions → servicio de correo por API HTTPS, Supabase Storage para comprobantes y facturas en PDF, y Supabase Realtime para los cambios de estado de los pagos. |
| **Restricciones** | Pagos solo por transferencia (sin efectivo ni pasarela de pago); una factura por alumno y por mes que vence el día 10; una factura admite varios comprobantes; sin recargo por mora; el padre solo ve a sus hijos y el alumno no ve pagos. |
| **Tecnologías** | Se agregan vite-plugin-pwa, pg_cron, generación de PDF en Edge Functions, un servicio de correo transaccional (por ejemplo, Resend) y Claude como asistente de IA. |

#### Gestión del proyecto
Se utiliza el mismo tablero Kanban (GitHub Projects), con las mismas columnas. Los cambios son los siguientes:

- **Épicas e historias: **se cargan las épicas RF10 a RF15 y las historias HU41 a HU66, que continúan la numeración de la web.

- **Sprints: **los sprints de la app se identifican como M0 a M5 para distinguirlos de los sprints web que corren en paralelo hasta el 23/10.

- **Definition of Done: **se agrega que toda solución generada con IA debe quedar registrada en la bitácora de IA y ser revisada por el otro integrante antes de integrarse.

- **Bitácora de IA: **planilla compartida en Google Drive con las columnas de la consigna (N.º, problema, prompt, herramienta, respuesta, ¿funcionó?, modificaciones y resultado), que se actualiza en cada revisión de sprint.

#### Backend, frontend y gestor de base de datos
| **Capa** | **Tecnología** | **Cambio en la aplicación móvil** |
| --- | --- | --- |
| **Frontend (PWA)** | React 18 + TypeScript (Vite) con vite-plugin-pwa, en el mismo proyecto y despliegue de Vercel. | Pantallas móviles del padre y del alumno, instalación en el celular y reutilización de componentes y servicios de la web. |
| **Backend / lógica** | Supabase Auth, Row Level Security, Edge Functions y pg_cron. | Recuperación y cambio de contraseña, facturación mensual, comprobantes de pago, correos programados y permisos sobre pagos. |
| **Gestor de base de datos** | PostgreSQL (Supabase) y Supabase Storage. | Nuevas tablas de valores, facturas, ítems de factura, comprobantes de pago y registro de envíos; bucket privado para archivos. |

#### Maquetación
| **Instancia** | **Herramienta** | **Alcance previsto** |
| --- | --- | --- |
| **Wireframe** | Figma (baja fidelidad, formato celular) | Inicio de sesión, selección de hijo, cuotas, pago con carga de comprobante, facturas por período, historial de deuda e inscripciones. |
| **Mockup** | Figma (alta fidelidad) | Misma identidad visual de la web (#5B35C5, #F7F6FC y Nunito) adaptada a pantallas de 360 px. |
| **Prototipo** | Figma navegable y PWA instalable en Vercel | Recorrido del flujo «consultar cuota → pagar → cargar comprobante» y demo en cada revisión de sprint. |

#### Repositorio de software
- Se usa el mismo repositorio: https://github.com/maxistabile/EducarParaTransformarAm.os

- La PWA se incorpora en una carpeta propia dentro de frontend/, con sus rutas y su manifiesto.

- Las migraciones continúan la numeración de supabase/sql/ y las nuevas Edge Functions se guardan en supabase/functions/.

- Se mantienen los commits convencionales, las ramas por funcionalidad y los Pull Request con revisión cruzada; el nombre de la rama incluye el ID de la historia (por ejemplo, feat/HU54-comprobante).

#### Patrones de diseño
Se mantienen los tres patrones elegidos para la web. La tabla explica cómo se aplican en la aplicación móvil.

| **Tipo** | **Patrón** | **Aplicación en la aplicación móvil** | **Req. relacionados** |
| --- | --- | --- | --- |
| **Creacional** | Singleton | La PWA reutiliza la misma instancia única del cliente de Supabase que la web. Es el único punto de acceso a la sesión, al rol activo y a la conexión, y evita sesiones duplicadas entre la app instalada y el navegador. | RF10 y transversal |
| **Estructural** | Facade | Se agregan las fachadas ServicioCuotas, ServicioPagos y ServicioFacturas. Por ejemplo, registrarPago() oculta la subida del archivo a Storage, el alta del comprobante y su asociación con la factura y los ítems elegidos. Las pantallas nunca consultan tablas directamente. | RF12, RF13 y RF15 |
| **Comportamiento** | Observer | El estado de un comprobante es el sujeto. Cuando el administrador lo aprueba o rechaza, se notifica a los observadores suscriptos: la pantalla de cuotas del padre (Supabase Realtime), el panel de validación y el proceso de avisos por correo. El padre ve el cambio sin recargar la app. | RF12.5, RF12.6 y RF14 |

## 12. CRONOGRAMA DE ACTIVIDADES – PARTE APLICACIÓN MÓVIL
El cronograma convive con los sprints web 4 a 7 hasta el 23/10, con unas 9 horas semanales por integrante para la app (además de las 10 de la web). Después del 27/10 la dedicación sube a unas 12 horas semanales por integrante. Total estimado: 148 horas del equipo.

| **Fecha** | **Instancia** | **Alcance comprometido por el equipo** |
| --- | --- | --- |
| **29/09/2026** | Entrega del plan y 2.ª Tutoría | Presentación de este plan de trabajo (hasta las 14:00 h). |
| **29/09 – 02/10** | Sprint M0 | Planificación, requerimientos, modelado de los datos de facturación y pagos, y diseño de las pantallas móviles. |
| **05/10 – 23/10** | Sprints M1 a M3 (en paralelo con los sprints web 5 a 7) | PWA instalable y autenticación, valores, factura mensual, consulta de cuotas, carga de comprobantes, inscripciones y correo de fin de mes (HU41 a HU54, HU59 y HU60). |
| **26/10 – 27/10** | Pruebas web y 2.ª Instancia de Evaluación | Sin tareas de la app: el equipo se dedica a las pruebas y a la defensa de la web completa. |
| **28/10 – 06/11** | Sprints M4 y M5 | Validación de pagos, comprobante de pago, facturas por período, historial de deuda, aviso del día 20 y listados de pagos en la web (HU55 a HU58 y HU61 a HU66). |
| **03/11/2026** | 3.ª Tutoría | Revisión del avance de la app y de su integración con la web. |
| **09/11/2026** | Cierre | Integración, pruebas integrales y despliegue final de la PWA. |
| **10/11/2026** | Testing – Coevaluación | Aplicación terminada y probada en la actividad de testing. |
| **11/11 – 16/11** | Cierre | Corrección de los defectos del testing y elaboración del Informe de uso de IA. |
| **17/11/2026** | 3.ª Instancia de Evaluación | Entrega y exposición del TFI: web, aplicación móvil, Informe de uso de IA y bitácora. |

*Testing: la consigna indica el 11/11 y el cronograma de la cátedra el 10/11; se planifica con el 10/11. Recuperatorios: 24/11 y 01/12/2026.*

## 16. BACKLOG DEL SPRINT – APLICACIÓN MÓVIL
### 16.1. Historia de usuario épica
Como padre de un alumno del centro educativo, quiero gestionar desde el celular las cuotas, los pagos y los servicios de mis hijos, para cumplir con los pagos a tiempo y tener la información siempre actualizada.

Cada requerimiento funcional principal (RF10 a RF15) se comporta como una épica y se descompone en historias de usuario atómicas: se definió una historia por cada subrequerimiento, lo que da un total de 26 historias (HU41 a HU66). La numeración continúa la de la web para que las historias no se superpongan en el tablero.

### 16.2. Product Backlog priorizado
| **Épica** | **Historias de usuario** | **Cant.** | **Puntos** |
| --- | --- | --- | --- |
| **RF10. Autenticación en la app** | HU41 a HU45 | 5 | 9 |
| **RF11. Valores y facturación** | HU46 a HU50 | 5 | 9 |
| **RF12. Gestión de cuotas y pagos** | HU51 a HU56 | 6 | 17 |
| **RF13. Consultas por alumno** | HU57 a HU59 | 3 | 8 |
| **RF14. Avisos automáticos por correo** | HU60 y HU61 | 2 | 8 |
| **RF15. Listados de pagos en la web** | HU62 a HU66 | 5 | 12 |
| **TOTAL** | HU41 a HU66 | 26 | 63 |

| **ID** | **Req.** | **Historia de usuario** | **Prior.** | **Pts.** | **Responsable** | **Sprint** |
| --- | --- | --- | --- | --- | --- | --- |
| **HU41** | RF10.1 | Iniciar sesión en la aplicación móvil | Alta | 2 | Agostina | M1 |
| **HU42** | RF10.2 | Cerrar sesión en la aplicación | Alta | 1 | Agostina | M1 |
| **HU43** | RF10.3 | Recuperar la contraseña por correo | Media | 2 | Agostina | M1 |
| **HU44** | RF10.4 | Cambiar la contraseña | Media | 1 | Agostina | M1 |
| **HU45** | RF10.5 | Acceder solo a las funciones del rol en la app | Alta | 3 | Agostina | M1 |
| **HU46** | RF11.1 | Establecer el valor de la cuota mensual | Alta | 1 | Maximiliano | M1 |
| **HU47** | RF11.2 | Establecer el valor de cada deporte | Alta | 1 | Maximiliano | M1 |
| **HU48** | RF11.3 | Establecer el valor de cada recorrido | Alta | 1 | Maximiliano | M1 |
| **HU49** | RF11.4 | Establecer el valor del comedor | Alta | 1 | Maximiliano | M1 |
| **HU50** | RF11.5 | Generar la factura mensual de cada alumno | Alta | 5 | Maximiliano | M2 |
| **HU51** | RF12.1 | Consultar las cuotas pendientes | Alta | 2 | Agostina | M2 |
| **HU52** | RF12.2 | Consultar las cuotas pagadas | Alta | 2 | Agostina | M2 |
| **HU53** | RF12.3 | Consultar el historial de pagos | Alta | 2 | Agostina | M2 |
| **HU54** | RF12.4 | Seleccionar ítems y cargar el comprobante de pago | Alta | 5 | Agostina | M3 |
| **HU55** | RF12.5 | Aprobar o rechazar un comprobante de pago | Alta | 3 | Maximiliano | M4 |
| **HU56** | RF12.6 | Emitir el comprobante de pago | Alta | 3 | Maximiliano | M4 |
| **HU57** | RF13.1 | Listar facturas y comprobantes por período | Media | 3 | Agostina | M4 |
| **HU58** | RF13.2 | Consultar el historial de deuda por ítem | Media | 3 | Agostina | M5 |
| **HU59** | RF13.3 | Consultar las inscripciones a deportes, transporte y comedor | Media | 2 | Agostina | M3 |
| **HU60** | RF14.1 | Enviar el recordatorio mensual con la factura | Alta | 5 | Maximiliano | M3 |
| **HU61** | RF14.2 | Enviar el aviso de deuda del día 20 | Alta | 3 | Maximiliano | M5 |
| **HU62** | RF15.1 | Generar el listado de ingresos por período | Media | 2 | Maximiliano | M5 |
| **HU63** | RF15.2 | Generar el listado de pagos completos | Media | 3 | Maximiliano | M5 |
| **HU64** | RF15.3 | Generar el listado de pagos incompletos | Media | 2 | Maximiliano | M5 |
| **HU65** | RF15.4 | Generar el listado de pagos por deporte, nivel, horario y profesor | Media | 3 | Agostina | M5 |
| **HU66** | RF15.5 | Generar el listado de pagos por recorrido de transporte | Media | 2 | Agostina | M5 |

**Total estimado: 63 puntos de historia en cinco sprints de desarrollo (Agostina Jara 33 pts · Maximiliano Stabile 30 pts), más un sprint de planificación (M0) y una etapa de cierre con testing y correcciones.**

### 16.3. Backlog de cada sprint
Se presenta un backlog por sprint, con una fila por cada historia de usuario, sus tareas técnicas y sus criterios de aceptación.

#### Sprint M1 (05/10 – 09/10) · Autenticación móvil y valores · 9 historias · 13 puntos
| **ID** | **Historia de usuario** | **Prior.** | **Estado** | **Tareas** | **Criterios de aceptación** |
| --- | --- | --- | --- | --- | --- |
| **HU41** | **Iniciar sesión en la aplicación móvil** Como padre o alumno quiero iniciar sesión en la aplicación con mis credenciales para acceder a mi información de forma segura desde el celular. | Alta | To Do | 1. Crear la pantalla de inicio de sesión móvil. 2. Reutilizar el cliente único de Supabase Auth. 3. Mantener la sesión en la PWA instalada. | • Un padre o alumno activo ingresa con credenciales correctas. • Las credenciales incorrectas muestran un mensaje de error. • Un usuario inactivo no puede ingresar. |
| **HU42** | **Cerrar sesión en la aplicación** Como usuario de la app quiero cerrar mi sesión para evitar que otra persona acceda a mis datos desde el celular. | Alta | To Do | 1. Agregar la opción Cerrar sesión en el menú. 2. Eliminar la sesión guardada en el dispositivo. | • Al cerrar sesión la app vuelve a la pantalla de ingreso. • Sin sesión no se puede volver a una pantalla privada con el botón Atrás. |
| **HU43** | **Recuperar la contraseña por correo** Como usuario de la app quiero recuperar mi contraseña mediante un enlace a mi correo para volver a ingresar si la olvido. | Media | To Do | 1. Crear la pantalla «Olvidé mi contraseña». 2. Configurar el correo de recuperación de Supabase Auth. 3. Crear la pantalla para definir la nueva contraseña. | • El enlace llega al correo registrado del usuario. • El enlace permite definir una nueva contraseña una sola vez. • Un correo no registrado recibe un mensaje genérico. |
| **HU44** | **Cambiar la contraseña** Como usuario con sesión iniciada quiero cambiar mi contraseña para mantener segura mi cuenta. | Media | To Do | 1. Crear la pantalla Mi cuenta. 2. Validar la contraseña actual y la nueva. | • La nueva contraseña tiene al menos 8 caracteres. • El usuario ingresa con la nueva contraseña. |
| **HU45** | **Acceder solo a las funciones del rol en la app** Como usuario de la app quiero ver únicamente las funciones de mi rol para usar solo la información que me corresponde. | Alta | To Do | 1. Definir el menú del padre y el del alumno. 2. Proteger las rutas móviles por rol. 3. Crear las políticas RLS de facturas y pagos. 4. Redirigir a la web a los roles de gestión. | • El padre ve cuotas, pagos, facturas e inscripciones de sus hijos. • El alumno ve solo sus inscripciones. • Un padre no accede a datos de alumnos que no son sus hijos. |
| **HU46** | **Establecer el valor de la cuota mensual** Como administrador quiero establecer el valor de la cuota mensual para que las facturas se calculen con el importe vigente. | Alta | To Do | 1. Crear la tabla de valores con fecha de vigencia. 2. Diseñar el formulario en la web. | • El valor debe ser mayor que cero. • El nuevo valor se aplica a las facturas siguientes, no a las ya emitidas. |
| **HU47** | **Establecer el valor de cada deporte** Como administrador quiero establecer el valor mensual de cada deporte para cobrar cada actividad según su costo. | Alta | To Do | 1. Agregar el valor al deporte. 2. Habilitar su edición en la web. | • Cada deporte tiene su propio valor. • Solo el administrador puede modificarlo. |
| **HU48** | **Establecer el valor de cada recorrido** Como administrador quiero establecer el valor mensual de cada recorrido para cobrar el transporte según el recorrido. | Alta | To Do | 1. Agregar el valor al recorrido. 2. Habilitar su edición en la web. | • Cada uno de los cuatro recorridos tiene su propio valor. • Solo el administrador puede modificarlo. |
| **HU49** | **Establecer el valor del comedor** Como administrador quiero establecer el valor mensual del comedor para incluirlo en la factura de los alumnos inscriptos. | Alta | To Do | 1. Registrar el valor del servicio. 2. Habilitar su edición en la web. | • El valor debe ser mayor que cero. • Solo el administrador puede modificarlo. |

#### Sprint M2 (13/10 – 16/10) · Facturación mensual y consulta de cuotas · 4 historias · 11 puntos
| **ID** | **Historia de usuario** | **Prior.** | **Estado** | **Tareas** | **Criterios de aceptación** |
| --- | --- | --- | --- | --- | --- |
| **HU50** | **Generar la factura mensual de cada alumno** Como administrador quiero que el sistema genere la factura mensual de cada alumno para cobrar los servicios sin cargarlos a mano. | Alta | To Do | 1. Crear las tablas de facturas e ítems. 2. Programar la Edge Function de facturación con pg_cron. 3. Tomar las inscripciones activas de deportes, transporte y comedor. 4. Generar el PDF de la factura en Storage. | • Se emite una sola factura por alumno y por mes. • Se genera el último día hábil del mes para el mes siguiente y vence el día 10. • Cada ítem muestra su concepto e importe; el transporte solo figura si el alumno está inscripto ese mes. |
| **HU51** | **Consultar las cuotas pendientes** Como padre quiero consultar las cuotas pendientes de cada hijo para saber cuánto debo y cuándo vence. | Alta | To Do | 1. Crear la pantalla de selección de hijo. 2. Crear el método en ServicioCuotas. 3. Diseñar la lista con importe, vencimiento y estado. | • Se muestran importe, vencimiento y estado de cada cuota impaga. • Las cuotas vencidas se destacan. • Solo se ven los hijos asociados al padre. |
| **HU52** | **Consultar las cuotas pagadas** Como padre quiero consultar las cuotas pagadas de cada hijo para confirmar qué pagos fueron acreditados. | Alta | To Do | 1. Agregar el filtro Pagadas a la pantalla de cuotas. 2. Mostrar la fecha de pago y el comprobante emitido. | • Solo aparecen cuotas con pago aprobado. • Cada cuota muestra la fecha de aprobación. |
| **HU53** | **Consultar el historial de pagos** Como padre quiero consultar el historial de pagos de cada hijo para tener un registro de todo lo abonado. | Alta | To Do | 1. Crear la consulta de pagos por alumno. 2. Diseñar la lista ordenada por fecha. | • Muestra fecha, importe, factura asociada y estado del pago. • Incluye pagos en revisión, aprobados y rechazados. |

#### Sprint M3 (19/10 – 23/10) · Comprobantes, inscripciones y correo de fin de mes · 3 historias · 12 puntos
| **ID** | **Historia de usuario** | **Prior.** | **Estado** | **Tareas** | **Criterios de aceptación** |
| --- | --- | --- | --- | --- | --- |
| **HU54** | **Seleccionar ítems y cargar el comprobante de pago** Como padre quiero seleccionar los ítems que pago y cargar el comprobante de la transferencia para informar mi pago al centro educativo. | Alta | To Do | 1. Crear la pantalla de pago con los ítems de la factura. 2. Subir el archivo al bucket privado de Storage. 3. Registrar el comprobante con ServicioPagos. | • Una factura admite más de un comprobante. • Se aceptan JPG, PNG o PDF de hasta 5 MB. • El pago queda «En revisión» y no se puede pagar un ítem ya pagado. |
| **HU59** | **Consultar las inscripciones a deportes, transporte y comedor** Como padre quiero consultar las inscripciones de cada hijo a deportes, transporte y comedor para saber qué servicios se le facturan. | Media | To Do | 1. Reutilizar las consultas de inscripciones de la web. 2. Diseñar la vista móvil del padre y del alumno. | • Muestra los deportes con horario, el recorrido y el comedor activos. • El alumno ve solo sus propias inscripciones. • La información es de solo lectura. |
| **HU60** | **Enviar el recordatorio mensual con la factura** Como padre quiero recibir el último día hábil del mes un correo con el total a pagar y la factura adjunta para organizar el pago antes del vencimiento. | Alta | To Do | 1. Integrar el servicio de correo con una Edge Function. 2. Calcular el último día hábil considerando feriados. 3. Programar el envío con pg_cron. 4. Registrar cada envío. | • El correo detalla la composición del total por alumno. • Adjunta la factura en PDF. • No se envía dos veces el mismo recordatorio. |

#### Sprint M4 (28/10 – 30/10) · Validación de pagos y facturas por período · 3 historias · 9 puntos
| **ID** | **Historia de usuario** | **Prior.** | **Estado** | **Tareas** | **Criterios de aceptación** |
| --- | --- | --- | --- | --- | --- |
| **HU55** | **Aprobar o rechazar un comprobante de pago** Como administrador quiero aprobar o rechazar cada comprobante cargado para registrar solo los pagos acreditados. | Alta | To Do | 1. Crear la bandeja de comprobantes pendientes en la web. 2. Permitir ver el archivo y aprobar o rechazar con motivo. 3. Actualizar el estado de la factura y sus ítems. | • Un comprobante aprobado actualiza la deuda del alumno. • El rechazo exige un motivo, visible para el padre. • El padre ve el cambio sin recargar la app. |
| **HU56** | **Emitir el comprobante de pago** Como padre quiero recibir un comprobante cuando se aprueba mi pago para tener constancia de lo abonado. | Alta | To Do | 1. Crear la Edge Function que genera el comprobante en PDF. 2. Asociarlo al pago aprobado. 3. Permitir descargarlo desde la app. | • Se emite un comprobante por cada pago aprobado. • Indica alumno, ítems pagados, importe y fecha. • No se emite comprobante de pagos rechazados. |
| **HU57** | **Listar facturas y comprobantes por período** Como padre quiero listar las facturas de cada hijo y sus comprobantes en un período de fechas para controlar los pagos realizados. | Media | To Do | 1. Crear el filtro por fecha desde y hasta. 2. Mostrar cada factura con sus comprobantes. 3. Permitir abrir los PDF. | • Solo se muestran facturas del período elegido. • Cada factura lista todos sus comprobantes. • La fecha desde no puede ser posterior a la fecha hasta. |

#### Sprint M5 (02/11 – 06/11) · Deuda, aviso del día 20 y listados de pagos · 7 historias · 18 puntos
| **ID** | **Historia de usuario** | **Prior.** | **Estado** | **Tareas** | **Criterios de aceptación** |
| --- | --- | --- | --- | --- | --- |
| **HU58** | **Consultar el historial de deuda por ítem** Como padre quiero consultar el historial de deuda de cada hijo discriminado por ítem para saber qué conceptos quedan pendientes. | Media | To Do | 1. Crear la consulta de saldo por ítem y mes. 2. Diseñar la vista agrupada por concepto. | • Muestra por mes la cuota, cada deporte, el transporte y el comedor con su saldo. • El total coincide con la suma de los ítems pendientes. |
| **HU61** | **Enviar el aviso de deuda del día 20** Como padre quiero recibir el día 20 un aviso con la deuda pendiente para regularizar el pago. | Alta | To Do | 1. Crear la consulta de facturas con saldo. 2. Reutilizar la Edge Function de correo. 3. Programar el envío con pg_cron. | • Solo reciben el aviso los padres con pago incompleto. • El correo detalla la deuda por ítem. |
| **HU62** | **Generar el listado de ingresos por período** Como administrador quiero generar el listado de ingresos de un período para conocer lo recaudado. | Media | To Do | 1. Definir la consulta de pagos aprobados por fecha. 2. Diseñar la vista con totales. | • Incluye solo pagos aprobados dentro del período. • Muestra el total recaudado. |
| **HU63** | **Generar el listado de pagos completos** Como administrador quiero generar el listado de pagos completos de un período para identificar las familias al día. | Media | To Do | 1. Definir la consulta de facturas saldadas. 2. Agrupar por año del pago y por año de cursado. | • Solo incluye facturas pagadas en su totalidad. • Permite filtrar por año y por año de cursado. |
| **HU64** | **Generar el listado de pagos incompletos** Como administrador quiero generar el listado de pagos incompletos de un período para hacer el seguimiento de la deuda. | Media | To Do | 1. Reutilizar la consulta de HU63 con saldo pendiente. 2. Mostrar el saldo de cada factura. | • Incluye facturas con pago parcial o sin pago. • Muestra el saldo y se agrupa igual que HU63. |
| **HU65** | **Generar el listado de pagos por deporte, nivel, horario y profesor** Como administrador quiero generar el listado de pagos por deporte, nivel, horario y profesor para controlar la cobranza de cada actividad. | Media | To Do | 1. Reutilizar los filtros del listado HU38 de la web. 2. Agregar el estado de pago del ítem deportivo. | • Los filtros se pueden aplicar solos o combinados. • Muestra alumno, deporte, importe y estado de pago. |
| **HU66** | **Generar el listado de pagos por recorrido de transporte** Como administrador quiero generar el listado de pagos por recorrido para controlar la cobranza del transporte. | Media | To Do | 1. Reutilizar la consulta del listado HU39 de la web. 2. Agregar el estado de pago del ítem de transporte. | • Muestra recorrido, alumno, importe y estado de pago. • Solo incluye alumnos inscriptos al transporte en el mes consultado. |

#### Cierre (09/11 – 16/11) · Integración, testing e Informe de uso de IA
*Etapa de estabilización: no incorpora historias nuevas, sino que integra, prueba y documenta las desarrolladas en los sprints M1 a M5.*

| **ID** | **Tarea** | **Prior.** | **Estado** | **Tareas** | **Criterios de aceptación** |
| --- | --- | --- | --- | --- | --- |
| **C.1** | **Integrar y desplegar la PWA** 09/11 · Ambos | Alta | To Do | 1. Integrar HU41 a HU66 en main. 2. Ejecutar las pruebas integrales. 3. Desplegar en Vercel y verificar la instalación en Android e iOS. 4. Activar las tareas de pg_cron y cargar datos de prueba. | • La app funciona de extremo a extremo. • Los procesos programados corren en producción. |
| **C.2** | **Testing, coevaluación y correcciones** 10/11 – 12/11 · Ambos | Alta | To Do | 1. Participar del testing y la coevaluación. 2. Registrar los defectos en el tablero. 3. Corregir y volver a probar. | • Los defectos detectados quedan corregidos o registrados con su justificación. |
| **C.3** | **Elaborar el Informe de uso de IA** 13/11 – 16/11 · Ambos | Alta | To Do | 1. Completar la bitácora de IA. 2. Redactar los cinco apartados del informe. 3. Completar la tabla sin IA / con IA. 4. Preparar la exposición del 17/11. | • El informe cubre los cinco apartados de la consigna. • La bitácora refleja problemas reales del desarrollo. |

## 17. PLAN DE SPRINT – APLICACIÓN MÓVIL
Los sprints de la app duran una semana, de lunes a viernes, y se aplican a la etapa de programación. En la siguiente tabla se indican los requerimientos incluidos en cada uno.

| **Semana** | **Fechas** | **Sprint** | **Requerimientos incluidos** | **Objetivo del sprint** | **Pts.** |
| --- | --- | --- | --- | --- | --- |
| **1** | 29/09 – 02/10 | Sprint M0 | — | Presentar el plan, especificar los requerimientos, modelar los datos de pagos y diseñar las pantallas. | — |
| **2** | 05/10 – 09/10 | Sprint M1 | RF10.1 a RF10.5, RF11.1 a RF11.4 (HU41 a HU49) | Contar con la PWA instalable, el acceso por rol y los valores cargados. | 13 |
| **3** | 13/10 – 16/10 | Sprint M2 | RF11.5, RF12.1 a RF12.3 (HU50 a HU53) | Emitir la factura mensual y consultar las cuotas desde la app. | 11 |
| **4** | 19/10 – 23/10 | Sprint M3 | RF12.4, RF13.3, RF14.1 (HU54, HU59 y HU60) | Cargar comprobantes, consultar inscripciones y enviar el recordatorio de fin de mes. | 12 |
| **—** | 26/10 – 27/10 | Web | Pruebas y 2.ª Instancia de la web | Sin tareas de la app. | — |
| **5** | 28/10 – 30/10 | Sprint M4 | RF12.5, RF12.6, RF13.1 (HU55 a HU57) | Validar pagos, emitir comprobantes y listar facturas por período. | 9 |
| **6** | 02/11 – 06/11 | Sprint M5 | RF13.2, RF14.2, RF15.1 a RF15.5 (HU58 y HU61 a HU66) | Completar la deuda por ítem, el aviso del día 20 y los listados de pagos. | 18 |
| **7** | 09/11 | Cierre | Integración de HU41 a HU66 | Ejecutar las pruebas integrales y desplegar la versión final. | — |
| **—** | 10/11 | Hito | Testing – Coevaluación | Aplicación terminada y probada. | — |
| **7 – 8** | 11/11 – 16/11 | Cierre | Correcciones e Informe de uso de IA | Corregir los defectos y completar la bitácora y el informe. | — |
| **—** | 17/11 | Hito | 3.ª Instancia de Evaluación | Entrega y exposición del TFI completo. | — |

*Nota: el lunes 12/10/2026 es feriado nacional, por lo que el Sprint M2 se ejecuta de martes a viernes. Mientras la app se superpone con la web se mantiene la organización semanal de la sección 8.1: el lunes se planifican juntos el sprint web y el sprint de la app, y la revisión del viernes incluye la demo de ambos.*

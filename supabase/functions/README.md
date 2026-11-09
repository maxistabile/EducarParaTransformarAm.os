# Edge Function para Crear Usuarios

Esta Edge Function permite crear usuarios automáticamente desde el panel de administración sin necesidad de copiar UUIDs manualmente.

## 🚀 Despliegue

### 1. Configurar el Service Role Key

1. Ve a tu dashboard de Supabase
2. Navega a: `Project Settings` → `API`
3. Copia el `service_role` secret (NOT el anon key)

### 2. Crear el Secreto en Supabase

```bash
# Reemplaza con tu service_role key real
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
```

O desde el dashboard de Supabase:
1. Ve a `Edge Functions`
2. Entra a `crear-usuario`
3. En `Environment variables`, agrega:
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: tu_service_role_key

### 3. Desplegar la Edge Function

```bash
# Desde el directorio raíz del proyecto
supabase functions deploy crear-usuario
```

### 4. Verificar el Despliegue

Ve a `Edge Functions` en tu dashboard de Supabase y verifica que la función `crear-usuario` esté activa.

## 🔧 Uso

La Edge Function se llama automáticamente desde el panel de administración cuando creas un nuevo usuario.

### Campos requeridos:
- `email`: Email del usuario
- `password`: Contraseña (mínimo 6 caracteres)
- `nombre`: Nombre del usuario
- `apellido`: Apellido del usuario
- `rol`: Rol del usuario (`Docente`, `Directivo`, `Admin`)

### La función:
1. Crea el usuario en Supabase Auth
2. Upsert el registro en la tabla `usuarios` (usa `upsert` para evitar duplicados)
3. Si el rol es `Docente`, hace upsert en la tabla `docentes`
4. Retorna éxito o error

## 🔒 Seguridad

- Usa el `service_role` key para poder crear usuarios en Auth
- El email se auto-confirma automáticamente
- Usa `upsert` para manejar usuarios existentes
- Headers CORS configurados correctamente para evitar bloqueos

## 🐛 Troubleshooting

Si obtienes un error `401 Unauthorized`:
- Verifica que el `SUPABASE_SERVICE_ROLE_KEY` esté correctamente configurado
- Asegúrate de usar el `service_role` key, NO el `anon` key

Si obtienes un error `500 Internal Server Error`:
- Revisa los logs de la Edge Function en el dashboard de Supabase
- Verifica que las tablas `usuarios` y `docentes` existan

Si obtienes un error `CORS`:
- Verifica que la función tenga los headers CORS configurados
- Asegúrate de que el método OPTIONS esté manejado correctamente

---

# Edge Function `pagos` (HU54 a HU56)

Comprobantes de transferencia, URLs firmadas y comprobante de pago en PDF.
Código: `supabase/functions/pagos/index.ts` (un solo archivo, para poder
pegarlo en el dashboard).

> **No redesplegar `crear-usuario`** desde este repo: su `index.ts` está casi
> entero comentado y no coincide con la función que funciona (CLAUDE.md, 11).

## Antes

1. Ejecutar `supabase/sql/verificaciones/relevamiento_etapa18.sql` (todo `OK`
   o `INFO`).
2. Ejecutar `supabase/sql/etapa18_comprobantes.sql` (crea el bucket privado
   `pagos`, las funciones y los permisos) y
   `supabase/sql/verificaciones/pruebas_etapa18.sql`.

## Despliegue desde el dashboard

1. **Edge Functions → Deploy a new function → Via Editor**. Nombre: `pagos`.
2. Pegar **todo** el contenido de `supabase/functions/pagos/index.ts` y
   desplegar.
3. En la configuración de la función, dejar **Verify JWT** activado (la
   función además verifica el token con `auth.getUser`).
4. Secrets: usa `SUPABASE_URL` (la setea Supabase) y
   `SUPABASE_SERVICE_ROLE_KEY` (ya existe para las otras funciones). No hace
   falta agregar ninguno. La service role **nunca** va al frontend.
5. Comprobar que figure como **Active**.

Con la CLI (si se instala): `supabase functions deploy pagos`.

## Qué hace

- `subir` (Padre): valida el tamaño (5 MB) y el tipo real del archivo (JPG,
  PNG o PDF por sus primeros bytes); **antes de tocar Storage** verifica la
  identidad, la pertenencia actual de la factura y si la clave ya es un envío
  existente; sube a `comprobantes/{factura}/{clave}/{uuid}.{ext}` **sin
  upsert**; registra en la base; si no quedó vinculado, borra **solo su
  propio** archivo.
- `estado_clave` (Padre): recupera un envío cuya respuesta se perdió.
- `archivo`: URL firmada de 60 s del archivo de transferencia (Admin,
  Directivo o el padre actual del alumno).
- `revisar` (Admin o Directivo): aprueba o rechaza con motivo; al aprobar
  intenta generar el comprobante de pago (si falla, queda "pendiente" y se
  genera después sin duplicar).
- `recibo`: genera (si falta) el PDF en `recibos/{id_pago}.pdf`, sin upsert,
  con datos históricos (factura, ítems del pago, importes y fecha de
  aprobación), y devuelve una URL firmada de 60 s.
- `factura` (HU57; padre actual, Admin o Directivo): genera (si falta) el PDF
  de la **factura** en `facturas/{id_factura}.pdf`, sin upsert, con los datos
  históricos de `fn_datos_factura` (`etapa20`), y devuelve una URL firmada de
  60 s. No escribe en la base. Se distingue del comprobante de pago por el
  título, el número (`F-` frente a `R-`) y la aclaración de que no acredita
  pagos. Los correos de HU60 pueden reutilizar `asegurarFacturaPdf`.
  Requiere ejecutar `etapa20` antes de publicar esta versión.

Los errores llegan como `{ ok: false, codigo }` (`PAG_...`, `CUO_...`) y la
app los traduce. En los logs solo se registran códigos, nunca datos.

## Archivos huérfanos

Si la función se corta entre la subida y el registro, puede quedar un archivo
sin comprobante. Para listarlos (solo lectura) en el SQL Editor:

```sql
select o.name, o.created_at
  from storage.objects o
 where o.bucket_id = 'pagos' and o.name like 'comprobantes/%'
   and not exists (select 1 from public.pagos p where p.archivo_path = o.name)
 order by o.created_at;
```

Se borran desde **Storage → pagos**, revisando antes cada uno.

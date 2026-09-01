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
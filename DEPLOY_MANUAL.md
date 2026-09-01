# 🚀 Despliegue Manual de Edge Function

Como no tienes la CLI de Supabase instalada, sigue estos pasos para desplegar manualmente:

## 📋 Paso 1: Ir al Dashboard de Supabase

1. Abre tu navegador y ve a: `https://supabase.com/dashboard/project/ytamermzvgnnroppqrug/functions`

## 🔧 Paso 2: Crear la Edge Function

1. Haz clic en **"New Function"**
2. Ponle el nombre: `crear-usuario`
3. Haz clic en **"Create"**

## 📝 Paso 3: Copiar el Código

1. Abre el archivo: `supabase/functions/crear-usuario/index.ts`
2. Copia **TODO** el contenido del archivo
3. Pégalo en el editor de la Edge Function en el dashboard
4. Haz clic en **"Deploy"** o **"Save"**

## 🔑 Paso 4: Configurar Variables de Entorno

1. En la misma página de la Edge Function
2. Busca la sección **"Environment Variables"** o **"Secrets"**
3. Agrega la siguiente variable:
   - **Name**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: Tu `service_role` key

### 📍 ¿Dónde conseguir el Service Role Key?

1. Ve a: `Project Settings` → `API`
2. Busca la sección **"Project API Keys"**
3. Copia el **`service_role`** secret (NO el `anon` key)
4. Pégalo en la variable de entorno

## ✅ Paso 5: Verificar el Despliegue

1. Vuelve a la lista de Edge Functions
2. Verifica que `crear-usuario` aparezca como **"Active"**
3. Haz clic en ella para ver los detalles

## 🧪 Paso 6: Probar

1. Ve al panel de administración de tu aplicación
2. Intenta crear un nuevo usuario
3. Si funciona, ¡felicidades! 🎉

## 🐛 Si no funciona...

### Error CORS:
- ✅ Los headers CORS ya están configurados correctamente en el código
- Asegúrate de que la función esté en estado "Active"
- Verifica que el código haya sido copiado completamente

### Error 401/403:
- Verifica que el `SUPABASE_SERVICE_ROLE_KEY` sea correcto
- Asegúrate de usar el `service_role` key, NO el `anon` key

### Error 500:
- Revisa los logs de la Edge Function en el dashboard
- Verifica que las tablas `usuarios` y `docentes` existan

## 📞 Recursos Adicionales

- Documentación de Edge Functions: https://supabase.com/docs/guides/functions
- Dashboard de tu proyecto: https://supabase.com/dashboard/project/ytamermzvgnnroppqrug

---

**Nota**: Para futuros despliegues más rápidos, considera instalar la CLI de Supabase:
```bash
# macOS
brew install supabase/tap/supabase

# Linux/Windows
# Ve a: https://supabase.com/docs/guides/cli
```
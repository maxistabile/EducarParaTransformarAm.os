#!/bin/bash

# Script para desplegar Edge Functions de Supabase

echo "🚀 Desplegando Edge Function: crear-usuario"

# Verificar que supabase CLI esté instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI no está instalado"
    echo "📥 Instálalo desde: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Desplegar las funciones
supabase functions deploy crear-usuario
DEPLOY_1=$?

echo "🚀 Desplegando Edge Function: enviar-notificacion"
supabase functions deploy enviar-notificacion
DEPLOY_2=$?

if [ $DEPLOY_1 -eq 0 ] && [ $DEPLOY_2 -eq 0 ]; then
    echo "✅ Edge Functions desplegadas correctamente"
    echo ""
    echo "📝 No olvides configurar las variables de entorno (Settings → Edge Functions → Secrets):"
    echo "   - SUPABASE_SERVICE_ROLE_KEY : tu service_role key"
    echo "   - RESEND_API_KEY            : tu API key de Resend (https://resend.com)"
    echo "   - EMAIL_FROM (opcional)     : ej 'Educar Para Transformar <noreply@tudominio.com>'"
    echo ""
    echo "🔗 Ve a: https://supabase.com/dashboard/project/ytamermzvgnnroppqrug/functions"
else
    echo "❌ Error al desplegar alguna Edge Function"
    exit 1
fi
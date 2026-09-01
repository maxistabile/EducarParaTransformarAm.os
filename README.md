# Educar para Transformar

Portal educativo web del proyecto AMIFOS. Permite la gestión administrativa
de la institución (usuarios, alumnos, docentes, cursos, cuotas, noticias,
entre otros) y ofrece un portal para que los alumnos accedan a su información.

## Cómo ejecutar

El frontend está hecho con React + TypeScript + Vite y usa Supabase como backend.

1. Entrar a la carpeta del frontend e instalar las dependencias:

   ```bash
   cd frontend
   npm install
   ```

2. Crear un archivo `.env` dentro de `frontend/` con las credenciales de Supabase:

   ```
   VITE_SUPABASE_URL=<url del proyecto de Supabase>
   VITE_SUPABASE_ANON_KEY=<clave anónima del proyecto de Supabase>
   ```

3. Levantar el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   La aplicación queda disponible en la dirección que muestra la consola
   (por defecto `http://localhost:5173`).

## Funcionalidades principales

- Panel de administración para gestionar usuarios, alumnos, docentes y cursos.
- Gestión de cuotas y notificaciones a las familias.
- Publicación de noticias.
- Portal del alumno para acceder a su información.
- Inicio de sesión según el rol del usuario.

## Integrantes

- Jara, Agostina
- Stabile, Maximiliano

/**
 * validacionesAlumno.ts
 * Reglas de validación del módulo Alumnos (RF1 · HU7–HU10).
 * Se separaron de AdminPanel.tsx para poder probarlas con Vitest
 * y ejecutarlas automáticamente en la Integración Continua.
 */

export const FORM_ALUMNO_VACIO = {
  nombre: '',
  apellido: '',
  dni: '',
  fecha_nacimiento: '',
  id_curso: '',
  email_padre: '',
  obra_social: '',
  direccion: '',
  telefono: '',
  email: '',
}
export type FormAlumno = typeof FORM_ALUMNO_VACIO

export const RX_SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü][A-Za-zÁÉÍÓÚáéíóúÑñÜü\s'-]*$/
export const RX_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/
export const RX_TEL = /^[\d\s()+-]+$/

export function validarAlumno(f: FormAlumno): string | null {
  const nombre = f.nombre.trim()
  const apellido = f.apellido.trim()
  if (nombre.length < 2 || !RX_SOLO_LETRAS.test(nombre))
    return 'El nombre debe tener al menos 2 caracteres y solo letras.'
  if (apellido.length < 2 || !RX_SOLO_LETRAS.test(apellido))
    return 'El apellido debe tener al menos 2 caracteres y solo letras.'
  if (!/^\d{6,9}$/.test(f.dni.trim()))
    return 'El DNI debe tener entre 7 y 9 dígitos numéricos (sin puntos).'
  if (!f.fecha_nacimiento) return 'Ingresá la fecha de nacimiento.'
  const fnac = new Date(f.fecha_nacimiento + 'T00:00:00')
  if (isNaN(fnac.getTime()) || fnac > new Date())
    return 'La fecha de nacimiento no es válida.'
  // Regla de negocio: cada alumno debe pertenecer a un único curso
  if (!f.id_curso) return 'Seleccioná el curso del alumno.'
  const email = f.email.trim()
  if (email && !RX_EMAIL.test(email))
    return 'Ingresá un email válido (ej: nombre@dominio.com).'
  const tel = f.telefono.trim()
  if (tel) {
    if (!RX_TEL.test(tel))
      return 'El teléfono solo puede tener números, espacios y los signos + - ( ).'
    const digitos = tel.replace(/\D/g, '')
    if (digitos.length < 7 || digitos.length > 15)
      return 'El teléfono debe tener entre 7 y 15 dígitos.'
  }
  return null
}

// Traduce los errores de la base a mensajes claros para el usuario
export function mensajeErrorAlumno(raw: string): string {
  if (/alumnos_dni_key/i.test(raw))
    return 'Ya existe un alumno registrado con ese DNI.'
  if (/uq_alumnos_legajo/i.test(raw))
    return 'Ya existe un alumno con ese legajo.'
  if (/Cupo completo/i.test(raw))
    return 'El curso seleccionado no tiene cupo disponible.'
  if (/Could not find the '(legajo|telefono|email)' column/i.test(raw))
    return 'Falta correr la migración etapa9_modulo_alumnos.sql en Supabase.'
  return 'Error: ' + raw
}

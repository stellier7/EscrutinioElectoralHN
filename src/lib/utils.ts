/**
 * Formatea un nombre completo a formato abreviado (ej: "Juan Pérez" -> "J. Pérez")
 * @param fullName - Nombre completo a formatear
 * @returns Nombre formateado en formato "Inicial. Apellido"
 */
export function formatNameShort(fullName: string): string {
  if (!fullName || typeof fullName !== 'string') {
    return '';
  }

  // Sanitizar entrada: eliminar espacios extra y caracteres peligrosos
  const sanitized = fullName.trim().replace(/[<>]/g, '');
  
  if (!sanitized) {
    return '';
  }

  const parts = sanitized.split(/\s+/).filter(part => part.length > 0);
  
  if (parts.length === 0) {
    return '';
  }

  // Si solo hay un nombre, retornarlo completo
  if (parts.length === 1) {
    return parts[0];
  }

  // Primera letra del primer nombre + apellido completo
  const initial = parts[0].charAt(0).toUpperCase();
  const surname = parts[parts.length - 1];
  
  return `${initial}. ${surname}`;
}


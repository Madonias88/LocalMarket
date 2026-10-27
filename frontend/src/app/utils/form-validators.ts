/**
 * Validadores y limpiadores de campos de formulario (Teléfono, WhatsApp, Correo, Sitio Web).
 */

/**
 * Limpia la entrada de teléfono en tiempo real:
 * - Solo permite dígitos, '+', espacios, guiones y paréntesis.
 * - Asegura que el '+' solo pueda estar al inicio.
 */
export function cleanPhoneInput(raw: string): string {
  if (!raw) return '';
  // Quitar cualquier carácter no permitido
  let cleaned = raw.replace(/[^\d+\s\-()]/g, '');
  // El '+' solo puede estar en la primera posición
  if (cleaned.includes('+')) {
    const hasLeadingPlus = cleaned.startsWith('+');
    cleaned = (hasLeadingPlus ? '+' : '') + cleaned.replace(/\+/g, '');
  }
  return cleaned;
}

/**
 * Limpia la entrada de WhatsApp en tiempo real:
 * - Solo permite dígitos, '+', espacios y guiones.
 * - El '+' solo puede estar al inicio.
 */
export function cleanWhatsAppInput(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.replace(/[^\d+\s\-]/g, '');
  if (cleaned.includes('+')) {
    const hasLeadingPlus = cleaned.startsWith('+');
    cleaned = (hasLeadingPlus ? '+' : '') + cleaned.replace(/\+/g, '');
  }
  return cleaned;
}

/**
 * Limpia la entrada de correo electrónico:
 * - Elimina espacios en blanco.
 * - Convierte a minúsculas.
 */
export function cleanEmailInput(raw: string): string {
  if (!raw) return '';
  return raw.trim().replace(/\s+/g, '').toLowerCase();
}

/**
 * Limpia la entrada de sitio web:
 * - Elimina espacios accidentales.
 */
export function cleanWebsiteInput(raw: string): string {
  if (!raw) return '';
  return raw.trim().replace(/\s+/g, '');
}

/**
 * Valida un número de teléfono.
 * Acepta formatos locales (ej. 5555 1234) o internacionales (ej. +502 5555 1234).
 */
export function validatePhone(phone: string, required = false): { valid: boolean; error?: string } {
  const trimmed = phone ? phone.trim() : '';
  if (!trimmed) {
    return required
      ? { valid: false, error: 'El teléfono es obligatorio' }
      : { valid: true };
  }

  // Verificar caracteres permitidos
  if (!/^\+?[0-9\s\-()]+$/.test(trimmed)) {
    return { valid: false, error: 'El teléfono solo puede contener números, espacios y guiones' };
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8) {
    return { valid: false, error: 'El teléfono debe tener al menos 8 dígitos' };
  }
  if (digits.length > 15) {
    return { valid: false, error: 'El teléfono no puede exceder 15 dígitos' };
  }

  return { valid: true };
}

/**
 * Valida un número de WhatsApp.
 */
export function validateWhatsApp(whatsapp: string, required = false): { valid: boolean; error?: string } {
  const trimmed = whatsapp ? whatsapp.trim() : '';
  if (!trimmed) {
    return required
      ? { valid: false, error: 'El número de WhatsApp es obligatorio' }
      : { valid: true };
  }

  if (!/^\+?[0-9\s\-]+$/.test(trimmed)) {
    return { valid: false, error: 'El WhatsApp solo puede contener números, espacios y guiones' };
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8) {
    return { valid: false, error: 'El WhatsApp debe tener al menos 8 dígitos' };
  }
  if (digits.length > 15) {
    return { valid: false, error: 'El WhatsApp no puede exceder 15 dígitos' };
  }

  return { valid: true };
}

/**
 * Valida una dirección de correo electrónico según estándar RFC común.
 */
export function validateEmail(email: string, required = false): { valid: boolean; error?: string } {
  const trimmed = email ? email.trim() : '';
  if (!trimmed) {
    return required
      ? { valid: false, error: 'El correo electrónico es obligatorio' }
      : { valid: true };
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Ingresa un correo electrónico válido (ej. contacto@minegocio.com)' };
  }

  return { valid: true };
}

/**
 * Valida un sitio web / URL.
 * Acepta URLs con o sin http:// o https://, con dominio válido y TLD.
 */
export function validateWebsite(website: string, required = false): { valid: boolean; error?: string } {
  const trimmed = website ? website.trim() : '';
  if (!trimmed) {
    return required
      ? { valid: false, error: 'El sitio web es obligatorio' }
      : { valid: true };
  }

  const urlRegex =
    /^(https?:\/\/)?(www\.)?[a-zA-Z0-9]([-a-zA-Z0-9]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([-a-zA-Z0-9]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(:\d{1,5})?(\/.*)?$/i;

  if (!urlRegex.test(trimmed)) {
    return { valid: false, error: 'Ingresa una dirección web válida (ej. https://minegocio.com o www.minegocio.com)' };
  }

  return { valid: true };
}

/**
 * Normaliza una URL agregando 'https://' si el usuario omitió el protocolo.
 */
export function normalizeWebsiteUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

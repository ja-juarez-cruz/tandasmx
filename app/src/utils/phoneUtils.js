// phoneUtils.js — Lógica centralizada de ladas y teléfonos

export const PAISES = [
  { codigo: '+52', nombre: 'México',   bandera: '🇲🇽', digitos: 10, placeholder: '5512345678' },
  { codigo: '+57', nombre: 'Colombia', bandera: '🇨🇴', digitos: 10, placeholder: '3101234567' },
  { codigo: '+51', nombre: 'Perú',     bandera: '🇵🇪', digitos: 9,  placeholder: '912345678'  },
  { codigo: '+56', nombre: 'Chile',    bandera: '🇨🇱', digitos: 9,  placeholder: '912345678'  },
];

/**
 * Genera el string a guardar en BD: "52-5532305905"
 */
export function formatPhoneForStorage(lada, localDigits) {
  return `${lada.replace('+', '')}-${localDigits.replace(/\D/g, '')}`;
}

/**
 * Devuelve solo los dígitos locales para mostrar en pantalla.
 * Si tiene guion (nuevo formato): retorna lo que va después del guion.
 * Si es legacy (sin guion): retorna el string tal cual.
 */
export function getDisplayPhone(storedPhone) {
  if (!storedPhone) return '';
  const idx = storedPhone.indexOf('-');
  return idx !== -1 ? storedPhone.slice(idx + 1) : storedPhone;
}

/**
 * Detecta la lada (+52, +57, etc.) a partir del teléfono almacenado.
 * Útil para pre-llenar el selector al editar.
 */
export function detectLadaFromStored(storedPhone) {
  if (!storedPhone) return '+52';
  // Nuevo formato con guion: "52-XXXXXXXXXX"
  if (storedPhone.includes('-')) {
    const ladaDigits = storedPhone.split('-')[0];
    const found = PAISES.find(p => p.codigo.replace('+', '') === ladaDigits);
    return found ? found.codigo : '+52';
  }
  // Legacy: intentar detectar prefijo
  for (const pais of PAISES) {
    const prefix = pais.codigo.replace('+', '');
    if (storedPhone.startsWith(prefix) && storedPhone.length > prefix.length) {
      return pais.codigo;
    }
  }
  return '+52';
}

/**
 * Devuelve los dígitos locales (sin lada) para pre-llenar el input al editar.
 */
export function getLocalDigits(storedPhone) {
  if (!storedPhone) return '';
  // Nuevo formato con guion
  if (storedPhone.includes('-')) {
    return storedPhone.slice(storedPhone.indexOf('-') + 1);
  }
  // Legacy: intentar quitar prefijo de lada
  for (const pais of PAISES) {
    const prefix = pais.codigo.replace('+', '');
    if (storedPhone.startsWith(prefix) && storedPhone.length > prefix.length) {
      return storedPhone.slice(prefix.length);
    }
  }
  return storedPhone;
}

/**
 * Construye el número para wa.me a partir del teléfono almacenado.
 * México necesita el prefijo 521; otros países usan lada + dígitos.
 * Teléfonos legacy (sin guion) se tratan como México por defecto.
 */
export function buildWhatsAppFromStored(storedPhone) {
  if (!storedPhone) return '';

  // Nuevo formato con guion: "52-5532305905"
  if (storedPhone.includes('-')) {
    const [ladaDigits, ...rest] = storedPhone.split('-');
    const local = rest.join('').replace(/\D/g, '');
    if (ladaDigits === '52') return `521${local}`;
    return `${ladaDigits}${local}`;
  }

  // Legacy: sin guion
  const digits = storedPhone.replace(/\D/g, '');
  if (digits.length === 10) return `521${digits}`;                         // 10 dígitos MX legacy
  if (digits.startsWith('52') && digits.length === 12) return `521${digits.slice(2)}`; // 52+10 dígitos
  return digits;
}

/**
 * Verifica si el teléfono ingresado (lada + dígitos) coincide con el almacenado.
 * Maneja tanto el nuevo formato con guion como los formatos legacy.
 */
export function matchesStoredPhone(storedPhone, inputDigits, selectedLada) {
  if (!storedPhone) return false;
  const ladaDigits = selectedLada.replace('+', '');

  // Nuevo formato con guion
  if (storedPhone.includes('-')) {
    const [storeLada, ...rest] = storedPhone.split('-');
    const storeLocal = rest.join('').replace(/\D/g, '');
    return storeLada === ladaDigits && storeLocal === inputDigits;
  }

  // Legacy
  const stored = storedPhone.replace(/\D/g, '');
  if (stored === inputDigits) return true;                                    // 10 dígitos MX legacy
  if (stored === ladaDigits + inputDigits) return true;                      // con código de país
  if (selectedLada === '+52' && stored === '521' + inputDigits) return true; // MX móvil
  return false;
}

// ===========================================
// utils/apiFetch.js
// Fetch centralizado con refresh automático
// Importar esto en cualquier vista que haga
// peticiones autenticadas directas.
// ===========================================

const API_BASE_URL = 'https://9l2vrevqm1.execute-api.us-east-1.amazonaws.com/dev';

// Lock para evitar múltiples refreshes simultáneos
let refreshPromise = null;

function getAccessToken() {
  return localStorage.getItem('authToken');
}

function getRefreshToken() {
  return localStorage.getItem('refreshToken');
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) return null;

      const data = await response.json();
      const newToken = data.data?.token || data.token;
      const newRefreshToken = data.data?.refreshToken || data.refreshToken;

      if (newToken) {
        localStorage.setItem('authToken', newToken);
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }
        return newToken;
      }
      return null;
    } catch (error) {
      console.error('Error al renovar token:', error);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Fetch autenticado con refresh automático.
 * Úsalo en lugar de fetch() en cualquier vista.
 *
 * Ejemplo:
 *   import { apiFetch } from '../utils/apiFetch';
 *
 *   const data = await apiFetch(`/tandas/${tandaId}`, {
 *     method: 'PUT',
 *     body: JSON.stringify(payload)
 *   });
 *
 * - Agrega Authorization header automáticamente
 * - Si recibe 401, intenta refresh y reintenta
 * - Si el refresh falla, dispara 'token-expired'
 * - Lanza error si la respuesta no es ok
 *
 * @param {string} endpoint - Path relativo (ej: '/tandas/123') o URL completa
 * @param {object} options - Opciones de fetch (method, body, headers extras)
 * @returns {Promise<object>} - JSON parseado de la respuesta
 */
export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const buildHeaders = (token) => ({
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers
  });

  // Primera petición
  const token = getAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: buildHeaders(token)
  });

  // Si recibe 401, intentar refresh silencioso
  if (response.status === 401) {
    const newToken = await refreshAccessToken();

    if (newToken) {
      // Reintentar con nuevo token
      const retryResponse = await fetch(url, {
        ...options,
        headers: buildHeaders(newToken)
      });

      const retryData = await retryResponse.json();

      if (retryResponse.ok) {
        return retryData;
      }

      // Si el retry también falla con 401
      if (retryResponse.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        window.dispatchEvent(new CustomEvent('token-expired'));
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
      }

      throw new Error(retryData.error?.message || `Error ${retryResponse.status}`);
    }

    // No se pudo renovar el token
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    window.dispatchEvent(new CustomEvent('token-expired'));
    throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
  }

  // Respuesta normal (no 401)
  const data = await response.json();

  if (response.status === 403) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    window.dispatchEvent(new CustomEvent('token-expired'));
    throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
  }

  if (!response.ok) {
    throw new Error(data.error?.message || data.message || `Error ${response.status}`);
  }

  return data;
}

export { API_BASE_URL };
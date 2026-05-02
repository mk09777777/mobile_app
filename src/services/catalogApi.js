import secureStorage from '../utils/secureStorage';
import { CATALOG_API_BASE_URL } from '../config/catalogApiConfig';
import { decodeJWT } from '../utils/helpers';

/**
 * catalogApi — lightweight fetch wrapper for chandra_backend.
 *
 * Automatically attaches the logged-in user's JWT (from Keychain/AsyncStorage)
 * as a Bearer token so every catalog screen doesn't need to handle auth headers
 * manually.
 *
 * Usage example in a screen:
 *
 *   import catalogApi from '../../services/catalogApi';
 *
 *   const categories = await catalogApi.get('/categories');
 *   const banners    = await catalogApi.get('/banners');
 *   const profile    = await catalogApi.get('/auth/me');
 *
 * The token comes from the SAME Keychain entry used by the Custom app — no
 * separate login needed. chandra_backend accepts it because LEGACY_JWT_SECRET
 * is configured to match the Custom app backend's JWT_SECRET.
 */

async function getAuthHeaders() {
  const token = await secureStorage.getItem('token');
  if (__DEV__ && token) {
    const decoded = decodeJWT(token);
    const resolved = {
      id: decoded?.id ?? decoded?.Id ?? decoded?.sub,
      role:
        decoded?.role ??
        decoded?.Role ??
        (decoded?.roleNumber ?? decoded?.RoleNumber) ??
        undefined,
      roleNumber:
        decoded?.roleNumber ??
        decoded?.RoleNumber ??
        (typeof (decoded?.role ?? decoded?.Role) === 'number' ? (decoded?.role ?? decoded?.Role) : undefined),
      clientId: decoded?.clientId ?? decoded?.ClientId ?? decoded?.ClientID ?? decoded?.clientID,
      username: decoded?.username ?? decoded?.Username,
      email: decoded?.email ?? decoded?.Email,
      name: decoded?.name ?? decoded?.Name ?? decoded?.clientName ?? decoded?.ClientName,
      exp: decoded?.exp ?? decoded?.Exp,
      iat: decoded?.iat ?? decoded?.Iat,
    };
    console.log('🔎 [CatalogAuth] Token preview:', `${String(token).slice(0, 24)}...`);
    console.log('🔎 [CatalogAuth] Decoded payload:', {
      ...resolved,
      allKeys: decoded ? Object.keys(decoded) : [],
    });
    if (!resolved.username && !resolved.email && !resolved.name) {
      console.log(
        '⚠️ [CatalogAuth] Token has no username/email/name claims. Only ID-based identity can be resolved.',
      );
    }
  }
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(method, path, body, options = {}) {
  const headers = await getAuthHeaders();
  const isFormData = Boolean(options?.isFormData);
  if (isFormData) {
    delete headers['Content-Type'];
  }
  const url = `${CATALOG_API_BASE_URL}${path}`;

  const response = await fetch(url, {
    method,
    headers,
    ...(body
      ? {
          body: isFormData ? body : JSON.stringify(body),
        }
      : {}),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error || data.message || `Request failed with status ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

const catalogApi = {
  /** GET  /path */
  get: (path) => request('GET', path),

  /** POST /path  body: object */
  post: (path, body) => request('POST', path, body),

  /** POST /path form-data body */
  postForm: (path, body) => request('POST', path, body, { isFormData: true }),

  /** PUT  /path  body: object */
  put: (path, body) => request('PUT', path, body),

  /** DELETE /path */
  delete: (path) => request('DELETE', path),
};

export default catalogApi;

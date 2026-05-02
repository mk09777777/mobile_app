import { Platform } from 'react-native';

/**
 * Catalog API Configuration — chandra_backend
 *
 * The catalog app (new client-facing app) uses a separate backend:
 *   chandra_backend/  (this repo, runs on port 4000)
 *
 * This is completely independent of the Custom app's backend
 * (workflowapi-quhn.onrender.com).
 *
 * Auth endpoint: POST /auth/login  { username, password } → { token }
 * Profile:       GET  /auth/me     Authorization: Bearer <token>
 * Categories:    GET  /categories
 * Banners:       GET  /banners
 *
 * NOTE ON AUTH:
 * The chandra_backend signs its own JWTs with its own JWT_SECRET.
 * Catalog users (ClientUser model) have separate credentials (username +
 * password) from the Custom app's users (email + password).
 * The catalog token is stored under the key '@catalog_token' in AsyncStorage,
 * completely separate from the Custom app's token ('token' in Keychain).
 */

// ── Environment flags ─────────────────────────────────────────────────────────

/** Force production URL even in development */
export const CATALOG_USE_PRODUCTION_URL = false;

/** Use a custom IP (e.g. physical device testing) */
export const CATALOG_USE_PHYSICAL_DEVICE = false;

/** IP of your development machine (used for physical Android device) */
export const CATALOG_PHYSICAL_DEVICE_IP = '192.168.0.109';

// ── URLs ──────────────────────────────────────────────────────────────────────

/**
 * Production chandra_backend origin (no trailing slash; paths are /categories, /banners, etc.).
 */
const CATALOG_PRODUCTION_URL = 'https://chandra-backend-0hum.onrender.com';

// chandra_backend runs on port 4000 (see chandra_backend/.env PORT=4000)
const CATALOG_DEV_IOS_URL = 'http://localhost:4000';
const CATALOG_DEV_ANDROID_EMULATOR_URL = 'http://10.0.2.2:4000';
const CATALOG_DEV_ANDROID_PHYSICAL_URL = `http://${CATALOG_PHYSICAL_DEVICE_IP}:4000`;

// ── Resolver ──────────────────────────────────────────────────────────────────

export const getCatalogApiBaseUrl = () => {
  if (process.env.CATALOG_API_URL) {
    return process.env.CATALOG_API_URL;
  }

  if (!__DEV__ || CATALOG_USE_PRODUCTION_URL) {
    return CATALOG_PRODUCTION_URL;
  }

  if (Platform.OS === 'android') {
    return CATALOG_USE_PHYSICAL_DEVICE
      ? CATALOG_DEV_ANDROID_PHYSICAL_URL
      : CATALOG_DEV_ANDROID_EMULATOR_URL;
  }

  return CATALOG_DEV_IOS_URL;
};

export const CATALOG_API_BASE_URL = getCatalogApiBaseUrl();

if (__DEV__) {
  console.log('📦 Catalog API Base URL:', CATALOG_API_BASE_URL);
}

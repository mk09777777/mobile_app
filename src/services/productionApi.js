import secureStorage from '../utils/secureStorage';
import { API_BASE_URL, USE_PRODUCTION_URL } from '../config/apiConfig';

// Production planner runs on its own backend, separate from the main app.
// In production: https://chandra-backend-0hum.onrender.com
// In dev: same local/physical-device URL as the rest of the app (no change to dev workflow).
const PRODUCTION_PLANNER_PROD_URL = 'https://chandra-backend-0hum.onrender.com';

// Route chain: app("/") → routes("/admin") → adminRouter("/production") → productionPlannerRouter
// No "/api" prefix — routes mount directly at /admin/production/...
const BASE = `${USE_PRODUCTION_URL ? PRODUCTION_PLANNER_PROD_URL : API_BASE_URL}/admin/production`;

async function getHeaders(multipart = false) {
  // Use secureStorage (Keychain → AsyncStorage fallback) — same as rest of app
  const token = await secureStorage.getItem('token');
  if (__DEV__ && !token) console.warn('[ProductionAPI] ⚠️ No token found — user may need to log in again');
  const headers = { Authorization: `Bearer ${token}` };
  if (!multipart) headers['Content-Type'] = 'application/json';
  return headers;
}

async function request(method, path, body = null, multipart = false, _attempt = 0) {
  const url = `${BASE}${path}`;
  if (__DEV__) console.log(`[ProductionAPI] ${method} ${url}${_attempt > 0 ? ` (retry ${_attempt})` : ''}`);
  const headers = await getHeaders(multipart);
  const opts = { method, headers };
  if (body) opts.body = multipart ? body : JSON.stringify(body);

  // File uploads get 90 s; regular requests get 35 s.
  // 35 s accommodates Render free-tier cold-starts (can take 25-30 s).
  const timeoutMs = multipart ? 90000 : 35000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  opts.signal = controller.signal;

  try {
    const res = await fetch(url, opts);
    clearTimeout(timer);
    if (__DEV__) console.log(`[ProductionAPI] ✓ ${res.status} ${method} ${path.split('?')[0]}`);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
      if (__DEV__) console.warn(`[ProductionAPI] ✗ ${res.status} ${url}`, data);
      // Extract a readable message — server may return { error }, { message }, or plain text
      const msg = data?.message || data?.error || data?.msg ||
        (typeof data === 'string' ? data : null) ||
        `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      if (__DEV__) console.warn(`[ProductionAPI] ⏱ TIMEOUT ${method} ${path.split('?')[0]} (attempt ${_attempt})`);
      // Auto-retry once — backend may be cold-starting on Render free tier.
      if (_attempt === 0) {
        if (__DEV__) console.warn(`[ProductionAPI] ↺ cold-start timeout — retrying ${method} ${path.split('?')[0]}`);
        await new Promise(r => setTimeout(r, 1000));
        return request(method, path, body, multipart, 1);
      }
      throw new Error('Backend is taking too long to respond. Please try again in a moment.');
    }
    // "Network request failed" on the first attempt = stale keep-alive connection.
    // The server closed the socket; the client tried to reuse it and got a reset.
    // Auto-retry once after a short back-off — the retry opens a fresh connection.
    if (e.message === 'Network request failed' && _attempt === 0) {
      if (__DEV__) console.warn(`[ProductionAPI] ↺ stale connection — retrying ${method} ${path.split('?')[0]}`);
      await new Promise(r => setTimeout(r, 800));
      return request(method, path, body, multipart, 1);
    }
    throw e;
  }
}

// ── Imports ──────────────────────────────────────────────────────────────────
export const uploadOrdersFile = (formData) => request('POST', '/imports/gati-orders', formData, true);
export const uploadWipFile    = (formData, testDelay = false) =>
  request('POST', `/imports/gati-wip${testDelay ? '?testDelay=true' : ''}`, formData, true);
export const getImportRuns    = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request('GET', `/imports/runs${q ? '?' + q : ''}`);
};
export const getImportRun    = (id) => request('GET',    `/imports/runs/${id}`);
export const deleteImportRun = (id) => request('DELETE', `/imports/runs/${id}`);

// ── Job Cards ─────────────────────────────────────────────────────────────────
export const getJobCards     = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request('GET', `/job-cards${q ? '?' + q : ''}`);
};
export const getJobCardById   = (id)   => request('GET', `/job-cards/${id}`);
export const getJobCardByCode = (code) => request('GET', `/job-cards/by-code?code=${encodeURIComponent(code)}`);
export const getJobCardMovements = (id) => request('GET', `/job-cards/${id}/movements`);
export const setFindings  = (id, received) => request('PUT', `/job-cards/${id}/findings`, { received });
export const setPriority  = (id, priority) => request('PUT', `/job-cards/${id}/priority`, { priority });

// ── Dashboards ────────────────────────────────────────────────────────────────
export const getDashboardSummary = () => request('GET', '/dashboards/summary');
export const getOrdersDashboard  = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request('GET', `/dashboards/orders${q ? '?' + q : ''}`);
};
export const getOrderDetail      = (orderNumber) => request('GET', `/dashboards/orders/${encodeURIComponent(orderNumber)}`);
export const getCapacityDashboard = () => request('GET', '/dashboards/capacity');
export const getAnalytics        = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request('GET', `/dashboards/analytics${q ? '?' + q : ''}`);
};

// ── Planning ──────────────────────────────────────────────────────────────────
export const checkPlanning       = (orderSpec) => request('POST', '/planning/check', { orderSpec });
export const recomputeBaselines  = () => request('POST', '/planning/baselines/recompute');

// ── What-If ───────────────────────────────────────────────────────────────────
export const simulateWhatIf    = (changes) => request('POST', '/what-if/simulate', { changes });
export const getWhatIfScenarios = () => request('GET', '/what-if/scenarios');
export const saveWhatIfScenario = (data) => request('POST', '/what-if/scenarios', data);
export const deleteWhatIfScenario = (id) => request('DELETE', `/what-if/scenarios/${id}`);

// ── Diamonds ──────────────────────────────────────────────────────────────────
export const getDiamonds    = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request('GET', `/inventory/diamonds${q ? '?' + q : ''}`);
};
export const getDiamondByCode = (code) => request('GET', `/inventory/diamonds/by-code?code=${encodeURIComponent(code)}`);
export const createDiamond   = (data)  => request('POST', '/inventory/diamonds', data);
export const updateDiamond   = (code, data) => request('PUT', `/inventory/diamonds/by-code?code=${encodeURIComponent(code)}`, data);
export const deleteDiamond   = (code)  => request('DELETE', `/inventory/diamonds/by-code?code=${encodeURIComponent(code)}`);

// ── Inventory Ledger ──────────────────────────────────────────────────────────
export const getDiamondLedger = (code, limit = 50) =>
  request('GET', `/inventory/diamonds-ledger/by-code?code=${encodeURIComponent(code)}&limit=${limit}`);
export const addLedgerEntry  = (data) => request('POST', '/inventory/ledger', data);

// ── Allocations ───────────────────────────────────────────────────────────────
export const createAllocation  = (data) => request('POST', '/inventory/allocations', data);
export const consumeAllocation = (id, qty) => request('POST', `/inventory/allocations/${id}/consume`, qty ? { qty } : {});
export const releaseAllocation = (id) => request('POST', `/inventory/allocations/${id}/release`);
export const getAllocationsByJobCard = (id) => request('GET', `/inventory/allocations/by-job-card/${id}`);

// ── Requirements ──────────────────────────────────────────────────────────────
export const getRequirements = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request('GET', `/inventory/requirements${q ? '?' + q : ''}`);
};
export const getShortages    = () => request('GET', '/inventory/shortages');

// ── Metal Ledger ──────────────────────────────────────────────────────────────
export const addMetalLedgerEntry      = (data) => request('POST', '/inventory/metal-ledger', data);
export const getMetalLedgerByJobCard  = (id)   => request('GET', `/inventory/metal-ledger/by-job-card/${id}`);

// ── Material Loss ─────────────────────────────────────────────────────────────
export const getMaterialLossSummary = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request('GET', `/material-loss/summary${q ? '?' + q : ''}`);
};
export const getMaterialLossByStage   = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request('GET', `/material-loss/by-stage${q ? '?' + q : ''}`);
};
export const getMaterialLossByCell    = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request('GET', `/material-loss/by-cell${q ? '?' + q : ''}`);
};
export const getMaterialLossByJobCard = (id) => request('GET', `/material-loss/by-job-card/${id}`);
export const getMaterialLossByJobCards = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request('GET', `/material-loss/by-job-card${q ? '?' + q : ''}`);
};

// ── Purchase Orders ───────────────────────────────────────────────────────────
export const getPurchaseOrders  = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request('GET', `/purchase-orders${q ? '?' + q : ''}`);
};
export const getPurchaseOrder   = (id)   => request('GET', `/purchase-orders/${id}`);
export const createPurchaseOrder = (data) => request('POST', '/purchase-orders', data);
export const updatePurchaseOrder = (id, data) => request('PUT', `/purchase-orders/${id}`, data);
export const approvePurchaseOrder = (id) => request('POST', `/purchase-orders/${id}/approve`);
export const cancelPurchaseOrder  = (id) => request('POST', `/purchase-orders/${id}/cancel`);
export const generatePOsFromShortages = () => request('POST', '/purchase-orders/generate-from-shortages');

// ── Alerts ────────────────────────────────────────────────────────────────────
export const getAlerts       = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request('GET', `/alerts${q ? '?' + q : ''}`);
};
export const acknowledgeAlert = (id) => request('POST', `/alerts/${id}/acknowledge`);
export const resolveAlert     = (id) => request('POST', `/alerts/${id}/resolve`);
export const runAlerts        = ()   => request('POST', '/alerts/run');
export const deleteAlert      = (id) => request('DELETE', `/alerts/${id}`);
export const deleteAllAlerts  = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request('DELETE', `/alerts${q ? '?' + q : ''}`);
};

// ── Stages ────────────────────────────────────────────────────────────────────
export const getStages    = () => request('GET', '/stages');
export const createStage  = (data)       => request('POST', '/stages', data);
export const updateStage  = (code, data) => request('PUT', `/stages/${code}`, data);
export const deleteStage  = (code)       => request('DELETE', `/stages/${code}`);
export const reseedStages = ()           => request('POST', '/stages/reseed');

// ── Dev utilities ─────────────────────────────────────────────────────────────
// Wipes all imported production data (JobCards, movements, imports, column maps).
// Keeps StageDefinitions and Diamond masters intact.
export const devResetAll = () => request('POST', '/dev/reset-all');

// ── Calendar ──────────────────────────────────────────────────────────────────
export const getCalendar    = ()     => request('GET', '/calendar');
export const updateCalendar = (data) => request('PUT', '/calendar', data);

// ── Column Maps ───────────────────────────────────────────────────────────────
export const getColumnMap    = (fileType) => request('GET', `/column-maps/${fileType}`);
export const updateColumnMap = (fileType, data) => request('PUT', `/column-maps/${fileType}`, data);


// ── Production Scheduler ─────────────────────────
// GET /schedule/Analytics?days=N  →  { bottlenecks, lateOrders, startToday (count), totalPieces }
export const getScheduleAnalytics = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request('GET', `/schedule/Analytics${q ? '?' + q : ''}`);
};
// GET /schedule?days=N  →  { grid[], pieces[], bottlenecks[], lateOrders[], startToday[] }
// startToday[] items: { orderNumber, itemCategory, qty, priority }
export const getFullSchedule = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request('GET', `/schedule${q ? '?' + q : ''}`);
};
// GET /schedule?startDate=YYYY-MM-DD&days=N  →  full data for a specific date range
export const getScheduleByDateRange = (startDate, days) => {
  const q = new URLSearchParams({ startDate, days }).toString();
  return request('GET', `/schedule?${q}`);
};
export const getLiveStages = () => request('GET', '/schedule/live-stages');
// GET /schedule/today  →  { startToday[], stageLoad[] }
// startToday[] items: { orderNumber, itemCategory, qty, priority }
// stageLoad[] items: { stage, workerHoursUsed, workerHoursAvailable, utilisation }
export const getTodaySchedule  = () => request('GET', '/schedule/today');
export const getScheduleByPiece = (code) => request('GET', `/schedule/by-piece?code=${encodeURIComponent(code)}`);
export const getScheduleByStage = (stageCode, days = 14) => request('GET', `/schedule/by-stage/${stageCode}?days=${days}`);

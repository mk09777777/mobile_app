# Chandra Jewels — Production Intelligence Platform
## Full Session Build Summary

---

## 1. What Was Built

A complete **Production Intelligence Platform** frontend was added to the existing Chandra Jewels React Native app. It is accessible from the App Selection screen via the **"Production"** card and connects to the local `chandra_backend` Express + MongoDB server.

---

## 2. Project Structure

```
mobile_app/src/
├── navigation/
│   ├── ProductionNavigator.js       ← NEW — Root Stack → Bottom Tabs → nested Stacks
│   └── RootNavigator.js             ← MODIFIED — added ProductionApp screen
│
├── services/
│   └── productionApi.js             ← NEW — full API client for all /admin/production/* routes
│
├── config/
│   └── apiConfig.js                 ← MODIFIED — USE_PRODUCTION_URL = false (local backend)
│
└── screens/
    └── Production/
        ├── dashboard/
        │   └── ProductionDashboardScreen.js   ← custom header, no nav bar
        ├── tracking/
        │   ├── OrdersTrackingScreen.js
        │   ├── OrderDetailScreen.js
        │   ├── JobCardDetailScreen.js
        │   └── AllPiecesScreen.js
        ├── imports/
        │   ├── ImportOrdersScreen.js
        │   ├── ImportWipScreen.js
        │   └── ImportHistoryScreen.js
        ├── planning/
        │   ├── CapacityDashboardScreen.js
        │   ├── NewOrderCalculatorScreen.js
        │   └── WhatIfSimulatorScreen.js
        ├── inventory/
        │   ├── DiamondMasterScreen.js
        │   ├── RequirementsScreen.js
        │   └── PurchaseOrdersScreen.js
        ├── settings/
        │   ├── StagesSettingsScreen.js
        │   └── ColumnMapsScreen.js
        └── AlertsScreen.js
```

---

## 3. Navigation Architecture

```
RootNavigator (Stack)
└── ProductionApp → ProductionNavigator (Stack, headerShown: false)
    └── ProductionTabs (Bottom Tab — 5 tabs)
        ├── Dashboard  → DashboardStack  (Stack)
        │   └── ProductionHome (headerShown: false — custom dark-teal header)
        │       + CapacityDashboard, Tracking, Diamonds, Alerts, Imports...
        ├── Tracking   → TrackingStack   (Stack)
        ├── Imports    → ImportsStack    (Stack)
        ├── Planning   → PlanningStack   (Stack)
        └── Inventory  → InventoryStack  (Stack)
```

Global deep-link screens (Alerts, StagesSettings, ColumnMaps) are on the root Production stack so any tab can push them.

---

## 4. API Layer (`productionApi.js`)

### Base URL
```
${API_BASE_URL}/admin/production
```

### Route chain (backend)
```
app.use("/")
  → routes.use("/admin", adminRouter)
    → adminRouter.use("/production", productionPlannerRouter)
```
No `/api` prefix anywhere.

### Auth
Uses `secureStorage.getItem('token')` (Keychain → AsyncStorage fallback).  
Sends `Authorization: Bearer <token>` on every request.

### Timeout
Every `fetch` has a 15-second `AbortController` timeout. If the backend hangs (MongoDB not connected), requests fail with a clear message instead of loading forever.

### Dev logging
```
[ProductionAPI] GET  http://10.0.2.2:3000/admin/production/dashboards/capacity
[ProductionAPI] ✓ 200 GET /dashboards/capacity
[ProductionAPI] ✗ 404 GET /dashboards/capacity   ← route missing
[ProductionAPI] ⏱ TIMEOUT GET /dashboards/capacity  ← DB not connected
```

---

## 5. Backend Setup

### Location
```
Production_Backend/chandra_backend/
```

### Start (development, uses compiled dist/)
```bash
npm start
# Expected output:
# Connected to MongoDB
# [production-planner] schedulers running: baselines every 360m, alerts every 15m
# Server listening on port 3000
```

### Start (TypeScript source, hot-reload)
```bash
npm run dev
```

### .env (required)
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/chandra
JWT_SECRET=change-me-to-a-random-string
JWT_EXPIRES_IN=7d
PASSWORD_SEED=change-me-to-another-random-string
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123

# IMPORTANT — add this so the Render-issued login token is properly verified:
LEGACY_JWT_SECRET=<copy JWT_SECRET from workflowapi-quhn.onrender.com backend>
```

### MongoDB
The backend requires a local MongoDB instance at `localhost:27017`.

```bash
# Docker (fastest)
docker run -d --name mongo-chandra -p 27017:27017 mongo:7

# Or start the Windows service
net start MongoDB
```

---

## 6. Mobile App API Configuration (`apiConfig.js`)

| Flag | Value | Effect |
|---|---|---|
| `USE_PRODUCTION_URL` | `false` | Use local backend (default for dev) |
| `USE_PRODUCTION_URL` | `true` | Use Render backend `workflowapi-quhn.onrender.com` |
| `USE_PHYSICAL_DEVICE` | `false` | Android emulator → `10.0.2.2:3000` |
| `USE_PHYSICAL_DEVICE` | `true` | Physical device → `PHYSICAL_DEVICE_IP:3000` |
| `PHYSICAL_DEVICE_IP` | `192.168.51.175` | Change to your machine's LAN IP |

---

## 7. Safe Area / Status Bar (Android)

### Rule applied to ALL production screens
| Element | Value | Reason |
|---|---|---|
| `SafeAreaView edges` | `['top','left','right','bottom']` on Dashboard (custom header) | Pushes content below status bar |
| `SafeAreaView edges` | `['left','right','bottom']` on all other screens | Navigator header handles top inset |
| `safe.backgroundColor` | `colors.background` (#FFFFFF) | White canvas on all screens |
| `header View backgroundColor` | `colors.primary` (#143F45) | Dark-teal navbar preserved |
| `statusBarColor` (navigator) | `colors.primary` on header screens | Status bar matches dark-teal header |
| `statusBarStyle` (navigator) | `'light'` on header screens, `'dark'` on Dashboard | Correct icon colours per background |

---

## 8. Fixes Applied During Session

### Fix 1 — `npm run android` failed on Windows
**Cause:** Script used `bash -c '...'` and macOS `java_home` — not available on Windows.  
**Fix:** `package.json` `android` script → `"react-native run-android"`

### Fix 2 — Dashboard stuck on loading forever
**Cause 1:** Wrong URL prefix — `/api/admin/production` → correct is `/admin/production`  
**Cause 2:** Wrong token method — `AsyncStorage.getItem('token')` → correct is `secureStorage.getItem('token')`

### Fix 3 — Headers overlapping Android status bar
**Cause:** `SafeAreaView edges` missing `'top'` on the Dashboard's custom header.  
**Fix:** Added `'top'` to edges; set `safe.backgroundColor = colors.primary` (later changed to `colors.background` per user preference); added `statusBarColor`/`statusBarStyle` to navigator.

### Fix 4 — All requests timing out (15 s)
**Root cause:** `fetch` had no timeout — if MongoDB was disconnected, Mongoose buffered queries silently and never responded. `Promise.allSettled` never settled → `setLoading(false)` never called → spinner stayed forever.  
**Fix:** Added `AbortController` 15-second timeout to every `fetch` in `productionApi.js`.

### Fix 5 — MongoDB not running
**Symptom:** All `[ProductionAPI] ⏱ TIMEOUT` — backend running but DB not connected.  
**Fix:** Start MongoDB locally (`docker run -d mongo:7 -p 27017:27017`) then restart backend.

---

## 9. Network Diagnostic Checklist

If production API calls time out even with the backend running:

```powershell
# 1. Test backend responds on localhost
Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
# Expected: 200 {"status":"ok"}

# 2. Test emulator can reach host (in emulator Chrome browser)
# Navigate to: http://10.0.2.2:3000/health
# Expected: {"status":"ok"}

# 3. If step 2 fails — add Windows Firewall rule
netsh advfirewall firewall add rule name="Node 3000 (dev)" dir=in action=allow protocol=TCP localport=3000

# 4. Test authenticated route
$token = "your-jwt-token"
Invoke-WebRequest -Uri "http://localhost:3000/admin/production/dashboards/capacity" `
  -Headers @{ Authorization = "Bearer $token" } -UseBasicParsing
# Expected: {"stages":[],"bottlenecks":[],"monthLoad":0}
```

---

## 10. Dev Console Logs (per tab screen)

All 5 tab screens log their API responses in `__DEV__` mode:

| Tab | Log prefix | API call |
|---|---|---|
| Dashboard | `[Dashboard] capacity/analytics/alerts/orders :` | 4 parallel calls |
| Tracking | `[Tracking] orders response:` | `getOrdersDashboard` |
| Imports | `[Imports] upload result:` | `uploadOrdersFile` (on upload) |
| Planning | `[Planning] capacity response:` | `getCapacityDashboard` |
| Inventory | `[Inventory] diamonds response:` | `getDiamonds` |

---

## 11. First-Run Data Flow

The database starts **empty**. To populate it:

1. **Imports tab → Upload Orders** — pick your GatiSOFT orders `.xlsx` export  
   → Creates `JobCard` documents
2. **Imports tab → Upload WIP** — pick your WIP `.xlsx` export  
   → Creates `StageMovement` documents  
3. **Planning tab** → tap **Recompute Baselines**  
   → Builds `CapacityBaseline` documents from stage movement data
4. **Dashboard** → pull-to-refresh  
   → Now shows real KPIs, capacity %, bottlenecks, alerts

---

## 12. Key Files Reference

| File | Purpose |
|---|---|
| `src/navigation/ProductionNavigator.js` | All navigation for Production app |
| `src/navigation/RootNavigator.js` | Wires ProductionApp into root stack |
| `src/services/productionApi.js` | Every API call for production planner |
| `src/config/apiConfig.js` | Toggle local/Render/physical device URLs |
| `src/screens/AppSelection/AppSelectionScreen.js` | Entry point card |
| `Production_Backend/chandra_backend/src/production-planner/` | All backend routes, models, services |
| `Production_Backend/chandra_backend/.env` | Backend environment config |
| `Production_Backend/chandra_backend/src/server.ts` | Backend entry point |

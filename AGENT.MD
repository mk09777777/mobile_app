# Chandra Jewels Mobile App - Agent Guide

## App Overview

- **Platform/stack:** React Native app with React Navigation, Redux store, Auth context, alert context, sockets, and push notifications.
- **Entry point:** `App.tsx` sets up providers and renders `AppNavigator`.
- **Navigation root:** `src/navigation/RootNavigator.js`.
- **Current product direction:** app contains two authenticated destinations:
  - **Custom flow** (existing internal operations app)
  - **Catalog flow** (client-facing app; currently a scaffold/placeholder and the main area to build next)

## Top-Level User Flow

1. Splash screen (`VideoSplashScreen`) plays first.
2. Auth token check runs (`AuthContext`).
3. If unauthenticated -> `Login`.
4. If authenticated -> `AppSelection`.
5. User chooses one of:
   - `CustomApp` -> `StackNavigator`
   - `CatalogApp` -> `App2Navigator`

## Flow 1: Custom (Existing Internal App)

### Navigator Structure

- **Root route:** `CustomApp`
- **Navigator file:** `src/navigation/StackNavigator.js`
- **Core container:** stack navigator with `MainTabs` as default
- **Bottom tabs:** `src/navigation/BottomTabs.js`
  - Dashboard
  - Enquiries
  - Chats

### Existing Custom Screens

- **Auth/entry:** `LoginScreen`, `OnboardingScreen` (legacy support in stack)
- **Dashboard:** `DashboardScreen`
- **Enquiries domain:**
  - `EnquiryListScreen`
  - `SingleEnquiryScreen`
  - `AddEnquiryStep1Screen`, `AddEnquiryStep2Screen`
  - `EditEnquiryStep1Screen`, `EditEnquiryStep2Screen`
- **Chat domain:**
  - `ChatsScreen`
  - `ChatGroupsScreen`
  - `ChatDetailScreen`
- **Admin domain:**
  - `MetalPricesScreen`
  - `ClientsListScreen`
  - `CreateClientScreen`
  - `ClientPricingScreen`
  - `StatusStatisticsScreen`
- **Design/pricing helpers:**
  - `DesignViewerScreen`
  - `PricingScreen`
  - `UploadDesignScreen`
- **Other:** `NotificationsScreen`

### Common Layout Patterns Used in Custom Flow

- Bottom-tab app shell (`MainTabs`) with stack-based detail routes.
- List -> detail screens (enquiries, chats, clients).
- Multi-step form layout (add/edit enquiry steps).
- Admin management tables/cards + modal editing.
- Chat layout (thread list + detail/chat header + swipe actions).
- Full-screen utility views (notifications, design viewer, pricing, upload).

## Flow 2: Catalog (Client-Facing; In Progress)

### Navigator Structure

- **Root route:** `CatalogApp`
- **Navigator file:** `src/navigation/App2Navigator.js`
- **Current screen:** `ClientHome` -> `src/screens/ClientApp/HomeScreen.js`

### Current Catalog State

- Catalog flow is authenticated and reachable from `AppSelection`.
- `HomeScreen` is currently a branded "Coming Soon" placeholder.
- It includes:
  - Header with back action to `AppSelection`
  - Centered hero/brand mark
  - Subtitle/description text
  - Feature chip row (planned capabilities)

### Planned Catalog API Surface (already configured)

- `GET /categories`
- `GET /categories/:id/subcategory-profiles`
- `GET /banners`
- `GET /auth/me`
- Config/service files:
  - `src/config/catalogApiConfig.js`
  - `src/services/catalogApi.js`

## App Selection Screen (Flow Switcher)

- **File:** `src/screens/AppSelection/AppSelectionScreen.js`
- **Layout type:** branded decision screen with two animated cards.
- **Cards/routes:**
  - **Custom** -> `navigation.replace('CustomApp')`
  - **Catalog** -> `navigation.replace('CatalogApp')`

## Existing Component Types in the App

### Common UI (`src/components/common`)

- Buttons (`Button`, `SecondaryButton`, `OutlineButton`)
- Typography wrappers (`CustomText`, `Heading`, `BodyText`, etc.)
- Inputs (`Input`, `SearchInput`)
- Loading states (`Loader`, `OverlayLoader`, `SkeletonLoader`, `AnimatedLogoLoader`)
- Navigation UI (`TopNavbar`, `CustomTabBar`, `Icon`)
- Image primitives (`ResponsiveImage`, `OptimizedImage`, `AvatarImage`, `CardImage`, `BannerImage`, `EnquiryImage`)
- Resilience/feedback (`ErrorBoundary`, branded alert component)

### Domain Components

- **Cards:** enquiry/business summary card variants (`src/components/cards`)
- **Enquiry:** `EnquirySummaryCard`
- **Filters:** `EnquiryFiltersModal`
- **Modals:** account, notifications, enquiry history (`src/components/modals`)
- **Chat:** chat header, empty state, swipeable message (`src/components/chat`)
- **Charts:** metal price history chart (`src/components/charts`)
- **Admin subcomponents:** diamond row/edit modal (`src/screens/Admin/components`)
- **Providers:** users, push initialization, socket manager, chat sync (`src/components/providers`)

## Screen Layout Categories Present Today

- **Auth layout:** full-screen login/onboarding.
- **Selection layout:** split choice via large action cards (Custom vs Catalog).
- **Tab-shell layout:** persistent bottom nav with stack push to detail pages.
- **List/detail layout:** searchable/filterable lists with drill-down.
- **Form wizard layout:** multi-step create/edit flows with controlled navigation.
- **Chat layout:** conversation list, group list, and message detail screens.
- **Admin tools layout:** CRUD and settings style screens with modal editing.
- **Placeholder marketing layout:** centered "coming soon" with feature chips (Catalog home).

## Where We Will Work Next

- Primary build focus should be **Catalog flow** in `App2Navigator` and new `src/screens/ClientApp/*` screens.
- Reuse existing common components and design language from Custom flow where possible.
- Keep `RootNavigator` and `AppSelection` contract stable: both flows stay accessible after a single login.

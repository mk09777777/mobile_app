/**
 * ProductionNavigator
 *
 * Stack navigator for the Diamond Production Intelligence Platform.
 * All screens under /admin/production backend prefix.
 *
 * Auth is handled upstream in RootNavigator — users reaching this
 * navigator are always authenticated (admin role required).
 *
 * API calls → use src/services/productionApi.js (auto-attaches JWT from AsyncStorage).
 *
 * Information Architecture (§14.9 of production-planner-spec.md — 25 content screens):
 *   Dashboard (home) → bottom tab
 *   Imports: ImportOrders, ImportWip, ImportHistory
 *   Tracking: ProductionTracking (orders list), OrderDetail, JobCardDetail, AllPieces
 *   Planning: CapacityDashboard, NewOrderCalculator, WhatIfSimulator
 *   Inventory: DiamondMaster, DiamondLedger, MetalLedger, Requirements, PurchaseOrders
 *   Material Loss (4 tabs: Summary, By Stage, By Cell, By JobCard)
 *   Alerts
 *   Analytics
 *   Settings: StagesSettings, ColumnMaps, Calendar
 */

import React from 'react';
import { StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import CustomTabBar from '../components/common/CustomTabBar';
import TopNavbar from '../components/common/TopNavbar';

// ── Screens ───────────────────────────────────────────────────────────────────
import ProductionDashboardScreen from '../screens/Production/dashboard/ProductionDashboardScreen';
import ImportOrdersScreen        from '../screens/Production/imports/ImportOrdersScreen';
import ImportWipScreen           from '../screens/Production/imports/ImportWipScreen';
import ImportHistoryScreen       from '../screens/Production/imports/ImportHistoryScreen';
import OrdersTrackingScreen      from '../screens/Production/tracking/OrdersTrackingScreen';
import OrderDetailScreen         from '../screens/Production/tracking/OrderDetailScreen';
import JobCardDetailScreen       from '../screens/Production/tracking/JobCardDetailScreen';
import AllPiecesScreen           from '../screens/Production/tracking/AllPiecesScreen';
import CapacityDashboardScreen   from '../screens/Production/planning/CapacityDashboardScreen';
import NewOrderCalculatorScreen  from '../screens/Production/planning/NewOrderCalculatorScreen';
import WhatIfSimulatorScreen     from '../screens/Production/planning/WhatIfSimulatorScreen';
import DiamondMasterScreen       from '../screens/Production/inventory/DiamondMasterScreen';
import DiamondLedgerScreen       from '../screens/Production/inventory/DiamondLedgerScreen';
import MetalLedgerScreen         from '../screens/Production/inventory/MetalLedgerScreen';
import RequirementsScreen        from '../screens/Production/inventory/RequirementsScreen';
import PurchaseOrdersScreen      from '../screens/Production/inventory/PurchaseOrdersScreen';
import AlertsScreen              from '../screens/Production/AlertsScreen';
import MaterialLossScreen        from '../screens/Production/MaterialLossScreen';
import AnalyticsScreen           from '../screens/Production/AnalyticsScreen';
import StagesSettingsScreen      from '../screens/Production/settings/StagesSettingsScreen';
import ColumnMapsScreen          from '../screens/Production/settings/ColumnMapsScreen';
import CalendarScreen            from '../screens/Production/settings/CalendarScreen';
import AppsSelectionScreen       from '../screens/AppSelection/AppSelectionScreen';


const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// ── Tab-root navbar wrappers ───────────────────────────────────────────────────
// TopNavbar (Chandra header) shows ONLY on the 5 bottom-tab root screens.
// Quick-action sub-screens pushed within any tab stack get the native React
// Navigation header (teal bar + back arrow + title) instead — no TopNavbar.
const withTabNavbar = (Screen) => (props) => (
  // SafeAreaView edges={['top']} reserves the status-bar height.
  // backgroundColor: colors.primary makes that reserved area teal on iOS
  // (iOS status bar is transparent — whatever is beneath it shows through).
  // The explicit <StatusBar> component ensures Android also gets a teal
  // status bar on every tab switch (React Navigation screenOptions inheritance
  // is not always reliable across tab changes).
  <SafeAreaView style={{ flex: 1, backgroundColor: colors.primary }} edges={['top']}>
    <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
    <TopNavbar navigation={props.navigation} />
    <Screen {...props} />
  </SafeAreaView>
);

const DashboardRoot = withTabNavbar(ProductionDashboardScreen);
const TrackingRoot  = withTabNavbar(OrdersTrackingScreen);
const ImportsRoot   = withTabNavbar(ImportOrdersScreen);
const PlanningRoot  = withTabNavbar(CapacityDashboardScreen);
const InventoryRoot = withTabNavbar(DiamondMasterScreen);

// ── Shared header defaults ────────────────────────────────────────────────────
const HEADER_OPTS = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: '#ffffff',
  headerTitleStyle: { fontFamily: fonts.bold, fontSize: fonts.base },
  headerBackButtonDisplayMode: 'minimal',
  // Android: paint the status bar the same dark-teal so header + status bar are seamless
  statusBarColor: colors.primary,
  statusBarStyle: 'light',   // white battery/wifi icons on dark background
};

// ── Tab Screens (each is a mini-stack so deep links can push sub-screens) ────

const DashboardStack = () => (
  <Stack.Navigator screenOptions={HEADER_OPTS}>
    <Stack.Screen
      name="Production"
      component={DashboardRoot}
      options={{ headerShown: false, statusBarColor: colors.primary, statusBarStyle: 'light' }}
    />
    {/* quick-access screens launched from Dashboard */}
    <Stack.Screen name="CapacityDashboard"   component={CapacityDashboardScreen}  options={{ title: 'Capacity' }} />
    <Stack.Screen name="NewOrderCalculator"  component={NewOrderCalculatorScreen} options={{ title: 'Order Calculator' }} />
    <Stack.Screen name="WhatIfSimulator"     component={WhatIfSimulatorScreen}    options={{ title: 'What-If Simulator' }} />
    <Stack.Screen name="ProductionTracking"  component={OrdersTrackingScreen}     options={{ title: 'Orders' }} />
    <Stack.Screen name="OrderDetail"         component={OrderDetailScreen}        options={({ route }) => ({ title: route.params?.orderNumber || 'Order Detail' })} />
    <Stack.Screen name="JobCardDetail"       component={JobCardDetailScreen}      options={{ title: 'Job Card' }} />
    <Stack.Screen name="AllPieces"           component={AllPiecesScreen}          options={{ title: 'All Pieces' }} />
    <Stack.Screen name="DiamondMaster"       component={DiamondMasterScreen}      options={{ title: 'Diamonds' }} />
    <Stack.Screen name="DiamondLedger"       component={DiamondLedgerScreen}      options={{ title: 'Diamond Ledger' }} />
    <Stack.Screen name="MetalLedger"         component={MetalLedgerScreen}        options={{ title: 'Metal Ledger' }} />
    <Stack.Screen name="Requirements"        component={RequirementsScreen}       options={{ title: 'Requirements vs Stock' }} />
    <Stack.Screen name="PurchaseOrders"      component={PurchaseOrdersScreen}     options={{ title: 'Purchase Orders' }} />
    <Stack.Screen name="ProductionAlerts"    component={AlertsScreen}             options={{ title: 'Alerts' }} />
    <Stack.Screen name="MaterialLoss"        component={MaterialLossScreen}       options={{ title: 'Material Loss' }} />
    <Stack.Screen name="Analytics"           component={AnalyticsScreen}          options={{ title: 'Analytics' }} />
    <Stack.Screen name="ImportOrders"        component={ImportOrdersScreen}       options={{ title: 'Upload Orders' }} />
    <Stack.Screen name="ImportWip"           component={ImportWipScreen}          options={{ title: 'Upload WIP' }} />
    <Stack.Screen name="ImportHistory"       component={ImportHistoryScreen}      options={{ title: 'Import History' }} />
    <Stack.Screen name="StagesSettings"      component={StagesSettingsScreen}     options={{ title: 'Stages' }} />
    <Stack.Screen name="ColumnMaps"          component={ColumnMapsScreen}         options={{ title: 'Column Maps' }} />
    <Stack.Screen name="Calendar"            component={CalendarScreen}           options={{ title: 'Production Calendar' }} />
  </Stack.Navigator>
);

const TrackingStack = () => (
  <Stack.Navigator screenOptions={HEADER_OPTS}>
    <Stack.Screen name="TrackingOrders"   component={TrackingRoot}          options={{ headerShown: false, statusBarColor: colors.primary, statusBarStyle: 'light' }} />
    <Stack.Screen name="OrderDetail"      component={OrderDetailScreen}     options={({ route }) => ({ title: route.params?.orderNumber || 'Order Detail' })} />
    <Stack.Screen name="JobCardDetail"    component={JobCardDetailScreen}   options={{ title: 'Job Card' }} />
    <Stack.Screen name="AllPieces"        component={AllPiecesScreen}       options={{ title: 'All Pieces' }} />
  </Stack.Navigator>
);

const ImportsStack = () => (
  <Stack.Navigator screenOptions={HEADER_OPTS}>
    <Stack.Screen name="ImportsHome"   component={ImportsRoot}         options={{ headerShown: false, statusBarColor: colors.primary, statusBarStyle: 'light' }} />
    <Stack.Screen name="ImportOrders"  component={ImportOrdersScreen}  options={{ title: 'Upload Orders' }} />
    <Stack.Screen name="ImportWip"     component={ImportWipScreen}     options={{ title: 'Upload WIP' }} />
    <Stack.Screen name="ImportHistory" component={ImportHistoryScreen} options={{ title: 'Import History' }} />
  </Stack.Navigator>
);

const PlanningStack = () => (
  <Stack.Navigator screenOptions={HEADER_OPTS}>
    <Stack.Screen name="PlanningHome"        component={PlanningRoot}              options={{ headerShown: false, statusBarColor: colors.primary, statusBarStyle: 'light' }} />
    <Stack.Screen name="NewOrderCalculator"  component={NewOrderCalculatorScreen}  options={{ title: 'Order Calculator' }} />
    <Stack.Screen name="WhatIfSimulator"     component={WhatIfSimulatorScreen}     options={{ title: 'What-If Simulator' }} />
  </Stack.Navigator>
);

const InventoryStack = () => (
  <Stack.Navigator screenOptions={HEADER_OPTS}>
    <Stack.Screen name="InventoryHome"   component={InventoryRoot}        options={{ headerShown: false, statusBarColor: colors.primary, statusBarStyle: 'light' }} />
    <Stack.Screen name="DiamondLedger"   component={DiamondLedgerScreen}  options={{ title: 'Diamond Ledger' }} />
    <Stack.Screen name="MetalLedger"     component={MetalLedgerScreen}    options={{ title: 'Metal Ledger' }} />
    <Stack.Screen name="Requirements"    component={RequirementsScreen}   options={{ title: 'Requirements' }} />
    <Stack.Screen name="PurchaseOrders"  component={PurchaseOrdersScreen} options={{ title: 'Purchase Orders' }} />
    <Stack.Screen name="MaterialLoss"    component={MaterialLossScreen}   options={{ title: 'Material Loss' }} />
    <Stack.Screen name="JobCardDetail"   component={JobCardDetailScreen}  options={{ title: 'Job Card' }} />
  </Stack.Navigator>
);

// ── Main Tab Navigator ─────────────────────────────────────────────────────────
export const ProductionTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <CustomTabBar {...props} currentApp="production" />}
    screenOptions={{
      headerShown: false,
    }}
  >
    <Tab.Screen name="Dashboard" component={DashboardStack}  options={{ title: 'Dashboard' }} />
    <Tab.Screen name="Tracking"  component={TrackingStack}   options={{ title: 'Tracking' }} />
    <Tab.Screen name="Imports"   component={ImportsStack}    options={{ title: 'Imports' }} />
    <Tab.Screen name="Planning"  component={PlanningStack}   options={{ title: 'Planning' }} />
    <Tab.Screen name="Inventory" component={InventoryStack}  options={{ title: 'Inventory' }} />
  </Tab.Navigator>
);

// ── Shell: no safe-area edges here ────────────────────────────────────────────
// Top inset → handled inside withTabNavbar (tab root screens only).
// Left/right/bottom insets → handled by each individual screen's SafeAreaView.
// Quick-action sub-screens use React Navigation's native header, which manages
// the status bar itself — no extra top padding is added here.
const ProductionShell = () => (
  <SafeAreaView style={styles.shell} edges={[]}>
    <ProductionTabs />
  </SafeAreaView>
);

// ── Root Production Navigator ─────────────────────────────────────────────────
const ProductionNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, statusBarColor: colors.primary, statusBarStyle: 'light' }}>
    <Stack.Screen name="ProductionTabs" component={ProductionShell} />
    {/* Global deep-link screens accessible from any tab / push notification */}
    <Stack.Screen name="ProductionAlerts" component={AlertsScreen}           options={{ ...HEADER_OPTS, headerShown: true, title: 'Alerts' }} />
    <Stack.Screen name="Analytics"        component={AnalyticsScreen}        options={{ ...HEADER_OPTS, headerShown: true, title: 'Analytics' }} />
    <Stack.Screen name="MaterialLoss"     component={MaterialLossScreen}     options={{ ...HEADER_OPTS, headerShown: true, title: 'Material Loss' }} />
    <Stack.Screen name="StagesSettings"   component={StagesSettingsScreen}   options={{ ...HEADER_OPTS, headerShown: true, title: 'Stages' }} />
    <Stack.Screen name="ColumnMaps"       component={ColumnMapsScreen}       options={{ ...HEADER_OPTS, headerShown: true, title: 'Column Maps' }} />
    <Stack.Screen name="Calendar"         component={CalendarScreen}         options={{ ...HEADER_OPTS, headerShown: true, title: 'Production Calendar' }} />
    <Stack.Screen name="DiamondLedger"    component={DiamondLedgerScreen}    options={{ ...HEADER_OPTS, headerShown: true, title: 'Diamond Ledger' }} />
    <Stack.Screen name="MetalLedger"      component={MetalLedgerScreen}      options={{ ...HEADER_OPTS, headerShown: true, title: 'Metal Ledger' }} />
  </Stack.Navigator>
);

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

export default ProductionNavigator;

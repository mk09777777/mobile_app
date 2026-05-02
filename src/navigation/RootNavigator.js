import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/Auth/LoginScreen';
import AppSelectionScreen from '../screens/AppSelection/AppSelectionScreen';
import StackNavigator from './StackNavigator';
import App2Navigator from './App2Navigator';

const Root = createStackNavigator();

/**
 * RootNavigator — the single top-level navigator inside NavigationContainer.
 *
 * Flow:
 *
 *   Not authenticated
 *     └── Login  (email + password → existing backend)
 *
 *   Authenticated  ← React Navigation switches here automatically after login
 *     ├── AppSelection  (always the entry point; user picks Custom or Catalog)
 *     ├── CustomApp     (existing internal app — StackNavigator)
 *     └── CatalogApp    (new client-facing app — App2Navigator)
 *
 * Auth is resolved HERE, before the user ever sees the selection screen.
 * Neither StackNavigator nor App2Navigator need to handle auth themselves.
 *
 * Session persistence:
 *   - On next launch, if the stored token is still valid, isAuthenticated is
 *     true immediately after splash, so the user lands straight on AppSelection
 *     without seeing the login screen again.
 *   - Logging out from either app sets isAuthenticated to false, which causes
 *     React Navigation to replace the stack with LoginScreen automatically.
 */
const RootNavigator = ({ isAuthenticated }) => {
  return (
    <Root.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        // ── Unauthenticated ────────────────────────────────────────────────
        // Single login screen for both Custom and Catalog apps.
        // After successful login isAuthenticated flips to true and React
        // Navigation automatically transitions to the AppSelection screen.
        <Root.Screen name="Login" component={LoginScreen} />
      ) : (
        // ── Authenticated ──────────────────────────────────────────────────
        <>
          {/* First screen after login and on every subsequent launch */}
          <Root.Screen name="AppSelection" component={AppSelectionScreen} />

          {/* Custom app — existing internal tool */}
          <Root.Screen name="CustomApp">
            {() => <StackNavigator isAuthenticated={isAuthenticated} />}
          </Root.Screen>

          {/* Catalog app — new client-facing app */}
          <Root.Screen name="CatalogApp" component={App2Navigator} />
        </>
      )}
    </Root.Navigator>
  );
};

export default RootNavigator;

/**
 * Chandra Jewellery Management App
 * A comprehensive React Native app for jewelry business management
 *
 * @format
 */
import React, { useState } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { store } from './src/store';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigator from './src/navigation';
import SplashScreen from './src/screens/VideoSplashScreen';
import { AnimatedLogoLoader, ErrorBoundary } from './src/components/common';
import { AlertProvider } from './src/context/AlertContext';
import UsersProvider from './src/components/providers/UsersProvider';
import PushNotificationsInitializer from './src/components/providers/PushNotificationsInitializer';
import SocketConnectionManager from './src/components/providers/SocketConnectionManager';
import ChatListSocketSync from './src/components/providers/ChatListSocketSync';
const AppContent = () => {
  const isDarkMode = useColorScheme() === 'dark';
  const { isLoading: authLoading } = useAuth();
  const [splashFinished, setSplashFinished] = useState(true);

  // Show splash screen first
  if (!splashFinished) {
    return <SplashScreen onAnimationFinish={() => setSplashFinished(true)} />;
  }

  // Wait for the auth token check to complete before rendering navigation.
  // This prevents a flash of the Login screen on launches where the token
  // is already stored (i.e. returning users who are still authenticated).
  if (authLoading) {
    return <AnimatedLogoLoader size={50} />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <UsersProvider>
          <AlertProvider>
            <PushNotificationsInitializer />
            <SocketConnectionManager />
            <ChatListSocketSync />
            <AppNavigator />
          </AlertProvider>
        </UsersProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
};

function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Provider>
  );
}

export default App;

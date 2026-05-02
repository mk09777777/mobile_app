import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import RootNavigator from './RootNavigator';
import { navigationRef } from './navigationRef';
import { processPendingNotification } from '../utils/notificationNavigation';

// Auth loading is already resolved in App.tsx before AppNavigator mounts,
// so isLoading will always be false here. We still read isAuthenticated so
// the notification handler can fire once the user is confirmed logged-in.
const AppNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();

  // Process any pending push notification once nav + auth are both ready
  useEffect(() => {
    if (!isLoading && isAuthenticated && navigationRef.isReady()) {
      const timer = setTimeout(() => {
        processPendingNotification();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated]);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        if (isAuthenticated) {
          setTimeout(() => {
            processPendingNotification();
          }, 2000);
        }
      }}
    >
      <RootNavigator isAuthenticated={isAuthenticated} />
    </NavigationContainer>
  );
};

export default AppNavigator;

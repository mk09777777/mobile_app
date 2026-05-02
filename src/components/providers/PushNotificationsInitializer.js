import { useEffect } from 'react';
import notifee from '@notifee/react-native';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { navigateFromNotification } from '../../utils/notificationNavigation';

const PushNotificationsInitializer = () => {
  usePushNotifications();

  // Handle background notification taps
  useEffect(() => {
    const unsubscribe = notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === 1) { // PRESS event - user tapped the notification
        // Convert notifee notification format to match expected format
        const notificationData = {
          data: detail.notification?.data || {},
        };
        navigateFromNotification(notificationData);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  return null;
};

export default PushNotificationsInitializer;


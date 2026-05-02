/**
 * @format
 */

import 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';
import { AppRegistry, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import { displayGroupedChatNotification } from './src/utils/chatNotificationGrouping';

// Suppress React Native Firebase deprecation warnings (they're harmless)
// These warnings are about migrating to modular API, but current API still works
if (__DEV__) {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const message = args[0]?.toString() || '';
    // Filter out Firebase deprecation warnings
    if (
      message.includes('This method is deprecated') &&
      message.includes('React Native Firebase') &&
      message.includes('modular SDK API')
    ) {
      return; // Suppress these warnings
    }
    originalWarn.apply(console, args);
  };
}

// Initialize Sentry with error handling (DISABLED for iOS due to C++ compilation errors)
// Sentry native SDK is disabled in iOS build, so we skip JS initialization too
if (false) { // Disabled - Sentry causes C++ compilation errors on iOS
  try {
    Sentry.init({
      dsn: 'https://3fd29e70ba7c23d9c9b6b246a292bf67@o4510333890920448.ingest.us.sentry.io/4510359398449152',
      enableInExpoDevelopment: false,
      debug: __DEV__,
      environment: __DEV__ ? 'development' : 'production',
      tracesSampleRate: 1.0,
    });
  } catch (error) {
    console.warn('Sentry initialization failed:', error?.message || error);
  }
}

// Background message handler - MUST be registered before AppRegistry
// This handles notifications when app is in background or killed state
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  try {
    // Log for debugging (works in release builds via logcat)
    // Use console.log (not __DEV__ check) so logs appear in release builds via logcat
    console.log('[FCM Background] ========================================');
    console.log('[FCM Background] Message received at:', new Date().toISOString());
    console.log('[FCM Background] Message ID:', remoteMessage?.messageId || 'unknown');
    console.log('[FCM Background] From:', remoteMessage?.from || 'unknown');
    console.log('[FCM Background] Sent Time:', remoteMessage?.sentTime || 'unknown');
    console.log('[FCM Background] Full message:', JSON.stringify(remoteMessage, null, 2));
    console.log('[FCM Background] Has notification field:', !!remoteMessage?.notification);
    console.log('[FCM Background] Has data field:', !!remoteMessage?.data);
    console.log('[FCM Background] Notification title:', remoteMessage?.notification?.title || remoteMessage?.data?.Title || remoteMessage?.data?.title || 'NONE');
    console.log('[FCM Background] Notification body:', remoteMessage?.notification?.body || remoteMessage?.data?.Body || remoteMessage?.data?.body || remoteMessage?.data?.message || 'NONE');
    console.log('[FCM Background] ========================================');
    
    // Display notification for background messages
    const notifee = require('@notifee/react-native').default;
    const { Platform } = require('react-native');
    const { AndroidImportance } = require('@notifee/react-native');
    
    // Create notification channel for Android (required for Android 8.0+)
    if (Platform.OS === 'android') {
      try {
        await notifee.createChannel({
          id: 'default',
          name: 'Default Channel',
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibration: true,
          visibility: 1, // VISIBILITY_PUBLIC - show on lock screen
          showBadge: true,
        });
        console.log('[FCM Background] Notification channel created/verified');
      } catch (channelError) {
        console.error('[FCM Background] Error creating channel:', channelError);
        // Continue anyway - channel might already exist
      }
    }
    
    // Extract notification content
    const title = remoteMessage?.notification?.title || 
                  remoteMessage?.data?.Title || 
                  remoteMessage?.data?.title ||
                  remoteMessage?.data?.senderName ||
                  '';
    const body = remoteMessage?.notification?.body || 
                 remoteMessage?.data?.Body || 
                 remoteMessage?.data?.body ||
                 remoteMessage?.data?.message || 
                 '';
    
    // Extract chatId early to determine if this is a chat notification
    const chatId = remoteMessage?.data?.chatId || 
                   remoteMessage?.data?.ChatId || 
                   remoteMessage?.data?.chat_id;
    
    // Check if this is a chat notification
    const notificationType = remoteMessage?.data?.type || remoteMessage?.data?.Type || 
                            remoteMessage?.data?.notificationType || remoteMessage?.data?.NotificationType;
    const isChatNotification = notificationType?.toLowerCase() === 'chat' || 
                               notificationType?.toLowerCase() === 'message' ||
                               notificationType?.toLowerCase() === 'chat_message' ||
                               !!chatId;
    
    // For chat notifications, we MUST have chatId and body, otherwise skip
    if (isChatNotification) {
      if (!chatId) {
        console.warn('[FCM Background] ⚠️ Chat notification but no chatId found - skipping');
        console.warn('[FCM Background] ⚠️ Data:', JSON.stringify(remoteMessage?.data || {}));
        return;
      }
      if (!body && !title) {
        console.warn('[FCM Background] ⚠️ Chat notification but no body or title - skipping');
        return;
      }
    } else {
      // For non-chat notifications, only display if we have content
      if (!title && !body) {
        console.warn('[FCM Background] ⚠️ No title or body found in message - cannot display notification');
        console.warn('[FCM Background] ⚠️ This usually means backend sent data-only payload without notification field');
        console.warn('[FCM Background] ⚠️ Check backend FCM payload format - should include "notification" field for Android');
        return;
      }
    }
    
    console.log('[FCM Background] ✅ Extracted notification content:', { 
      title, 
      body, 
      chatId, 
      isChatNotification,
      notificationType 
    });
    console.log('[FCM Background] Creating notification channel...');
    
    // Display notification
    console.log('[FCM Background] Displaying notification with Notifee...');
    let notificationId;
    
    if (isChatNotification) {
      // Use grouped notification for chat messages
      console.log('[FCM Background] Using grouped chat notification');
      notificationId = await displayGroupedChatNotification(title, body, remoteMessage?.data || {});
    } else {
      // Regular notification for non-chat messages
      notificationId = await notifee.displayNotification({
      id: `bg_${remoteMessage?.messageId || Date.now()}`, // Unique ID
      title,
      body,
      data: remoteMessage?.data || {},
      android: {
        channelId: 'default',
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
        sound: 'default',
        vibrationPattern: [300, 500],
        smallIcon: 'ic_launcher', // Small icon (left side) - shows in status bar
        largeIcon: 'ic_launcher', // Large icon (right side) - shows in expanded notification
        color: '#FF6B35', // Notification color
        autoCancel: true,
        ongoing: false,
        visibility: 1, // VISIBILITY_PUBLIC - show on lock screen
        showTimestamp: true,
        timestamp: remoteMessage?.sentTime || Date.now(),
        onlyAlertOnce: false,
      },
      ios: {
        sound: 'default',
        badge: true,
      },
    });
    }
    
    console.log('[FCM Background] ✅ Notification displayed successfully!');
    console.log('[FCM Background] Notification ID:', notificationId);
    console.log('[FCM Background] Title:', title);
    console.log('[FCM Background] Body:', body);
    console.log('[FCM Background] ========================================');
    
    // Verify notification was actually created (Android only)
    if (Platform.OS === 'android') {
      try {
        const allNotifications = await notifee.getDisplayedNotifications();
        const found = allNotifications.find(n => n.id === notificationId);
        if (found) {
          console.log('[FCM Background] ✅ Notification verified in system notifications');
        } else {
          console.warn('[FCM Background] ⚠️ Notification created but not found in system - check device notification settings');
        }
      } catch (verifyError) {
        console.warn('[FCM Background] ⚠️ Could not verify notification:', verifyError?.message);
      }
    }
  } catch (error) {
    // Critical: Log errors so they can be seen in logcat even in release builds
    console.error('[FCM Background] ========================================');
    console.error('[FCM Background] ❌ ERROR handling background message');
    console.error('[FCM Background] Error message:', error?.message);
    console.error('[FCM Background] Error code:', error?.code);
    console.error('[FCM Background] Error stack:', error?.stack);
    console.error('[FCM Background] Message ID:', remoteMessage?.messageId);
    console.error('[FCM Background] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('[FCM Background] ========================================');
    // Re-throw to ensure Firebase knows there was an error
    throw error;
  }
});

AppRegistry.registerComponent(appName, () => App);

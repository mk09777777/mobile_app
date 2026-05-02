import { Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';

/**
 * Display a local notification
 * This function is used by real push notifications from the backend via FCM
 * The usePushNotifications hook calls this when receiving FCM messages
 */
export const displayLocalNotification = async (title, body, data = {}) => {
  try {
    // Create notification channel for Android
    if (Platform.OS === 'android') {
      const channelId = 'default';
      const channel = await notifee.getChannel(channelId);
      
      // Create channel if it doesn't exist or update it
      if (!channel) {
        await notifee.createChannel({
          id: channelId,
          name: 'Default Channel',
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibration: true,
          visibility: 1, // VISIBILITY_PUBLIC - show on lock screen
          showBadge: true,
        });
        if (__DEV__) {
          console.log('✅ Created notification channel:', channelId);
        }
      } else {
        if (__DEV__) {
          console.log('✅ Notification channel already exists:', channelId);
        }
      }
    }

    // Display notification with enhanced settings
    const notificationId = await notifee.displayNotification({
      id: `notif_${Date.now()}`, // Unique ID to prevent duplicates
      title: title || 'New Notification',
      body: body || '',
      data: data,
      android: {
        channelId: 'default',
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
        sound: 'default',
        vibrationPattern: [300, 500], // Vibrate pattern
        color: '#FF6B35', // Notification color
        autoCancel: true, // Auto cancel when tapped
        ongoing: false, // Not ongoing
        visibility: 1, // VISIBILITY_PUBLIC - show on lock screen
        showTimestamp: true, // Show timestamp
        timestamp: Date.now(),
        // Notification icons
        // smallIcon: Icon on the LEFT (status bar) - must be white/transparent
        // Use launcher icon as small icon (will be converted to monochrome by Android)
        smallIcon: 'ic_launcher', // Small icon (left side) - shows in status bar
        // largeIcon: Icon on the RIGHT (expanded notification) - can be colored
        largeIcon: 'ic_launcher', // Large icon (colored logo) - shows in expanded notification
        // Ensure notification shows even when app is in foreground
        onlyAlertOnce: false,
        // Use BigTextStyle for better visibility (requires text property)
        style: {
          type: 1, // BIGTEXT style
          text: body || '', // Required for BigTextStyle
        },
      },
      ios: {
        sound: 'default',
        badge: true,
      },
    });

    if (__DEV__) {
      console.log('✅ Local notification displayed:', { 
        title, 
        body, 
        notificationId,
        platform: Platform.OS,
      });
      console.log('📱 Notification should appear in notification tray');
      console.log('💡 TIP: If you don\'t see it, check:');
      console.log('   1. Pull down from top of screen to see notification tray');
      console.log('   2. Check device notification settings for this app');
      console.log('   3. Ensure "Show notifications" is enabled in app settings');
    }
    
    // On Android, also check if notification was actually created
    if (Platform.OS === 'android') {
      try {
        const allNotifications = await notifee.getDisplayedNotifications();
        const found = allNotifications.find(n => n.id === notificationId);
        if (found) {
          if (__DEV__) {
            console.log('✅ Notification confirmed in system:', found.id);
          }
        } else {
          if (__DEV__) {
            console.warn('⚠️ Notification created but not found in system notifications');
          }
        }
      } catch (checkError) {
        if (__DEV__) {
          console.warn('⚠️ Could not verify notification:', checkError);
        }
      }
    }
    
    return notificationId;
  } catch (error) {
    console.error('❌ Error displaying local notification:', error);
    console.error('❌ Error details:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    throw error;
  }
};

// Test notification functions removed - notifications now come from backend via FCM
// The displayLocalNotification function is kept for use by real push notifications


/**
 * Test utility for notification permission
 * Use this to reset and test the permission flow
 * 
 * Usage:
 * import { testNotificationPermission } from './utils/testNotificationPermission';
 * testNotificationPermission();
 */

import { resetFirstLaunch } from './firstLaunch';
import { requestPushPermission } from '../services/pushNotificationService';
import messaging, { AuthorizationStatus } from '@react-native-firebase/messaging';
import { Alert } from 'react-native';

/**
 * Reset first launch flag and request permission again
 * Useful for testing the permission flow
 */
export const testNotificationPermission = async () => {
  try {
    console.log('[Test] 🧪 Starting notification permission test...');
    
    // Reset first launch flag
    console.log('[Test] 🔄 Resetting first launch flag...');
    await resetFirstLaunch();
    console.log('[Test] ✅ First launch flag reset');
    
    // Check current permission status
    console.log('[Test] 🔍 Checking current permission status...');
    const currentStatus = await messaging().hasPermission();
    console.log('[Test] 📊 Current status:', currentStatus);
    
    const isGranted = currentStatus === AuthorizationStatus.AUTHORIZED || 
                     currentStatus === AuthorizationStatus.PROVISIONAL;
    
    if (isGranted) {
      Alert.alert(
        'Permission Already Granted',
        `Notification permission is already granted (status: ${currentStatus}).\n\nTo test the permission dialog, you need to:\n1. Go to Settings > Apps > Chandra Jewels > Notifications\n2. Disable notifications\n3. Restart the app`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Request permission
    console.log('[Test] 📞 Requesting permission...');
    Alert.alert(
      'Testing Permission',
      'About to request notification permission. The system dialog should appear now.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Permission',
          onPress: async () => {
            const granted = await requestPushPermission();
            if (granted) {
              Alert.alert('Success', 'Permission granted!');
            } else {
              Alert.alert('Denied', 'Permission was denied. You can enable it in Settings.');
            }
          },
        },
      ]
    );
  } catch (error) {
    console.error('[Test] ❌ Error testing permission:', error);
    Alert.alert('Error', `Failed to test permission: ${error.message}`);
  }
};

/**
 * Check current permission status
 */
export const checkPermissionStatus = async () => {
  try {
    const status = await messaging().hasPermission();
    const isGranted = status === AuthorizationStatus.AUTHORIZED || 
                     status === AuthorizationStatus.PROVISIONAL;
    
    const statusText = {
      [AuthorizationStatus.NOT_DETERMINED]: 'Not Determined',
      [AuthorizationStatus.DENIED]: 'Denied',
      [AuthorizationStatus.AUTHORIZED]: 'Authorized',
      [AuthorizationStatus.PROVISIONAL]: 'Provisional',
    }[status] || 'Unknown';
    
    console.log('[Test] 📊 Permission Status:', {
      status,
      statusText,
      isGranted,
    });
    
    return { status, statusText, isGranted };
  } catch (error) {
    console.error('[Test] ❌ Error checking status:', error);
    return { error: error.message };
  }
};


































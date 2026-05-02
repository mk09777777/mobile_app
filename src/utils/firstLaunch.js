import AsyncStorage from '@react-native-async-storage/async-storage';

const FIRST_LAUNCH_KEY = '@chandra_jewels_first_launch';

/**
 * Check if this is the first launch of the app
 * @returns {Promise<boolean>} True if first launch, false otherwise
 */
export const isFirstLaunch = async () => {
  try {
    const value = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    return value === null;
  } catch (error) {
    console.error('Error checking first launch:', error);
    // If we can't check, assume it's not first launch to avoid repeated prompts
    return false;
  }
};

/**
 * Mark that the app has been launched (not first launch anymore)
 * @returns {Promise<void>}
 */
export const markFirstLaunchComplete = async () => {
  try {
    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'false');
  } catch (error) {
    console.error('Error marking first launch complete:', error);
  }
};

/**
 * Reset first launch status (useful for testing)
 * @returns {Promise<void>}
 */
export const resetFirstLaunch = async () => {
  try {
    await AsyncStorage.removeItem(FIRST_LAUNCH_KEY);
  } catch (error) {
    console.error('Error resetting first launch:', error);
  }
};


































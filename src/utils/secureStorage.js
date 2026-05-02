/**
 * Secure Storage Utility
 * 
 * Provides a secure storage solution using react-native-keychain for sensitive data (tokens, user data)
 * while maintaining AsyncStorage-compatible API for seamless migration.
 * 
 * Features:
 * - Uses iOS Keychain and Android Keystore for secure storage
 * - Automatically migrates existing AsyncStorage data to secure storage
 * - Falls back to AsyncStorage if keychain is unavailable
 * - Maintains AsyncStorage API compatibility
 */

import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Keys that should be stored securely
const SECURE_KEYS = ['token', 'user'];

// Migration flag key (stored in AsyncStorage, not secure storage)
const MIGRATION_FLAG_KEY = '@secure_storage_migrated';

/**
 * Check if a key should be stored securely
 */
const isSecureKey = (key) => {
  return SECURE_KEYS.includes(key);
};

/**
 * Get service name for keychain (iOS requires a service name)
 */
const getServiceName = (key) => {
  return `com.chandrajewellery.${key}`;
};

/**
 * Migrate existing AsyncStorage data to secure storage
 * This runs once on first app launch after update
 */
const migrateToSecureStorage = async () => {
  try {
    // Check if migration has already been done
    const migrated = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
    if (migrated === 'true') {
      return;
    }

    // Migrate each secure key
    for (const key of SECURE_KEYS) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          // Store in secure storage
          await Keychain.setGenericPassword(key, value, {
            service: getServiceName(key),
            accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
          });
          
          if (__DEV__) {
            console.log(`✅ Migrated ${key} to secure storage`);
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.warn(`⚠️ Failed to migrate ${key} to secure storage:`, error);
        }
        // Continue with other keys even if one fails
      }
    }

    // Mark migration as complete
    await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    
    if (__DEV__) {
      console.log('✅ Secure storage migration completed');
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('⚠️ Secure storage migration error:', error);
    }
    // Don't throw - allow app to continue with AsyncStorage fallback
  }
};

/**
 * Secure Storage API (AsyncStorage-compatible)
 */
const secureStorage = {
  /**
   * Get item from secure storage or AsyncStorage
   */
  getItem: async (key) => {
    try {
      // Ensure migration has been attempted
      await migrateToSecureStorage();

      if (isSecureKey(key)) {
        try {
          // Try to get from secure storage
          const credentials = await Keychain.getGenericPassword({
            service: getServiceName(key),
          });
          
          if (credentials && credentials.password) {
            if (__DEV__) {
              console.log(`🔐 [SECURE STORAGE] Retrieved ${key} from Keychain/Keystore`);
            }
            return credentials.password;
          }
          
          // Fallback to AsyncStorage if not in secure storage
          const asyncValue = await AsyncStorage.getItem(key);
          if (asyncValue && __DEV__) {
            console.warn(`⚠️ [SECURE STORAGE] ${key} not found in Keychain, using AsyncStorage fallback`);
          }
          return asyncValue;
        } catch (error) {
          if (__DEV__) {
            console.warn(`⚠️ Failed to get ${key} from secure storage, falling back to AsyncStorage:`, error);
          }
          // Fallback to AsyncStorage
          return await AsyncStorage.getItem(key);
        }
      } else {
        // Non-secure keys use AsyncStorage
        return await AsyncStorage.getItem(key);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn(`⚠️ Error getting ${key}:`, error);
      }
      // Fallback to AsyncStorage
      return await AsyncStorage.getItem(key);
    }
  },

  /**
   * Set item in secure storage or AsyncStorage
   */
  setItem: async (key, value) => {
    try {
      if (isSecureKey(key)) {
        try {
          // Store in secure storage
          await Keychain.setGenericPassword(key, value, {
            service: getServiceName(key),
            accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
          });
          
          // Verify it was stored successfully
          const verifyCredentials = await Keychain.getGenericPassword({
            service: getServiceName(key),
          });
          
          if (verifyCredentials && verifyCredentials.password === value) {
            if (__DEV__) {
              console.log(`✅ [SECURE STORAGE] Successfully stored ${key} in Keychain/Keystore`);
              console.log(`   Service: ${getServiceName(key)}`);
              console.log(`   Value preview: ${value.substring(0, 30)}...`);
            }
          } else {
            if (__DEV__) {
              console.warn(`⚠️ [SECURE STORAGE] Verification failed for ${key} - stored but couldn't verify`);
            }
          }
          
          // Also keep in AsyncStorage for backward compatibility during transition
          // This ensures existing code continues to work
          await AsyncStorage.setItem(key, value);
        } catch (error) {
          if (__DEV__) {
            console.warn(`⚠️ Failed to store ${key} in secure storage, using AsyncStorage:`, error);
          }
          // Fallback to AsyncStorage
          await AsyncStorage.setItem(key, value);
        }
      } else {
        // Non-secure keys use AsyncStorage
        await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn(`⚠️ Error setting ${key}:`, error);
      }
      // Fallback to AsyncStorage
      await AsyncStorage.setItem(key, value);
    }
  },

  /**
   * Remove item from secure storage and AsyncStorage
   */
  removeItem: async (key) => {
    try {
      if (isSecureKey(key)) {
        try {
          // Remove from secure storage
          await Keychain.resetGenericPassword({
            service: getServiceName(key),
          });
        } catch (error) {
          if (__DEV__) {
            console.warn(`⚠️ Failed to remove ${key} from secure storage:`, error);
          }
        }
      }
      
      // Always remove from AsyncStorage (for cleanup and fallback)
      await AsyncStorage.removeItem(key);
      
      if (__DEV__) {
        console.log(`✅ Removed ${key} from storage`);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn(`⚠️ Error removing ${key}:`, error);
      }
      // Still try AsyncStorage as fallback
      try {
        await AsyncStorage.removeItem(key);
      } catch (fallbackError) {
        // Ignore fallback errors
      }
    }
  },

  /**
   * Clear all secure storage (for logout)
   */
  clear: async () => {
    try {
      // Clear all secure keys
      for (const key of SECURE_KEYS) {
        try {
          await Keychain.resetGenericPassword({
            service: getServiceName(key),
          });
        } catch (error) {
          // Continue even if one fails
        }
      }
      
      // Clear AsyncStorage as well
      await AsyncStorage.clear();
    } catch (error) {
      if (__DEV__) {
        console.warn('⚠️ Error clearing secure storage:', error);
      }
    }
  },

  /**
   * Get all keys (for debugging)
   */
  getAllKeys: async () => {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      if (__DEV__) {
        console.warn('⚠️ Error getting all keys:', error);
      }
      return [];
    }
  },

  /**
   * Multi-get (for batch operations)
   */
  multiGet: async (keys) => {
    try {
      return await AsyncStorage.multiGet(keys);
    } catch (error) {
      if (__DEV__) {
        console.warn('⚠️ Error in multiGet:', error);
      }
      return [];
    }
  },

  /**
   * Multi-set (for batch operations)
   */
  multiSet: async (keyValuePairs) => {
    try {
      // Handle secure keys separately
      const securePairs = [];
      const asyncPairs = [];
      
      for (const [key, value] of keyValuePairs) {
        if (isSecureKey(key)) {
          securePairs.push([key, value]);
        } else {
          asyncPairs.push([key, value]);
        }
      }
      
      // Store secure keys
      for (const [key, value] of securePairs) {
        await secureStorage.setItem(key, value);
      }
      
      // Store async keys
      if (asyncPairs.length > 0) {
        await AsyncStorage.multiSet(asyncPairs);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('⚠️ Error in multiSet:', error);
      }
    }
  },

  /**
   * Multi-remove (for batch operations)
   */
  multiRemove: async (keys) => {
    try {
      // Remove secure keys
      for (const key of keys) {
        if (isSecureKey(key)) {
          await secureStorage.removeItem(key);
        }
      }
      
      // Remove async keys
      const asyncKeys = keys.filter(key => !isSecureKey(key));
      if (asyncKeys.length > 0) {
        await AsyncStorage.multiRemove(asyncKeys);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('⚠️ Error in multiRemove:', error);
      }
    }
  },

  /**
   * Verify if a key is stored in secure storage (Keychain/Keystore)
   * Returns: { isSecure: boolean, location: 'keychain' | 'asyncStorage' | 'none', error?: string }
   */
  verifyStorage: async (key) => {
    try {
      if (!isSecureKey(key)) {
        return {
          isSecure: false,
          location: 'asyncStorage',
          message: `${key} is not a secure key, using AsyncStorage`,
        };
      }

      // Check if it exists in Keychain
      try {
        const credentials = await Keychain.getGenericPassword({
          service: getServiceName(key),
        });
        
        if (credentials && credentials.password) {
          return {
            isSecure: true,
            location: 'keychain',
            message: `✅ ${key} is securely stored in Keychain/Keystore`,
            service: getServiceName(key),
          };
        }
      } catch (keychainError) {
        // Keychain error - might not be available or key doesn't exist
      }

      // Check if it exists in AsyncStorage
      const asyncValue = await AsyncStorage.getItem(key);
      if (asyncValue) {
        return {
          isSecure: false,
          location: 'asyncStorage',
          message: `⚠️ ${key} found in AsyncStorage (not secure)`,
          warning: 'Token should be migrated to secure storage',
        };
      }

      return {
        isSecure: false,
        location: 'none',
        message: `❌ ${key} not found in any storage`,
      };
    } catch (error) {
      return {
        isSecure: false,
        location: 'error',
        message: `Error verifying ${key}: ${error.message}`,
        error: error.message,
      };
    }
  },

  /**
   * Get storage status for all secure keys
   */
  getStorageStatus: async () => {
    const status = {};
    for (const key of SECURE_KEYS) {
      status[key] = await secureStorage.verifyStorage(key);
    }
    return status;
  },
};

// Initialize migration on module load
migrateToSecureStorage().catch(() => {
  // Silent fail - migration will retry on next access
});

export default secureStorage;


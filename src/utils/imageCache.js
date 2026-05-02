import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Image Cache Utility
 * 
 * Caches image URLs and data URIs to avoid re-fetching images on every render.
 * Uses AsyncStorage for persistence across app sessions.
 */

const CACHE_PREFIX = '@image_cache_';
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE_SIZE_MB = 50; // Maximum cache size in MB

/**
 * Generate cache key from image URL
 */
const getCacheKey = (url) => {
  // Create a hash-like key from URL
  // Remove query params and use a simple hash
  const cleanUrl = url.split('?')[0];
  return `${CACHE_PREFIX}${cleanUrl.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100)}`;
};

/**
 * Check if cached image exists and is still valid
 */
export const getCachedImage = async (url) => {
  try {
    if (!url) return null;

    const cacheKey = getCacheKey(url);
    const cachedData = await AsyncStorage.getItem(cacheKey);

    if (!cachedData) {
      return null;
    }

    const parsed = JSON.parse(cachedData);
    const now = Date.now();

    // Check if cache is expired
    if (parsed.expiry && now > parsed.expiry) {
      // Remove expired cache
      await AsyncStorage.removeItem(cacheKey);
      return null;
    }

    return parsed.dataUri || parsed.url || null;
  } catch (error) {
    
    return null;
  }
};

/**
 * Cache an image URL or data URI
 */
/**
 * Remove one persistent cache entry (same key rules as cacheImage).
 */
export const removePersistentImageCache = async (url) => {
  try {
    if (!url) return;
    await AsyncStorage.removeItem(getCacheKey(url));
  } catch (error) {
    // ignore
  }
};

export const cacheImage = async (url, dataUri) => {
  try {
    if (!url || !dataUri) return;

    const cacheKey = getCacheKey(url);
    const cacheData = {
      url: url,
      dataUri: dataUri,
      cachedAt: Date.now(),
      expiry: Date.now() + CACHE_EXPIRY_MS,
    };

    await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));

    if (__DEV__) {
      console.log('✅ Image cached:', url.substring(0, 50) + '...');
    }
  } catch (error) {
    
  }
};

/**
 * Clear all cached images
 */
export const clearImageCache = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
      
    }
  } catch (error) {
    
  }
};

/**
 * Clear expired cache entries
 */
export const clearExpiredCache = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    const now = Date.now();
    let clearedCount = 0;

    for (const key of cacheKeys) {
      try {
        const cachedData = await AsyncStorage.getItem(key);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          if (parsed.expiry && now > parsed.expiry) {
            await AsyncStorage.removeItem(key);
            clearedCount++;
          }
        }
      } catch (e) {
        // Skip invalid entries
      }
    }

    
  } catch (error) {
    
  }
};

/**
 * Get cache size estimate (approximate)
 */
export const getCacheSize = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    let totalSize = 0;

    for (const key of cacheKeys) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          // Rough estimate: each character is ~1 byte, JSON overhead
          totalSize += value.length;
        }
      } catch (e) {
        // Skip
      }
    }

    return {
      count: cacheKeys.length,
      sizeMB: (totalSize / (1024 * 1024)).toFixed(2),
    };
  } catch (error) {
    
    return { count: 0, sizeMB: '0' };
  }
};


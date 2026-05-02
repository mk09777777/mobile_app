/**
 * In-Memory Image Cache
 * Stores image data URIs in memory to prevent reloading on scroll
 */

const imageCache = new Map();

/**
 * Get cached image data URI
 */
export const getCachedImageData = (url) => {
  if (!url) return null;
  return imageCache.get(url) || null;
};

/**
 * Cache image data URI
 */
export const cacheImageData = (url, dataUri) => {
  if (!url || !dataUri) return;
  imageCache.set(url, dataUri);
  
  // Limit cache size to prevent memory issues (keep last 100 images)
  if (imageCache.size > 100) {
    const firstKey = imageCache.keys().next().value;
    imageCache.delete(firstKey);
  }
};

/**
 * Clear all cached images
 */
export const clearImageMemoryCache = () => {
  imageCache.clear();
};

/**
 * Remove specific image from cache
 */
export const removeCachedImage = (url) => {
  if (url) {
    imageCache.delete(url);
  }
};


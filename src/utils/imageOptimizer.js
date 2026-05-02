/**
 * Image Optimizer Utility
 * 
 * Provides utilities for optimizing image URLs and sizes
 * This is SAFE and NON-BREAKING - doesn't modify existing behavior
 * 
 * Features:
 * - Add query parameters for size optimization
 * - Generate thumbnail URLs
 * - Validate image URLs
 */

/**
 * Add size parameters to image URL (if supported by backend)
 * This helps reduce bandwidth by requesting smaller images
 * 
 * @param {string} url - Original image URL
 * @param {object} options - Size options
 * @param {number} options.width - Desired width
 * @param {number} options.height - Desired height
 * @param {number} options.quality - Quality (1-100)
 * @returns {string} - Optimized URL
 */
export const optimizeImageUrl = (url, options = {}) => {
  if (!url || typeof url !== 'string') {
    return url;
  }

  // If it's a local asset, return as-is
  if (url.startsWith('file://') || url.startsWith('asset://') || url.startsWith('/')) {
    return url;
  }

  // If URL already has query params, append to them
  const separator = url.includes('?') ? '&' : '?';
  const params = [];

  if (options.width) {
    params.push(`w=${options.width}`);
  }
  if (options.height) {
    params.push(`h=${options.height}`);
  }
  if (options.quality) {
    params.push(`q=${Math.min(100, Math.max(1, options.quality))}`);
  }

  // Only add params if we have any
  if (params.length === 0) {
    return url;
  }

  return `${url}${separator}${params.join('&')}`;
};

/**
 * Generate thumbnail URL from full image URL
 * Assumes backend supports thumbnail generation via query params
 * 
 * @param {string} url - Full image URL
 * @param {number} size - Thumbnail size (default: 200)
 * @returns {string} - Thumbnail URL
 */
export const getThumbnailUrl = (url, size = 200) => {
  return optimizeImageUrl(url, {
    width: size,
    height: size,
    quality: 75,
  });
};

/**
 * Get optimized image URL based on container size
 * Helps reduce bandwidth by requesting appropriately sized images
 * 
 * @param {string} url - Original image URL
 * @param {object} containerSize - Container dimensions
 * @param {number} containerSize.width - Container width
 * @param {number} containerSize.height - Container height
 * @param {number} scale - Device pixel ratio (default: 2)
 * @returns {string} - Optimized URL
 */
export const getOptimizedImageUrl = (url, containerSize, scale = 2) => {
  if (!containerSize || !containerSize.width || !containerSize.height) {
    return url;
  }

  return optimizeImageUrl(url, {
    width: Math.ceil(containerSize.width * scale),
    height: Math.ceil(containerSize.height * scale),
    quality: 85,
  });
};

/**
 * Validate image URL
 * 
 * @param {string} url - Image URL to validate
 * @returns {boolean} - True if URL is valid
 */
export const isValidImageUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Check if it's a valid URL or local path
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return true;
  }

  if (url.startsWith('file://') || url.startsWith('asset://')) {
    return true;
  }

  // Check for common image extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  return imageExtensions.some(ext => url.toLowerCase().includes(ext));
};

/**
 * Get image dimensions from URL (if available)
 * This is a placeholder - actual implementation would need backend support
 * 
 * @param {string} url - Image URL
 * @returns {Promise<{width: number, height: number} | null>}
 */
export const getImageDimensions = async (url) => {
  // This would typically require:
  // 1. Backend API endpoint that returns image metadata
  // 2. Or loading image and reading dimensions
  // For now, return null (can be implemented later)
  return null;
};


































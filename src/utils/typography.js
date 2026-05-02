/**
 * Typography Utilities
 * 
 * Helper functions for consistent typography usage across the app.
 * Use these utilities instead of hardcoded font values.
 */

import { fonts } from '../constants/fonts';

/**
 * Get typography style for a given variant
 * @param {string} variant - Typography variant (h1, h2, h3, h4, body, caption, label, etc.)
 * @param {object} overrides - Style overrides (color, fontSize, etc.)
 * @returns {object} Style object
 */
export const getTypographyStyle = (variant = 'body', overrides = {}) => {
  const baseStyle = fonts.typography[variant] || fonts.typography.body;
  return {
    ...baseStyle,
    ...overrides,
  };
};

/**
 * Get font size for a given size name
 * @param {string} size - Size name (xs, sm, base, lg, xl, 2xl, 3xl, 4xl)
 * @returns {number} Font size in pixels
 */
export const getFontSize = (size = 'base') => {
  return fonts[size] || fonts.base;
};

/**
 * Get font family for a given weight
 * @param {string} weight - Weight name (regular, medium, bold, light, black)
 * @returns {string} Font family name
 */
export const getFontFamily = (weight = 'regular') => {
  return fonts[weight] || fonts.regular;
};

/**
 * Convert fontWeight to fontFamily
 * Useful when migrating from fontWeight to fontFamily
 * @param {string|number} fontWeight - Standard fontWeight value ('bold', '500', 700, etc.)
 * @returns {string} Font family name
 */
export const fontWeightToFamily = (fontWeight) => {
  const weightStr = String(fontWeight).toLowerCase();
  return fonts.weight[weightStr] || fonts.regular;
};

/**
 * Get line height for a given font size and type
 * @param {number} fontSize - Font size in pixels
 * @param {string} type - Line height type ('tight', 'normal', 'relaxed')
 * @returns {number} Line height in pixels
 */
export const getLineHeight = (fontSize, type = 'normal') => {
  const multiplier = fonts.lineHeight[type] || fonts.lineHeight.normal;
  return Math.round(fontSize * multiplier);
};

/**
 * Common typography styles ready to use
 */
export const typography = {
  // Headings
  h1: fonts.typography.h1,
  h2: fonts.typography.h2,
  h3: fonts.typography.h3,
  h4: fonts.typography.h4,
  
  // Body text
  body: fonts.typography.body,
  bodyLarge: fonts.typography.bodyLarge,
  bodySmall: fonts.typography.bodySmall,
  
  // Labels and captions
  label: fonts.typography.label,
  caption: fonts.typography.caption,
  
  // Special cases
  button: fonts.typography.button,
  badge: fonts.typography.badge,
  input: fonts.typography.input,
};

/**
 * Helper to create consistent text styles
 * @param {object} options - Style options
 * @param {string} options.size - Font size (xs, sm, base, lg, xl, 2xl, 3xl, 4xl)
 * @param {string} options.weight - Font weight (regular, medium, bold, light, black)
 * @param {string} options.lineHeight - Line height type (tight, normal, relaxed)
 * @param {string} options.color - Text color (optional)
 * @returns {object} Complete style object
 */
export const createTextStyle = ({
  size = 'base',
  weight = 'regular',
  lineHeight = 'normal',
  color = null,
} = {}) => {
  const fontSize = getFontSize(size);
  const fontFamily = getFontFamily(weight);
  const lineHeightValue = getLineHeight(fontSize, lineHeight);
  
  return {
    fontSize,
    fontFamily,
    lineHeight: lineHeightValue,
    ...(color && { color }),
  };
};


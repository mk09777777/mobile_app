import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions (iPhone X as reference)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// Screen size breakpoints
export const BREAKPOINTS = {
  small: 320,   // iPhone SE, small Android phones
  medium: 375,  // iPhone X, standard phones
  large: 414,   // iPhone Plus, large phones
  xlarge: 768,   // Small tablets
};

// Device type detection
export const getDeviceType = () => {
  if (SCREEN_WIDTH <= BREAKPOINTS.small) return 'small';
  if (SCREEN_WIDTH <= BREAKPOINTS.medium) return 'medium';
  if (SCREEN_WIDTH <= BREAKPOINTS.large) return 'large';
  return 'xlarge';
};

// Responsive scaling functions
export const scale = (size) => {
  return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

export const verticalScale = (size) => {
  return (SCREEN_HEIGHT / BASE_HEIGHT) * size;
};

export const moderateScale = (size, factor = 0.5) => {
  return size + (scale(size) - size) * factor;
};

// Font scaling with limits
export const scaleFont = (size) => {
  const scaledSize = scale(size);
  const maxSize = size * 1.3; // Max 30% increase
  const minSize = size * 0.8;  // Min 20% decrease
  return Math.max(minSize, Math.min(maxSize, scaledSize));
};

// Responsive dimensions
export const responsiveDimensions = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isSmallScreen: SCREEN_WIDTH <= BREAKPOINTS.small,
  isMediumScreen: SCREEN_WIDTH > BREAKPOINTS.small && SCREEN_WIDTH <= BREAKPOINTS.medium,
  isLargeScreen: SCREEN_WIDTH > BREAKPOINTS.medium && SCREEN_WIDTH <= BREAKPOINTS.large,
  isXLargeScreen: SCREEN_WIDTH > BREAKPOINTS.large,
};

// Responsive spacing
export const spacing = {
  xs: scale(4),
  sm: scale(8),
  md: scale(16),
  lg: scale(24),
  xl: scale(32),
  xxl: scale(48),
};

// Responsive image sizes
export const imageSizes = {
  small: scale(60),
  medium: scale(100),
  large: scale(150),
  xlarge: scale(200),
  // Responsive based on screen width
  avatar: SCREEN_WIDTH * 0.12, // 12% of screen width
  cardImage: SCREEN_WIDTH * 0.25, // 25% of screen width
  bannerImage: SCREEN_WIDTH * 0.9, // 90% of screen width
};

// Responsive font sizes
export const responsiveFonts = {
  xs: scaleFont(12),
  sm: scaleFont(14),
  base: scaleFont(16),
  lg: scaleFont(18),
  xl: scaleFont(20),
  '2xl': scaleFont(24),
  '3xl': scaleFont(30),
  '4xl': scaleFont(36),
};

// Responsive padding/margin
export const responsivePadding = {
  xs: scale(4),
  sm: scale(8),
  md: scale(16),
  lg: scale(24),
  xl: scale(32),
  // Screen-based padding
  screenHorizontal: SCREEN_WIDTH * 0.05, // 5% of screen width
  screenVertical: SCREEN_HEIGHT * 0.02, // 2% of screen height
};

// Responsive border radius
export const borderRadius = {
  sm: scale(4),
  md: scale(8),
  lg: scale(12),
  xl: scale(16),
  full: scale(999),
};

// Helper function to get responsive value based on device type
export const getResponsiveValue = (values) => {
  const deviceType = getDeviceType();
  return values[deviceType] || values.medium || values.default;
};

// Example usage:
// getResponsiveValue({
//   small: 12,
//   medium: 16,
//   large: 20,
//   default: 16
// })

export default {
  scale,
  verticalScale,
  moderateScale,
  scaleFont,
  responsiveDimensions,
  spacing,
  imageSizes,
  responsiveFonts,
  responsivePadding,
  borderRadius,
  getResponsiveValue,
  BREAKPOINTS,
  getDeviceType,
};

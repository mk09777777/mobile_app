import { responsiveFonts } from '../utils/responsive';

/**
 * Centralized Font System
 * 
 * This file provides a consistent typography system for the entire application.
 * All components should use these font definitions instead of hardcoded values.
 * 
 * Usage:
 * - Import: import { fonts } from '../constants/fonts';
 * - Use: fontSize: fonts.sm, fontFamily: fonts.medium
 */

export const fonts = {
  // ==================== FONT FAMILIES ====================
  // Avenir font family (without .otf extension)
  regular: 'AvenirLTStd-Roman',      // Default body text
  medium: 'AvenirLTStd-Medium',      // Medium weight (semi-bold)
  bold: 'AvenirLTStd-Heavy',         // Bold headings
  light: 'AvenirLTStd-Light',        // Light weight
  black: 'AvenirLTStd-Black',        // Extra bold
  book: 'AvenirLTStd-Book',          // Book weight (lighter than regular)

  // Montserrat (optional; add .ttf files under src/assets/fonts and run `npx react-native-asset`)
  // Expected file names (examples):
  // - Montserrat-Bold.ttf      -> "Montserrat-Bold"
  // - Montserrat-SemiBold.ttf  -> "Montserrat-SemiBold"
  // - Montserrat-Medium.ttf    -> "Montserrat-Medium"
  // - Montserrat-Regular.ttf   -> "Montserrat-Regular"
  montserratRegular: 'Montserrat-Regular',
  montserratMedium: 'Montserrat-Medium',
  montserratSemiBold: 'Montserrat-SemiBold',
  montserratBold: 'Montserrat-Bold',
  
  // ==================== FONT SIZES ====================
  // Responsive font sizes (scaled based on device)
  xs: responsiveFonts.xs,            // 12px - Extra small (captions, labels)
  sm: responsiveFonts.sm,            // 14px - Small (secondary text, badges)
  base: responsiveFonts.base,        // 16px - Base (body text, default)
  lg: responsiveFonts.lg,            // 18px - Large (subheadings)
  xl: responsiveFonts.xl,            // 20px - Extra large (section titles)
  '2xl': responsiveFonts['2xl'],     // 24px - 2X Large (h3 headings)
  '3xl': responsiveFonts['3xl'],    // 30px - 3X Large (h2 headings)
  '4xl': responsiveFonts['4xl'],     // 36px - 4X Large (h1 headings)
  
  // ==================== LINE HEIGHTS ====================
  lineHeight: {
    tight: 1.2,    // For headings (compact)
    normal: 1.4,   // For body text (default)
    relaxed: 1.6,  // For long-form content (readable)
  },
  
  // ==================== TYPOGRAPHY PRESETS ====================
  // Pre-configured typography styles for common use cases
  typography: {
    // Headings
    h1: {
      fontSize: responsiveFonts['4xl'],
      fontFamily: 'AvenirLTStd-Heavy',
      lineHeight: Math.round(responsiveFonts['4xl'] * 1.2),
    },
    h2: {
      fontSize: responsiveFonts['3xl'],
      fontFamily: 'AvenirLTStd-Heavy',
      lineHeight: Math.round(responsiveFonts['3xl'] * 1.2),
    },
    h3: {
      fontSize: responsiveFonts['2xl'],
      fontFamily: 'AvenirLTStd-Heavy',
      lineHeight: Math.round(responsiveFonts['2xl'] * 1.2),
    },
    h4: {
      fontSize: responsiveFonts.xl,
      fontFamily: 'AvenirLTStd-Heavy',
      lineHeight: Math.round(responsiveFonts.xl * 1.2),
    },
    
    // Body text
    body: {
      fontSize: responsiveFonts.base,
      fontFamily: 'AvenirLTStd-Roman',
      lineHeight: Math.round(responsiveFonts.base * 1.4),
    },
    bodyLarge: {
      fontSize: responsiveFonts.lg,
      fontFamily: 'AvenirLTStd-Roman',
      lineHeight: Math.round(responsiveFonts.lg * 1.4),
    },
    bodySmall: {
      fontSize: responsiveFonts.sm,
      fontFamily: 'AvenirLTStd-Roman',
      lineHeight: Math.round(responsiveFonts.sm * 1.4),
    },
    
    // Labels and captions
    label: {
      fontSize: responsiveFonts.sm,
      fontFamily: 'AvenirLTStd-Medium',
      lineHeight: Math.round(responsiveFonts.sm * 1.4),
    },
    caption: {
      fontSize: responsiveFonts.xs,
      fontFamily: 'AvenirLTStd-Roman',
      lineHeight: Math.round(responsiveFonts.xs * 1.6),
    },
    
    // Special cases
    button: {
      fontSize: responsiveFonts.base,
      fontFamily: 'AvenirLTStd-Medium',
      lineHeight: Math.round(responsiveFonts.base * 1.2),
    },
    badge: {
      fontSize: responsiveFonts.xs,
      fontFamily: 'AvenirLTStd-Medium',
      lineHeight: Math.round(responsiveFonts.xs * 1.2),
    },
    input: {
      fontSize: responsiveFonts.base,
      fontFamily: 'AvenirLTStd-Roman',
      lineHeight: Math.round(responsiveFonts.base * 1.4),
    },
  },
  
  // ==================== FONT WEIGHT MAPPING ====================
  // Map standard fontWeight values to Avenir font families
  // Use this when you need to convert fontWeight to fontFamily
  weight: {
    '100': 'AvenirLTStd-Light',
    '300': 'AvenirLTStd-Light',
    '400': 'AvenirLTStd-Roman',
    '500': 'AvenirLTStd-Medium',
    '600': 'AvenirLTStd-Medium',
    '700': 'AvenirLTStd-Heavy',
    '800': 'AvenirLTStd-Heavy',
    '900': 'AvenirLTStd-Black',
    normal: 'AvenirLTStd-Roman',
    bold: 'AvenirLTStd-Heavy',
  },
};

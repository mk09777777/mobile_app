import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';

// Compute platform-friendly line-heights in pixels to avoid glyph clipping
const lhTight = (size) => Math.round(size * 1.2);
const lhNormal = (size) => Math.round(size * 1.35);
const lhRelaxed = (size) => Math.round(size * 1.5);

export const CustomText = ({
  children,
  variant = 'body',
  color = 'primary',
  style,
  ...props
}) => {
  const textStyle = [
    styles.text,
    styles[variant],
    styles[color],
    style,
  ];

  return (
    <Text style={textStyle} {...props}>
      {children}
    </Text>
  );
};

export const Heading = ({ children, level = 1, style, ...props }) => {
  const headingStyle = [
    styles.heading,
    styles[`h${level}`],
    style,
  ];

  return (
    <Text style={headingStyle} {...props}>
      {children}
    </Text>
  );
};

export const BodyText = ({ children, style, ...props }) => (
  <CustomText variant="body" style={style} {...props}>
    {children}
  </CustomText>
);

export const Caption = ({ children, style, ...props }) => (
  <CustomText variant="caption" style={style} {...props}>
    {children}
  </CustomText>
);

export const Label = ({ children, style, ...props }) => (
  <CustomText variant="label" style={style} {...props}>
    {children}
  </CustomText>
);

const styles = StyleSheet.create({
  text: {
    fontFamily: fonts.regular,
    // Prevent extra Android font padding and reduce clipping
    includeFontPadding: false,
  },
  
  // Variants
  heading: {
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  h1: {
    fontSize: fonts['4xl'],
    lineHeight: lhTight(fonts['4xl']),
  },
  h2: {
    fontSize: fonts['3xl'],
    lineHeight: lhTight(fonts['3xl']),
  },
  h3: {
    fontSize: fonts['2xl'],
    lineHeight: lhNormal(fonts['2xl']),
  },
  h4: {
    fontSize: fonts.xl,
    lineHeight: lhNormal(fonts.xl),
  },
  
  body: {
    fontSize: fonts.base,
    lineHeight: lhNormal(fonts.base),
    color: colors.textPrimary,
  },
  
  caption: {
    fontSize: fonts.sm,
    lineHeight: lhRelaxed(fonts.sm),
    color: colors.textSecondary,
  },
  
  label: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  
  // Colors
  primary: {
    color: colors.textPrimary,
  },
  secondary: {
    color: colors.textSecondary,
  },
  light: {
    color: colors.textLight,
  },
  white: {
    color: colors.textWhite,
  },
  success: {
    color: colors.success,
  },
  error: {
    color: colors.error,
  },
  warning: {
    color: colors.warning,
  },
  info: {
    color: colors.info,
  },
});

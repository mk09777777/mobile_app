import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from './Icon';

/**
 * Standardized Button Component
 * 
 * Provides consistent button sizes, widths, and styles across the app.
 * 
 * @param {string} title - Button text
 * @param {function} onPress - Press handler
 * @param {string} variant - Button style: 'primary', 'secondary', 'outline', 'danger', 'success', 'ghost'
 * @param {string} size - Button size: 'small', 'medium', 'large'
 * @param {string} width - Button width: 'auto', 'full', 'half'
 * @param {boolean} disabled - Disabled state
 * @param {boolean} loading - Loading state
 * @param {string} icon - Icon name (optional)
 * @param {string} iconPosition - Icon position: 'left', 'right' (default: 'left')
 * @param {object} style - Additional button styles
 * @param {object} textStyle - Additional text styles
 */
export const Button = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  width = 'auto',
  disabled = false,
  loading = false,
  icon = null,
  iconPosition = 'left',
  style,
  textStyle,
  ...props
}) => {
  const buttonStyle = [
    styles.button,
    styles[variant],
    styles[size],
    styles[`width_${width}`],
    disabled && styles.disabled,
    style,
  ];

  const buttonTextStyle = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    disabled && styles.disabledText,
    textStyle,
  ];

  const iconColor = variant === 'primary' || variant === 'danger' || variant === 'success'
    ? colors.textWhite
    : variant === 'outline' || variant === 'ghost'
    ? colors.primary
    : colors.textWhite;

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          color={iconColor}
          size="small"
        />
      );
    }

    const iconElement = icon ? (
      <Icon 
        name={icon} 
        size={size === 'small' ? 16 : size === 'large' ? 24 : 20} 
        color={iconColor} 
      />
    ) : null;

    return (
      <View style={styles.buttonContent}>
        {iconPosition === 'left' && iconElement && (
          <View style={styles.iconLeft}>{iconElement}</View>
        )}
        {title && <Text style={buttonTextStyle}>{title}</Text>}
        {iconPosition === 'right' && iconElement && (
          <View style={styles.iconRight}>{iconElement}</View>
        )}
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}>
      {renderContent()}
    </TouchableOpacity>
  );
};

// Convenience components for common button types
export const SecondaryButton = ({ title, onPress, style, ...props }) => (
  <Button
    title={title}
    onPress={onPress}
    variant="secondary"
    style={style}
    {...props}
  />
);

export const OutlineButton = ({ title, onPress, style, ...props }) => (
  <Button
    title={title}
    onPress={onPress}
    variant="outline"
    style={style}
    {...props}
  />
);

export const DangerButton = ({ title, onPress, style, ...props }) => (
  <Button
    title={title}
    onPress={onPress}
    variant="danger"
    style={style}
    {...props}
  />
);

export const SuccessButton = ({ title, onPress, style, ...props }) => (
  <Button
    title={title}
    onPress={onPress}
    variant="success"
    style={style}
    {...props}
  />
);

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  
  // Variants
  primary: {
    backgroundColor: colors.primary, // Chandra green
  },
  primaryText: {
    color: colors.textWhite,
  },
  
  secondary: {
    backgroundColor: colors.textSecondary, // Grey
  },
  secondaryText: {
    color: colors.textWhite,
  },
  
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  outlineText: {
    color: colors.primary,
  },
  
  // Sizes
  small: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallText: {
    fontSize: fonts.sm,
  },
  
  medium: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mediumText: {
    fontSize: fonts.base,
  },
  
  large: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  largeText: {
    fontSize: fonts.lg,
  },
  
  // States
  disabled: {
    opacity: 0.6,
  },
  disabledText: {
    opacity: 0.6,
  },
});

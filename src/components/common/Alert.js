import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from './Icon';

const { width } = Dimensions.get('window');

/**
 * Branded Alert Component
 * Replaces native Alert.alert with custom branded styling
 */
const BrandedAlert = ({ visible, title, message, type = 'info', buttons = [], onClose }) => {
  if (!visible) return null;

  // Determine colors based on type
  const getTypeColors = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'check-circle',
          iconColor: colors.success,
          backgroundColor: colors.success + '15',
          borderColor: colors.success,
        };
      case 'error':
        return {
          icon: 'error',
          iconColor: colors.error,
          backgroundColor: colors.error + '15',
          borderColor: colors.error,
        };
      case 'warning':
        return {
          icon: 'warning',
          iconColor: colors.warning,
          backgroundColor: colors.warning + '15',
          borderColor: colors.warning,
        };
      case 'info':
      default:
        return {
          icon: 'info',
          iconColor: colors.primary, // Use brand primary color for info
          backgroundColor: colors.primary + '15',
          borderColor: colors.primary,
        };
    }
  };

  const typeColors = getTypeColors();

  // Default button if none provided
  const defaultButtons = buttons.length > 0 
    ? buttons 
    : [{ text: 'OK', onPress: onClose, style: 'default' }];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.alertContainer}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: typeColors.backgroundColor }]}>
            <Icon name={typeColors.icon} size={48} color={typeColors.iconColor} />
          </View>

          {/* Title */}
          {title && (
            <Text style={styles.title}>{title}</Text>
          )}

          {/* Message */}
          {message && (
            <Text style={styles.message}>{message}</Text>
          )}

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {defaultButtons.map((button, index) => {
              const isDefault = button.style === 'default' || button.style === undefined;
              const isDestructive = button.style === 'destructive';
              const isCancel = button.style === 'cancel';

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    defaultButtons.length === 1 && styles.singleButton,
                    defaultButtons.length === 2 && styles.doubleButton,
                    isDefault && { backgroundColor: colors.primary },
                    isDestructive && { backgroundColor: colors.error },
                    isCancel && { backgroundColor: colors.backgroundSecondary },
                  ]}
                  onPress={() => {
                    if (button.onPress) {
                      button.onPress();
                    }
                    if (onClose) {
                      onClose();
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isDefault && styles.buttonTextPrimary,
                      isDestructive && styles.buttonTextWhite,
                      isCancel && styles.buttonTextSecondary,
                    ]}
                  >
                    {button.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertContainer: {
    backgroundColor: colors.background,
    borderRadius: 16,
    width: width * 0.85,
    maxWidth: 400,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: fonts.xl,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  singleButton: {
    flex: 1,
  },
  doubleButton: {
    flex: 1,
  },
  buttonText: {
    fontSize: fonts.base,
    fontFamily: fonts.medium,
  },
  buttonTextPrimary: {
    color: colors.textWhite,
  },
  buttonTextWhite: {
    color: colors.textWhite,
  },
  buttonTextSecondary: {
    color: colors.textPrimary,
  },
});

export default BrandedAlert;


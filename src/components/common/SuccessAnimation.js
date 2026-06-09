import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, Text, TouchableOpacity, Animated } from 'react-native';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import IconComponent from './Icon';

const SuccessAnimation = ({ visible, onComplete, title = 'Success!', message = 'Your enquiry has been created successfully!' }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      // Bounce-in animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Auto-complete after 2 seconds
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 2000);
      });
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onComplete}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, { opacity: opacityAnim }]}>
          {/* Success Icon with bounce animation */}
          <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.iconCircle}>
              <IconComponent name="check" size={56} color="#fff" />
            </View>
          </Animated.View>

          {/* Success Message */}
          <View style={styles.messageContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>

          {/* Close Button */}
          <TouchableOpacity
            style={styles.button}
            onPress={onComplete}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '85%',
    maxWidth: 400,
    shadowColor: colors.shadow || colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.success || '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.success || '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: fonts.xl,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 12,
    minWidth: 120,
  },
  buttonText: {
    color: colors.textWhite,
    fontSize: fonts.base,
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
});

export default SuccessAnimation;

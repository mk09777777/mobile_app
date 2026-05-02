import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, Text, TouchableOpacity } from 'react-native';
import LottieView from 'lottie-react-native';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import IconComponent from './Icon';

const SuccessAnimation = ({ visible, onComplete, title = 'Success!', message = 'Your enquiry has been created successfully!' }) => {
  const animationRef = useRef(null);

  useEffect(() => {
    if (visible && animationRef.current) {
      // Play animation when modal becomes visible
      animationRef.current.play();
    }
  }, [visible]);

  const handleAnimationFinish = () => {
    // Animation completed, call onComplete callback
    if (onComplete) {
      // Small delay to show the final frame
      setTimeout(() => {
        onComplete();
      }, 500);
    }
  };

  // Load the Chandra.lottie animation file
  let animationSource = null;
  try {
    animationSource = require('../../assets/animations/Chandra.lottie');
  } catch (error) {
    // Animation file not found, will use icon instead
    if (__DEV__) {
      console.warn('⚠️ Lottie animation file not found. Using icon fallback.');
    }
  }

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onComplete}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Lottie Animation or Icon Fallback */}
          {animationSource ? (
            <View style={styles.animationContainer}>
              <LottieView
                ref={animationRef}
                source={animationSource}
                style={styles.animation}
                loop={false}
                autoPlay={true}
                onAnimationFinish={handleAnimationFinish}
                onLayout={() => {
                  // Ensure animation plays
                  if (animationRef.current) {
                    animationRef.current.play();
                  }
                }}
              />
            </View>
          ) : (
            <View style={styles.iconContainer}>
              <IconComponent name="check-circle" size={80} color={colors.success || colors.primary} />
            </View>
          )}

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
        </View>
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
    padding: 24,
    alignItems: 'center',
    width: '85%',
    maxWidth: 400,
    shadowColor: colors.shadow || colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  animationContainer: {
    width: 200,
    height: 200,
    marginBottom: 16,
  },
  animation: {
    width: '100%',
    height: '100%',
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  iconContainer: {
    marginBottom: 16,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 32,
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


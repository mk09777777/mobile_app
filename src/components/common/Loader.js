import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';

export const Loader = ({ size = 'large', color = colors.primary, style }) => (
  <View style={[styles.container, style]}>
    <ActivityIndicator size={size} color={color} />
  </View>
);

export const OverlayLoader = ({ visible, text }) => {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.overlayContent}>
        <ActivityIndicator size="large" color={colors.primary} />
        {text && (
          <Text style={styles.overlayText}>{text}</Text>
        )}
      </View>
    </View>
  );
};

export const SkeletonLoader = ({ width = '100%', height = 20, style }) => (
  <View style={[styles.skeleton, { width, height }, style]} />
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  overlayContent: {
    backgroundColor: colors.modalBackground,
    padding: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  overlayText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textPrimary,
  },
  skeleton: {
    backgroundColor: colors.borderLight,
    borderRadius: 4,
  },
});

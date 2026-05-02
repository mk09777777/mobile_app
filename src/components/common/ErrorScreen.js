/**
 * Error Screen Component
 * 
 * Displays a user-friendly error screen when an error boundary catches an error.
 * Provides recovery options like Retry and Go Back.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from './Icon';
import { Button } from './Button';

const ErrorScreen = ({ error, errorInfo, onRetry, onGoBack }) => {
  const isDevelopment = __DEV__;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Error Icon */}
          <View style={styles.iconContainer}>
            <Icon name="error-outline" size={64} color={colors.error} />
          </View>

          {/* Error Title */}
          <Text style={styles.title}>Oops! Something Went Wrong</Text>

          {/* Error Message */}
          <Text style={styles.message}>
            We encountered an unexpected error. Don't worry, your data is safe.
          </Text>

          {/* Development Error Details */}
          {isDevelopment && error && (
            <View style={styles.errorDetails}>
              <Text style={styles.errorDetailsTitle}>Error Details (Dev Only):</Text>
              <Text style={styles.errorText}>
                {error.toString()}
              </Text>
              {errorInfo && errorInfo.componentStack && (
                <Text style={styles.stackTrace}>
                  {errorInfo.componentStack}
                </Text>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {onRetry && (
              <Button
                title="Try Again"
                onPress={onRetry}
                style={styles.retryButton}
              />
            )}
            {onGoBack && (
              <TouchableOpacity
                style={styles.goBackButton}
                onPress={onGoBack}
              >
                <Text style={styles.goBackText}>Go Back</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Help Text */}
          <Text style={styles.helpText}>
            If this problem persists, please contact support.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: fonts.xl,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: fonts.md,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  errorDetails: {
    width: '100%',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorDetailsTitle: {
    fontSize: fonts.sm,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  errorText: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.error,
    marginBottom: 12,
  },
  stackTrace: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  retryButton: {
    width: '100%',
  },
  goBackButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  goBackText: {
    fontSize: fonts.md,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  helpText: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default ErrorScreen;


































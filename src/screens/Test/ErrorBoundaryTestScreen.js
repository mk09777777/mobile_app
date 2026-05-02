/**
 * Error Boundary Test Screen
 * 
 * Temporary test screen to verify Error Boundary functionality.
 * Add this to your navigation temporarily for testing, then remove.
 * 
 * Usage:
 * 1. Add to StackNavigator temporarily
 * 2. Navigate to this screen
 * 3. Test different error scenarios
 * 4. Remove from navigation after testing
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Button } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { Heading, BodyText } from '../../components/common/Text';

const ErrorBoundaryTestScreen = ({ navigation }) => {
  const [renderError, setRenderError] = useState(false);
  const [stateError, setStateError] = useState(false);

  // Test 1: Render Error
  if (renderError) {
    throw new Error('Test Render Error: This error was triggered intentionally to test Error Boundary!');
  }

  // Test 2: State Update Error
  if (stateError) {
    const data = null;
    // This will cause an error when React tries to render
    return <Text>{data.name}</Text>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Heading style={styles.title}>Error Boundary Test</Heading>
        <BodyText style={styles.description}>
          Use the buttons below to test different error scenarios.
          The Error Boundary should catch these errors and show an error screen.
        </BodyText>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Scenarios:</Text>

          {/* Test 1: Render Error */}
          <View style={styles.testItem}>
            <Text style={styles.testTitle}>1. Render Error</Text>
            <Text style={styles.testDescription}>
              Throws an error during component render
            </Text>
            <Button
              title="Trigger Render Error"
              onPress={() => setRenderError(true)}
              variant="danger"
              style={styles.button}
            />
          </View>

          {/* Test 2: State Update Error */}
          <View style={styles.testItem}>
            <Text style={styles.testTitle}>2. State Update Error</Text>
            <Text style={styles.testDescription}>
              Causes error when accessing null property
            </Text>
            <Button
              title="Trigger State Error"
              onPress={() => setStateError(true)}
              variant="danger"
              style={styles.button}
            />
          </View>

          {/* Test 3: Async Error (if not caught) */}
          <View style={styles.testItem}>
            <Text style={styles.testTitle}>3. Async Error</Text>
            <Text style={styles.testDescription}>
              Throws error after delay (may not be caught by Error Boundary)
            </Text>
            <Button
              title="Trigger Async Error"
              onPress={() => {
                setTimeout(() => {
                  throw new Error('Async error - may not be caught by Error Boundary');
                }, 1000);
                alert('Error will trigger in 1 second');
              }}
              variant="danger"
              style={styles.button}
            />
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Expected Behavior:</Text>
          <Text style={styles.infoText}>
            • Error screen should appear instead of white screen{'\n'}
            • "Try Again" button should reset the error{'\n'}
            • "Go Back" button should navigate back{'\n'}
            • Error details visible in dev mode only
          </Text>
        </View>

        <View style={styles.noteSection}>
          <Text style={styles.noteText}>
            ⚠️ Remember to remove this test screen from navigation after testing!
          </Text>
        </View>

        <Button
          title="Go Back"
          onPress={() => navigation.goBack()}
          variant="secondary"
          style={styles.backButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: fonts.xl,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: fonts.md,
    color: colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  testItem: {
    backgroundColor: colors.backgroundSecondary,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  testTitle: {
    fontSize: fonts.md,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  testDescription: {
    fontSize: fonts.sm,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  button: {
    marginTop: 8,
  },
  infoSection: {
    backgroundColor: colors.info + '10',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
  },
  infoTitle: {
    fontSize: fonts.md,
    fontFamily: fonts.bold,
    color: colors.info,
    marginBottom: 8,
  },
  infoText: {
    fontSize: fonts.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  noteSection: {
    backgroundColor: colors.warning + '10',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  noteText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  backButton: {
    marginTop: 8,
  },
});

export default ErrorBoundaryTestScreen;


































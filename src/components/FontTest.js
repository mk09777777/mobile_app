import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fonts } from '../constants/fonts';
import { colors } from '../constants/colors';

const FontTest = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Font Test - Avenir Family</Text>
      
      <View style={styles.section}>
        <Text style={styles.label}>Regular (AvenirLTStd-Roman):</Text>
        <Text style={[styles.text, { fontFamily: fonts.regular }]}>
          The quick brown fox jumps over the lazy dog
        </Text>
        <Text style={[styles.text, { fontFamily: fonts.regular }]}>
          ABCDEFGHIJKLMNOPQRSTUVWXYZ
        </Text>
        <Text style={[styles.text, { fontFamily: fonts.regular }]}>
          abcdefghijklmnopqrstuvwxyz
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Medium (AvenirLTStd-Medium):</Text>
        <Text style={[styles.text, { fontFamily: fonts.medium }]}>
          The quick brown fox jumps over the lazy dog
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Bold (AvenirLTStd-Heavy):</Text>
        <Text style={[styles.text, { fontFamily: fonts.bold }]}>
          The quick brown fox jumps over the lazy dog
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Light (AvenirLTStd-Light):</Text>
        <Text style={[styles.text, { fontFamily: fonts.light }]}>
          The quick brown fox jumps over the lazy dog
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Black (AvenirLTStd-Black):</Text>
        <Text style={[styles.text, { fontFamily: fonts.black }]}>
          The quick brown fox jumps over the lazy dog
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>System Font (Fallback):</Text>
        <Text style={[styles.text, { fontFamily: 'System' }]}>
          The quick brown fox jumps over the lazy dog
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: fonts['2xl'],
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
  },
  label: {
    fontSize: fonts.sm,
    color: colors.textSecondary,
    marginBottom: 5,
    fontWeight: 'bold',
  },
  text: {
    fontSize: fonts.lg,
    color: colors.textPrimary,
    lineHeight: fonts.lg * 1.4,
  },
});

export default FontTest;

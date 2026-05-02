import React from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from './cards/Cards';
import { Button } from './common/Button';
import { ResponsiveImage, AvatarImage, CardImage, BannerImage } from './common/ResponsiveImage';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { 
  responsiveDimensions, 
  spacing, 
  responsivePadding, 
  imageSizes,
  getDeviceType,
  BREAKPOINTS 
} from '../utils';

const ResponsiveDemoScreen = () => {
  const deviceType = getDeviceType();
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Card style={styles.headerCard}>
          <Text style={[styles.title, { fontSize: fonts['2xl'] }]}>
            Responsive Design Demo
          </Text>
          <Text style={[styles.subtitle, { fontSize: fonts.base }]}>
            Device Type: {deviceType.toUpperCase()}
          </Text>
          <Text style={[styles.info, { fontSize: fonts.sm }]}>
            Screen: {responsiveDimensions.width} x {responsiveDimensions.height}
          </Text>
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { fontSize: fonts.xl }]}>
            Responsive Images
          </Text>
          
          <View style={styles.imageRow}>
            <View style={styles.imageContainer}>
              <Text style={[styles.imageLabel, { fontSize: fonts.sm }]}>Small</Text>
              <ResponsiveImage 
                source={{ uri: 'https://via.placeholder.com/60x60?text=S' }}
                size="small"
              />
            </View>
            
            <View style={styles.imageContainer}>
              <Text style={[styles.imageLabel, { fontSize: fonts.sm }]}>Medium</Text>
              <ResponsiveImage 
                source={{ uri: 'https://via.placeholder.com/100x100?text=M' }}
                size="medium"
              />
            </View>
            
            <View style={styles.imageContainer}>
              <Text style={[styles.imageLabel, { fontSize: fonts.sm }]}>Large</Text>
              <ResponsiveImage 
                source={{ uri: 'https://via.placeholder.com/150x150?text=L' }}
                size="large"
              />
            </View>
          </View>

          <View style={styles.specialImageRow}>
            <View style={styles.imageContainer}>
              <Text style={[styles.imageLabel, { fontSize: fonts.sm }]}>Avatar</Text>
              <AvatarImage 
                source={{ uri: 'https://via.placeholder.com/80x80?text=A' }}
                size="medium"
              />
            </View>
            
            <View style={styles.imageContainer}>
              <Text style={[styles.imageLabel, { fontSize: fonts.sm }]}>Card</Text>
              <CardImage 
                source={{ uri: 'https://via.placeholder.com/200x200?text=C' }}
              />
            </View>
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { fontSize: fonts.xl }]}>
            Responsive Spacing
          </Text>
          
          <View style={styles.spacingDemo}>
            <View style={[styles.spacingBox, { padding: spacing.xs }]}>
              <Text style={[styles.spacingText, { fontSize: fonts.xs }]}>XS: {spacing.xs}</Text>
            </View>
            <View style={[styles.spacingBox, { padding: spacing.sm }]}>
              <Text style={[styles.spacingText, { fontSize: fonts.sm }]}>SM: {spacing.sm}</Text>
            </View>
            <View style={[styles.spacingBox, { padding: spacing.md }]}>
              <Text style={[styles.spacingText, { fontSize: fonts.base }]}>MD: {spacing.md}</Text>
            </View>
            <View style={[styles.spacingBox, { padding: spacing.lg }]}>
              <Text style={[styles.spacingText, { fontSize: fonts.lg }]}>LG: {spacing.lg}</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { fontSize: fonts.xl }]}>
            Responsive Fonts
          </Text>
          
          <View style={styles.fontDemo}>
            <Text style={[styles.fontSample, { fontSize: fonts.xs }]}>
              Extra Small Text (XS)
            </Text>
            <Text style={[styles.fontSample, { fontSize: fonts.sm }]}>
              Small Text (SM)
            </Text>
            <Text style={[styles.fontSample, { fontSize: fonts.base }]}>
              Base Text (Base)
            </Text>
            <Text style={[styles.fontSample, { fontSize: fonts.lg }]}>
              Large Text (LG)
            </Text>
            <Text style={[styles.fontSample, { fontSize: fonts.xl }]}>
              Extra Large Text (XL)
            </Text>
            <Text style={[styles.fontSample, { fontSize: fonts['2xl'] }]}>
              Double Extra Large Text (2XL)
            </Text>
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { fontSize: fonts.xl }]}>
            Device Breakpoints
          </Text>
          
          <View style={styles.breakpointDemo}>
            <Text style={[styles.breakpointText, { fontSize: fonts.base }]}>
              Small: ≤ {BREAKPOINTS.small}px
            </Text>
            <Text style={[styles.breakpointText, { fontSize: fonts.base }]}>
              Medium: {BREAKPOINTS.small + 1}px - {BREAKPOINTS.medium}px
            </Text>
            <Text style={[styles.breakpointText, { fontSize: fonts.base }]}>
              Large: {BREAKPOINTS.medium + 1}px - {BREAKPOINTS.large}px
            </Text>
            <Text style={[styles.breakpointText, { fontSize: fonts.base }]}>
              XLarge: &gt; {BREAKPOINTS.large}px
            </Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  headerCard: {
    margin: responsivePadding.screenHorizontal,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  title: {
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.medium,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  info: {
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  sectionCard: {
    margin: responsivePadding.screenHorizontal,
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  imageRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
  },
  specialImageRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  imageContainer: {
    alignItems: 'center',
  },
  imageLabel: {
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  spacingDemo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  spacingBox: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginBottom: spacing.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  spacingText: {
    fontFamily: fonts.bold,
    color: colors.textWhite,
  },
  fontDemo: {
    gap: spacing.sm,
  },
  fontSample: {
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  breakpointDemo: {
    gap: spacing.sm,
  },
  breakpointText: {
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
});

export default ResponsiveDemoScreen;

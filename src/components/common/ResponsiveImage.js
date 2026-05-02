import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { imageSizes, borderRadius } from '../../utils';
import { colors } from '../../constants/colors';

const ResponsiveImage = ({ 
  source, 
  size = 'medium', 
  style, 
  borderRadius: customBorderRadius,
  aspectRatio,
  ...props 
}) => {
  const imageSize = imageSizes[size] || imageSizes.medium;
  const radius = customBorderRadius || borderRadius.md;

  const imageStyle = [
    styles.image,
    {
      width: imageSize,
      height: aspectRatio ? imageSize / aspectRatio : imageSize,
      borderRadius: radius,
    },
    style,
  ];

  return (
    <Image
      source={source}
      style={imageStyle}
      resizeMode="cover"
      {...props}
    />
  );
};

// Predefined image components for common use cases
export const AvatarImage = ({ source, size = 'small', ...props }) => (
  <ResponsiveImage 
    source={source} 
    size={size} 
    borderRadius={borderRadius.full}
    {...props} 
  />
);

export const CardImage = ({ source, ...props }) => (
  <ResponsiveImage 
    source={source} 
    size="cardImage" 
    aspectRatio={1}
    {...props} 
  />
);

export const BannerImage = ({ source, ...props }) => (
  <ResponsiveImage 
    source={source} 
    size="bannerImage" 
    aspectRatio={2.5}
    {...props} 
  />
);

export const EnquiryImage = ({ source, ...props }) => (
  <ResponsiveImage 
    source={source} 
    size="medium" 
    aspectRatio={1}
    {...props} 
  />
);

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.backgroundSecondary,
  },
});

export default ResponsiveImage;

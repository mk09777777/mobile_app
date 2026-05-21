import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';

const JacketProductCard = ({
  title = 'Lorem ipsum',
  price = '000',
  displayImage,
  secondaryImage,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.imageContainer}>
        {displayImage ? (
          <Image source={{ uri: displayImage }} style={styles.mainImage} resizeMode="contain" />
        ) : (
          <View style={styles.mainImagePlaceholder} />
        )}
        
        {secondaryImage ? (
          <View style={styles.secondaryImageWrapper}>
            <Image source={{ uri: secondaryImage }} style={styles.secondaryImage} resizeMode="contain" />
          </View>
        ) : null}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.title}>
          {title} : <Text style={styles.price}>${price} and onwards</Text>
        </Text>
        <Text style={styles.detailsText}>See details</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  imageContainer: {
    height: 140,
    width: '100%',
    marginBottom: 16,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  mainImage: {
    width: '60%',
    height: '100%',
  },
  mainImagePlaceholder: {
    width: '60%',
    height: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  secondaryImageWrapper: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F5F65',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#0F5F65',
  },
  secondaryImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  title: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '400',
  },
  price: {
    fontWeight: '400',
  },
  detailsText: {
    color: '#B0B0B0',
    fontSize: 12,
    fontWeight: '400',
  },
});

export default JacketProductCard;

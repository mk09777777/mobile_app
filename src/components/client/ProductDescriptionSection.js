import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

const ProductDescriptionSection = ({ title = 'Description', description = '' }) => {
  if (!description) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.title}>{title} :</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: colors.cardBackground,
    padding: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '400',
  },
  description: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 24,
  },
});

export default ProductDescriptionSection;

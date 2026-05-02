import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../constants/colors';
import {
  ChipsFilterField,
  DropdownFilterField,
  MultiChipsFilterField,
} from '../../components/client/filters/ProductFilterFields';
import ProductDescriptionSection from '../../components/client/ProductDescriptionSection';

const ProductListScreen = ({ route, navigation }) => {
  const categoryName = route?.params?.categoryName || '';
  const subcategoryProfileName = route?.params?.subcategoryProfileName || '';
  const subcategoryId = route?.params?.subcategoryId;
  const subcategoryName = route?.params?.subcategoryName || 'Products';
  const subcategoryFilterSchema = Array.isArray(route?.params?.subcategoryFilterSchema)
    ? route.params.subcategoryFilterSchema
    : [];
  const subcategoryImages = Array.isArray(route?.params?.subcategoryImages)
    ? route.params.subcategoryImages
    : [];
  const subcategoryThumbnailImage = route?.params?.subcategoryThumbnailImage || '';
  const specialNotePlaceholderText =
    route?.params?.specialNotePlaceholderText || 'Length variation';
  const [selectedFilters, setSelectedFilters] = useState({});

  const productImageUrl =
    subcategoryImages.find((url) => typeof url === 'string' && url.trim()) || subcategoryThumbnailImage;
  const productDescription = route?.params?.subcategoryDescription || route?.params?.description || '';
  const subcategorySubtext = route?.params?.subcategorySubtext || '';
  const subcategoryDescription = route?.params?.subcategoryDescription || '';
  const breadcrumbParts = ['HOME', categoryName, subcategoryProfileName]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .map((part) => part.toUpperCase());
  const breadcrumbText = breadcrumbParts.join(' | ');
  const isRingCategory = String(categoryName || '').toLowerCase().includes('ring');

  const metalOptions = ['10 kt', '14 kt', '18 kt', '925 Silver'].map((value) => ({ label: value, value }));
  const stoneOptions = ['Natural Diamond', 'Lab Grown Diamond'].map((value) => ({ label: value, value }));
  const baseFilterFields = [
    { key: 'metal', label: 'Metal', type: 'chips', options: metalOptions, displayOrder: -2 },
    { key: 'stone', label: 'Stone', type: 'chips', options: stoneOptions, displayOrder: -1 },
  ];

  const sortedSchema = [...baseFilterFields, ...subcategoryFilterSchema].sort(
    (a, b) => Number(a?.displayOrder || 0) - Number(b?.displayOrder || 0),
  );

  const toggleFilterValue = (fieldKey, optionValue, isMulti) => {
    setSelectedFilters((prev) => {
      const previousValue = prev[fieldKey];
      if (isMulti) {
        const prevArray = Array.isArray(previousValue) ? previousValue : [];
        const exists = prevArray.includes(optionValue);
        return {
          ...prev,
          [fieldKey]: exists
            ? prevArray.filter((item) => item !== optionValue)
            : [...prevArray, optionValue],
        };
      }
      return { ...prev, [fieldKey]: optionValue };
    });
  };

  const renderFilterField = (field) => {
    const options = Array.isArray(field?.options) ? field.options : [];
    const fieldKey = field?.key;
    const label = field?.label || fieldKey || 'Filter';

    if (!fieldKey || options.length === 0) {
      return null;
    }

    if (field?.type === 'multi_chips') {
      return (
        <MultiChipsFilterField
          label={label}
          options={options}
          selectedValues={Array.isArray(selectedFilters[fieldKey]) ? selectedFilters[fieldKey] : []}
          onToggle={(optionValue) => toggleFilterValue(fieldKey, optionValue, true)}
        />
      );
    }

    if (field?.type === 'dropdown') {
      return (
        <DropdownFilterField
          label={label}
          options={options}
          selectedValue={selectedFilters[fieldKey]}
          onSelect={(optionValue) => toggleFilterValue(fieldKey, optionValue, false)}
        />
      );
    }

    return (
      <ChipsFilterField
        label={label}
        options={options}
        selectedValue={selectedFilters[fieldKey]}
        onSelect={(optionValue) => toggleFilterValue(fieldKey, optionValue, false)}
      />
    );
  };

  const requiredFields = sortedSchema.filter(
    (field) => field?.key && Array.isArray(field?.options) && field.options.length > 0,
  );

  const isFieldSelected = (field) => {
    const fieldValue = selectedFilters[field.key];
    if (field?.type === 'multi_chips') {
      return Array.isArray(fieldValue) && fieldValue.length > 0;
    }
    return typeof fieldValue === 'string' && fieldValue.trim().length > 0;
  };

  const canProceed = !!subcategoryId && requiredFields.length > 0 && requiredFields.every(isFieldSelected);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.breadcrumb} numberOfLines={1} ellipsizeMode="tail">
        {breadcrumbText || `HOME | ${String(subcategoryName).toUpperCase()}`}
      </Text>

      <View style={styles.productHero}>
        {productImageUrl ? (
          <Image source={{ uri: productImageUrl }} style={styles.heroImage} resizeMode="contain" />
        ) : (
          <View style={styles.heroPlaceholder} />
        )}
      </View>

      <ProductDescriptionSection description={productDescription} />

      {sortedSchema.map((field) => (
        <View key={field?.key || field?.label}>
          {renderFilterField(field)}
        </View>
      ))}

      <TouchableOpacity
        style={[styles.proceedButton, !canProceed && styles.proceedButtonDisabled]}
        activeOpacity={canProceed ? 0.85 : 1}
        disabled={!canProceed}
        onPress={() =>
          navigation.navigate(isRingCategory ? 'RingMatrixPage' : 'ProductMatrix', {
            categoryName,
            subcategoryProfileName,
            subcategoryId,
            subcategoryName,
            subcategorySubtext,
            subcategoryDescription,
            selectedFilters,
            specialNotePlaceholderText,
            productImageUrl,
            productDescription,
            subcategoryThumbnailImage,
          })
        }>
        <Text style={styles.proceedButtonText}>Proceed</Text>
      </TouchableOpacity>

      {!subcategoryId ? (
        <TouchableOpacity style={styles.stateCard} activeOpacity={0.8}>
          <Text style={styles.stateTitle}>Missing subcategory details</Text>
          <Text style={styles.stateSub}>Please re-open from category screen</Text>
        </TouchableOpacity>
      ) : null}

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    paddingBottom: 24,
  },
  breadcrumb: {
    color: colors.textPrimary,
    fontSize: 12,
    marginBottom: 10,
    fontWeight: '400',
  },
  productHero: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: colors.cardBackground,
    overflow: 'hidden',
    marginBottom: 10,
  },
  heroImage: {
    width: '100%',
    height: 260,
  },
  heroPlaceholder: {
    width: '100%',
    height: 260,
    backgroundColor: colors.cardBackground,
  },
  listHeading: {
    marginTop: 6,
    marginBottom: 8,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  productCard: {
    width: '48.5%',
    backgroundColor: '#EFEFF1',
    borderRadius: 12,
    overflow: 'hidden',
    paddingBottom: 10,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#E3E5E8',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: '#E3E5E8',
  },
  styleNo: {
    marginTop: 8,
    paddingHorizontal: 10,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  desc: {
    marginTop: 4,
    paddingHorizontal: 10,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  skeletonCard: {
    width: '48.5%',
    aspectRatio: 0.9,
    borderRadius: 12,
    backgroundColor: '#E9ECEF',
  },
  stateCard: {
    minHeight: 90,
    borderRadius: 12,
    backgroundColor: colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  stateTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  stateSub: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
  },
  proceedButton: {
    marginTop: 4,
    marginBottom: 12,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  proceedButtonDisabled: {
    backgroundColor: colors.border,
  },
  proceedButtonText: {
    color: colors.textWhite,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default ProductListScreen;

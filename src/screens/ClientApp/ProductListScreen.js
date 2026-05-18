import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../../constants/colors';
import {
  ChipsFilterField,
  DropdownFilterField,
  MultiChipsFilterField,
} from '../../components/client/filters/ProductFilterFields';
import ProductDescriptionSection from '../../components/client/ProductDescriptionSection';
import ProductMatrixCard from '../../components/client/ProductMatrixCard';
import catalogApi from '../../services/catalogApi';
import { getSubcategoryProductsPath } from '../../utils/subcategoryProductsPath';
import { computeUnitPriceFromSource, getPricingContext } from '../../services/clientPricingEngine';

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
  const productId = String(route?.params?.productId || '');
  const onlyBestSeller = Boolean(route?.params?.onlyBestSeller);
  const onlyReadyToShip = Boolean(route?.params?.onlyReadyToShip);
  const isJacketFlow = Boolean(route?.params?.isJacketFlow || productId);

  const [selectedFilters, setSelectedFilters] = useState({});
  const [jacketProduct, setJacketProduct] = useState(null);
  const [jacketLoading, setJacketLoading] = useState(false);
  const [jacketError, setJacketError] = useState('');
  const [quantities, setQuantities] = useState({ W: 0, Y: 0, R: 0 });
  const [specialNote, setSpecialNote] = useState('');
  const [pricingContext, setPricingContext] = useState(null);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

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

  useEffect(() => {
    if (!isJacketFlow) return undefined;
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [isJacketFlow]);

  useEffect(() => {
    if (!isJacketFlow) return undefined;
    let mounted = true;
    getPricingContext()
      .then((ctx) => {
        if (mounted) setPricingContext(ctx);
      })
      .catch(() => {
        if (mounted) setPricingContext(null);
      });
    return () => {
      mounted = false;
    };
  }, [isJacketFlow]);

  const fetchJacketProduct = useCallback(async () => {
    if (!isJacketFlow || !subcategoryId || !productId) {
      setJacketError('Missing product details');
      setJacketProduct(null);
      setJacketLoading(false);
      return;
    }

    try {
      setJacketLoading(true);
      setJacketError('');
      const response = await catalogApi.get(
        getSubcategoryProductsPath(subcategoryId, { onlyBestSeller, onlyReadyToShip }),
      );
      const fetchedProducts = Array.isArray(response?.products) ? response.products : [];
      const product = fetchedProducts.find((item) => String(item?._id || '') === productId) || null;
      if (!product) {
        setJacketError('Product not found');
        setJacketProduct(null);
        return;
      }
      setJacketProduct(product);
    } catch (err) {
      setJacketError(err?.message || 'Failed to load product');
      setJacketProduct(null);
    } finally {
      setJacketLoading(false);
    }
  }, [isJacketFlow, onlyBestSeller, onlyReadyToShip, productId, subcategoryId]);

  useEffect(() => {
    if (isJacketFlow) {
      fetchJacketProduct();
    }
  }, [fetchJacketProduct, isJacketFlow]);

  useEffect(() => {
    if (!isJacketFlow) return;
    setQuantities({ W: 0, Y: 0, R: 0 });
  }, [isJacketFlow, selectedFilters.metal, selectedFilters.stone]);

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

  const filtersComplete =
    requiredFields.length === 0 || requiredFields.every(isFieldSelected);

  const isJacketBaseFiltersSelected = useMemo(() => {
    const metal = selectedFilters.metal;
    const stone = selectedFilters.stone;
    return (
      typeof metal === 'string' &&
      metal.trim().length > 0 &&
      typeof stone === 'string' &&
      stone.trim().length > 0
    );
  }, [selectedFilters]);

  const resolveJacketUnitPrice = useCallback(
    (product) => {
      if (!isJacketBaseFiltersSelected || !pricingContext || !product) {
        return 0;
      }
      return computeUnitPriceFromSource(product, selectedFilters, pricingContext);
    },
    [isJacketBaseFiltersSelected, pricingContext, selectedFilters],
  );

  const totalSelectedQty = useMemo(
    () => Number(quantities.W || 0) + Number(quantities.Y || 0) + Number(quantities.R || 0),
    [quantities],
  );

  const formatJacketProductPrice = useCallback(
    (product) => {
      if (!isJacketBaseFiltersSelected) {
        return '—';
      }
      const computed = resolveJacketUnitPrice(product);
      if (Number.isFinite(computed) && computed > 0) {
        return `$${computed}`;
      }
      return '$0';
    },
    [isJacketBaseFiltersSelected, resolveJacketUnitPrice],
  );

  const jacketSelectedProductLines = useMemo(() => {
    if (!jacketProduct || totalSelectedQty === 0) return [];
    const lineProductId = String(jacketProduct?._id || '');
    return [
      {
        productId: lineProductId,
        styleNo: jacketProduct?.styleNo || '',
        name:
          route?.params?.productName ||
          jacketProduct?.name ||
          jacketProduct?.title ||
          jacketProduct?.styleNo ||
          `${jacketProduct?.pointer || 0} Pointer`,
        imageUrl:
          jacketProduct?.displayImage ||
          jacketProduct?.imageUrl ||
          jacketProduct?.thumbnailUrl ||
          (Array.isArray(jacketProduct?.images) ? jacketProduct.images[0] : '') ||
          productImageUrl,
        description: jacketProduct?.description || productDescription || '',
        pointer: jacketProduct?.pointer || 0,
        quantities,
        totalQty: totalSelectedQty,
        unitPrice: resolveJacketUnitPrice(jacketProduct),
        note: String(specialNote || ''),
      },
    ];
  }, [
    jacketProduct,
    productDescription,
    productImageUrl,
    quantities,
    route?.params?.productName,
    resolveJacketUnitPrice,
    specialNote,
    totalSelectedQty,
  ]);

  const onJacketQuantityChange = useCallback((colorKey, delta) => {
    setQuantities((prev) => ({
      ...prev,
      [colorKey]: Math.max(0, Number(prev[colorKey] || 0) + delta),
    }));
  }, []);

  const canProceedStandard =
    !!subcategoryId && requiredFields.length > 0 && requiredFields.every(isFieldSelected);

  const jacketUnitPrice = useMemo(
    () => resolveJacketUnitPrice(jacketProduct),
    [jacketProduct, resolveJacketUnitPrice],
  );

  const canProceedJacket =
    !!subcategoryId &&
    !!jacketProduct &&
    isJacketBaseFiltersSelected &&
    filtersComplete &&
    jacketUnitPrice > 0 &&
    totalSelectedQty > 0 &&
    !jacketLoading &&
    !jacketError;

  const openOrderReview = useCallback(() => {
    navigation.navigate('OrderReview', {
      categoryName,
      subcategoryProfileName,
      subcategoryId,
      subcategoryName,
      subcategorySubtext,
      subcategoryDescription,
      totalSelectedQty,
      selectedProductLines: jacketSelectedProductLines,
      selectedFilters,
      specialNotePlaceholderText,
      productImageUrl,
      productDescription,
      subcategoryThumbnailImage,
    });
  }, [
    categoryName,
    jacketSelectedProductLines,
    navigation,
    productDescription,
    productImageUrl,
    selectedFilters,
    specialNotePlaceholderText,
    subcategoryDescription,
    subcategoryId,
    subcategoryName,
    subcategoryProfileName,
    subcategorySubtext,
    subcategoryThumbnailImage,
    totalSelectedQty,
  ]);

  const contentPaddingBottom = isJacketFlow
    ? styles.jacketFooterWrap.height + 24
    : 24;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: contentPaddingBottom }]}>
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

        {isJacketFlow ? (
          <>
            {jacketLoading ? (
              <View style={styles.stateCard}>
                <Text style={styles.stateText}>Loading product...</Text>
              </View>
            ) : null}

            {!jacketLoading && jacketError ? (
              <TouchableOpacity style={styles.stateCard} activeOpacity={0.8} onPress={fetchJacketProduct}>
                <Text style={styles.stateTitle}>Unable to load product</Text>
                <Text style={styles.stateText}>Tap to retry</Text>
              </TouchableOpacity>
            ) : null}

            {!jacketLoading && !jacketError && jacketProduct && !isJacketBaseFiltersSelected ? (
              <View style={styles.matrixHintCard}>
                <Text style={styles.matrixHintText}>
                  Select metal and stone to view pricing and add quantities.
                </Text>
              </View>
            ) : null}

            {!jacketLoading && !jacketError && jacketProduct && isJacketBaseFiltersSelected ? (
              <View style={styles.matrixCardWrap}>
                <ProductMatrixCard
                  pointer={String(jacketProduct?.pointer ?? 0)}
                  price={formatJacketProductPrice(jacketProduct)}
                  specialNotePlaceholderText={specialNotePlaceholderText}
                  quantities={quantities}
                  onChangeQuantities={onJacketQuantityChange}
                  specialNoteValue={specialNote}
                  onChangeSpecialNote={setSpecialNote}
                />
              </View>
            ) : null}
          </>
        ) : null}

        {!isJacketFlow ? (
          <TouchableOpacity
            style={[styles.proceedButton, !canProceedStandard && styles.proceedButtonDisabled]}
            activeOpacity={canProceedStandard ? 0.85 : 1}
            disabled={!canProceedStandard}
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
                onlyBestSeller,
                onlyReadyToShip,
              })
            }>
            <Text style={styles.proceedButtonText}>Proceed</Text>
          </TouchableOpacity>
        ) : null}

        {!subcategoryId ? (
          <TouchableOpacity style={styles.stateCard} activeOpacity={0.8}>
            <Text style={styles.stateTitle}>Missing subcategory details</Text>
            <Text style={styles.stateSub}>Please re-open from category screen</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {isJacketFlow && !isKeyboardVisible ? (
        <View style={styles.jacketFooterWrap}>
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>{totalSelectedQty} Designs Added</Text>
          </View>
          <TouchableOpacity
            activeOpacity={canProceedJacket ? 0.85 : 1}
            disabled={!canProceedJacket}
            style={[styles.jacketProceedButton, !canProceedJacket && styles.jacketProceedButtonDisabled]}
            onPress={openOrderReview}>
            <Text style={styles.jacketProceedText}>Proceed</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
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
  matrixHintCard: {
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: colors.cardBackground,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  matrixHintText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  matrixCardWrap: {
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  stateCard: {
    minHeight: 90,
    borderRadius: 12,
    backgroundColor: colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginTop: 8,
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
  stateText: {
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
  jacketFooterWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 8,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  totalBadge: {
    flex: 1,
    height: '100%',
    borderRadius: 14,
    backgroundColor: colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  totalBadgeText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontWeight: '400',
  },
  jacketProceedButton: {
    width: 132,
    height: '100%',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F5A62',
  },
  jacketProceedButtonDisabled: {
    backgroundColor: '#8AA8AC',
  },
  jacketProceedText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '400',
  },
});

export default ProductListScreen;

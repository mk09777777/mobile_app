import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Keyboard } from 'react-native';
import { colors } from '../../constants/colors';
import ProductMatrixCard from '../../components/client/ProductMatrixCard';
import catalogApi from '../../services/catalogApi';
import { getSubcategoryProductsPath } from '../../utils/subcategoryProductsPath';
import { computeUnitPriceFromSource, getPricingContext } from '../../services/clientPricingEngine';

const ProductMatrixScreen = ({ route, navigation }) => {
  const subcategoryId = route?.params?.subcategoryId;
  const categoryName = route?.params?.categoryName || '';
  const subcategoryProfileName = route?.params?.subcategoryProfileName || '';
  const subcategoryName = route?.params?.subcategoryName || 'Products';
  const selectedFilters = useMemo(
    () => route?.params?.selectedFilters ?? {},
    [route?.params?.selectedFilters],
  );
  const specialNotePlaceholderText =
    route?.params?.specialNotePlaceholderText ||
    route?.params?.specialNotePlaceholder ||
    'Length variation';
  const productImageUrl = route?.params?.productImageUrl || '';
  const subcategoryThumbnailImage = route?.params?.subcategoryThumbnailImage || '';
  const productDescription = route?.params?.productDescription || '';
  const onlyBestSeller = Boolean(route?.params?.onlyBestSeller);
  const onlyReadyToShip = Boolean(route?.params?.onlyReadyToShip);
  const breadcrumbParts = ['HOME', categoryName, subcategoryProfileName]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .map((part) => part.toUpperCase());
  const breadcrumbText = breadcrumbParts.join(' | ');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantitiesByProduct, setQuantitiesByProduct] = useState({});
  const [notesByProduct, setNotesByProduct] = useState({});
  const [pricingContext, setPricingContext] = useState(null);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const normalizeToken = useCallback(
    (value) =>
      String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ''),
    [],
  );

  const matchesSelectedFilters = useCallback((product) => {
    const filterEntries = Array.isArray(product?.filter) ? product.filter : [];
    const normalizedMap = filterEntries.reduce((acc, item) => {
      const key = normalizeToken(item?.filterName);
      if (!key) return acc;
      acc[key] = item?.filterValue;
      return acc;
    }, {});

    const selectedEntries = Object.entries(selectedFilters || {});
    if (selectedEntries.length === 0) return true;

    return selectedEntries.every(([selectedKey, selectedValue]) => {
      const key = normalizeToken(selectedKey);
      const productValue = normalizedMap[key];
      if (productValue === undefined || productValue === null) return true;

      if (Array.isArray(selectedValue)) {
        if (selectedValue.length === 0) return true;
        const normalizedSelected = selectedValue.map(normalizeToken).filter(Boolean);
        if (normalizedSelected.length === 0) return true;
        if (Array.isArray(productValue)) {
          const normalizedProductValues = productValue.map(normalizeToken).filter(Boolean);
          return normalizedSelected.every((v) => normalizedProductValues.includes(v));
        }
        return normalizedSelected.includes(normalizeToken(productValue));
      }

      if (typeof selectedValue === 'string') {
        const normalizedSelected = normalizeToken(selectedValue);
        if (!normalizedSelected) return true;
        if (Array.isArray(productValue)) {
          const normalizedProductValues = productValue.map(normalizeToken).filter(Boolean);
          return normalizedProductValues.includes(normalizedSelected);
        }
        return normalizeToken(productValue) === normalizedSelected;
      }

      return true;
    });
  }, [normalizeToken, selectedFilters]);

  const fetchProducts = useCallback(async () => {
    if (!subcategoryId) {
      setError('Missing subcategory id');
      setProducts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await catalogApi.get(
        getSubcategoryProductsPath(subcategoryId, { onlyBestSeller, onlyReadyToShip }),
      );
      const fetchedProducts = Array.isArray(response?.products) ? response.products : [];
      const visibleProducts = fetchedProducts.filter(matchesSelectedFilters);
      if (__DEV__) {
        console.log('💎 [ProductMatrix] products fetched', {
          subcategoryId,
          fetchedCount: fetchedProducts.length,
          visibleCount: visibleProducts.length,
          selectedFilters,
          firstProduct: visibleProducts[0]
            ? {
                id: visibleProducts[0]?._id,
                styleNo: visibleProducts[0]?.styleNo,
                pointer: visibleProducts[0]?.pointer,
                filter: visibleProducts[0]?.filter,
                metalWeights: visibleProducts[0]?.metalWeights,
                diamonds: visibleProducts[0]?.diamonds,
              }
            : null,
        });
      }
      setProducts(visibleProducts);
      setQuantitiesByProduct((prev) => {
        const nextState = {};
        visibleProducts.forEach((product) => {
          const key = String(product?._id || '');
          if (!key) return;
          nextState[key] = prev[key] || { W: 0, Y: 0, R: 0 };
        });
        return nextState;
      });
      setNotesByProduct((prev) => {
        const nextState = {};
        visibleProducts.forEach((product) => {
          const key = String(product?._id || '');
          if (!key) return;
          nextState[key] = String(prev[key] || '');
        });
        return nextState;
      });
    } catch (err) {
      setError(err?.message || 'Failed to load products');
      setProducts([]);
      setQuantitiesByProduct({});
      setNotesByProduct({});
    } finally {
      setLoading(false);
    }
  }, [matchesSelectedFilters, onlyBestSeller, onlyReadyToShip, subcategoryId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    let mounted = true;
    getPricingContext()
      .then((ctx) => {
        if (__DEV__) {
          console.log('💎 [ProductMatrix] pricingContext loaded', {
            hasContext: !!ctx,
            metalPrices: ctx?.metalPrices,
            hasClientPricing: !!ctx?.clientPricing,
          });
        }
        if (mounted) setPricingContext(ctx);
      })
      .catch((pricingError) => {
        if (__DEV__) {
          console.log('💎 [ProductMatrix] pricingContext failed', {
            message: pricingError?.message || 'unknown error',
          });
        }
        if (mounted) setPricingContext(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const onCardQuantityChange = useCallback((productId, colorKey, delta) => {
    setQuantitiesByProduct((prev) => {
      const current = prev[productId] || { W: 0, Y: 0, R: 0 };
      return {
        ...prev,
        [productId]: {
          ...current,
          [colorKey]: Math.max(0, Number(current[colorKey] || 0) + delta),
        },
      };
    });
  }, []);
  const onCardNoteChange = useCallback((productId, value) => {
    setNotesByProduct((prev) => ({
      ...prev,
      [productId]: value,
    }));
  }, []);

  const totalSelectedQty = useMemo(
    () =>
      Object.values(quantitiesByProduct).reduce(
        (sum, qty) => sum + Number(qty?.W || 0) + Number(qty?.Y || 0) + Number(qty?.R || 0),
        0,
      ),
    [quantitiesByProduct],
  );

  const selectedProductLines = useMemo(
    () =>
      products
        .map((product) => {
          const productId = String(product?._id || '');
          const qty = quantitiesByProduct[productId] || { W: 0, Y: 0, R: 0 };
          const totalForProduct = Number(qty.W || 0) + Number(qty.Y || 0) + Number(qty.R || 0);
          if (totalForProduct === 0) return null;
          return {
            productId,
            styleNo: product?.styleNo || '',
            name: product?.name || product?.title || product?.styleNo || `${product?.pointer || 0} Pointer`,
            imageUrl:
              product?.displayImage ||
              product?.imageUrl ||
              product?.thumbnailUrl ||
              (Array.isArray(product?.images) ? product.images[0] : '') ||
              productImageUrl,
            description: product?.description || productDescription || '',
            pointer: product?.pointer || 0,
            quantities: qty,
            totalQty: totalForProduct,
            unitPrice:
              (pricingContext
                ? computeUnitPriceFromSource(product, selectedFilters, pricingContext)
                : 0) ||
              (Number(product?.price ?? product?.sellingPrice ?? product?.mrp ?? 0) > 0
                ? Number(product?.price ?? product?.sellingPrice ?? product?.mrp ?? 0)
                : 0),
            note: String(notesByProduct[productId] || ''),
          };
        })
        .filter(Boolean),
    [
      notesByProduct,
      pricingContext,
      productDescription,
      productImageUrl,
      products,
      quantitiesByProduct,
      selectedFilters,
    ],
  );

  const canProceed = totalSelectedQty > 0;

  const formatProductPrice = useCallback((product) => {
    const computed = pricingContext ? computeUnitPriceFromSource(product, selectedFilters, pricingContext) : 0;
    const n = computed || Number(product?.price ?? product?.sellingPrice ?? product?.mrp ?? 0);
    if (__DEV__) {
      console.log('💎 [ProductMatrix] formatProductPrice', {
        styleNo: product?.styleNo,
        computed,
        fallbackPrice: Number(product?.price ?? product?.sellingPrice ?? product?.mrp ?? 0),
        final: n,
        hasPricingContext: !!pricingContext,
      });
    }
    if (Number.isFinite(n) && n > 0) {
      return `$${n}`;
    }
    return '$0';
  }, [pricingContext, selectedFilters]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: styles.footerWrap.height + 16 },
        ]}>
        <Text style={styles.breadcrumb} numberOfLines={1} ellipsizeMode="tail">
          {breadcrumbText || `HOME | ${String(subcategoryName).toUpperCase()}`}
        </Text>

        {loading ? <View style={styles.stateCard}><Text style={styles.stateText}>Loading products...</Text></View> : null}

        {!loading && error ? (
          <TouchableOpacity style={styles.stateCard} activeOpacity={0.8} onPress={fetchProducts}>
            <Text style={styles.stateTitle}>Unable to load products</Text>
            <Text style={styles.stateText}>Tap to retry</Text>
          </TouchableOpacity>
        ) : null}

        {!loading && !error && products.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>No products found</Text>
            <Text style={styles.stateText}>Try changing filters</Text>
          </View>
        ) : null}

        {!loading && !error
          ? products.map((product) => {
              const productId = String(product?._id || '');
              if (!productId) return null;
              return (
                <View key={productId} style={styles.cardWrap}>
                  <ProductMatrixCard
                    pointer={String(product?.pointer ?? 0)}
                    price={formatProductPrice(product)}
                    specialNotePlaceholderText={specialNotePlaceholderText}
                    quantities={quantitiesByProduct[productId] || { W: 0, Y: 0, R: 0 }}
                    onChangeQuantities={(colorKey, delta) =>
                      onCardQuantityChange(productId, colorKey, delta)
                    }
                    specialNoteValue={String(notesByProduct[productId] || '')}
                    onChangeSpecialNote={(value) => onCardNoteChange(productId, value)}
                  />
                </View>
              );
            })
          : null}
      </ScrollView>

      {!isKeyboardVisible && (
        <View style={styles.footerWrap}>
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>{totalSelectedQty} Designs Added</Text>
          </View>
          <TouchableOpacity
            activeOpacity={canProceed ? 0.85 : 1}
            disabled={!canProceed}
            style={[styles.proceedButton, !canProceed && styles.proceedButtonDisabled]}
            onPress={() =>
              navigation.navigate('OrderReview', {
                categoryName,
                subcategoryProfileName,
                subcategoryId,
                subcategoryName,
                totalSelectedQty,
                selectedProductLines,
                selectedFilters,
                specialNotePlaceholderText,
                productImageUrl,
                productDescription,
                subcategoryThumbnailImage,
              })
            }>
            <Text style={styles.proceedText}>Proceed</Text>
          </TouchableOpacity>
        </View>
      )}
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
    paddingVertical: 14,
  },
  breadcrumb: {
    color: colors.textPrimary,
    fontSize: 12,
    marginBottom: 15,
    fontWeight: '400',
  },
  heading: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 12,
  },
  cardWrap: {
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  stateCard: {
    borderRadius: 12,
    backgroundColor: colors.cardBackground,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
  },
  stateTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '400',
  },
  stateText: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
  },
  footerWrap: {
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
  proceedButton: {
    width: 132,
    height: '100%',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F5A62',
  },
  proceedButtonDisabled: {
    backgroundColor: '#8AA8AC',
  },
  proceedText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '400',
  },
});

export default ProductMatrixScreen;

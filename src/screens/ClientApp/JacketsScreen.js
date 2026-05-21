import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import catalogApi from '../../services/catalogApi';
import JacketProductCard from '../../components/client/JacketProductCard';
import { computeUnitPriceFromSource, getPricingContext } from '../../services/clientPricingEngine';
import { colors } from '../../constants/colors';

const JacketsScreen = ({ route, navigation }) => {
  const categoryName = route?.params?.categoryName || '';
  const subcategoryId = route?.params?.subcategoryId;
  const subcategoryName = route?.params?.subcategoryName || 'Jackets';
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pricingContext, setPricingContext] = useState(null);

  const breadcrumbParts = ['HOME', categoryName, subcategoryName]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .map((part) => part.toUpperCase());
  const breadcrumbText = breadcrumbParts.join(' | ');

  const fetchProducts = useCallback(async () => {
    if (!subcategoryId) {
      setError('Missing subcategory id');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await catalogApi.get(`/subcategories/${subcategoryId}/products`);
      const fetchedProducts = Array.isArray(response?.products) ? response.products : [];
      setProducts(fetchedProducts);
    } catch (err) {
      setError(err?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [subcategoryId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    let mounted = true;
    getPricingContext().then((ctx) => {
      if (mounted) setPricingContext(ctx);
    }).catch(() => {
      if (mounted) setPricingContext(null);
    });
    return () => { mounted = false; };
  }, []);

  const formatProductPrice = useCallback((product) => {
    const filters = { 'Metal Type': '10kt', 'Stone Type': 'Lab Grown' };
    const computed = pricingContext ? computeUnitPriceFromSource(product, filters, pricingContext) : 0;
    const n = computed || Number(product?.price ?? product?.sellingPrice ?? product?.mrp ?? 0);
    if (Number.isFinite(n) && n > 0) {
      return `$${n}`;
    }
    return '$0';
  }, [pricingContext]);

  const openProductList = useCallback(
    (product) => {
      const productId = String(product?._id || '');
      if (!productId) return;

      const title =
        product?.name || product?.title || product?.styleNo || `${product?.pointer || 0} Pointer`;
      const displayImage =
        product?.displayImage ||
        product?.imageUrl ||
        (Array.isArray(product?.images) ? product.images[0] : '');

      navigation.navigate('ProductList', {
        categoryName,
        subcategoryProfileName: route?.params?.subcategoryProfileName || '',
        subcategoryId,
        subcategoryName,
        subcategorySubtext: route?.params?.subcategorySubtext || '',
        subcategoryFilterSchema: route?.params?.subcategoryFilterSchema || [],
        subcategoryDescription:
          product?.description || product?.remarks || route?.params?.subcategoryDescription || '',
        subcategoryImages: displayImage ? [displayImage] : route?.params?.subcategoryImages || [],
        subcategoryThumbnailImage: displayImage || route?.params?.subcategoryThumbnailImage || '',
        specialNotePlaceholderText:
          route?.params?.specialNotePlaceholderText || 'Length variation',
        productId,
        productName: title,
        isJacketFlow: true,
      });
    },
    [categoryName, navigation, route?.params, subcategoryId, subcategoryName],
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text style={styles.breadcrumb} numberOfLines={1} ellipsizeMode="tail">
          {breadcrumbText}
        </Text>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : null}

        {!loading && error ? (
          <TouchableOpacity style={styles.stateCard} activeOpacity={0.8} onPress={fetchProducts}>
            <Text style={styles.stateTitle}>Unable to load products</Text>
            <Text style={styles.stateText}>Tap to retry</Text>
          </TouchableOpacity>
        ) : null}

        {!loading && !error && products.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>No products found</Text>
          </View>
        ) : null}

        {!loading && !error
          ? products.map((product) => {
              const productId = String(product?._id || '');
              if (!productId) return null;
              const title = product?.name || product?.title || product?.styleNo || `${product?.pointer || 0} Pointer`;
              const price = formatProductPrice(product);
              
              const displayImage = product?.displayImage || product?.imageUrl || (Array.isArray(product?.images) ? product.images[0] : '');
              const secondaryImage = product?.secondaryImage || null;

              return (
                <JacketProductCard
                  key={productId}
                  title={title}
                  price={price.replace('$', '')}
                  displayImage={displayImage}
                  secondaryImage={secondaryImage}
                  onPress={() => openProductList(product)}
                />
              );
            })
          : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: 40,
  },
  breadcrumb: {
    color: '#000000',
    fontSize: 12,
    marginBottom: 20,
    fontWeight: '400',
  },
  centerContainer: {
    marginTop: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCard: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
  },
  stateTitle: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '400',
  },
  stateText: {
    marginTop: 4,
    color: '#666666',
    fontSize: 12,
  },
});

export default JacketsScreen;

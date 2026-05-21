import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { colors } from '../../constants/colors';
import catalogApi from '../../services/catalogApi';
import CategoryCard from '../../components/client/CategoryCard';

const FeaturedCollectionScreen = ({ route, navigation }) => {
  const { width } = useWindowDimensions();
  const collectionId = route?.params?.collectionId;
  const fallbackName = route?.params?.collectionName || 'Collection';

  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const bannerHeight = width * (9 / 16);
  const cardWidth = (width - 20 * 2 - 8) / 2;

  const fetchCollection = useCallback(async () => {
    if (!collectionId) {
      setError('Missing collection');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await catalogApi.get(`/featured-collections/${collectionId}`);
      setCollection(response?.collection || null);
    } catch (err) {
      setError(err?.message || 'Failed to load collection');
      setCollection(null);
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  const handleItemPress = (item) => {
    if (item.type === 'subcategory') {
      const isStuds = String(item.categoryName || '').trim().toLowerCase() === 'studs';
      const isJackets = String(item.name || '').trim().toLowerCase() === 'jackets';
      if (isStuds && isJackets) {
        navigation.navigate('JacketsScreen', {
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          subcategoryProfileName: item.subcategoryProfileName || '',
          subcategoryId: item.subcategoryId,
          subcategoryName: item.name,
          subcategorySubtext: item.subtext || '',
          subcategoryFilterSchema: item.filterSchema || [],
          subcategoryDescription: item.description || item.infoText || '',
          subcategoryImages: [],
          subcategoryThumbnailImage: item.imageUrl || '',
          specialNotePlaceholderText: 'Length variation',
        });
        return;
      }

      navigation.navigate('ProductList', {
        categoryName: item.categoryName,
        subcategoryProfileName: item.subcategoryProfileName || '',
        subcategoryId: item.subcategoryId,
        subcategoryName: item.name,
        subcategorySubtext: item.subtext || '',
        subcategoryFilterSchema: item.filterSchema || [],
        subcategoryDescription: item.description || item.infoText || '',
        subcategoryImages: [],
        subcategoryThumbnailImage: item.imageUrl || '',
        specialNotePlaceholderText: 'Length variation',
      });
      return;
    }

    navigation.navigate('ProductList', {
      categoryName: item.categoryName,
      subcategoryProfileName: item.subcategoryProfileName || '',
      subcategoryId: item.subcategoryId,
      subcategoryName: item.subcategoryName,
      subcategoryFilterSchema: [],
      subcategoryDescription: item.name || item.styleNo || '',
      subcategoryImages: item.imageUrl ? [item.imageUrl] : [],
      subcategoryThumbnailImage: item.imageUrl || '',
      productId: item.productId,
      specialNotePlaceholderText: 'Length variation',
    });
  };

  const displayName = collection?.name || fallbackName;
  const items = Array.isArray(collection?.items) ? collection.items : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={[styles.bannerContainer, { height: bannerHeight }]}>
        {collection?.bannerImageUrl ? (
          <Image source={{ uri: collection.bannerImageUrl }} style={styles.bannerImage} resizeMode="cover" />
        ) : (
          <View style={styles.bannerPlaceholder} />
        )}
      </View>

      <Text style={styles.collectionTitle}>{String(displayName).toUpperCase()}</Text>

      {loading ? (
        <View style={styles.sectionWrap}>
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((item) => (
              <View key={`fc-skeleton-${item}`} style={[styles.skeletonCard, { width: cardWidth }]} />
            ))}
          </View>
        </View>
      ) : null}

      {!loading && error ? (
        <View style={styles.sectionWrap}>
          <TouchableOpacity onPress={fetchCollection} style={styles.stateCard} activeOpacity={0.8}>
            <Text style={styles.stateTitle}>Unable to load collection</Text>
            <Text style={styles.stateSub}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <View style={styles.sectionWrap}>
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>No items in this collection</Text>
          </View>
        </View>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <View style={styles.sectionWrap}>
          <View style={styles.grid}>
            {items.map((item) => {
              const title = item.type === 'subcategory' ? item.name : item.name || item.styleNo;
              const subtext =
                item.type === 'subcategory'
                  ? item.subtext
                  : `${item.styleNo}${item.subcategoryName ? ` · ${item.subcategoryName}` : ''}`;
              const infoText = item.type === 'subcategory' ? item.infoText : '';

              return (
                <CategoryCard
                  key={item.itemId}
                  style={{ width: cardWidth }}
                  thumbnailUrl={item.imageUrl}
                  title={title}
                  subtext={subtext}
                  infoText={infoText}
                  onPress={() => handleItemPress(item)}
                />
              );
            })}
          </View>
        </View>
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
    paddingBottom: 24,
  },
  bannerContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E9ECEF',
  },
  collectionTitle: {
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 20,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
  },
  sectionWrap: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  skeletonCard: {
    height: 170,
    borderRadius: 12,
    backgroundColor: '#E9ECEF',
  },
  stateCard: {
    minHeight: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
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
});

export default FeaturedCollectionScreen;

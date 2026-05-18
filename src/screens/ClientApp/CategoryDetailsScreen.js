import React, { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { colors } from '../../constants/colors';
import catalogApi from '../../services/catalogApi';
import CategoryCard from '../../components/client/CategoryCard';

const CategoryDetailsScreen = ({ route, navigation }) => {
  const { width } = useWindowDimensions();
  const categoryId = route?.params?.categoryId;
  const categoryName = route?.params?.categoryName || 'Category';
  const categoryBannerImages = Array.isArray(route?.params?.categoryBannerImages)
    ? route.params.categoryBannerImages
    : [];
  const categoryImageUrl = route?.params?.categoryImageUrl || '';
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const categoryBannerUrl = categoryBannerImages.find((url) => typeof url === 'string' && url.trim()) || categoryImageUrl;
  const bannerHeight = width * (9 / 16);
  const cardWidth = (width - 20 * 2 - 8) / 2;
  const getSubcategorySubtext = (subcategory) => {
    const customSubtext = String(subcategory?.subtext || '').trim();
    if (customSubtext) {
      return customSubtext;
    }

    return `${Number(subcategory?.designCount || 0)} Designs`;
  };

  const fetchSubcategories = useCallback(async () => {
    if (!categoryId) {
      setError('Missing category id');
      setProfiles([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await catalogApi.get(`/categories/${categoryId}/subcategory-profiles`);
      const fetchedProfiles = Array.isArray(response?.subcategoryProfiles) ? response.subcategoryProfiles : [];
      setProfiles(fetchedProfiles);
    } catch (err) {
      setError(err?.message || 'Failed to load subcategories');
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    fetchSubcategories();
  }, [fetchSubcategories]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={[styles.bannerContainer, { height: bannerHeight }]}>
        {categoryBannerUrl ? (
          <Image source={{ uri: categoryBannerUrl }} style={styles.bannerImage} resizeMode="cover" />
        ) : (
          <View style={styles.bannerPlaceholder} />
        )}
      </View>

      {loading ? (
        <View style={styles.sectionContentWrap}>
          <View style={styles.grid}>
          {[0, 1, 2, 3].map((item) => (
            <View key={`subcat-skeleton-${item}`} style={[styles.skeletonCard, { width: cardWidth }]} />
          ))}
        </View>
        </View>
      ) : null}

      {!loading && error ? (
        <View style={styles.sectionContentWrap}>
          <TouchableOpacity onPress={fetchSubcategories} style={styles.stateCard} activeOpacity={0.8}>
            <Text style={styles.stateTitle}>Unable to load subcategories</Text>
            <Text style={styles.stateSub}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!loading && !error && profiles.length === 0 ? (
        <View style={styles.sectionContentWrap}>
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>No subcategories available</Text>
          </View>
        </View>
      ) : null}

        {!loading && !error
          ? profiles.map((profile) => (
              <View key={profile._id || profile.name} style={styles.sectionContentWrap}>
                <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {String(profile?.name || categoryName || 'Category').toUpperCase()}
                </Text>
                <View style={styles.grid}>
                  {(profile.subcategories || []).map((subcategory) => (
                    <CategoryCard
                      key={subcategory._id || subcategory.name}
                      style={{ width: cardWidth }}
                      thumbnailUrl={subcategory.imageUrl}
                      title={subcategory.name}
                      subtext={getSubcategorySubtext(subcategory)}
                      infoText={subcategory.infoText}
                      onPress={() => {
                        const isStuds = String(categoryName || '').trim().toLowerCase() === 'studs';
                        const isJackets = String(subcategory.name || '').trim().toLowerCase() === 'jackets';
                        if (isStuds && isJackets) {
                          navigation.navigate('JacketsScreen', {
                            categoryId,
                            categoryName,
                            subcategoryProfileName: profile?.name || '',
                            subcategoryId: subcategory._id,
                            subcategoryName: subcategory.name,
                            subcategorySubtext: subcategory.subtext || '',
                            subcategoryFilterSchema: subcategory.filterSchema || [],
                            subcategoryDescription:
                              subcategory.description || subcategory.infoText || subcategory.subtext || '',
                            subcategoryImages: Array.isArray(subcategory.images) ? subcategory.images : [],
                            subcategoryThumbnailImage:
                              subcategory.thumbnailImage || subcategory.imageUrl || '',
                            specialNotePlaceholderText:
                              subcategory.specialNotePlaceholderText || 'Length variation',
                          });
                        } else {
                          navigation.navigate('ProductList', {
                            categoryName,
                            subcategoryProfileName: profile?.name || '',
                            subcategoryId: subcategory._id,
                            subcategoryName: subcategory.name,
                            subcategorySubtext: subcategory.subtext || '',
                            subcategoryFilterSchema: subcategory.filterSchema || [],
                            subcategoryDescription:
                              subcategory.description || subcategory.infoText || subcategory.subtext || '',
                            subcategoryImages: Array.isArray(subcategory.images) ? subcategory.images : [],
                            subcategoryThumbnailImage:
                              subcategory.thumbnailImage || subcategory.imageUrl || '',
                            specialNotePlaceholderText:
                              subcategory.specialNotePlaceholderText || 'Length variation',
                          });
                        }
                      }}
                    />
                  ))}
                </View>
                </View>
              </View>
            ))
          : null}
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
    borderRadius: 0,
    overflow: 'hidden',
    marginTop: 0,
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
  sectionContentWrap: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  section: {
    marginBottom: 0,
  },
  sectionTitle: {
    width: '100%',
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 8,
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

export default CategoryDetailsScreen;

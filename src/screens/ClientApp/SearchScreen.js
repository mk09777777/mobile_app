import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  InteractionManager,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { CommonActions } from '@react-navigation/native';
import { navigationRef } from '../../navigation/navigationRef';
import { colors } from '../../constants/colors';
import catalogApi from '../../services/catalogApi';

// ─── Type-pill colour themes ─────────────────────────────────────────────────
const PILL = {
  category:    { bg: '#E6F0F1', text: '#143F45' },   // teal   — category
  profile:     { bg: '#EDE9FE', text: '#5B21B6' },   // violet — subcategory profile
  subcategory: { bg: '#FEF3C7', text: '#92400E' },   // amber  — subcategory
  product:     { bg: '#D1FAE5', text: '#065F46' },   // green  — product
};

// ─── Global navigation helper ────────────────────────────────────────────────
// Uses the root navigationRef so we can reach DashboardStack screens from
// inside the App2Navigator stack without needing a reference to nested navs.
const dispatchNavigate = (name, params) => {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(CommonActions.navigate({ name, params }));
  }
};

// ─── Shared card shell ────────────────────────────────────────────────────────
const ResultCard = ({ imageUrl, pillLabel, pillTheme, onPress, children }) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
    {imageUrl ? (
      <Image source={{ uri: imageUrl }} style={styles.cardImg} resizeMode="cover" />
    ) : (
      <View style={[styles.cardImg, styles.imgPlaceholder]} />
    )}
    <View style={styles.cardBody}>
      <View style={[styles.pill, { backgroundColor: pillTheme.bg }]}>
        <Text style={[styles.pillText, { color: pillTheme.text }]}>{pillLabel}</Text>
      </View>
      {children}
    </View>
    <MaterialIcons name="chevron-right" size={22} color={colors.textLight} />
  </TouchableOpacity>
);

// ─── Category card ────────────────────────────────────────────────────────────
const CategoryCard = ({ item, onPress }) => (
  <ResultCard
    imageUrl={item.imageUrl}
    pillLabel="CATEGORY"
    pillTheme={PILL.category}
    onPress={onPress}>
    <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
    <Text style={styles.cardMeta} numberOfLines={1}>
      {Number(item.designCount || 0)} Designs
    </Text>
  </ResultCard>
);

// ─── Subcategory-profile card ─────────────────────────────────────────────────
// Profiles are grouping labels inside a category (e.g. "Solitaire Rings").
// Tapping navigates to CategoryDetails for the parent category.
const ProfileCard = ({ item, onPress }) => (
  <ResultCard
    imageUrl={item.imageUrl}
    pillLabel="PROFILE"
    pillTheme={PILL.profile}
    onPress={onPress}>
    <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
    {item.categoryName ? (
      <Text style={styles.cardMeta} numberOfLines={1}>in {item.categoryName}</Text>
    ) : null}
  </ResultCard>
);

// ─── Subcategory card ─────────────────────────────────────────────────────────
const SubcategoryCard = ({ item, onPress }) => {
  const designCount = Number(item.designCount || 0);
  const metaParts = [
    item.categoryName ? `in ${item.categoryName}` : '',
    item.subcategoryProfileName ? `· ${item.subcategoryProfileName}` : '',
    designCount > 0 ? `${designCount} Designs` : '',
  ].filter(Boolean);

  return (
    <ResultCard
      imageUrl={item.imageUrl || item.thumbnailImage}
      pillLabel="SUBCATEGORY"
      pillTheme={PILL.subcategory}
      onPress={onPress}>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
      {metaParts.length > 0 ? (
        <Text style={styles.cardMeta} numberOfLines={1}>{metaParts.join(' ')}</Text>
      ) : null}
    </ResultCard>
  );
};

// ─── Product card ─────────────────────────────────────────────────────────────
const ProductCard = ({ item, onPress }) => {
  const pointer = Number(item.pointer || 0);
  const metaParts = [
    pointer > 0 ? `${pointer} ct` : '',
    item.subcategoryName || '',
  ].filter(Boolean);

  return (
    <ResultCard
      imageUrl={item.displayImage}
      pillLabel="PRODUCT"
      pillTheme={PILL.product}
      onPress={onPress}>
      {item.styleNo ? (
        <Text style={styles.cardStyleNo} numberOfLines={1}>{item.styleNo}</Text>
      ) : null}
      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.name || item.styleNo}
      </Text>
      {metaParts.length > 0 ? (
        <Text style={styles.cardMeta} numberOfLines={1}>{metaParts.join(' · ')}</Text>
      ) : null}
    </ResultCard>
  );
};

// ─── Section heading ──────────────────────────────────────────────────────────
const SectionHeading = ({ label, count }) => (
  <View style={styles.sectionHeading}>
    <Text style={styles.sectionLabel}>{label}</Text>
    <Text style={styles.sectionCount}>{count}</Text>
  </View>
);

// ─── Main screen ──────────────────────────────────────────────────────────────
const SearchScreen = ({ navigation }) => {
  const [query, setQuery]                             = useState('');
  const [loading, setLoading]                         = useState(false);
  const [categoryResults, setCategoryResults]         = useState([]);
  const [profileResults, setProfileResults]           = useState([]);
  const [subcategoryResults, setSubcategoryResults]   = useState([]);
  const [productResults, setProductResults]           = useState([]);
  const [hasSearched, setHasSearched]                 = useState(false);

  const inputRef    = useRef(null);
  const debounceRef = useRef(null);

  // Auto-focus search input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);

  // Cleanup pending debounce on unmount
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // ── Search execution ────────────────────────────────────────────────────────
  const runSearch = useCallback(async (q) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setCategoryResults([]);
      setProfileResults([]);
      setSubcategoryResults([]);
      setProductResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await catalogApi.get(`/search?q=${encodeURIComponent(trimmed)}`);
      setCategoryResults(Array.isArray(res?.categories)          ? res.categories          : []);
      setProfileResults(Array.isArray(res?.subcategoryProfiles)  ? res.subcategoryProfiles : []);
      setSubcategoryResults(Array.isArray(res?.subcategories)    ? res.subcategories       : []);
      setProductResults(Array.isArray(res?.products)             ? res.products            : []);
    } catch (err) {
      if (__DEV__) console.warn('[SearchScreen] search error:', err?.message);
      setCategoryResults([]);
      setProfileResults([]);
      setSubcategoryResults([]);
      setProductResults([]);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }, []);

  // ── Debounced input change ──────────────────────────────────────────────────
  const handleChange = useCallback((text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), 300);
  }, [runSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
    setCategoryResults([]);
    setProfileResults([]);
    setSubcategoryResults([]);
    setProductResults([]);
    setHasSearched(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    inputRef.current?.focus();
  }, []);

  // ── Navigation ──────────────────────────────────────────────────────────────
  // Pops SearchScreen from App2Navigator first so it doesn't sit behind CatalogMain.
  // InteractionManager waits for the back-animation to finish before deep-linking.
  const navigateToResult = useCallback((screenName, params) => {
    navigation.goBack();
    InteractionManager.runAfterInteractions(() => {
      dispatchNavigate(screenName, params);
    });
  }, [navigation]);

  // Category → CategoryDetails
  const handleCategoryPress = useCallback((cat) => {
    navigateToResult('CategoryDetails', {
      categoryId: cat._id,
      categoryName: cat.name,
      categoryBannerImages: Array.isArray(cat.categoryBannerImages) ? cat.categoryBannerImages : [],
      categoryImageUrl: cat.imageUrl || '',
    });
  }, [navigateToResult]);

  // SubcategoryProfile → CategoryDetails for the parent category
  // (The user sees the full category page with the profile group highlighted naturally)
  const handleProfilePress = useCallback((profile) => {
    navigateToResult('CategoryDetails', {
      categoryId: profile.categoryId,
      categoryName: profile.categoryName || '',
      categoryBannerImages: Array.isArray(profile.categoryBannerImages)
        ? profile.categoryBannerImages : [],
      categoryImageUrl: profile.imageUrl || '',
    });
  }, [navigateToResult]);

  // Subcategory → ProductList (or JacketsScreen for the Studs → Jackets flow)
  const handleSubcategoryPress = useCallback((sub) => {
    const isStuds   = String(sub.categoryName || '').trim().toLowerCase() === 'studs';
    const isJackets = String(sub.name         || '').trim().toLowerCase() === 'jackets';
    navigateToResult(isStuds && isJackets ? 'JacketsScreen' : 'ProductList', {
      categoryId:                 sub.categoryId,
      categoryName:               sub.categoryName               || '',
      subcategoryProfileName:     sub.subcategoryProfileName     || '',
      subcategoryId:              sub._id,
      subcategoryName:            sub.name,
      subcategorySubtext:         sub.subtext                    || '',
      subcategoryFilterSchema:    Array.isArray(sub.filterSchema) ? sub.filterSchema : [],
      subcategoryDescription:     sub.description || sub.infoText || sub.subtext || '',
      subcategoryImages:          Array.isArray(sub.images) ? sub.images : [],
      subcategoryThumbnailImage:  sub.imageUrl || sub.thumbnailImage || '',
      specialNotePlaceholderText: sub.specialNotePlaceholderText || 'Length variation',
    });
  }, [navigateToResult]);

  // Product → ProductList for the product's subcategory.
  // The backend already embeds full subcategory nav params on each product result
  // so we never need a second fetch.
  const handleProductPress = useCallback((product) => {
    const isStuds   = String(product.categoryName || '').trim().toLowerCase() === 'studs';
    const isJackets = String(product.subcategoryName || '').trim().toLowerCase() === 'jackets';
    navigateToResult(isStuds && isJackets ? 'JacketsScreen' : 'ProductList', {
      categoryId:                 product.categoryId,
      categoryName:               product.categoryName               || '',
      subcategoryProfileName:     product.subcategoryProfileName     || '',
      subcategoryId:              product.subcategoryId,
      subcategoryName:            product.subcategoryName            || 'Products',
      subcategorySubtext:         product.subcategorySubtext         || '',
      subcategoryFilterSchema:    Array.isArray(product.subcategoryFilterSchema)
        ? product.subcategoryFilterSchema : [],
      subcategoryDescription:     product.subcategoryDescription     || '',
      subcategoryImages:          Array.isArray(product.subcategoryImages)
        ? product.subcategoryImages : [],
      subcategoryThumbnailImage:  product.subcategoryThumbnailImage  || product.displayImage || '',
      specialNotePlaceholderText: product.specialNotePlaceholderText || 'Length variation',
    });
  }, [navigateToResult]);

  // ── Derived display state ───────────────────────────────────────────────────
  const isShortQuery  = query.trim().length < 2;
  const totalResults  =
    categoryResults.length + profileResults.length +
    subcategoryResults.length + productResults.length;
  const showNoResults = hasSearched && !loading && totalResults === 0;
  const showResults   = !loading && totalResults > 0;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>

      {/* ── Header bar ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={colors.textWhite} />
        </TouchableOpacity>

        <View style={styles.inputWrap}>
          <MaterialIcons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder="Search products, categories, profiles..."
            placeholderTextColor={colors.textLight}
            value={query}
            onChangeText={handleChange}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 ? (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Results scroll ──────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}>

        {/* Idle prompt */}
        {isShortQuery && !loading ? (
          <View style={styles.stateWrap}>
            <MaterialIcons name="search" size={52} color={colors.border} />
            <Text style={styles.stateTitle}>Search the catalog</Text>
            <Text style={styles.stateSub}>
              Find categories, profiles, subcategories and products
            </Text>
          </View>
        ) : null}

        {/* Searching spinner */}
        {loading ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Searching…</Text>
          </View>
        ) : null}

        {/* Zero results */}
        {showNoResults ? (
          <View style={styles.stateWrap}>
            <MaterialIcons name="search-off" size={52} color={colors.border} />
            <Text style={styles.stateTitle}>No results found</Text>
            <Text style={styles.stateSub}>Try a different keyword</Text>
          </View>
        ) : null}

        {/* ── 1. Categories ───────────────────────────────────────────────── */}
        {showResults && categoryResults.length > 0 ? (
          <View style={styles.section}>
            <SectionHeading label="CATEGORIES" count={categoryResults.length} />
            {categoryResults.map((item) => (
              <CategoryCard
                key={String(item._id)}
                item={item}
                onPress={() => handleCategoryPress(item)}
              />
            ))}
          </View>
        ) : null}

        {/* ── 2. Subcategory profiles ─────────────────────────────────────── */}
        {showResults && profileResults.length > 0 ? (
          <View style={styles.section}>
            <SectionHeading label="PROFILES" count={profileResults.length} />
            {profileResults.map((item) => (
              <ProfileCard
                key={String(item._id)}
                item={item}
                onPress={() => handleProfilePress(item)}
              />
            ))}
          </View>
        ) : null}

        {/* ── 3. Subcategories ────────────────────────────────────────────── */}
        {showResults && subcategoryResults.length > 0 ? (
          <View style={styles.section}>
            <SectionHeading label="SUBCATEGORIES" count={subcategoryResults.length} />
            {subcategoryResults.map((item) => (
              <SubcategoryCard
                key={String(item._id)}
                item={item}
                onPress={() => handleSubcategoryPress(item)}
              />
            ))}
          </View>
        ) : null}

        {/* ── 4. Products ─────────────────────────────────────────────────── */}
        {showResults && productResults.length > 0 ? (
          <View style={styles.section}>
            <SectionHeading label="PRODUCTS" count={productResults.length} />
            {productResults.map((item) => (
              <ProductCard
                key={String(item._id)}
                item={item}
                onPress={() => handleProductPress(item)}
              />
            ))}
          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    padding: 0,
    fontFamily: 'AvenirLTStd-Roman',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },

  // Empty / loading states
  stateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 10,
  },
  stateTitle: {
    marginTop: 6,
    fontSize: 17,
    fontFamily: 'AvenirLTStd-Heavy',
    color: colors.textSecondary,
  },
  stateSub: {
    fontSize: 13,
    fontFamily: 'AvenirLTStd-Roman',
    color: colors.textLight,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: 'AvenirLTStd-Roman',
    color: colors.textSecondary,
  },

  // Section
  section: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'AvenirLTStd-Heavy',
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  sectionCount: {
    fontSize: 11,
    fontFamily: 'AvenirLTStd-Roman',
    color: colors.textLight,
  },

  // Result card (shared shell)
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    marginBottom: 8,
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardImg: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  imgPlaceholder: {
    backgroundColor: colors.borderLight,
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },

  // Type pill
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 2,
  },
  pillText: {
    fontSize: 9,
    fontFamily: 'AvenirLTStd-Heavy',
    letterSpacing: 0.8,
  },

  // Card text
  cardStyleNo: {
    fontSize: 11,
    fontFamily: 'AvenirLTStd-Roman',
    color: colors.textSecondary,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'AvenirLTStd-Medium',
    color: colors.textPrimary,
    lineHeight: 19,
  },
  cardMeta: {
    fontSize: 12,
    fontFamily: 'AvenirLTStd-Roman',
    color: colors.textSecondary,
  },
});

export default SearchScreen;

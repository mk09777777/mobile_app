import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Image,
  Alert,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';

let DocumentPicker;
try {
  DocumentPicker = require('react-native-document-picker').default;
} catch (e) {
  DocumentPicker = null;
}

import { Card } from '../../components/cards/Cards';
import Icon from '../../components/common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { useClients } from '../../features/clients/clientsHooks';
import { useGetStoneTypesQuery, useGetMetalPricesQuery, useCalculatePricingMutation,useImagepriceDataMutation } from '../../store/api';

export default function PricingCalci() {
  // Form State
  const [clientId, setClientId] = useState('');
  const [stoneType, setStoneType] = useState('');
  const [metalKt, setMetalKt] = useState('18K');
  const [imageFile, setImageFile] = useState(null);
  const [excelFile, setExcelFile] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // Modals Visibility
  const [showClientModal, setShowClientModal] = useState(false);
  const [showStoneModal, setShowStoneModal] = useState(false);
  const [showMetalModal, setShowMetalModal] = useState(false);
  const [showAllPricesModal, setShowAllPricesModal] = useState(false);

  // API Data
  const { clients = [] } = useClients();
  const { data: stoneTypesData = [] } = useGetStoneTypesQuery();
  const { data: metalPricesData } = useGetMetalPricesQuery(false);
  const [calculatePricing, { isLoading: isCalculating }] = useCalculatePricingMutation();
  const [GetimagepriceData, { isLoading: isImageLoading }] = useImagepriceDataMutation();

  // Options Formatting
  const clientOptions = clients.map((c) => ({
    label: c.name || 'Unknown Client',
    value: c.id || c._id,
  }));

  const stoneOptions = stoneTypesData.map((st) => ({
    label: st.label,
    value: st.value,
  }));

  const metalQualityOptions = [
    { label: '10K', value: '10K' },
    { label: '14K', value: '14K' },
    { label: '18K', value: '18K' },
    { label: '22K', value: '22K' },
    { label: 'Silver 925', value: 'Silver 925' },
    { label: 'Platinum', value: 'Platinum' },
  ];

  // Calculate Today's Price based on selection
  const getTodayPrice = () => {
    const prices = metalPricesData?.prices || {};
    if (metalKt.includes('Silver')) {
      return prices.silver?.price ? `$${prices.silver.price.toFixed(2)} / g` : 'N/A';
    }
    if (metalKt.includes('Platinum')) {
      return prices.platinum?.price ? `$${prices.platinum.price.toFixed(2)} / g` : 'N/A';
    }
    
    // For Gold (e.g. 10K, 14K, 18K)
    const baseGoldPrice = prices.gold?.price || 0;
    if (!baseGoldPrice) return 'N/A';

    const match = metalKt.match(/(\d+)K/i);
    if (match) {
      const kt = parseInt(match[1], 10);
      const calculatedPrice = baseGoldPrice * (kt / 24);
      return `$${calculatedPrice.toFixed(2)} / g`;
    }
    return 'N/A';
  };

  const todayPriceDisplay = getTodayPrice();

  // Handlers
  const handleImagePick = async () => {
    // Validate required fields before picking image
    if (!clientId) {
      Alert.alert('Validation Error', 'Please select a client first');
      return;
    }
    if (!stoneType) {
      Alert.alert('Validation Error', 'Please select a stone type first');
      return;
    }

    try {
      const pickerResult = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
      if (pickerResult.didCancel) return;
      if (pickerResult.assets && pickerResult.assets.length > 0) {
        const asset = pickerResult.assets[0];
        // Max 20MB limit validation
        if (asset.fileSize && asset.fileSize > 20 * 1024 * 1024) {
          Alert.alert('File too large', 'Maximum allowed image size is 20MB.');
          return;
        }
        setImageFile({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
        });

        // Show loader and extract data from image
        setIsExtracting(true);
        try {
          const apiResult = await GetimagepriceData({
            image: {
              uri: asset.uri,
              name: asset.fileName || `image_${Date.now()}.jpg`,
              type: asset.type || 'image/jpeg',
            },
            clientId: clientId,
            stoneType: stoneType,
            metalQuality: metalKt,
          }).unwrap();

          console.log('🚀 image price data', apiResult);
          setImageData(apiResult);
        } catch (apiError) {
          console.error('❌ API Error:', apiError);
          const errorMsg = apiError?.data?.message || apiError?.error || 'Failed to extract pricing data. Please ensure the client has pricing configuration set up.';
          Alert.alert('Extraction Error', errorMsg);
          // Clear the image on error
          setImageFile(null);
        } finally {
          setIsExtracting(false);
        }
      }
    } catch (error) {
      console.error('❌ Image Picker Error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      setIsExtracting(false);
    }
  };

  const handleExcelPick = async () => {
    if (!DocumentPicker) {
      Alert.alert(
        'Feature Not Available',
        'Document picker is not available on this device.'
      );
      return;
    }
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.xlsx, DocumentPicker.types.xls],
      });
      setExcelFile({
        uri: result.uri,
        name: result.name,
        type: result.type,
      });
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('Error', 'Failed to pick excel file');
      }
    }
  };

  const handleCalculate = async (extractedDetails = null) => {
    const data = extractedDetails || imageData;
    const detailsData = data?.pricing || data?.extractedData || data?.details || data;
    
    if (!detailsData) {
      Alert.alert('Validation Error', 'No pricing data available. Please upload an image first.');
      return;
    }
    
    try {
      // Structure the payload exactly as the backend expects
      const rawStones = Array.isArray(detailsData.Stones) 
        ? detailsData.Stones 
        : Array.isArray(detailsData.stones) ? detailsData.stones : [];

      const formattedStones = rawStones.map(stone => ({
        Type: stone.Type || stone.type || stoneType || '',
        Color: stone.Color || stone.color || '',
        Shape: stone.Shape || stone.shape || '',
        MmSize: (stone.MmSize || stone.mmSize || stone.MM || stone.mm || '0').toString(),
        SieveSize: (stone.SieveSize || stone.sieveSize || stone.Sieve || stone.sieve || '0').toString(),
        CtWeight: parseFloat(stone.CtWeight || stone.ctWeight || stone.CaratWeight || stone.caratWeight || 0) || 0,
        Weight: parseFloat(stone.Weight || stone.weight || 0) || 0,
        Pcs: parseInt(stone.Pcs || stone.pcs || stone.Pieces || stone.pieces || 0, 10) || 0,
        Price: parseFloat(stone.Price || stone.price || 0) || 0,
      })).filter(s => s.Type);

      const payloadDetails = {
        Metal: {
          Weight: parseFloat(detailsData.Metal?.Weight || detailsData.metalWeight || 0) || 0,
          Quality: detailsData.Metal?.Quality || detailsData.metalQuality || metalKt,
        },
        Stones: formattedStones,
        Quantity: parseInt(detailsData.Quantity || detailsData.quantity || 1, 10) || 1,
      };

      const result = await calculatePricing({
        details: payloadDetails,
        clientId,
      }).unwrap();

      const finalPrice = result?.TotalPrice !== undefined ? result.TotalPrice : (result?.totalPrice || 'N/A');
      Alert.alert(
        'Calculation Complete',
        `Total Price: $${finalPrice}\n\nPlease check the console for detailed pricing breakdown.`,
        [{ text: 'OK' }]
      );
      
      console.log('💰 Pricing Result:', result);
    } catch (error) {
      console.error('❌ Pricing calculation error:', error);
      const errorMsg = error?.data?.message || error?.message || 'Failed to calculate pricing. Please ensure the client has pricing configuration set up.';
      Alert.alert('Calculation Failed', errorMsg);
    }
  };

  // Reusable Dropdown Render Function
  const renderDropdown = (
    label,
    placeholder,
    value,
    options,
    isVisible,
    setVisible,
    onSelect,
    extraElement = null
  ) => {
    const selectedLabel = options.find((o) => o.value === value)?.label || placeholder;

    return (
      <View style={styles.inputContainer}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {extraElement}
        </View>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={[styles.dropdownText, !value && styles.placeholderText]}>
            {selectedLabel}
          </Text>
          <Icon name="arrow-drop-down" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <Modal
          visible={isVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setVisible(false)}
          >
            <View style={styles.modalContent}>
              <ScrollView showsVerticalScrollIndicator={true}>
                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.dropdownOption,
                      value === opt.value && styles.dropdownOptionSelected,
                    ]}
                    onPress={() => {
                      onSelect(opt.value);
                      setVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        value === opt.value && styles.dropdownOptionTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {value === opt.value && (
                      <Icon name="check" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Text style={styles.title}>Pricing Calculator</Text>

          {renderDropdown(
            'Client*',
            'Select a client...',
            clientId,
            clientOptions,
            showClientModal,
            setShowClientModal,
            setClientId
          )}

          {renderDropdown(
            'Stone Type*',
            'Select stone type...',
            stoneType,
            stoneOptions,
            showStoneModal,
            setShowStoneModal,
            setStoneType
          )}

          {renderDropdown(
            'Metal Kt*',
            'Select Metal Kt...',
            metalKt,
            metalQualityOptions,
            showMetalModal,
            setShowMetalModal,
            setMetalKt,
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.extraText}>Today: {todayPriceDisplay}</Text>
              <TouchableOpacity onPress={() => setShowAllPricesModal(true)} style={{ marginLeft: 8 }}>
                <Icon name="monetization-on" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Image*</Text>
            <TouchableOpacity
              style={styles.uploadArea}
              onPress={handleImagePick}
              activeOpacity={0.7}
              disabled={isExtracting || isImageLoading}
            >
              {isExtracting || isImageLoading ? (
                <View style={styles.loadingContainer}>
                  <Icon name="hourglass-empty" size={40} color={colors.primary} />
                  <Text style={styles.uploadText}>Extracting pricing data...</Text>
                  <Text style={styles.uploadSubText}>Please wait while we analyze the image</Text>
                </View>
              ) : imageFile ? (
                <View style={styles.filePreview}>
                  <Image source={{ uri: imageFile.uri }} style={styles.previewImage} />
                  <Text style={styles.fileName} numberOfLines={1}>{imageFile.name}</Text>
                  <TouchableOpacity onPress={() => { setImageFile(null); setImageData(null); }}>
                    <Icon name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Icon name="cloud-upload" size={40} color={colors.primary} />
                  <Text style={styles.uploadText}>No file chosen</Text>
                  <Text style={styles.uploadSubText}>Select client & stone type first, then upload (max 20 MB)</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Excel (optional)</Text>
            <TouchableOpacity
              style={styles.uploadArea}
              onPress={handleExcelPick}
              activeOpacity={0.7}
            >
              {excelFile ? (
                <View style={styles.filePreview}>
                  <Icon name="insert-drive-file" size={40} color={colors.primary} />
                  <Text style={styles.fileName} numberOfLines={1}>{excelFile.name}</Text>
                  <TouchableOpacity onPress={() => setExcelFile(null)}>
                    <Icon name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Icon name="file-upload" size={40} color={colors.primary} />
                  <Text style={styles.uploadText}>No file chosen</Text>
                  <Text style={styles.uploadSubText}>Drag & drop .xlsx (overrides image data)</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => handleCalculate()}
          disabled={isCalculating || isExtracting || isImageLoading || !imageData}
          style={[
            styles.calculateButton,
            (isCalculating || isExtracting || isImageLoading || !imageData) && styles.calculateButtonDisabled,
          ]}
          activeOpacity={0.8}
        >
          <Icon name="calculate" size={20} color={colors.textWhite} />
          <Text style={styles.calculateButtonText}>
            {isCalculating ? 'Calculating...' : isExtracting || isImageLoading ? 'Extracting...' : 'Calculate'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showAllPricesModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAllPricesModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAllPricesModal(false)}
        >
          <View style={styles.pricesModalContent}>
            <Text style={styles.pricesModalTitle}>Current Metal Prices</Text>
            <ScrollView style={styles.pricesList}>
              {metalPricesData?.prices ? (
                Object.entries(metalPricesData.prices).map(([metal, data]) => (
                  <View key={metal} style={styles.priceRow}>
                    <Text style={styles.priceMetal}>{metal.charAt(0).toUpperCase() + metal.slice(1)}</Text>
                    <Text style={styles.priceValue}>${data?.price?.toFixed(2)} / {data?.unit || 'g'}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noPricesText}>No prices available</Text>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.closePricesButton}
              onPress={() => setShowAllPricesModal(false)}
            >
              <Text style={styles.closePricesButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    padding: 20,
    borderRadius: 12,
  },
  title: {
    fontSize: fonts.xl,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  label: {
    fontSize: fonts.md,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  extraText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: colors.background,
  },
  dropdownText: {
    fontSize: fonts.md,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  placeholderText: {
    color: colors.textLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 12,
    minWidth: 250,
    maxWidth: '80%',
    maxHeight: '60%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight || colors.border,
  },
  dropdownOptionSelected: {
    backgroundColor: colors.backgroundSecondary,
  },
  dropdownOptionText: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  dropdownOptionTextSelected: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface || colors.backgroundSecondary,
    minHeight: 120,
  },
  uploadText: {
    fontSize: fonts.md,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    marginTop: 8,
  },
  uploadSubText: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  previewImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
  },
  fileName: {
    flex: 1,
    marginHorizontal: 10,
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  calculateButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  calculateButtonDisabled: {
    opacity: 0.6,
  },
  calculateButtonText: {
    color: colors.textWhite,
    fontFamily: fonts.bold,
    fontSize: fonts.md,
  },
  pricesModalContent: {
    backgroundColor: colors.background,
    borderRadius: 12,
    width: '80%',
    maxHeight: '60%',
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  pricesModalTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  pricesList: {
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight || colors.border,
  },
  priceMetal: {
    fontSize: fonts.md,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  priceValue: {
    fontSize: fonts.md,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  noPricesText: {
    fontSize: fonts.md,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  closePricesButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closePricesButtonText: {
    color: colors.textWhite,
    fontFamily: fonts.bold,
    fontSize: fonts.md,
  },
});
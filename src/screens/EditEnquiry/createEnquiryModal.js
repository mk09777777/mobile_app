import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Text,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Input, Button } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import IconComponent from '../../components/common/Icon';
import {
  useGetUsersQuery,
  useGetStoneTypesQuery,
  useParseEnquiryMutation,
  useSubmitEnquiryMutation,
} from '../../store/api';
import { useClients } from '../../features/clients/clientsHooks';
import { useAuth } from '../../context/AuthContext';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import BrandedAlert from '../../components/common/BrandedAlert';
import { useSelector } from 'react-redux';

export default function CreateEnquiryModal({ visible, onClose, onEnquiryCreated, route }) {
  const { user } = useAuth();
  const [parseEnquiry, { isLoading: isParsing }] = useParseEnquiryMutation();
  const [submitEnquiry, { isLoading: isSubmitting }] = useSubmitEnquiryMutation();
  const { clients: clientsData = [] } = useClients({ skip: false });
  const clients = Array.isArray(clientsData) ? clientsData : [];
  const { data: stoneTypesData = [] } = useGetStoneTypesQuery();

  const roleLower = user?.role?.toLowerCase();
  const isClient = roleLower === 'client' || roleLower === 'cl' || user?.roleId === 4 || user?.roleNumber === 4;

  const reduxFilters = useSelector(state => state.enquiries?.filters);
  const reduxSelectedClient = useSelector(state => state.enquiries?.selectedClient);
  const preSelectedClientId = route?.params?.clientId || reduxFilters?.clientId || null;
  const preSelectedClientIdResolved = preSelectedClientId && preSelectedClientId !== 'all' ? preSelectedClientId : null;
  const preSelectedClientName = route?.params?.clientName || route?.params?.filter || (reduxSelectedClient && reduxSelectedClient !== 'All' ? reduxSelectedClient : null) || (preSelectedClientIdResolved ? clients.find(c => (c.id || c._id) === preSelectedClientIdResolved)?.name : null) || null;

  const [projectType, setProjectType] = useState('coral');
  const [enquiryDescription, setEnquiryDescription] = useState('');
  const [referenceImages, setReferenceImages] = useState([]);
  const [textSubmitted, setTextSubmitted] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [dynamicMissingFields, setDynamicMissingFields] = useState([]);
  const [missingFieldsData, setMissingFieldsData] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  useEffect(() => {
    if (visible) {
      console.log('CreateEnquiryModal - clientId:', preSelectedClientIdResolved, 'clientName:', preSelectedClientName);
    }
    if (!visible) {
      setProjectType('coral');
      setEnquiryDescription('');
      setReferenceImages([]);
      setTextSubmitted(false);
      setParsedData(null);
      setDynamicMissingFields([]);
      setMissingFieldsData({});
      setShowConfirmModal(false);
    }
  }, [visible]);

  const handleImagePicker = async () => {
    const result = await launchImageLibrary({ mediaType: 'mixed', selectionLimit: 10 });
    if (result.assets) {
      setReferenceImages(prev => [
        ...prev,
        ...result.assets.map(a => ({ uri: a.uri, name: a.fileName, type: a.type })),
      ]);
    }
  };

  const handleCamera = async () => {
    const result = await launchCamera({ mediaType: 'photo', quality: 0.8, saveToPhotos: true });
    if (result.assets?.length > 0) {
      const a = result.assets[0];
      setReferenceImages(prev => [
        ...prev,
        { uri: a.uri, type: a.type || 'image/jpeg', name: a.fileName || `camera_${Date.now()}.jpg` },
      ]);
    }
  };

  const handleTextSubmit = async () => {
    try {
      const result = await parseEnquiry({
        message: enquiryDescription,
        mediaType: projectType,
      }).unwrap();
      setParsedData(result.parsed);
      const missing = (result.missingFields || []).filter(f => f.field !== 'ClientId');
      setDynamicMissingFields(missing);
      if (preSelectedClientIdResolved) {
        setMissingFieldsData(prev => ({ ...prev, ClientId: preSelectedClientIdResolved }));
      }
      setTextSubmitted(true);
    } catch (error) {
      showAlert(
        'Parsing Failed',
        'AI parsing failed. Would you like to fill the form manually?',
        'warning',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Fill Manually',
            onPress: () => {
              setTextSubmitted(true);
              setParsedData(null);
              setDynamicMissingFields([]);
              if (preSelectedClientIdResolved) {
                setMissingFieldsData(prev => ({ ...prev, ClientId: preSelectedClientIdResolved }));
              }
            },
          },
        ]
      );
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      showAlert('Error', 'User not found. Please login again.', 'error');
      return;
    }

    try {
      const isAIParsingFlow = textSubmitted && parsedData !== null;
      let finalData;

      if (isAIParsingFlow) {
        finalData = {
          Name: missingFieldsData.Name || parsedData?.Name || '',
          ClientId: preSelectedClientIdResolved || missingFieldsData.ClientId || parsedData?.ClientId || (isClient ? user.clientId || user.id : user.id),
          AssignedTo: missingFieldsData.AssignedTo || parsedData?.AssignedTo || (isClient ? null : null),
          Status: missingFieldsData.Status || parsedData?.Status || 'Enquiry Created',
          Priority: missingFieldsData.Priority || parsedData?.Priority || 'Normal',
          Quantity: missingFieldsData.Quantity || parsedData?.Quantity || 1,
          Metal: {
            Color: missingFieldsData.MetalColor || parsedData?.Metal?.Color || null,
            Quality: missingFieldsData.MetalQuality || parsedData?.Metal?.Quality || '10K',
          },
          StoneType: missingFieldsData.StoneType || parsedData?.StoneType || null,
          Stamping: missingFieldsData.Stamping || parsedData?.Stamping || null,
          Remarks: missingFieldsData.Remarks || parsedData?.Remarks || '',
          Category: missingFieldsData.Category || parsedData?.Category || 'Ring',
          Budget: missingFieldsData.Budget || parsedData?.Budget || null,
          SpecialRemarks: missingFieldsData.SpecialRemarks || parsedData?.SpecialRemarks || null,
          StyleNumber: missingFieldsData.StyleNumber || parsedData?.StyleNumber || null,
          GatiOrderNumber: missingFieldsData.GatiOrderNumber || parsedData?.GatiOrderNumber || null,
          ShippingDate: missingFieldsData.ShippingDate || parsedData?.ShippingDate || null,
          CoralCode: missingFieldsData.CoralCode || parsedData?.CoralCode || null,
          CadCode: missingFieldsData.CadCode || parsedData?.CadCode || null,
          ApprovedDate: missingFieldsData.ApprovedDate || parsedData?.ApprovedDate || null,
        };

        if (missingFieldsData.MetalWeightFrom || missingFieldsData.MetalWeightTo || missingFieldsData.MetalWeightExact) {
          finalData.MetalWeight = {
            From: missingFieldsData.MetalWeightFrom || null,
            To: missingFieldsData.MetalWeightTo || null,
            Exact: missingFieldsData.MetalWeightExact || null,
          };
        }
        if (missingFieldsData.DiamondWeightFrom || missingFieldsData.DiamondWeightTo || missingFieldsData.DiamondWeightExact) {
          finalData.DiamondWeight = {
            From: missingFieldsData.DiamondWeightFrom || null,
            To: missingFieldsData.DiamondWeightTo || null,
            Exact: missingFieldsData.DiamondWeightExact || null,
          };
        }
      } else {
        finalData = {
          Name: '',
          ClientId: preSelectedClientIdResolved || user.clientId || user.id,
          AssignedTo: null,
          Status: 'Enquiry Created',
          Priority: 'Normal',
          Quantity: 1,
          Metal: { Color: null, Quality: '10K' },
          StoneType: null,
          Stamping: null,
          Remarks: '',
          Category: 'Ring',
          Budget: null,
          SpecialRemarks: null,
          StyleNumber: null,
          GatiOrderNumber: null,
          ShippingDate: null,
          CoralCode: null,
          CadCode: null,
          ApprovedDate: null,
        };
      }

      const result = await submitEnquiry({
        data: finalData,
        referenceImages: referenceImages,
      }).unwrap();

      let enquiryId = result?.id || result?._id || result?.data?.id || result?.data?._id || result?.enquiry?.id || result?.enquiry?._id || result?.insertedId;

      showAlert(
        'Enquiry Created!',
        'Your enquiry has been created successfully.',
        'success',
        [
          {
            text: 'Done',
            onPress: () => {
              hideAlert();
              onClose();
              if (onEnquiryCreated) onEnquiryCreated(enquiryId || result, finalData);
            },
          },
        ]
      );
    } catch (error) {
      showAlert('Error', 'Failed to create enquiry. Please try again.', 'error');
    }
  };

  const renderMissingFields = () => {
    if (dynamicMissingFields.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Complete Missing Details</Text>
        {dynamicMissingFields.map((item, index) => {
          if (item.field === 'ClientId' && item.options.length > 0) {
            return (
              <View key={index} style={styles.tileGroup}>
                <Text style={styles.dropdownLabel}>{item.label}</Text>
                <View style={styles.chipRowWrap}>
                  {item.options.map(option => {
                    const selected = missingFieldsData[item.field] === option.value;
                    const clientName = clients.find(c => (c.id || c._id) === option.value)?.name || option.label;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.choiceChip, selected && styles.choiceChipActive]}
                        activeOpacity={0.85}
                        onPress={() => setMissingFieldsData(prev => ({ ...prev, [item.field]: option.value }))}
                      >
                        <Text style={[styles.choiceChipLabel, selected && styles.choiceChipLabelActive]}>{clientName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          } else if (item.options.length > 0) {
            return (
              <View key={index} style={styles.tileGroup}>
                <Text style={styles.dropdownLabel}>{item.label}</Text>
                <View style={styles.chipRowWrap}>
                  {item.options.map(option => {
                    const selected = missingFieldsData[item.field] === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.choiceChip, selected && styles.choiceChipActive]}
                        activeOpacity={0.85}
                        onPress={() => setMissingFieldsData(prev => ({ ...prev, [item.field]: option.value }))}
                      >
                        <Text style={[styles.choiceChipLabel, selected && styles.choiceChipLabelActive]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          } else {
            return (
              <View key={index} style={styles.formRow}>
                <View style={[styles.formField, styles.fullWidthField]}>
                  <Input
                    label={item.label}
                    placeholder={`Enter ${item.label.toLowerCase()}`}
                    value={missingFieldsData[item.field] || ''}
                    onChangeText={value => setMissingFieldsData(prev => ({ ...prev, [item.field]: value }))}
                  />
                </View>
              </View>
            );
          }
        })}
      </View>
    );
  };

  const renderParsedPreview = () => {
    if (!parsedData) return null;
    const displayClientName = preSelectedClientName;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Extracted Details</Text>
        <View style={styles.parsedDataCard}>
          <Text style={styles.parsedDataLabel}>Name: <Text style={styles.parsedDataValue}>{parsedData.Name || 'Not specified'}</Text></Text>
          {!isClient && <Text style={styles.parsedDataLabel}>Client: <Text style={styles.parsedDataValue}>{displayClientName}</Text></Text>}
          <Text style={styles.parsedDataLabel}>Category: <Text style={styles.parsedDataValue}>{parsedData.Category || 'Not specified'}</Text></Text>
          <Text style={styles.parsedDataLabel}>Metal: <Text style={styles.parsedDataValue}>{parsedData.Metal?.Quality || ''} {parsedData.Metal?.Color || ''}</Text></Text>
          <Text style={styles.parsedDataLabel}>Stone Type: <Text style={styles.parsedDataValue}>{parsedData.StoneType || 'Not specified'}</Text></Text>
          <Text style={styles.parsedDataLabel}>Priority: <Text style={styles.parsedDataValue}>{parsedData.Priority || 'Normal'}</Text></Text>
          <Text style={styles.parsedDataLabel}>Status: <Text style={styles.parsedDataValue}>{parsedData.Status || 'Not specified'}</Text></Text>
        </View>
        {renderMissingFields()}
      </View>
    );
  };

  const renderInitialInput = () => {
    const isSubmitReady = enquiryDescription.trim().length > 0;
    return (
      <View>
        <View style={styles.uploadArea}>
          <TouchableOpacity onPress={handleImagePicker} activeOpacity={0.7}>
            <IconComponent name="cloud-upload" size={32} color={colors.primary} />
            <Text style={styles.uploadText}>Tap to add images / videos</Text>
            <Text style={styles.uploadSubtext}>Camera or Gallery</Text>
          </TouchableOpacity>
        </View>
        {referenceImages.length > 0 && (
          <View style={styles.previewRow}>
            {referenceImages.map((img, i) => (
              <View key={i} style={styles.previewItem}>
                <Image source={{ uri: img.uri }} style={styles.previewThumb} />
                <TouchableOpacity onPress={() => setReferenceImages(prev => prev.filter((_, idx) => idx !== i))}>
                  <IconComponent name="close" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <Input
          placeholder="Describe your custom jewelry piece"
          multiline
          numberOfLines={6}
          value={enquiryDescription}
          onChangeText={setEnquiryDescription}
          style={{ minHeight: 120, textAlignVertical: 'top' }}
        />
        <TouchableOpacity onPress={() => setShowConfirmModal(true)} disabled={!isSubmitReady || isParsing}>
          <View style={[styles.submitBtn, (!isSubmitReady || isParsing) && styles.submitBtnDisabled]}>
            {isParsing ? (
              <ActivityIndicator size="small" color={colors.textWhite} />
            ) : (
              <Text style={styles.submitBtnText}>{isParsing ? 'Parsing...' : 'Parse with AI'}</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={styles.overlayTop} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalBox}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>New Enquiry</Text>
            <TouchableOpacity onPress={onClose}>
              <IconComponent name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {preSelectedClientName && (
            <View style={styles.clientBadge}>
              <IconComponent name="person" size={16} color={colors.primary} />
              <Text style={styles.clientBadgeText}>{preSelectedClientName}</Text>
            </View>
          )}
          <View style={styles.designTypeRow}>
            {['coral', 'cad', 'approvedCad'].map(type => (
              <TouchableOpacity
                key={type}
                activeOpacity={0.85}
                style={[styles.designTile, projectType === type && styles.designTileActive]}
                onPress={() => setProjectType(type)}
              >
                <IconComponent
                  name={type === 'coral' ? 'waves' : type === 'cad' ? 'architecture' : 'description'}
                  size={20}
                  color={projectType === type ? colors.textWhite : colors.primary}
                />
                <Text style={[styles.designTileLabel, projectType === type && styles.designTileLabelActive]}>
                  {type === 'approvedCad' ? 'Approved CAD' : type.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!textSubmitted ? renderInitialInput() : (
              <View>
                {renderParsedPreview()}
                <TouchableOpacity onPress={handleSubmit} disabled={isSubmitting}>
                  <View style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}>
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color={colors.textWhite} />
                    ) : (
                      <Text style={styles.submitBtnText}>Create Enquiry</Text>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backBtn} onPress={() => { setTextSubmitted(false); setParsedData(null); setDynamicMissingFields([]); setMissingFieldsData({}); }}>
                  <Text style={styles.backBtnText}>Edit Description</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
        <BrandedAlert
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          buttons={alertConfig.buttons}
          onClose={hideAlert}
        />
        <Modal visible={showConfirmModal} transparent animationType="fade" onRequestClose={() => setShowConfirmModal(false)}>
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTitle}>Test with AI?</Text>
              <Text style={styles.confirmDesc}>Would you like to test this description with AI parsing?</Text>
              <TouchableOpacity style={styles.confirmUploadBtn} onPress={handleImagePicker}>
                <IconComponent name="cloud-upload" size={20} color={colors.primary} />
                <Text style={styles.confirmUploadText}>Upload Screenshot</Text>
              </TouchableOpacity>
              {referenceImages.length > 0 && (
                <View style={styles.previewRow}>
                  {referenceImages.map((img, i) => (
                    <View key={i} style={styles.previewItem}>
                      <Image source={{ uri: img.uri }} style={styles.previewThumb} />
                      <TouchableOpacity onPress={() => setReferenceImages(prev => prev.filter((_, idx) => idx !== i))}>
                        <IconComponent name="close" size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.confirmActions}>
                <TouchableOpacity style={styles.confirmBtnSecondary} onPress={() => setShowConfirmModal(false)}>
                  <Text style={styles.confirmBtnSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtnPrimary} onPress={() => { setShowConfirmModal(false); handleTextSubmit(); }}>
                  <Text style={styles.confirmBtnPrimaryText}>Yes, Parse</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  overlayTop: {
    flex: 1,
  },
  modalBox: {
    backgroundColor: colors.background,
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    padding: 24,
    maxHeight: '80%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  designTypeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  designTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryLight || colors.primary,
    backgroundColor: colors.primaryExtraLight || colors.backgroundSecondary,
  },
  designTileActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark || colors.primary,
  },
  designTileLabel: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.primaryDark || colors.primary,
  },
  designTileLabelActive: {
    color: colors.textWhite,
  },
  headerTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  clientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryExtraLight || colors.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  clientBadgeText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.primary,
    marginLeft: 6,
  },
  body: {
    maxHeight: 500,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: fonts.base,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadText: {
    fontSize: fonts.sm,
    color: colors.textSecondary,
    marginTop: 6,
  },
  uploadSubtext: {
    fontSize: fonts.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  previewItem: {
    alignItems: 'center',
    position: 'relative',
  },
  previewThumb: {
    width: 50,
    height: 50,
    borderRadius: 6,
  },
  submitBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: fonts.base,
    color: colors.textWhite,
    fontFamily: fonts.medium,
  },
  backBtn: {
    marginTop: 12,
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: fonts.sm,
    color: colors.primary,
    fontFamily: fonts.medium,
  },
  tileGroup: {
    marginTop: 12,
    marginBottom: 4,
  },
  chipRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primaryLight || colors.primary,
    backgroundColor: colors.primaryExtraLight || colors.backgroundSecondary,
    marginRight: 8,
    marginBottom: 8,
  },
  choiceChipActive: {
    borderColor: colors.primaryDark || colors.primary,
    backgroundColor: colors.primary,
  },
  choiceChipLabel: {
    fontSize: fonts.sm,
    color: colors.primaryDark || colors.primary,
  },
  choiceChipLabelActive: {
    color: colors.textWhite,
    fontFamily: fonts.medium,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  formField: {
    flex: 1,
  },
  fullWidthField: {
    flex: 1,
    width: '100%',
  },
  dropdownLabel: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  parsedDataCard: {
    backgroundColor: colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  parsedDataLabel: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  parsedDataValue: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  confirmBox: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  confirmTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  confirmDesc: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  confirmUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryLight || colors.primary,
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  confirmUploadText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  confirmBtnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  confirmBtnSecondaryText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  confirmBtnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  confirmBtnPrimaryText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textWhite,
  },
});

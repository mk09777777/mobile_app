import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  ImageBackground,
  StyleSheet,
  View,
  Text,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Video from 'react-native-video';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { FILE_BASE_URL } from '../../config/apiConfig';
import Icon from '../common/Icon';
import BrandedAlert from '../common/BrandedAlert';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import {
  useGetUsersQuery,
  useGetStatusesQuery,
  useGetRolesQuery,
  useGetEnquiryByIdQuery,
  useApproveDesignVersionMutation,
  useRejectDesignVersionMutation,
  useUpdateEnquiryMutation,
} from '../../store/api';

const { width: screenWidth } = Dimensions.get('window');

function ModalVideoItem({ uri }) {
  const [paused, setPaused] = useState(true);
  return (
    <TouchableOpacity activeOpacity={1} onPress={() => setPaused(p => !p)} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Video
        source={{ uri }}
        style={styles.fullscreenImage}
        resizeMode="contain"
        paused={paused}
        controls={false}
        repeat={false}
      />
      {paused && (
        <View style={styles.modalVideoPlayOverlay}>
          <Icon name="play-circle-filled" size={64} color="rgba(255,255,255,0.9)" />
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function NewEnquiryCard({
  item,
  navigation,
  onViewQuotation,
  onPress,
  currentTab,
  onUpdateEnquiry,
  onDeleteEnquiry,
  isExpandedAll = false,
  onFinalLook,
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const { data: users, isLoading } = useGetUsersQuery();
  const { data: statusesData, isLoading: isStatusesLoading } =
    useGetStatusesQuery();
  const { data: rolesData } = useGetRolesQuery();

  // console.log('User Data is:', users);
  const [imagesData, setImagesData] = useState([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  // isExpandedAll is now controlled globally via the isExpandedAll prop from Tabs.js
  const [isImageModalVisible, setImageModalVisible] = useState(false);
  const [modalCurrentIndex, setModalCurrentIndex] = useState(0);
  const [zoomedImageIndex, setZoomedImageIndex] = useState(null);
  const modalFlatListRef = useRef(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [isRemarkExpanded, setIsRemarkExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Quotation action sheet state ──────────────────────────────────────────
  const [showQuotationActions, setShowQuotationActions]   = useState(false);
  const [showReasonInput,      setShowReasonInput]        = useState(false);
  const [showCadPicker,        setShowCadPicker]          = useState(false);
  const [selectedCadDesigner,  setSelectedCadDesigner]    = useState(null);
  const [updateReason,         setUpdateReason]           = useState('');
  const [isActionLoading,      setIsActionLoading]        = useState(false);
  const [alertCfg, setAlertCfg] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = useCallback((title, message, type = 'info', buttons = []) =>
    setAlertCfg({ visible: true, title, message, type, buttons }), []);
  const hideAlert = useCallback(() => setAlertCfg(p => ({ ...p, visible: false })), []);

  const cadDesigners = useMemo(
    () => (users || []).filter(u => u.role === 3 || u.roleId === 3 || u.roleNumber === 3),
    [users],
  );

  const [approveDesignVersion] = useApproveDesignVersionMutation();
  const [rejectDesignVersion]  = useRejectDesignVersionMutation();
  const [updateEnquiryDirect]  = useUpdateEnquiryMutation();

  const priority = (item?.Priority || 'medium').toLowerCase();
  const status = (item?.CurrentStatus || 'pending').toLowerCase();
  const isCoral = user?.role === 'coral';
  const isCad = user?.role === 'cad';
  const isClientHandler = user?.role === 'client_handler';

  // Fix status matching to match actual database values
  const isJustCreated =
    status === 'enquiry created' ||
    status === 'created' ||
    status === 'new' ||
    status === 'pending';
  const isCoralPending = status === 'coral';
  const isCadPending = status === 'cad';
  const isQuotation = status === 'quotation';
  const isApprovalPending = status === 'design approval pending';
  const isPlacementStage = status === 'order placement';
  const isProduction = status === 'production';

  // Fetch full enquiry (with Coral/Cad arrays + StatusHistory).
  // The list API strips these arrays in its $project — getEnquiryById returns the full doc.
  // We fetch for quotation items too so we can detect the revised-quotation state.
  const enquiryId = item?.Id || item?._id || item?.id;
  const shouldFetchFull = showQuotationActions || isQuotation;
  const { data: fullEnquiryData, isFetching: isFetchingEnquiry } = useGetEnquiryByIdQuery(enquiryId, {
    skip: !enquiryId || !shouldFetchFull,
  });

  // StatusHistory is only available in the full enquiry (not in list API response)
  const fullSrc = fullEnquiryData?._originalData || fullEnquiryData;
  const statusHistory = fullSrc?.StatusHistory || [];
  const hasApprovedCadInHistory = statusHistory.some(
    (s, i, arr) => s.Status === 'Approved Cad' && arr[i + 1]?.Status === 'Quotation'
  );
  const isRevisedQuotation = isQuotation && hasApprovedCadInHistory;

  const referenceImages = item?.ReferenceImages || [];

  useEffect(() => {
    if (!isExpandedAll || !referenceImages.length) return;
    let cancelled = false;
    const loadAllImages = async () => {
      setImageLoading(true);
      try {
        const token = await AsyncStorage.getItem('token');
        const results = await Promise.all(referenceImages.map(async img => {
          const imageKey = img?.Key;
          if (!imageKey) return null;
          const isVideo = typeof img?.MimeType === 'string' && img.MimeType.toLowerCase().startsWith('video/');
          try {
            const res = await fetch(`${FILE_BASE_URL}/api/enquiries/files/${encodeURIComponent(imageKey)}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return null;
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
              const j = await res.json();
              const uri = j.url || j.imageUrl || null;
              return uri ? { uri, isVideo } : null;
            }
            const buf = await res.arrayBuffer();
            const b64 = btoa(new Uint8Array(buf).reduce((d, b) => d + String.fromCharCode(b), ''));
            return { uri: `data:${ct};base64,${b64}`, isVideo: ct.startsWith('video/') };
          } catch { return null; }
        }));
        if (!cancelled) setImagesData(results.filter(Boolean));
      } catch { }
      finally { if (!cancelled) setImageLoading(false); }
    };
    loadAllImages();
    return () => { cancelled = true; };
  }, [isExpandedAll]);


  const createdDate = item?.CreatedDate || item?.createdAt;
  const daysSinceCreation = createdDate
    ? Math.floor((new Date() - new Date(createdDate)) / (1000 * 60 * 60 * 24))
    : 0;
  const isPendingStatus = isCoralPending || isCadPending;
  const ageShadeIndex = Math.min(Math.max(daysSinceCreation, 0), 4);
  const shadeColors = ['transparent', '#FFE4E2', '#FFB8B0', '#FF7A70', '#EF4444'];
  const pendingShadeColor = isPendingStatus ? shadeColors[ageShadeIndex] : 'transparent';

  // Check if item already has an assigned user
  const raw = item._originalData || item;
  const assignedVal = item.AssignedTo || item.assignedTo || raw.AssignedTo || raw.assignedTo;

  // Extract the raw ID string from whatever shape assignedVal is
  const assignedIdStr = useMemo(() => {
    if (!assignedVal) return '';
    if (typeof assignedVal === 'object') {
      return String(assignedVal.id || assignedVal.Id || assignedVal._id || assignedVal.userId || '').trim();
    }
    const s = String(assignedVal).trim();
    // Reject garbage values
    if (!s || s === 'null' || s === 'undefined' || s === '0' || s === 'false') return '';
    return s;
  }, [assignedVal]);

  const hasAssignedUser = assignedIdStr.length > 0;

  // Resolve assigned user's display name
  const assignedUserName = useMemo(() => {
    if (!assignedIdStr) return null;
    // If assignedVal is an object that already carries a name, use it directly
    if (typeof assignedVal === 'object') {
      const name = assignedVal.name || assignedVal.Name || assignedVal.username || assignedVal.email;
      if (name) return name;
    }
    // Look up by ID in users list
    if (users) {
      const found = users.find(u => String(u.id || u._id || '').trim() === assignedIdStr);
      return found?.name || found?.Name || found?.username || found?.email || null;
    }
    return null;
  }, [assignedIdStr, assignedVal, users]);

  // Button visibility based on user role and status
  const isApprovedCad = status === 'approved cad';

  // Admin: show upload button for whichever design stage is active
  const shouldShowAdminCoralUpload     = isAdmin && isCoralPending;
  const shouldShowAdminCadUpload       = isAdmin && (isCadPending || isApprovedCad);
  const shouldShowAdminPlacement       = isAdmin && isPlacementStage;
  const shouldShowAdminProduction      = (isAdmin || isClientHandler) && isProduction;

  // Designers: show upload for their stage regardless of how the enquiry was created
  const shouldShowCoralDesignerButtons = isCoral && isCoralPending;
  const shouldShowCadDesignerButtons   = isCad   && (isCadPending || isApprovedCad);
  const shouldShowAdminApprovedCad     = isAdmin && isApprovedCad;
  const shouldShowQuotationButtons     = isQuotation || isApprovalPending;

  // Log bearer token on component mount



  const handleScroll = e => setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / screenWidth));
  const handleImagePress = useCallback(index => { setModalCurrentIndex(index); setImageModalVisible(true); }, []);
  const closeImageModal = useCallback(() => { setImageModalVisible(false); setZoomedImageIndex(null); }, []);
  const handleDoubleTap = useCallback(index => {
    setZoomedImageIndex(prev => prev === index ? null : index);
  }, []);

  const updateEnquiryStatus = async (updateData) => {
    if (!onUpdateEnquiry) {
      console.error('onUpdateEnquiry prop not provided');
      return false;
    }
    const lastHistory = item?.StatusHistory?.at(-1);
    const payload = {
      id: item?.Id || item?._id || item?.id,
      Status: lastHistory?.Status,
      AssignedTo: lastHistory?.AssignedTo ?? null,
      ...updateData,
    };
    const result = await onUpdateEnquiry(payload);
    return result;
  };

  const handleDeleteEnquiry = async () => {
    if (!onDeleteEnquiry) {
      console.error('onDeleteEnquiry prop not provided');
      return;
    }

    setIsDeleting(true);
    try {
      const enquiryId = item?.Id || item?._id || item?.id;
      await onDeleteEnquiry(enquiryId);
      setShowMoreOptions(false);
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Quotation action helpers ───────────────────────────────────────────────
  /** Returns { type: 'coral'|'cad', version } from the full enquiry fetched by ID.
   *  The list aggregation strips Coral/Cad arrays — getEnquiryByIdQuery returns the
   *  complete document when the action sheet is open. */
  const getLatestDesign = () => {
    const src = fullEnquiryData || item?._originalData || item;

    const cad   = Array.isArray(src?.Cad)   && src.Cad.length   > 0 ? src.Cad[src.Cad.length - 1]     : null;
    const coral = Array.isArray(src?.Coral) && src.Coral.length > 0 ? src.Coral[src.Coral.length - 1] : null;

    if (cad?.Version)   return { type: 'cad',   version: cad.Version };
    if (coral?.Version) return { type: 'coral', version: coral.Version };

    return null;
  };

  const handleApprove = () => {
    setShowCadPicker(true);
  };

  const handleApproveWithDesigner = async (designer) => {
    const design = getLatestDesign();
    if (!design) {
      showAlert('Error', 'No design version found to approve.', 'warning', [{ text: 'OK' }]);
      return;
    }
    const clientId = item?.ClientId || item?.clientId;
    setIsActionLoading(true);
    try {
      if (isApprovedCad) {
        await updateEnquiryDirect({
          id: enquiryId,
          Status: 'Production',
          ApprovedDate: new Date().toISOString(),
          AssignedTo: designer ? designer.id : null,
          ClientId: clientId,
        }).unwrap();
      } else {
        await updateEnquiryDirect({
          id: enquiryId,
          Status: 'Approved Cad',
          AssignedTo: designer ? designer.id : null,
          ClientId: clientId,
        }).unwrap();
      }

      setShowQuotationActions(false);
      const msg = isApprovedCad
        ? 'CAD approved. Enquiry moved to Production.'
        : 'Design approved and assigned to CAD designer.';
      showAlert('Approved', msg, 'success', [{ text: 'OK' }]);
    } catch (e) {
      showAlert('Failed', e?.data?.message || 'Could not approve the design. Please try again.', 'error', [{ text: 'OK' }]);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRequestUpdate = async () => {
    if (!updateReason.trim()) return;
    const design = getLatestDesign();
    if (!design) {
      showAlert('Error', 'No design version found.', 'warning', [{ text: 'OK' }]);
      return;
    }
    setIsActionLoading(true);
    try {
      await rejectDesignVersion({
        enquiryId,
        designType: design.type,
        version:    design.version,
        reason:     updateReason.trim(),
      }).unwrap();
      if (design.type === 'cad') {
        const currentAssignedTo = item?.AssignedTo || item?.assignedTo;
        await updateEnquiryDirect({
          id: enquiryId,
          Status: 'CAD',
          ClientId: item?.ClientId || item?.clientId,
          ...(currentAssignedTo ? { AssignedTo: currentAssignedTo } : {}),
        }).unwrap();
      }
      setShowQuotationActions(false);
      setShowReasonInput(false);
      setUpdateReason('');
      showAlert('Update Requested', 'Your revision request has been sent. The design will be updated.', 'success', [{ text: 'OK' }]);
    } catch (e) {
      showAlert('Failed', e?.data?.message || 'Could not send the update request. Please try again.', 'error', [{ text: 'OK' }]);
    } finally {
      setIsActionLoading(false);
    }
  };


  const doApproveWithoutDesigner = async () => {
    const clientId = item?.ClientId || item?.clientId;
    setIsActionLoading(true);
    try {
      await updateEnquiryDirect({
        id: enquiryId,
        Status: 'Production',
        ApprovedDate: new Date().toISOString(),
        ClientId: clientId,
      }).unwrap();
      showAlert('Success', 'Enquiry moved to Production.', 'success', [{ text: 'OK' }]);
    } catch (e) {
      showAlert('Failed', e?.data?.message || 'Could not move to Production.', 'error', [{ text: 'OK' }]);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleApproveWithoutDesigner = () => {
    showAlert(
      'Confirm Approval',
      'Are you sure you want to move this enquiry to Production?',
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: doApproveWithoutDesigner },
      ],
    );
  };

  const closeQuotationActions = () => {
    setShowQuotationActions(false);
    setShowReasonInput(false);
    setShowCadPicker(false);
    setSelectedCadDesigner(null);
    setUpdateReason('');
  };

 
  return (
    <View style={[styles.mainContainer, { borderLeftWidth: isPendingStatus ? 4 : 0, borderLeftColor: pendingShadeColor }]}>

      {/* ── Expanded: original image section ────────────────────────────── */}
      {isExpandedAll && (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
          <View style={styles.ImageContainer}>
            {imageLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : imagesData.length > 0 ? (
              <View style={styles.carouselContainer}>
                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16}>
                  {imagesData.map((media, index) => (
                    <TouchableOpacity key={`media-${index}`} activeOpacity={0.9} onPress={() => handleImagePress(index)}>
                      <View style={styles.carouselImage}>
                        {media.isVideo ? (
                          <Video
                            source={{ uri: media.uri }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
                            paused
                            muted
                            repeat={false}
                          />
                        ) : (
                          <ImageBackground source={{ uri: media.uri }} style={StyleSheet.absoluteFill} />
                        )}
                        {media.isVideo && (
                          <View style={styles.carouselPlayOverlay}>
                            <Icon name="play-circle-filled" size={44} color="rgba(255,255,255,0.9)" />
                          </View>
                        )}
                        <View style={styles.StatusContainerStart}>
                          <View style={[styles.PriortyContainer, { backgroundColor: getPriorityColor(priority) }]}>
                            <Text style={styles.PriorityText} numberOfLines={1} ellipsizeMode="tail">{priority.toUpperCase()} Priority</Text>
                          </View>
                          <View style={styles.StatusContainerEnd}>
                            <View style={[styles.statusContainer, { backgroundColor: getStatusColor(status) }]}>
                              <Text style={styles.StatusText} numberOfLines={1} ellipsizeMode="tail">{status.toUpperCase()}</Text>
                            </View>
                            {isAdmin && (
                              <TouchableOpacity style={styles.moreOptionsButton} onPress={() => setShowMoreOptions(true)}>
                                <Icon name="more-vert" size={20} color={colors.textWhite} />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {imagesData.length > 1 && (
                  <View style={styles.paginationContainer}>
                    <Text style={styles.paginationText}>{currentIndex + 1} / {imagesData.length}</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.placeholderContainer}>
                <View style={[styles.StatusContainerStart, { position: 'absolute', top: 0, left: 0, right: 0 }]}>
                  <View style={[styles.PriortyContainer, { backgroundColor: getPriorityColor(priority) }]}>
                    <Text style={styles.PriorityText} numberOfLines={1} ellipsizeMode="tail">{priority.toUpperCase()} Priority</Text>
                  </View>
                  <View style={styles.StatusContainerEnd}>
                    <View style={[styles.statusContainer, { backgroundColor: getStatusColor(status) }]}>
                      <Text style={styles.StatusText} numberOfLines={1} ellipsizeMode="tail">{status.toUpperCase()}</Text>
                    </View>
                    {isAdmin && (
                      <TouchableOpacity style={styles.moreOptionsButton} onPress={() => setShowMoreOptions(true)}>
                        <Icon name="more-vert" size={20} color={colors.textWhite} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <Text style={styles.placeholderText}>No Image</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      )}

      {/* ── Always visible: compact info ─────────────────────────────────── */}
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <View style={styles.titleRow}>
          <Text style={styles.Heading} numberOfLines={1}>{item?.Name || 'Untitled Enquiry'}</Text>
          <View style={styles.badgesRow}>
            <View style={[styles.badge, { backgroundColor: getPriorityColor(priority) }]}>
              <Text style={styles.badgeText}>{priority.toUpperCase()}</Text>

            </View>
            
            <View style={[styles.badge, { backgroundColor: getStatusColor(status) }]}>
              <Text style={styles.badgeText} numberOfLines={1}>{status.toUpperCase()}</Text>
            </View>
            {/* {isAdmin && (
              <TouchableOpacity style={styles.moreOptionsButton} onPress={() => setShowMoreOptions(true)}>
                <Icon name="more-vert" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )} */}
          </View>
        </View>
        <Text style={styles.remarkText} numberOfLines={1}>
          {item?.Remarks || 'No description available.'}
        </Text>
        <View style={styles.metaRow}>
          <Icon name="person" size={12} color={colors.textSecondary} />
          <Text style={styles.metaText}>{item?.clientName || 'Unknown'}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Icon name="schedule" size={12} color={colors.textSecondary} />
          <Text style={styles.metaText}>{formatDate(item?.CreatedDate) || '—'}</Text>
        </View>
        {hasAssignedUser && !isAdmin && (
          <View style={styles.AssignedRow}>
            <Icon name="person-add" size={13} color={colors.background} />
            <Text style={styles.AssignedName} numberOfLines={1}>
              Assigned: {assignedUserName || 'User assigned'}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── Expanded: original action buttons ───────────────────────────── */}
      {isExpandedAll && (
        <View style={styles.ButtonContainer}>
          {/* Description with its own expand/collapse toggle */}
          <View style={styles.remarkContainer}>
            <Text style={styles.placeholderText2} numberOfLines={isRemarkExpanded ? undefined : 2}>
              {item?.Remarks || 'No description available.'}
            </Text>
            {item?.Remarks && (item.Remarks.length > 60 || item.Remarks.includes('\n')) && (
              <TouchableOpacity
                style={styles.expandButton}
                onPress={() => setIsRemarkExpanded(v => !v)}
              >
                <Icon
                  name={isRemarkExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={22}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>

        {shouldShowAdminCoralUpload ? (
          <View style={styles.QuickButtonContainer}>
            <TouchableOpacity
              style={styles.ChatButton}
              onPress={() =>
                navigation.navigate('ChatDetail', {
                  enquiryId: item?.id || item?._id,
                })
              }
            >
              <Icon name="chat" size={16} color={colors.primaryDark} />
              <Text style={styles.ChatButtonText}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.QuickActionButton}
              onPress={() =>
                navigation.navigate('UploadDesign', {
                  enquiryId: item?.id || item?._id,
                  designType: 'coral',
                  enquiry: item,
                })
              }
            >
              <Icon name="cloud-upload" size={16} color={colors.textWhite} />
              <Text style={styles.QuickActionButtonText}>Upload Coral</Text>
            </TouchableOpacity>
          </View>
        ) : shouldShowAdminCadUpload ? (
          <View style={styles.QuickButtonContainer}>
            <TouchableOpacity
              style={styles.ChatButton}
              onPress={() =>
                navigation.navigate('ChatDetail', {
                  enquiryId: item?.id || item?._id,
                })
              }
            >
              <Icon name="chat" size={16} color={colors.primaryDark} />
              <Text style={styles.ChatButtonText}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.QuickActionButton}
              onPress={() =>
                navigation.navigate('UploadDesign', {
                  enquiryId: item?.id || item?._id,
                  designType: 'cad',
                  enquiry: item,
                })
              }
            >
              <Icon name="cloud-upload" size={16} color={colors.textWhite} />
              <Text style={styles.QuickActionButtonText}>Upload CAD</Text>
            </TouchableOpacity>
          </View>
        ) : shouldShowCoralDesignerButtons ? (
          <View style={styles.QuickButtonContainer}>
            <TouchableOpacity
              style={styles.ChatButton}
              onPress={() =>
                navigation.navigate('ChatDetail', {
                  enquiryId: item?.id || item?._id,
                })
              }
            >
              <Icon name="chat" size={16} color={colors.primaryDark} />
              <Text style={styles.ChatButtonText}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.QuickActionButton}
              onPress={() =>
                navigation.navigate('UploadDesign', {
                  enquiryId: item?.id || item?._id,
                  designType: 'coral',
                  enquiry: item,
                })
              }
            >
              <Icon name="cloud-upload" size={16} color={colors.textWhite} />
              <Text style={styles.QuickActionButtonText}>Upload Coral</Text>
            </TouchableOpacity>
          </View>
        ) : shouldShowCadDesignerButtons ? (
          <View style={styles.QuickButtonContainer}>
            <TouchableOpacity
              style={styles.ChatButton}
              onPress={() =>
                navigation.navigate('ChatDetail', {
                  enquiryId: item?.id || item?._id,
                })
              }
            >
              <Icon name="chat" size={16} color={colors.primaryDark} />
              <Text style={styles.ChatButtonText}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.QuickActionButton}
              onPress={() =>
                navigation.navigate('UploadDesign', {
                  enquiryId: item?.id || item?._id,
                  designType: 'cad',
                  enquiry: item,
                })
              }
            >
              <Icon name="cloud-upload" size={16} color={colors.textWhite} />
              <Text style={styles.QuickActionButtonText}>Upload CAD</Text>
            </TouchableOpacity>
          </View>
        ) : isRevisedQuotation ? (
          <View style={styles.QuickButtonContainer}>
            <TouchableOpacity
              style={styles.ChatButton}
              onPress={() => {
                if (onFinalLook) {
                  onFinalLook(item);
                }
              }}
            >
              <Icon name="visibility" size={16} color={colors.primaryDark} />
              <Text style={styles.ChatButtonText}>Final Look</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.QuickActionButton}
              onPress={handleApproveWithoutDesigner}
            >
              <Icon name="check-circle" size={16} color={colors.textWhite} />
              <Text style={styles.QuickActionButtonText}>
                Approve
              </Text>
            </TouchableOpacity>
          </View>
        ) : shouldShowQuotationButtons ? (
          <View style={styles.QuickButtonContainer}>
            <TouchableOpacity
              style={styles.ChatButton}
              onPress={() => {
                if (onViewQuotation) {
                
                  onViewQuotation(item);
                } else {
                  navigation.navigate('ChatDetail', {
                    enquiryId: item?.id || item?._id,
                  });
                }
              }}
            >
              <Icon
                name="picture-as-pdf"
                size={16}
                color={colors.primaryDark}
              />
              <Text style={styles.ChatButtonText}>View Quotation</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.QuickActionButton}
              onPress={() => setShowQuotationActions(true)}
            >
              <Icon name="more-vert" size={16} color={colors.textWhite} />
              <Text style={styles.QuickActionButtonText}>
                Actions
              </Text>
            </TouchableOpacity>
          </View>
        ) : shouldShowAdminApprovedCad ? (
          <View style={styles.QuickButtonContainer}>
            <TouchableOpacity
              style={styles.ChatButton}
              onPress={() => navigation.navigate('ChatDetail', { enquiryId: item?.id || item?._id })}
            >
              <Icon name="chat" size={16} color={colors.primaryDark} />
              <Text style={styles.ChatButtonText}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.QuickActionButton}
              onPress={() =>
                navigation.navigate('UploadDesign', {
                  enquiryId: item?.id || item?._id,
                  designType: 'cad',
                  enquiry: item,
                })
              }
            >
              <Icon name="cloud-upload" size={16} color={colors.textWhite} />
              <Text style={styles.QuickActionButtonText}>Upload Final CAD</Text>
            </TouchableOpacity>
          </View>
        ) : shouldShowAdminPlacement ? (
          <View style={styles.QuickButtonContainer}>
            <TouchableOpacity
              style={styles.ChatButton}
              onPress={() => navigation.navigate('ChatDetail', { enquiryId: item?.id || item?._id })}
            >
              <Icon name="chat" size={16} color={colors.primaryDark} />
              <Text style={styles.ChatButtonText}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.QuickActionButton}
              onPress={async () => { await updateEnquiryStatus({ Status: 'Production' }); }}
            >
              <Icon name="build" size={16} color={colors.textWhite} />
              <Text style={styles.QuickActionButtonText}>Production</Text>
            </TouchableOpacity>
          </View>
        ) : shouldShowAdminProduction ? (
          <View style={styles.QuickButtonContainer}>
            <TouchableOpacity
              style={styles.ChatButton}
              onPress={() => navigation.navigate('ChatDetail', { enquiryId: item?.id || item?._id })}
            >
              <Icon name="chat" size={16} color={colors.primaryDark} />
              <Text style={styles.ChatButtonText}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.QuickActionButton}
              onPress={() => showAlert(
                'Move to Shipped',
                'Are you sure you want to mark this enquiry as Shipped?',
                'warning',
                [
                  { text: 'Cancel', onPress: hideAlert },
                  { text: 'Confirm', onPress: async () => { hideAlert(); await updateEnquiryStatus({ Status: 'Shipped' }); } },
                ]
              )}
            >
              <Icon name="local-shipping" size={16} color={colors.textWhite} />
              <Text style={styles.QuickActionButtonText}>Shipped</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        </View>
      )}
      {/* ══ Quotation Action Sheet ════════════════════════════════════════════ */}
      <Modal
        visible={showQuotationActions}
        transparent
        animationType="slide"
        onRequestClose={closeQuotationActions}
      >
        <TouchableOpacity
          style={styles.qaOverlay}
          activeOpacity={1}
          onPress={closeQuotationActions}
        >
          <TouchableOpacity activeOpacity={1} style={styles.qaSheet}>
            {/* Header */}
            <View style={styles.qaHeader}>
              <View style={styles.qaDragHandle} />
              <Text style={styles.qaTitle}>
                {showReasonInput ? 'Request a Design Update' : showCadPicker ? 'Assign CAD Designer' : 'Quotation Actions'}
              </Text>
              <Text style={styles.qaSubtitle} numberOfLines={1}>
                {item?.Name || ''}
              </Text>
            </View>

            {showCadPicker ? (
              /* ── CAD designer picker step ──────────────────────────── */
              <View style={styles.qaOptions}>
                {cadDesigners.length === 0 ? (
                  <Text style={[styles.qaOptionDesc, { textAlign: 'center', paddingVertical: 16 }]}>
                    No CAD designers found.
                  </Text>
                ) : (
                  cadDesigners.map(designer => (
                    <TouchableOpacity
                      key={designer.id}
                      style={[styles.qaOption, selectedCadDesigner?.id === designer.id && { borderColor: colors.primary, backgroundColor: colors.primaryLight || colors.background }]}
                      onPress={() => setSelectedCadDesigner(designer)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.qaIconWrap}>
                        <Icon name="person" size={20} color={selectedCadDesigner?.id === designer.id ? colors.background : colors.textSecondary} />
                      </View>
                      <View style={styles.qaOptionText}>
                        <Text style={[styles.qaOptionTitle, selectedCadDesigner?.id === designer.id && { color: colors.background }]}>
                          {designer.name}
                        </Text>
                        {!!designer.email && designer.email !== 'N/A' && (
                          <Text style={styles.qaOptionDesc}>{designer.email}</Text>
                        )}
                      </View>
                      {selectedCadDesigner?.id === designer.id && (
                        <Icon name="check-circle" size={18} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))
                )}
                <TouchableOpacity
                  style={[styles.QuickActionButton, { marginTop: 8, justifyContent: 'center', opacity: (!selectedCadDesigner || isActionLoading) ? 0.4 : 1 }]}
                  onPress={() => handleApproveWithDesigner(selectedCadDesigner)}
                  disabled={!selectedCadDesigner || isActionLoading}
                  activeOpacity={0.8}
                >
                  {isActionLoading
                    ? <ActivityIndicator size="small" color={colors.textWhite} />
                    : <Text style={styles.QuickActionButtonText}>Confirm & Approve</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.qaOption, { marginTop: 4, justifyContent: 'center' }]}
                  onPress={() => { setShowCadPicker(false); setSelectedCadDesigner(null); }}
                  disabled={isActionLoading}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.qaOptionTitle, { textAlign: 'center' }]}>Back</Text>
                </TouchableOpacity>
              </View>
            ) : !showReasonInput ? (
              /* ── 3-option menu ─────────────────────────────────────── */
              <View style={styles.qaOptions}>
                {isFetchingEnquiry && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingBottom: 4 }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>Loading design info...</Text>
                  </View>
                )}

                {/* Approve — context-aware:
                    'Quotation'               → approve the design version (→ Approved Cad)
                    'Design Approval Pending' → client approved; move straight to Order Placement */}
                <TouchableOpacity
                  style={styles.qaOption}
                  onPress={isApprovalPending
                    ? async () => {
                        setIsActionLoading(true);
                        try {
                          await updateEnquiryStatus({ Status: 'Order Placement' });
                          setShowQuotationActions(false);
                        } catch (e) {
                          showAlert('Failed', e?.data?.message || 'Could not move to Order Placement.', 'error', [{ text: 'OK' }]);
                        } finally {
                          setIsActionLoading(false);
                        }
                      }
                    : handleApprove}
                  disabled={isActionLoading}
                  activeOpacity={0.8}
                >
                  {isActionLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <View style={styles.qaIconWrap}>
                        <Icon name="check-circle" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.qaOptionText}>
                        <Text style={styles.qaOptionTitle}>
                          {isApprovalPending ? 'Move to Order Placement' : 'Approve'}
                        </Text>
                        <Text style={styles.qaOptionDesc}>
                          {isApprovalPending
                            ? 'Client has approved — proceed to Order Placement'
                            : 'Mark this version as approved and move to next stage'}
                        </Text>
                      </View>
                      <Icon name="chevron-right" size={18} color={colors.textSecondary} />
                    </>
                  )}
                </TouchableOpacity>

                {/* Update (Request Revision) */}
                <TouchableOpacity
                  style={styles.qaOption}
                  onPress={() => setShowReasonInput(true)}
                  disabled={isActionLoading}
                  activeOpacity={0.8}
                >
                  <>
                    <View style={styles.qaIconWrap}>
                      <Icon name="edit" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.qaOptionText}>
                      <Text style={styles.qaOptionTitle}>Update</Text>
                      <Text style={styles.qaOptionDesc}>Request a new version with changes — provide a reason</Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.textSecondary} />
                  </>
                </TouchableOpacity>

                {/* Cancel Order — disabled for now */}
                <TouchableOpacity
                  style={[styles.qaOption, { opacity: 0.35 }]}
                  disabled
                  activeOpacity={0.8}
                >
                  <>
                    <View style={styles.qaIconWrap}>
                      <Icon name="cancel" size={20} color={colors.textSecondary} />
                    </View>
                    <View style={styles.qaOptionText}>
                      <Text style={styles.qaOptionTitle}>Cancel Order</Text>
                      <Text style={styles.qaOptionDesc}>Cancel this enquiry order</Text>
                    </View>
                    <Text style={styles.qaBadge}>Soon</Text>
                  </>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── Reason input step ─────────────────────────────────── */
              <View style={styles.qaReasonWrap}>
                <Text style={styles.qaReasonLabel}>
                  What changes are needed?
                </Text>
                <TextInput
                  style={styles.qaReasonInput}
                  value={updateReason}
                  onChangeText={setUpdateReason}
                  placeholder="Add a reason to update the version..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                  autoFocus
                />
                <View style={styles.qaReasonActions}>
                  <TouchableOpacity
                    style={styles.qaReasonBack}
                    onPress={() => { setShowReasonInput(false); setUpdateReason(''); }}
                    disabled={isActionLoading}
                    activeOpacity={0.8}
                  >
                    <Icon name="arrow-back" size={16} color="#6B7280" />
                    <Text style={styles.qaReasonBackText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.qaReasonSubmit,
                      (!updateReason.trim() || isActionLoading) && { opacity: 0.4 },
                    ]}
                    onPress={handleRequestUpdate}
                    disabled={!updateReason.trim() || isActionLoading}
                    activeOpacity={0.8}
                  >
                    {isActionLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Icon name="send" size={15} color="#fff" />
                        <Text style={styles.qaReasonSubmitText}>Send Request</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Close pill */}
            <TouchableOpacity style={styles.qaDismiss} onPress={closeQuotationActions} activeOpacity={0.7}>
              <Text style={styles.qaDismissText}>Dismiss</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>



      <Modal
        visible={showMoreOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreOptions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMoreOptions(false)}
        >
          <View style={styles.dropdownModalContent}>
            <Text style={styles.dropdownModalTitle}>Options</Text>
            <TouchableOpacity
              style={styles.dropdownModalItem}
              onPress={handleDeleteEnquiry}
              disabled={isDeleting}
            >
              <Text style={[styles.dropdownModalItemText, { color: colors.error }]}>
                {isDeleting ? 'Deleting...' : 'Delete Enquiry'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Image fullscreen modal ───────────────────────────────────────── */}
      <Modal visible={isImageModalVisible} transparent animationType="fade" onRequestClose={closeImageModal}>
        <View style={styles.fullscreenImageBackdrop}>
          <TouchableOpacity style={styles.fullscreenImageCloseButton} onPress={closeImageModal} activeOpacity={0.7}>
            <Icon name="close" size={24} color={colors.textWhite} />
          </TouchableOpacity>
          {imagesData.length > 1 && (
            <View style={styles.modalImageCounter}>
              <Text style={styles.modalImageCounterText}>{modalCurrentIndex + 1} / {imagesData.length}</Text>
            </View>
          )}
          <FlatList
            ref={modalFlatListRef}
            data={imagesData}
            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            initialScrollIndex={modalCurrentIndex}
            getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
            onMomentumScrollEnd={e => {
              const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
              setModalCurrentIndex(index);
              setZoomedImageIndex(null);
            }}
            scrollEventThrottle={16}
            scrollEnabled={zoomedImageIndex === null}
            keyExtractor={(_, index) => `modal-img-${index}`}
            renderItem={({ item: media, index }) => (
              <View style={styles.modalImageContainer}>
                {media.isVideo ? (
                  <ModalVideoItem uri={media.uri} />
                ) : (
                  <TouchableOpacity activeOpacity={1} onPress={() => handleDoubleTap(index)} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Image source={{ uri: media.uri }} style={[styles.fullscreenImage, zoomedImageIndex === index && styles.fullscreenImageZoomed]} resizeMode="contain" />
                  </TouchableOpacity>
                )}
                {!media.isVideo && zoomedImageIndex === index && (
                  <View style={styles.zoomHintContainer}>
                    <Text style={styles.zoomHintText}>Tap again to zoom out</Text>
                  </View>
                )}
              </View>
            )}
          />
        </View>
      </Modal>

      <BrandedAlert
        visible={alertCfg.visible}
        title={alertCfg.title}
        message={alertCfg.message}
        type={alertCfg.type}
        buttons={alertCfg.buttons}
        onClose={hideAlert}
      />
    </View>
  );
}

const getStatusColor = status => {
  const statusColors = {
    // raw CurrentStatus values (lowercased)
    'enquiry created':          '#F59E0B',
    'coral':                    '#8B5CF6',
    'cad':                      '#3B82F6',
    'approved cad':             '#10B981',
    'quotation':                '#0EA5E9',
    'design approval pending':  '#F97316',
    'order placement':          '#6366F1',
    'production':               '#D97706',
    'shipped':                  '#059669',
    'completed':                '#10B981',
    'rejected':                 '#EF4444',
    // normalizedStatus values (fallback)
    pending:           '#F59E0B',
    approval_pending:  '#F97316',
    approved_cad:      '#10B981',
    cad:               '#3B82F6',
    coral:             '#8B5CF6',
    order_placement:   '#6366F1',
    production:        '#D97706',
    shipped:           '#059669',
    in_progress:       '#6B7280',
  };
  return statusColors[status] || '#6B7280';
};

const getPriorityColor = priority => {
  const priorityColors = {
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#10B981',
  };
  return priorityColors[priority] || '#6B7280';
};

const formatDate = dateString => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now - date;
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHrs = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMins < 60) {
    return `${diffInMins} mins ago`;
  } else if (diffInHrs < 24) {
    return `${diffInHrs} hrs ago`;
  } else {
    return `${diffInDays} days ago`;
  }
};

const styles = StyleSheet.create({
  mainContainer: {
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
    marginHorizontal: 10,
    marginBottom: 8,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    color: colors.textWhite,
    fontFamily: fonts.medium,
  },
  Heading: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
    marginRight: 6,
  },
  remarkText: {
    fontSize: 12,
    color: colors.textLight,
    fontFamily: fonts.regular,
    marginBottom: 6,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
  },
  metaDot: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  assignedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  assignedChipText: {
    fontSize: 10,
    color: colors.background,
    fontFamily: fonts.medium,
  },
  moreOptionsButton: {
    padding: 2,
  },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  // toggleDivider: { flex: 1, height: 1, backgroundColor: colors.border },
  toggleTrack: { width: 36, height: 20, borderRadius: 10, backgroundColor: colors.border, justifyContent: 'center', paddingHorizontal: 2 },
  toggleTrackOn: { backgroundColor: colors.primary },
  toggleThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff', elevation: 2, alignSelf: 'flex-start' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  ImageContainer: { width: '100%', padding: 10 },
  StatusContainerStart: { marginTop: 5, flexDirection: 'row', justifyContent: 'space-between', marginLeft: 5 },
  PriortyContainer: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, flexShrink: 1, maxWidth: '45%' },
  PriorityText: { fontSize: 12, color: colors.textWhite, fontFamily: fonts.regular },
  statusContainer: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, flexShrink: 1, maxWidth: 120 },
  StatusText: { fontSize: 12, color: colors.textWhite, fontFamily: fonts.regular },
  StatusContainerEnd: { marginRight: 5, flexDirection: 'row', alignItems: 'center', flexShrink: 1, maxWidth: '55%' },
  moreOptionsButton: { marginLeft: 5, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 5, paddingHorizontal: 4, paddingVertical: 4, justifyContent: 'center', alignItems: 'center' },
  loadingContainer: { width: '100%', height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.backgroundSecondary },
  placeholderContainer: { width: '100%', height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.backgroundSecondary },
  placeholderText: { fontSize: 14, color: colors.textLight, fontFamily: fonts.regular, paddingHorizontal: 10 },
  carouselContainer: { width: '100%', height: 200, position: 'relative' },
  carouselImage: { width: Dimensions.get('window').width - 60, height: 200, marginRight: 3, overflow: 'hidden', backgroundColor: '#000' },
  carouselPlayOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  paginationContainer: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  paginationText: { fontSize: 12, color: colors.textWhite, fontFamily: fonts.medium },
  ButtonContainer: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: 10, paddingTop: 8, flexDirection: 'column' },
  remarkContainer: {
    marginBottom: 8,
  },

  placeholderText2: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  expandButton: {
    alignSelf: 'flex-end',
    marginTop: 2,
    padding: 2,
  },

  ClientTimeContainer: { flexDirection: 'row', marginBottom: 5, justifyContent: 'space-between' },
  ClientRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  TimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ClientName: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  ClientTime: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  AssignedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: colors.primary, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 9 },
  AssignedName: { fontFamily: fonts.medium, fontSize: 12, color: colors.textWhite, flexShrink: 1 },
  QuickButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  ChatButton: { flex: 1, backgroundColor: colors.background, borderColor: colors.primaryDark, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, borderRadius: 5, paddingVertical: 8, paddingHorizontal: 12 },
  ChatButtonText: { fontFamily: fonts.medium, fontSize: 14, color: colors.primaryDark },
  QuickActionButton: { flex: 1, backgroundColor: colors.primaryDark, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, borderRadius: 5, paddingVertical: 8, paddingHorizontal: 12 },
  QuickActionButtonText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textWhite, textAlign: 'center' },
  DropdownButton: { flex: 1, backgroundColor: colors.background, borderColor: colors.primaryDark, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, borderRadius: 5, paddingVertical: 8, paddingHorizontal: 8 },
  DropdownButtonText: { fontFamily: fonts.medium, fontSize: 13, color: colors.primaryDark },
  ActionButton: { flex: 1, backgroundColor: colors.primaryDark, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, borderRadius: 5, paddingVertical: 8, paddingHorizontal: 8 },
  ActionButtonText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textWhite },
  fullscreenImageBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullscreenImageCloseButton: { position: 'absolute', top: 40, right: 20, padding: 12, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000 },
  modalImageCounter: { position: 'absolute', top: 50, left: 20, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, zIndex: 10 },
  modalImageCounterText: { color: colors.textWhite, fontSize: 14, fontFamily: fonts.medium },
  modalImageContainer: { width: Dimensions.get('window').width, height: Dimensions.get('window').height, justifyContent: 'center', alignItems: 'center' },
  fullscreenImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.8 },
  fullscreenImageZoomed: { width: Dimensions.get('window').width * 2.5, height: Dimensions.get('window').height * 2.5 },
  zoomHintContainer: { position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  zoomHintText: { color: colors.textWhite, fontSize: 12, fontFamily: fonts.medium },
  modalVideoPlayOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  dropdownModalTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  dropdownModalItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 5,
    backgroundColor: colors.background,
    marginBottom: 8,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  dropdownModalItemText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  // ── Quotation Action Sheet ──────────────────────────────────────────────
  qaOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  qaSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  qaHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  qaDragHandle: {
    width: 36, height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 10,
  },
  qaTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  qaSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  qaOptions: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  qaOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  qaIconWrap: {
    width: 36, height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qaOptionText: {
    flex: 1,
  },
  qaOptionTitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  qaOptionDesc: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  qaBadge: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },

  // Reason input step
  qaReasonWrap: {
    padding: 20,
    gap: 12,
  },
  qaReasonLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  qaReasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 110,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  qaReasonActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  qaReasonBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qaReasonBackText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  qaReasonSubmit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  qaReasonSubmitText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textWhite,
  },
  qaDismiss: {
    alignSelf: 'center',
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  qaDismissText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textSecondary,
  },
});

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
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { FILE_BASE_URL } from '../../config/apiConfig';
import Icon from '../common/Icon';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import {
  useGetUsersQuery,
  useGetStatusesQuery,
  useGetRolesQuery,
} from '../../store/api';

const { width: screenWidth } = Dimensions.get('window');

export default function NewEnquiryCard({
  item,
  navigation,
  onViewQuotation,
  onPress,
  currentTab,
  onUpdateEnquiry,
  onDeleteEnquiry,
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const { data: users, isLoading } = useGetUsersQuery();
  const { data: statusesData, isLoading: isStatusesLoading } =
    useGetStatusesQuery();
  const { data: rolesData } = useGetRolesQuery();

  // console.log('User Data is:', users);
  const [imagesData, setImagesData] = useState([]);
  const [imageLoading, setImageLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isImageModalVisible, setImageModalVisible] = useState(false);
  const [modalCurrentIndex, setModalCurrentIndex] = useState(0);
  const [zoomedImageIndex, setZoomedImageIndex] = useState(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [assignDropDownUsers, setAssignDropDownUsers] = useState([]);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [isRemarkExpanded, setIsRemarkExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const modalFlatListRef = useRef(null);
  const screenHeight = Dimensions.get('window').height;
  const navigate = useNavigation();
  const referenceImages = item?.ReferenceImages || [];
  const priority = (item?.Priority || 'medium').toLowerCase();
  const status = (item?.CurrentStatus || 'pending').toLowerCase();
  const isCoral = user?.role === 'coral';
  const isCad = user?.role === 'cad';

  //consoling the complete enquiry data
  console.log('📋 Enquiry Item:', item);
  console.log('🎯 Status (original):', item?.CurrentStatus);
  console.log('🎯 Status (lowercase):', status);
  console.log('⚡ Priority:', priority);
  console.log('👤 Client:', item?.clientName);
  console.log('🆔 Enquiry ID:', item?.Id || item?._id || item?.id);
  
  // Console based on status
  if (isJustCreated) {
    console.log('🆕 NEW ENQUIRY - Awaiting Assignment');
  } else if (isCoralPending) {
    console.log('🎨 CORAL STAGE - Design in Progress');
  } else if (isCadPending) {
    console.log('💻 CAD STAGE - Technical Design');
  } else if (isQuotation) {
    console.log('💰 QUOTATION STAGE - Pricing Ready');
  } else if (isApprovalPending) {
    console.log('✅ APPROVAL PENDING - Awaiting Client Decision');
  } else if (isPlacementStage) {
    console.log('📦 ORDER PLACEMENT - Ready for Production');
  } else {
    console.log('📌 STATUS:', status.toUpperCase());
  }

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
  const hasAssignedUser = assignedVal
    ? (typeof assignedVal === 'object'
        ? !!(assignedVal.id || assignedVal.Id || assignedVal._id || assignedVal.userId)
        : String(assignedVal).trim().length > 0)
    : false;

  // Resolve assigned user's display name
  const assignedUserName = useMemo(() => {
    if (!assignedVal) return null;
    if (typeof assignedVal === 'object') {
      // Object may already contain name
      const name = assignedVal.name || assignedVal.Name || assignedVal.username || assignedVal.email;
      if (name) return name;
      // Fall back to ID lookup
      const id = String(assignedVal.id || assignedVal.Id || assignedVal._id || '').trim();
      if (id && users) {
        const found = users.find(u => String(u.id || u._id || '').trim() === id);
        return found?.name || found?.Name || found?.username || found?.email || null;
      }
      return null;
    }
    // Plain string — treat as ID and look up
    const idStr = String(assignedVal).trim();
    if (!idStr || idStr === 'null' || idStr === 'undefined') return null;
    if (users) {
      const found = users.find(u => String(u.id || u._id || '').trim() === idStr);
      return found?.name || found?.Name || found?.username || found?.email || null;
    }
    return null;
  }, [assignedVal, users]);

  // Button visibility based on user role and status
  const shouldShowActionButtons = isAdmin && isJustCreated;
  const shouldShowAdminCoralUpload = isAdmin && isCoralPending;
  const shouldShowAdminCadUpload = isAdmin && isCadPending;
  const shouldShowCoralDesignerButtons = isCoral && isCoralPending;
  const shouldShowCadDesignerButtons = isCad && isCadPending;
  const shouldShowQuotationButtons = isQuotation;
  const showApprovalButton = isAdmin && isApprovalPending;
  const showPlacementButton = isAdmin && isPlacementStage;
  const showProductionButton = isAdmin && isProduction;

  // Log bearer token on component mount

  useEffect(() => {
    if (!referenceImages || referenceImages.length === 0) {
      setImageLoading(false);
      return;
    }

    let cancelled = false;

    const loadAllImages = async () => {
      try {
        setImageLoading(true);
        const token = await AsyncStorage.getItem('token');

        const imagePromises = referenceImages.map(async img => {
          const imageKey = img?.Key;
          if (!imageKey) return null;

          const imageUrl = `${FILE_BASE_URL}/api/enquiries/files/${encodeURIComponent(
            imageKey,
          )}`;

          try {
            const response = await fetch(imageUrl, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!response.ok) return null;

            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
              const jsonData = await response.json();
              return jsonData.url || jsonData.imageUrl || jsonData.Url || null;
            } else {
              const arrayBuffer = await response.arrayBuffer();
              const base64 = btoa(
                new Uint8Array(arrayBuffer).reduce(
                  (data, byte) => data + String.fromCharCode(byte),
                  '',
                ),
              );
              return `data:${contentType};base64,${base64}`;
            }
          } catch (error) {
            return null;
          }
        });

        const loadedImages = await Promise.all(imagePromises);
        const validImages = loadedImages.filter(img => img !== null);

        if (!cancelled) {
          setImagesData(validImages);
          setImageLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setImageLoading(false);
        }
      }
    };

    loadAllImages();

    return () => {
      cancelled = true;
    };
  }, [referenceImages.length]);

  const handleScroll = event => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / screenWidth);
    setCurrentIndex(index);
  };

  const handleImagePress = useCallback(index => {
    // Set the starting index for the modal
    setModalCurrentIndex(index);
    // Open modal - all images from imagesData will be rendered
    setImageModalVisible(true);
  }, []);

  const closeImageModal = useCallback(() => {
    setImageModalVisible(false);
    setZoomedImageIndex(null);
  }, []);

  const handleDoubleTap = useCallback(
    index => {
      if (zoomedImageIndex === index) {
        setZoomedImageIndex(null);
      } else {
        setZoomedImageIndex(index);
      }
    },
    [zoomedImageIndex],
  );

  const DropDownStatus = useMemo(() => {
    if (!statusesData) return [];
    return statusesData.map(status => ({
      Id: status.id,
      value: status.name,
      label: status.label,
    }));
  }, [statusesData]);

  //role

  const statusToRoleMap = useMemo(() => {
    const map = {};
    (rolesData || []).forEach(role => {
      const name = (role.name || '').toLowerCase();
      const code = (role.code || '').toLowerCase();
      if (name === 'coral' || code === 'co') {
        map['coral'] = role.id;
        map['co'] = role.id;
      }
      if (name === 'cad' || code === 'cd' || name === 'cad designer') {
        map['cad'] = role.id;
        map['cd'] = role.id;
      }
    });
    return map;
  }, [rolesData]);

  const handleStatusSelect = (value, label, id) => {
    console.log('Selected status:', value, label);
    setSelectedStatus({ value, label });
    setShowStatusDropdown(false);

    const targetRoleId = statusToRoleMap[value.toLowerCase()];
    
    if (targetRoleId && users && users.length > 0) {
      // Filter users by role ID
      const filteredUsers = users.filter(user => user.role === targetRoleId);
      console.log('Filtered users for role ID', targetRoleId, ':', filteredUsers);
      
      setAssignDropDownUsers(filteredUsers.map(user => ({
        id: user.id,
        name: user.name || user.Name || user.username || user.email,  
      })));
    } else {
      // For other statuses, show all users
      setAssignDropDownUsers([{name:"Select status first"}]);
    }
  };


  const updateEnquiryStatus = async (updateData) => {
    if (!onUpdateEnquiry) {
      console.error('onUpdateEnquiry prop not provided');
      return false;
    }
    
    const payload = {
      id: item?.Id || item?._id || item?.id,
      ...updateData,
    };
    
    return await onUpdateEnquiry(payload);
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

 
  return (
    <View style={[styles.mainContainer, { borderLeftWidth: isPendingStatus ? 6 : 0, borderLeftColor: pendingShadeColor }]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <View style={styles.ImageContainer}>
          {imageLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : imagesData && imagesData.length > 0 ? (
            <View style={styles.carouselContainer}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
              >
                {imagesData.map((imageUri, index) => (
                  <TouchableOpacity
                    key={`image-${index}`}
                    activeOpacity={0.9}
                    onPress={() => handleImagePress(index)}
                  >
                    <ImageBackground
                      source={{ uri: imageUri }}
                      style={styles.carouselImage}
                    >
                      <View style={styles.StatusContainerStart}>
                        <View
                          style={[
                            styles.PriortyContainer,
                            { backgroundColor: getPriorityColor(priority) },
                          ]}
                        >
                          <Text style={styles.PriorityText} numberOfLines={1} ellipsizeMode="tail">
                            {priority.toUpperCase()} Priority
                          </Text>
                        </View>
                        <View style={styles.StatusContainerEnd}>
                          <View
                            style={[
                              styles.statusContainer,
                              { backgroundColor: getStatusColor(status) },
                            ]}
                          >
                            <Text style={styles.StatusText} numberOfLines={1} ellipsizeMode="tail">
                              {status.toUpperCase()}
                            </Text>
                          </View>
                          {isAdmin && (
                            <TouchableOpacity
                              style={styles.moreOptionsButton}
                              onPress={() => setShowMoreOptions(true)}
                            >
                              <Icon name="more-vert" size={20} color={colors.textWhite} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </ImageBackground>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {imagesData.length > 1 && (
                <View style={styles.paginationContainer}>
                  <Text style={styles.paginationText}>
                    {currentIndex + 1} / {imagesData.length}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <View style={[styles.StatusContainerStart, { position: 'absolute', top: 0, left: 0, right: 0 }]}>
                <View
                  style={[
                    styles.PriortyContainer,
                    { backgroundColor: getPriorityColor(priority) },
                  ]}
                >
                  <Text style={styles.PriorityText} numberOfLines={1} ellipsizeMode="tail">
                    {priority.toUpperCase()} Priority
                  </Text>
                </View>
                <View style={styles.StatusContainerEnd}>
                  <View
                    style={[
                      styles.statusContainer,
                      { backgroundColor: getStatusColor(status) },
                    ]}
                  >
                    <Text style={styles.StatusText} numberOfLines={1} ellipsizeMode="tail">
                      {status.toUpperCase()}
                    </Text>
                  </View>
                  {isAdmin && (
                    <TouchableOpacity
                      style={styles.moreOptionsButton}
                      onPress={() => setShowMoreOptions(true)}
                    >
                      <Icon name="more-vert" size={20} color={colors.textWhite} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
        </View>
        <Text style={styles.Heading}>{item?.Name || 'Untitled Enquiry'}</Text>
        <View style={styles.remarkContainer}>
          <Text style={styles.placeholderText2} numberOfLines={isRemarkExpanded ? undefined : 2}>
            {item?.Remarks || 'No description available.'}
          </Text>
          {item?.Remarks && (item.Remarks.length > 60 || item.Remarks.includes('\n')) && (
            <TouchableOpacity 
              style={styles.expandButton}
              onPress={() => setIsRemarkExpanded(!isRemarkExpanded)}
            >
              <Icon 
                name={isRemarkExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                size={24} 
                color={colors.textLight} 
              />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
      <View style={styles.ButtonContainer}>
        <View style={styles.ClientTimeContainer}>
          <View style={styles.ClientRow}>
            <Icon name="person" size={16} color={colors.textSecondary} />
            <Text style={styles.ClientName}>
              Client:{item?.clientName || 'Unknown Client'}
            </Text>
          </View>
          <View style={styles.TimeRow}>
            <Icon name="schedule" size={14} color={colors.textSecondary} />
            <Text style={styles.ClientTime}>
              {formatDate(item?.CreatedDate) || 'Unknown Date'}
            </Text>
          </View>
        </View>
        {assignedUserName ? (
          <View style={styles.AssignedRow}>
            <Icon name="person-add" size={14} color={colors.background} />
            <Text style={styles.AssignedName} numberOfLines={1}>
              Assigned: {assignedUserName}
            </Text>
          </View>
        ) : null}

        {shouldShowActionButtons ? (
          <View style={styles.QuickButtonContainer}>
            <TouchableOpacity
              style={styles.DropdownButton}
              onPress={() => setShowStatusDropdown(true)}
            >
              <Icon name="tune" size={16} color={colors.primaryDark} />
              <Text style={styles.DropdownButtonText}>
                {selectedStatus ? selectedStatus.label : 'Move to Status'}
              </Text>
              <Icon
                name="arrow-drop-down"
                size={16}
                color={colors.primaryDark}
              />
            </TouchableOpacity>
            {!hasAssignedUser && (
              <TouchableOpacity
                style={styles.ActionButton}
                onPress={() => {
                  if (assignDropDownUsers.length > 0) {
                    setShowAssignDropdown(true);
                  } else {
                    console.log('Please select a status first');
                  }
                }}
              >
                <Icon name="person-add" size={16} color={colors.textWhite} />
                <Text style={styles.ActionButtonText}>Assign To</Text>
                <Icon name="arrow-drop-down" size={16} color={colors.textWhite} />
              </TouchableOpacity>
            )}
          </View>
        ) : shouldShowAdminCoralUpload ? (
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
        ) : shouldShowQuotationButtons ? (
          <View style={styles.QuickButtonContainer}>
            <TouchableOpacity
              style={styles.ChatButton}
              onPress={() => {
                if (onViewQuotation) {
                  const quotationUrl =
                    item.quotationUrl || item.QuotationUrl || item.pdfUrl;
                  onViewQuotation(quotationUrl);
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
              onPress={async () => await updateEnquiryStatus({ status: 'Design Approval Pending' })}
            >
              {/* <Icon name="edit" size={16} color={colors.textWhite} /> */}
              <Text style={styles.QuickActionButtonText}>
                Send to Design Approval
              </Text>
            </TouchableOpacity>
          </View>
        ) : showApprovalButton ? (
          <View style={styles.QuickButtonContainer}>
            <TouchableOpacity
              style={styles.QuickActionButton}
              onPress={async () => {await updateEnquiryStatus({ status: 'Order Placement' });}
              }
            >
              <Text style={styles.QuickActionButtonText}>
                Move to Order Placement
              </Text>
            </TouchableOpacity>
          </View>
        ) : showPlacementButton ? (
          <View style={styles.QuickButtonContainer}>
            <TouchableOpacity
              style={styles.QuickActionButton}
              onPress={async () => {
                await updateEnquiryStatus({ status: 'production' });
              }}
            >
              <Icon name="build" size={16} color={colors.textWhite} />
              <Text style={styles.QuickActionButtonText}>
                Move to Production
              </Text>
            </TouchableOpacity>
          </View>
      ) : showProductionButton ? (
        <View style={styles.QuickButtonContainer}>
          <TouchableOpacity
            style={styles.QuickActionButton}
            onPress={async () => {
              await updateEnquiryStatus({ status: 'shipped' });
            }}
          >
            <Icon name="local-shipping" size={16} color={colors.textWhite} />
            <Text style={styles.QuickActionButtonText}>
              Move to Shipped
            </Text>
          </TouchableOpacity>
        </View>
        ) : null}
      </View>
      <Modal
        visible={showStatusDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusDropdown(false)}
        >
          <View style={styles.dropdownModalContent}>
            <Text style={styles.dropdownModalTitle}>Move to Status</Text>
            {DropDownStatus.map(option => (
              <TouchableOpacity
                key={option.value}
                style={styles.dropdownModalItem}
                onPress={() =>
                  handleStatusSelect(option.value, option.label, item?.Id || item?._Id)
                }
              >
                <Text style={styles.dropdownModalItemText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showAssignDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAssignDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAssignDropdown(false)}
        >
          <View style={styles.dropdownModalContent}>
            <Text style={styles.dropdownModalTitle}>Assign To</Text>
            {assignDropDownUsers.map(user => (
              <TouchableOpacity
                key={user.id}
                style={styles.dropdownModalItem}
                onPress={async () => {
                  const success = await updateEnquiryStatus({
                    assignedTo: user.id,
                    status: selectedStatus?.label || status,
                  });
                  if (success) {
                    setShowAssignDropdown(false);
                  }
                }}
              >
                <Text style={styles.dropdownModalItemText}>{user.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
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

      <Modal
        visible={isImageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeImageModal}
      >
        <View style={styles.fullscreenImageBackdrop}>
          <TouchableOpacity
            style={styles.fullscreenImageCloseButton}
            onPress={closeImageModal}
            activeOpacity={0.7}
          >
            <Icon name="close" size={24} color={colors.textWhite} />
          </TouchableOpacity>

          {imagesData.length > 1 && (
            <View style={styles.modalImageCounter}>
              <Text style={styles.modalImageCounterText}>
                {modalCurrentIndex + 1} / {imagesData.length}
              </Text>
            </View>
          )}

          <FlatList
            ref={modalFlatListRef}
            data={imagesData}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={modalCurrentIndex}
            getItemLayout={(data, index) => ({
              length: screenWidth,
              offset: screenWidth * index,
              index,
            })}
            onMomentumScrollEnd={event => {
              const scrollPosition = event.nativeEvent.contentOffset.x;
              const index = Math.round(scrollPosition / screenWidth);
              setModalCurrentIndex(index);
              // Reset zoom when changing images
              setZoomedImageIndex(null);
            }}
            scrollEventThrottle={16}
            scrollEnabled={zoomedImageIndex === null}
            keyExtractor={(item, index) => `modal-img-${index}`}
            renderItem={({ item: imageUri, index }) => (
              <View style={styles.modalImageContainer}>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => handleDoubleTap(index)}
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Image
                    source={{ uri: imageUri }}
                    style={[
                      styles.fullscreenImage,
                      zoomedImageIndex === index &&
                        styles.fullscreenImageZoomed,
                    ]}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
                {zoomedImageIndex === index && (
                  <View style={styles.zoomHintContainer}>
                    <Text style={styles.zoomHintText}>
                      Tap again to zoom out
                    </Text>
                  </View>
                )}
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const getStatusColor = status => {
  const statusColors = {
    pending: '#F59E0B',
    completed: '#10B981',
    rejected: '#EF4444',
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
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    margin: 10,
  },

  ImageContainer: {
    width: '100%',
    padding: 10,
  },

  StatusContainerStart: {
    marginTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 5,
  },

  PriortyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    flexShrink: 1,
    maxWidth: '45%',
  },

  PriorityText: {
    fontSize: 12,
    color: colors.textWhite,
    fontFamily: fonts.regular,
  },

  statusContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    flexShrink: 1,
    maxWidth: 120,
  },

  StatusText: {
    fontSize: 12,
    color: colors.textWhite,
    fontFamily: fonts.regular,
  },

  StatusContainerEnd: {
    marginRight: 5,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    maxWidth: '55%',
  },

  moreOptionsButton: {
    marginLeft: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 5,
    paddingHorizontal: 4,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingContainer: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },

  placeholderContainer: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },

  placeholderText: {
    fontSize: 14,
    color: colors.textLight,
    fontFamily: fonts.regular,
    paddingHorizontal: 10,
  },
  placeholderText2: {
    fontSize: 14,
    color: colors.textLight,
    fontFamily: fonts.regular,
    paddingHorizontal: 10,
    lineHeight: 16,
  },
  remarkContainer: {
    marginBottom: 5,
  },
  expandButton: {
    alignItems: 'flex-end',
    marginTop: 2,
    paddingHorizontal: 10,
  },
  Heading: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 5,
    marginTop: 5,
    paddingHorizontal: 10,
  },

  carouselContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },

  carouselImage: {
    width: Dimensions.get('window').width - 60,
    height: '100%',
    // marginLeft: 10,
    marginRight: 3,
  },

  paginationContainer: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },

  paginationText: {
    fontSize: 12,
    color: colors.textWhite,
    fontFamily: fonts.medium,
  },

  ButtonContainer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 8,
    flexDirection: 'column',
  },

  ClientTimeContainer: {
    flexDirection: 'row',
    marginBottom: 5,
    justifyContent: 'space-between',
  },

  ClientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  TimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  ClientName: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },

  ClientTime: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },

  AssignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: colors.primary || '#EEF4FF',
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 9,
  },

  AssignedName: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textWhite,
    flexShrink: 1,
  },

  QuickButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },

  ChatButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderColor: colors.primaryDark,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  ChatButtonText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.primaryDark,
  },

  QuickActionButton: {
    flex: 1,
    backgroundColor: colors.primaryDark,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  QuickActionButtonText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textWhite,
    textAlign: 'center',
  },

  DropdownButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderColor: colors.primaryDark,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },

  DropdownButtonText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.primaryDark,
  },

  ActionButton: {
    flex: 1,
    backgroundColor: colors.primaryDark,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },

  ActionButtonText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textWhite,
  },

  QuotationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 5,
  },

  QuotationText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.info,
  },
  fullscreenImageBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fullscreenImageCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
  },
  modalImageCounter: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 10,
  },
  modalImageCounterText: {
    color: colors.textWhite,
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  modalImageContainer: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.8,
  },
  fullscreenImageZoomed: {
    width: Dimensions.get('window').width * 2.5,
    height: Dimensions.get('window').height * 2.5,
  },
  zoomScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomHintContainer: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  zoomHintText: {
    color: colors.textWhite,
    fontSize: 12,
    fontFamily: fonts.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 15,
    textAlign: 'center',
  },
  dropdownModalItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 5,
    backgroundColor: colors.background,
    marginBottom: 10,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  dropdownModalItemText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});

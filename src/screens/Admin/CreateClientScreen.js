import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Text,
  Image,
  Platform,
  PermissionsAndroid,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useCreateClientMutation, useUploadImageMutation } from '../../store/api';
import { Card } from '../../components/cards/Cards';
import { AnimatedLogoLoader } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { Input } from '../../components/common';
import { spacing } from '../../utils/responsive';

const CreateClientScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    Name: '',
    ImageUrl: '',
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [createClient, { isLoading: isCreating }] = useCreateClientMutation();
  const [uploadImage, { isLoading: isUploading }] = useUploadImageMutation();
  
  const isLoading = isCreating || isUploading;

  // Debug modal state
  useEffect(() => {
    
  }, [showImagePickerModal]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Request camera permission for Android
  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'App needs access to your camera to take photos',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        return false;
      }
    }
    return true;
  };

  // Request storage permission for Android
  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const androidVersion = Platform.Version;
        let permission = PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
        
        if (androidVersion >= 33) {
          permission = 'android.permission.READ_MEDIA_IMAGES';
        }
        
        const granted = await PermissionsAndroid.request(permission, {
          title: 'Storage Permission',
          message: 'App needs access to your storage to select images',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        });
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        return false;
      }
    }
    return true;
  };

  const handleCamera = async () => {
    try {
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Camera permission is required to take photos');
        return;
      }

      const options = {
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: true, // Enable base64 for data URI
        saveToPhotos: true, // Save to photos on iOS
      };

      

      launchCamera(options, (response) => {
        
        
        if (response.didCancel) {
        } else if (response.errorCode) {
          Alert.alert('Error', `Camera Error: ${response.errorMessage || response.errorCode}`);
        } else if (response.assets && response.assets.length > 0) {
          const asset = response.assets[0];
          
          
          const imageData = {
            uri: asset.uri || '',
            type: asset.type || 'image/jpeg',
            name: asset.fileName || asset.uri?.split('/').pop() || `image_${Date.now()}.jpg`,
          };
          
          // Create data URI if base64 is available
          if (asset.base64) {
            const mimeType = asset.type || 'image/jpeg';
            imageData.dataUri = `data:${mimeType};base64,${asset.base64}`;
            imageData.base64 = asset.base64;
          }
          
          setSelectedImage(imageData);
          // Clear any previous image URL error
          if (errors.ImageUrl) {
            setErrors(prev => ({ ...prev, ImageUrl: null }));
          }
        } else {
        }
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to open camera. Please try again.');
    }
  };

  const handleGallery = async () => {
    try {
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Storage permission is required to select images');
        return;
      }

      const options = {
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 1,
        includeBase64: true, // Enable base64 for data URI
      };

      

      launchImageLibrary(options, (response) => {
        
        
        if (response.didCancel) {
        } else if (response.errorCode) {
          Alert.alert('Error', `Image Picker Error: ${response.errorMessage || response.errorCode}`);
        } else if (response.assets && response.assets.length > 0) {
          const asset = response.assets[0];
          
          
          const imageData = {
            uri: asset.uri || '',
            type: asset.type || 'image/jpeg',
            name: asset.fileName || asset.uri?.split('/').pop() || `image_${Date.now()}.jpg`,
          };
          
          // Create data URI if base64 is available
          if (asset.base64) {
            const mimeType = asset.type || 'image/jpeg';
            imageData.dataUri = `data:${mimeType};base64,${asset.base64}`;
            imageData.base64 = asset.base64;
          }
          
          setSelectedImage(imageData);
          // Clear any previous image URL error
          if (errors.ImageUrl) {
            setErrors(prev => ({ ...prev, ImageUrl: null }));
          }
        } else {
        }
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to open image library. Please try again.');
    }
  };

  const handleImagePicker = () => {
    
    setShowImagePickerModal(true);
    
  };

  const handleCameraPress = () => {
    setShowImagePickerModal(false);
    setTimeout(() => {
      handleCamera();
    }, 300);
  };

  const handleGalleryPress = () => {
    setShowImagePickerModal(false);
    setTimeout(() => {
      handleGallery();
    }, 300);
  };

  const removeImage = () => {
    setSelectedImage(null);
    setFormData(prev => ({ ...prev, ImageUrl: '' }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.Name.trim()) {
      newErrors.Name = 'Name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      // If user manually entered ImageUrl, use it
      let imageUrl = formData.ImageUrl.trim() || undefined;
      
      // If image is selected from camera/gallery, upload it first (same pattern as enquiries)
      if (!imageUrl && selectedImage) {
        try {
          
          
          // Upload image using the same pattern as enquiries
          const uploadedImage = await uploadImage(selectedImage).unwrap();
          
          
          
          // Extract URL from upload response (same pattern as enquiries)
          if (uploadedImage) {
            // Try different possible response formats
            imageUrl = uploadedImage.Url || uploadedImage.url || 
                       uploadedImage.URI || uploadedImage.uri ||
                       uploadedImage.Location || uploadedImage.location ||
                       uploadedImage.Key || uploadedImage.key ||
                       uploadedImage.path || uploadedImage.Path ||
                       (typeof uploadedImage === 'string' ? uploadedImage : undefined);
            
            // If we got a key instead of URL, construct URL (same pattern as enquiries)
            if (!imageUrl && (uploadedImage.Key || uploadedImage.key)) {
              const key = uploadedImage.Key || uploadedImage.key;
              // Construct URL similar to enquiries: /api/clients/files/{key}
              // But we'll use the key directly as ImageUrl since backend might handle it
              imageUrl = key;
            }
            
            
          }
        } catch (uploadError) {
          Alert.alert(
            'Image Upload Failed',
            'Failed to upload image. Would you like to create the client without an image?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Create Without Image',
                onPress: async () => {
                  await createClientWithoutImage();
                },
              },
            ]
          );
          return;
        }
      }
      
      // Create client with the image URL (same pattern as enquiries)
      const result = await createClient({
        Name: formData.Name.trim(),
        ImageUrl: imageUrl, // Send URL string (not file)
        Pricing: undefined, // Can be added later if needed
      }).unwrap();

      Alert.alert(
        'Success',
        result.message || 'Client created successfully',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      handleSubmitError(error);
    }
  };

  const createClientWithoutImage = async () => {
    try {
      const result = await createClient({
        Name: formData.Name.trim(),
        ImageUrl: undefined,
        Pricing: undefined,
      }).unwrap();
      
      Alert.alert(
        'Success',
        result.message || 'Client created successfully',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
            },
          },
        ]
      );
    } catch (createError) {
      handleSubmitError(createError);
    }
  };

  const handleSubmitError = (error) => {
    console.error('Full error object:', JSON.stringify(error, null, 2));
    
    // Extract error message from different possible error formats
    let errorMessage = 'Failed to create client. Please try again.';
    
    if (error?.data) {
      errorMessage = error.data.error || error.data.message || errorMessage;
    } else if (error?.error) {
      errorMessage = error.error;
    } else if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    Alert.alert(
      'Error',
      errorMessage,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Card style={styles.formCard}>
          <Text style={styles.title}>
            Create New Client
          </Text>
          <Text style={styles.subtitle}>
            Fill in the details to create a new client
          </Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                Name *
              </Text>
              <Input
                placeholder="Enter client name"
                value={formData.Name}
                onChangeText={(value) => handleInputChange('Name', value)}
                error={errors.Name}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                Client Image (Optional)
              </Text>
              
              {selectedImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={removeImage}
                    activeOpacity={0.8}
                  >
                    <Icon name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.imagePickerButton}
                  onPress={handleImagePicker}
                  activeOpacity={0.8}
                >
                  <View style={styles.imagePickerContent}>
                    <Icon name="image" size={24} color={colors.primary} />
                    <Text style={[styles.imagePickerText, { marginLeft: spacing.xs }]}>Select Image</Text>
                  </View>
                </TouchableOpacity>
              )}
              
              {selectedImage && (
                <Text style={styles.helpText}>
                  Image will be uploaded when you create the client
                </Text>
              )}
            </View>
          </View>
        </Card>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading}
            style={[styles.adminActionButton, styles.adminActionButtonPrimary, isLoading && styles.btnDisabled]}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <>
                <AnimatedLogoLoader size={18} />
                <Text style={styles.adminActionText}>Creating...</Text>
              </>
            ) : (
              <>
                <Icon name="save" size={18} color={colors.textWhite} />
                <Text style={styles.adminActionText}>Create Client</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.adminActionButton, styles.adminActionButtonOutline]}
            activeOpacity={0.85}
            disabled={isLoading}
          >
            <Icon name="close" size={18} color={colors.primary} />
            <Text style={[styles.adminActionText, styles.adminActionOutlineText]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Image Picker Modal */}
      <Modal
        visible={showImagePickerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowImagePickerModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => {
              setShowImagePickerModal(false);
            }}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Image Source</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowImagePickerModal(false);
                }}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                handleCameraPress();
              }}
              activeOpacity={0.7}
            >
              <Icon name="camera-alt" size={24} color={colors.primary} />
              <Text style={styles.modalOptionText}>Camera</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                handleGalleryPress();
              }}
              activeOpacity={0.7}
            >
              <Icon name="photo-library" size={24} color={colors.primary} />
              <Text style={styles.modalOptionText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  formCard: {
    padding: 16,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  form: {
    gap: spacing.md,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  helpText: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  imagePickerButton: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  imagePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imagePickerText: {
    color: colors.primary,
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.textWhite,
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.textPrimary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtons: {
    gap: 12,
    marginTop: spacing.sm,
  },
  adminActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  adminActionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  adminActionButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  adminActionText: {
    color: colors.textWhite,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  adminActionOutlineText: {
    color: colors.primary,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalOverlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: colors.textWhite,
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
    marginBottom: 12,
  },
  modalOptionText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    marginLeft: 12,
  },
});

export default CreateClientScreen;


import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Text,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Input, Button } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import IconComponent from '../../components/common/Icon';
import { useGetUsersQuery, useCreateEnquiryMutation, useGetStoneTypesQuery } from '../../store/api';
import { useClients } from '../../features/clients/clientsHooks';
import { useAuth } from '../../context/AuthContext';

/** Default remark text when client picks a track on step 1 */
const CLIENT_REMARK_BY_PROJECT_TYPE = {
  coral: 'I want a coral design for this',
  cad: 'I want a cad design for this',
  approvedCad: 'I want an approved CAD design for this',
};

const AddEnquiryStep1Screen = ({ route, navigation }) => {
  // This screen is only for creating new enquiries
  const isEditMode = false;
  const { user } = useAuth();
  const [createEnquiry, { isLoading: isCreatingEnquiry }] = useCreateEnquiryMutation();
  
  // Check if user is a client
  const roleLower = user?.role?.toLowerCase();
  const isClient = 
    roleLower === 'client' ||
    roleLower === 'cl' ||
    user?.roleId === 4 ||
    user?.roleNumber === 4;

  /** Client & admin: step 1 = status tiles, step 2 = details. Summary is on the next screen (upload + instructions + summary). */
  const totalSteps = 2;
  const [currentStep, setCurrentStep] = useState(1);
  /** coral | cad | approvedCad — drives Status sent to API (client & admin) */
  const [projectType, setProjectType] = useState('coral');
  
  // Initialize form data for new enquiry
  const getInitialFormData = () => {
    return {
      title: '',
      description: '',
      remark: '',
      clientId: '',
      clientName: '',
      priority: 'Normal',
      category: 'Ring',
      metalColor: '', // Empty by default - optional field
      metalQuality: '10K',
      stoneType: '', // Optional field - no default
      quantity: '1',
      stamping: '',
      status: 'Coral',
      assignedTo: '',
      budget: '',
      specialRemarks: '',
      approvedDate: '',
    };
  };

  // Initialize form data - use empty form initially, will be populated in useEffect
  const [formData, setFormData] = useState(getInitialFormData());
  const [errors, setErrors] = useState({});
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showAssignedToDropdown, setShowAssignedToDropdown] = useState(false);
  
  // Fetch clients for dropdown (using cached hook)
  const { clients: clientsData = [] } = useClients({
    skip: false,
  });
  
  const clients = Array.isArray(clientsData) ? clientsData : [];
  
  // Create client options for dropdown
  const clientOptions = clients.map(client => ({
    label: client.name || 'Unknown Client',
    value: client.id || client._id,
  }));

  // Fetch users for Assigned To field
  const { data: usersData = [] } = useGetUsersQuery(undefined, {
    skip: false,
  });
  const users = Array.isArray(usersData) ? usersData : [];

  // Create assigned-to options from users (exclude clients by role)
  // Filter based on selected status:
  // - If status is "CAD", show only users with role === 3
  // - If status is "Coral", show only users with role === 2
  // - Otherwise, show all non-client users
  const assignedToOptions = useMemo(() => {
    const statusLower = String(formData.status || '').toLowerCase();
    
    return users
      .filter(user => {
        const roleString = String(user.role || '').toLowerCase();
        const roleNumber = typeof user.role === 'number' ? user.role : parseInt(user.role);
        
        // Always exclude clients
        if (roleString === 'client' || roleNumber === 4) {
          return false;
        }
        
        // Coral → role 2; CAD and Approved Cad → role 3
        if (statusLower.includes('coral') && !statusLower.includes('cad')) {
          return roleNumber === 2;
        }
        if (statusLower.includes('cad')) {
          return roleNumber === 3;
        }
        return true;
      })
      .map(user => ({
        label: user.name || user.email || 'Unknown',
        value: user.id || user._id,
      }));
  }, [users, formData.status]);

  // Fetch stone types from API
  const { data: stoneTypesData = [] } = useGetStoneTypesQuery();

  // Initialize form on mount (only for creating new enquiries)
  useEffect(() => {
    const initialData = getInitialFormData();
    setFormData({
      ...initialData,
      status: 'Coral',
      ...(isClient
        ? { remark: CLIENT_REMARK_BY_PROJECT_TYPE.coral }
        : {}),
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Client role: bind enquiry to logged-in client (no client picker on the form)
  useEffect(() => {
    if (!isClient || !user?.clientId) {
      return;
    }
    const userClient = clients.find(c => {
      const cid = c.id || c._id;
      return String(cid).trim() === String(user.clientId).trim();
    });
    const nameFromDirectory =
      userClient && (userClient.name || userClient.Name || '');
    const nameFromUser =
      user.name ||
      user.fullName ||
      user.Name ||
      user.email ||
      '';

    setFormData(prev => ({
      ...prev,
      clientId: user.clientId,
      clientName: nameFromDirectory || nameFromUser || prev.clientName || '',
    }));

    if (__DEV__ && clients.length > 0 && !userClient) {
      console.warn('⚠️ [ADD ENQUIRY] Client user clientId not in clients list; using profile name.', {
        userClientId: user.clientId,
      });
    }
  }, [
    isClient,
    user?.clientId,
    user?.name,
    user?.fullName,
    user?.Name,
    user?.email,
    clients,
  ]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Handle status change - clear assignedTo if current user is not valid for new status
  const handleStatusChange = (newStatus) => {
    handleInputChange('status', newStatus);
    
    // If there's a currently assigned user, check if they're still valid for the new status
    if (formData.assignedTo) {
      const statusLower = String(newStatus || '').toLowerCase();
      const assignedUser = users.find(u => (u.id || u._id) === formData.assignedTo);
      
      if (assignedUser) {
        const roleNumber = typeof assignedUser.role === 'number' 
          ? assignedUser.role 
          : parseInt(assignedUser.role);
        
        // Check if assigned user is still valid for the new status
        let isValid = true;
        if (statusLower.includes('cad')) {
          isValid = roleNumber === 3;
        } else if (statusLower.includes('coral')) {
          isValid = roleNumber === 2;
        }
        
        // Clear assignedTo if user is not valid for the new status
        if (!isValid) {
          handleInputChange('assignedTo', '');
        }
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Name of the piece is required';
    }

    if (!formData.clientId && !formData.clientName.trim()) {
      newErrors.clientId = 'Client is required';
    }

    const st = String(formData.status || '').trim();
    if (!st) {
      newErrors.status = 'Status is required';
    }

    if (isClient && !formData.metalQuality) {
      newErrors.metalQuality = 'Metal quality is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateCurrentStep = () => {
    const stepErrors = {};

    if (isClient) {
      if (currentStep === 1) {
        return true;
      }
      if (!formData.title.trim()) stepErrors.title = 'Name of the piece is required';
      if (!formData.clientId && !formData.clientName.trim()) {
        stepErrors.clientId = 'Client is required';
      }
      if (!formData.metalQuality) stepErrors.metalQuality = 'Metal quality is required';
    } else if (currentStep === 1) {
      return true;
    } else if (currentStep === 2) {
      if (!formData.title.trim()) stepErrors.title = 'Name of the piece is required';
      if (!formData.clientId && !formData.clientName.trim()) {
        stepErrors.clientId = 'Client is required';
      }
    }

    setErrors(prev => ({ ...prev, ...stepErrors }));
    return Object.keys(stepErrors).length === 0;
  };

  const buildRemarksForApi = () => {
    if (isClient && formData.remark?.trim()) {
      return formData.remark.trim();
    }
    return null;
  };

  const renderDropdown = (label, value, options, onSelect, isVisible, onToggle) => {
    const selectedOption = value ? options.find(opt => opt.value === value) : null;
    const displayText = selectedOption?.label || `Select ${label}`;
    
    return (
    <View style={styles.dropdownContainer}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdown}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}>
          {displayText}
        </Text>
        <IconComponent name="arrow-drop-down" size={24} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={onToggle}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={onToggle}
        >
          <View style={styles.dropdownModal}>
            <ScrollView showsVerticalScrollIndicator={false}  style={{height: '100%'}}   >
            {options.map((option) => {
              const isSelected = value === option.value || (!value && option.value === '');
              return (
              <TouchableOpacity
                key={option.value || 'none'}
                activeOpacity={0.7}
                style={[
                  styles.dropdownOption,
                  isSelected && styles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  // If "None" is selected, pass empty string
                  onSelect(option.value === 'None' ? '' : option.value);
                  onToggle();
                }}
              >
                {/* <Image source={} /> */}
                <Text
                  style={[
                    styles.dropdownOptionText,
                    isSelected && styles.dropdownOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {isSelected && (
                  <IconComponent name="check" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
            })}
              </ScrollView>
            
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
    );
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }

    try {
      // Map Priority from form values to API format
      const priorityMap = {
        'low': 'Low',
        'medium': 'Medium',
        'normal': 'Normal',
        'high': 'High',
        'super high': 'Super High',
        'urgent': 'Urgent',
        'Low': 'Low',
        'Medium': 'Medium',
        'Normal': 'Normal',
        'High': 'High',
        'Super High': 'Super High',
        'Urgent': 'Urgent',
      };
      
      const mappedPriority = priorityMap[formData.priority?.toLowerCase()] || priorityMap[formData.priority] || formData.priority || 'Normal';

      const enquiryStatus = formData.status || 'Enquiry Created';

      // Prepare enquiry data according to API structure (without images)
      const enquiryData = {
        Name: formData.title || '',
        ClientId: isClient
          ? formData.clientId || user.clientId || user.id
          : formData.clientId || user.id,
        AssignedTo: isClient ? null : (formData.assignedTo || null), // Client users can't assign
        Status: enquiryStatus,
        Priority: mappedPriority,
        Quantity: parseInt(formData.quantity) || 1,
        Metal: {
          Color: formData.metalColor && formData.metalColor.trim() ? formData.metalColor.trim() : null,
          Quality: formData.metalQuality || '10K',
        },
        StyleNumber: null,
        GatiOrderNumber: null,
        StoneType: formData.stoneType && formData.stoneType.trim() ? formData.stoneType.trim() : null,
        MetalWeight: {
          From: null,
          To: null,
          Exact: null,
        },
        DiamondWeight: {
          From: null,
          To: null,
          Exact: null,
        },
        Stamping: formData.stamping || null,
        Remarks: buildRemarksForApi() || '',
        ShippingDate: null,
        CoralCode: null,
        CadCode: null,
        Category: formData.category || 'Ring',
        Budget: formData.budget && formData.budget.trim() ? formData.budget.trim() : null,
        SpecialRemarks:
          !isClient && formData.remark && formData.remark.trim()
            ? formData.remark.trim()
            : formData.specialRemarks && formData.specialRemarks.trim()
              ? formData.specialRemarks.trim()
              : null,
        ApprovedDate: formData.approvedDate && formData.approvedDate.trim() ? formData.approvedDate : null,
        // Do NOT include ReferenceImages here - they will be uploaded in Step 2
      };

      console.log('📤 Creating enquiry (Step 1):', JSON.stringify(enquiryData, null, 2));
      console.log('📋 [ENQUIRY CREATION] Initial Status:', enquiryStatus);
      console.log('📋 [ENQUIRY CREATION] User Role:', user?.role);
      console.log('📋 [ENQUIRY CREATION] Is Client:', isClient);
      console.log('📋 [ENQUIRY CREATION] Status Flow: Enquiry Created → Coral → CAD → Design Approval Pending → Completed');

      // Create enquiry first - show loading spinner
      const createResult = await createEnquiry(enquiryData).unwrap();
      
      // Get enquiry ID from response
      // The API can return either:
      // 1. Just the ID as a string: "6920d151d1b48a5c0c082d52"
      // 2. An object with id/_id: { id: "...", ... }
      let enquiryId = null;
      
      if (typeof createResult === 'string') {
        // Response is directly the ID string
        enquiryId = createResult;
      } else if (createResult?.id) {
        enquiryId = createResult.id;
      } else if (createResult?._id) {
        enquiryId = createResult._id;
      }
      
      if (!enquiryId) {
        console.error('❌ Failed to extract enquiry ID from response:', createResult);
        Alert.alert('Error', 'Failed to create enquiry. Enquiry ID not returned.');
        return;
      }

      console.log('✅ Enquiry created successfully:', {
        'Enquiry ID': enquiryId,
        'Name': createResult?.Name || createResult?.name || enquiryData.Name,
      });

      const formDataForUpload = {
        ...formData,
        description: buildRemarksForApi() || '',
      };

      navigation.navigate('AddEnquiryStep2', {
        formData: formDataForUpload,
        enquiryId,
        isEditMode: false,
      });
    } catch (error) {
      console.error('❌ Error creating enquiry:', error);
      Alert.alert(
        'Error',
        error?.data?.message || error?.data?.error || 'Failed to create enquiry. Please try again.'
      );
    }
  };

  const priorityOptions = [
    { label: 'Normal', value: 'Normal' },
    { label: 'High', value: 'High' },
    { label: 'Super High', value: 'Super High' },
  ];

  const metalColorOptions = [
    { label: 'None', value: '' }, // Option to clear selection
    { label: 'White Gold', value: 'White Gold' },
    { label: 'Rose Gold', value: 'Rose Gold' },
    { label: 'Yellow Gold', value: 'Yellow Gold' },
    { label: 'Two Tone Rose White Gold', value: 'Two Tone Rose White Gold' },
    { label: 'Two Tone Yellow White Gold', value: 'Two Tone Yellow White Gold' },
    { label: 'Three Tone Rose Yellow White Gold', value: 'Three Tone Rose Yellow White Gold' },
  ];

  const metalQualityOptions = [
    { label: '10K', value: '10K' },
    { label: '14K', value: '14K' },
    { label: '18K', value: '18K' },
    { label: '22K', value: '22K' },
    { label: 'Silver 925', value: 'Silver 925' },
    { label: 'Platinum', value: 'Platinum' },
  ];

  // Stone type options from API - add "None" option at the beginning for optional field
  const stoneTypeOptions = [{ label: 'None', value: '' }, ...(stoneTypesData || [])];

  const goToNextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const goToPrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const renderProgress = () => {
    const progress = currentStep / totalSteps;
    return (
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarFill, { flex: progress }]} />
        <View style={{ flex: 1 - progress }} />
      </View>
    );
  };

  const handleSelectProjectType = (type) => {
    setProjectType(type);
    if (type === 'coral') {
      handleStatusChange('Coral');
      if (isClient) {
        handleInputChange('remark', CLIENT_REMARK_BY_PROJECT_TYPE.coral);
      }
    } else if (type === 'cad') {
      handleStatusChange('CAD');
      if (isClient) {
        handleInputChange('remark', CLIENT_REMARK_BY_PROJECT_TYPE.cad);
      }
    } else if (type === 'approvedCad') {
      handleStatusChange('Approved Cad');
      if (isClient) {
        handleInputChange('remark', CLIENT_REMARK_BY_PROJECT_TYPE.approvedCad);
      }
    }
  };

  const renderStep1TypeSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepQuestion}>Choose enquiry status</Text>
      <Text style={styles.stepHint}>
        {isClient
          ? 'Pick Coral, CAD, or Approved CAD. A starting note is added to your remark — you can edit it on the next step.'
          : 'Pick Coral, CAD, or Approved CAD. Assign To options match the status you choose.'}
      </Text>
      <View style={styles.projectTileRowWrap}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.projectTile,
            styles.projectTileThird,
            projectType === 'coral' && styles.projectTileActive,
          ]}
          onPress={() => handleSelectProjectType('coral')}
        >
          <IconComponent name="waves" size={28} color={colors.primary} />
          <Text style={styles.projectTileTitle}>Coral</Text>
          <Text style={styles.projectTileSubtitle}>Coral design track</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.projectTile,
            styles.projectTileThird,
            projectType === 'cad' && styles.projectTileActive,
          ]}
          onPress={() => handleSelectProjectType('cad')}
        >
          <IconComponent name="architecture" size={28} color={colors.primary} />
          <Text style={styles.projectTileTitle}>CAD</Text>
          <Text style={styles.projectTileSubtitle}>CAD workflow</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.projectTile,
            styles.projectTileThird,
            projectType === 'approvedCad' && styles.projectTileActive,
          ]}
          onPress={() => handleSelectProjectType('approvedCad')}
        >
          <IconComponent name="description" size={28} color={colors.primary} />
          <Text style={styles.projectTileTitle}>Approved CAD</Text>
          <Text style={styles.projectTileSubtitle}>Approved CAD track</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  /** Client picker — staff only; clients are auto-bound to the logged-in account */
  const renderClientTiles = () => {
    if (isClient) {
      return null;
    }

    return (
      <View style={styles.dropdownContainer}>
        {renderDropdown(
          'Client*',
          formData.clientId,
          clientOptions,
          (clientId) => {
            const selectedClient = clients.find(c => (c.id || c._id) === clientId);
            handleInputChange('clientId', clientId);
            handleInputChange('clientName', selectedClient?.name || '');
          },
          showClientDropdown,
          () => setShowClientDropdown(!showClientDropdown)
        )}
        {errors.clientId && (
          <Text style={styles.errorText}>{errors.clientId}</Text>
        )}
      </View>
    );
  };

  const renderAdminStep2Fields = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepQuestion}>Enquiry details</Text>
      <View style={styles.formRow}>
        <View style={[styles.formField, styles.fullWidthField]}>
          <Input
            label="Name of the Piece*"
            placeholder="Name of the piece"
            value={formData.title}
            onChangeText={(value) => handleInputChange('title', value)}
            error={errors.title}
          />
        </View>
      </View>
      <View style={styles.formRow}>
        <View style={[styles.formField, styles.fullWidthField]}>
          {renderClientTiles()}
        </View>
      </View>
      <View style={styles.formRow}>
        <View style={[styles.formField, styles.fullWidthField]}>
          {renderDropdown(
            'Assign To',
            formData.assignedTo,
            assignedToOptions,
            (value) => handleInputChange('assignedTo', value),
            showAssignedToDropdown,
            () => setShowAssignedToDropdown(!showAssignedToDropdown)
          )}
        </View>
      </View>
      <View style={styles.formRow}>
        <View style={[styles.formField, styles.fullWidthField]}>
          <View style={styles.priorityContainer}>
            <Text style={styles.priorityLabel}>Priority</Text>
            <View style={styles.priorityOptions}>
              {priorityOptions.map((option, index) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.priorityOption,
                    formData.priority === option.value && styles.priorityOptionActive,
                    index === priorityOptions.length - 1 && styles.priorityOptionLast,
                  ]}
                  onPress={() => handleInputChange('priority', option.value)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.priorityOptionText,
                      formData.priority === option.value && styles.priorityOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
      <View style={styles.formRow}>
        <View style={[styles.formField, styles.fullWidthField]}>
          <Input
            label="Remark"
            placeholder="Internal remark (optional)"
            value={formData.remark}
            onChangeText={(value) => handleInputChange('remark', value)}
            multiline
            numberOfLines={3}
          />
        </View>
      </View>
    </View>
  );

  const renderClientStepFields = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepQuestion}>Your enquiry</Text>
      <View style={styles.formRow}>
        <View style={[styles.formField, styles.fullWidthField]}>
          <Input
            label="Name of the Piece*"
            placeholder="Name of the piece"
            value={formData.title}
            onChangeText={(value) => handleInputChange('title', value)}
            error={errors.title}
          />
        </View>
      </View>
      {renderChipRow(
        'Stone type',
        formData.stoneType,
        stoneTypeOptions,
        (val) => handleInputChange('stoneType', val),
      )}
      {renderChipRow(
        'Metal quality*',
        formData.metalQuality,
        metalQualityOptions,
        (val) => handleInputChange('metalQuality', val),
      )}
      {errors.metalQuality ? (
        <Text style={styles.errorText}>{errors.metalQuality}</Text>
      ) : null}
      {renderChipRow(
        'Metal color',
        formData.metalColor,
        metalColorOptions,
        (val) => handleInputChange('metalColor', val),
      )}
      <View style={styles.formRow}>
        <View style={[styles.formField, styles.fullWidthField]}>
          <Input
            label="Remark"
            placeholder="Any other notes"
            value={formData.remark}
            onChangeText={(value) => handleInputChange('remark', value)}
            multiline
            numberOfLines={3}
          />
        </View>
      </View>
      <View style={styles.formRow}>
        <View style={[styles.formField, styles.fullWidthField]}>
          <Input
            label="Budget"
            placeholder="Budget (optional)"
            value={formData.budget}
            onChangeText={(value) => handleInputChange('budget', value)}
          />
        </View>
      </View>
    </View>
  );

  const renderChipRow = (label, value, options, onSelect) => (
    <View style={styles.tileGroup}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <View style={styles.chipRowWrap}>
        {options.map(option => {
          const selected = value === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.choiceChip,
                selected && styles.choiceChipActive,
              ]}
              activeOpacity={0.85}
              onPress={() => onSelect(option.value)}
            >
              <Text
                style={[
                  styles.choiceChipLabel,
                  selected && styles.choiceChipLabelActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderStepContent = () => {
    if (currentStep === 1) {
      return renderStep1TypeSelection();
    }
    if (isClient) {
      return renderClientStepFields();
    }
    return renderAdminStep2Fields();
  };

  const mainActionLabel =
    currentStep === totalSteps ? 'Create enquiry' : 'Next';

  const onPrimaryPress = () => {
    if (!validateCurrentStep()) {
      return;
    }
    // If we're on the last step, validateCurrentStep already ran full validation
    if (currentStep === totalSteps) {
      handleSubmit();
    } else {
      goToNextStep();
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create Enquiry</Text>
        <Text style={styles.headerSubtitle}>
          {`Step ${currentStep} of ${totalSteps}`}
        </Text>
        {renderProgress()}
      </View>

      <View style={styles.form}>
        {renderStepContent()}

        <View style={styles.footerActions}>
          {currentStep > 1 && (
            <TouchableOpacity
              onPress={goToPrevStep}
              style={[styles.adminActionButton, styles.adminActionButtonSecondary]}
              activeOpacity={0.85}
              disabled={isCreatingEnquiry}
            >
              <IconComponent name="arrow-back" size={18} color={colors.primary} />
              <Text style={[styles.adminActionText, styles.adminActionSecondaryText]}>
                Back
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={onPrimaryPress}
            style={[
              styles.adminActionButton,
              styles.adminActionButtonPrimary,
              isCreatingEnquiry && styles.disabledButton,
            ]}
            activeOpacity={0.85}
            disabled={isCreatingEnquiry}
          >
            {isCreatingEnquiry ? (
              <>
                <ActivityIndicator size="small" color={colors.textWhite} style={{ marginRight: 8 }} />
                <Text style={styles.adminActionText}>Creating Enquiry...</Text>
              </>
            ) : (
              <>
                <IconComponent
                  name={currentStep === totalSteps ? 'check-circle' : 'arrow-forward'}
                  size={18}
                  color={colors.textWhite}
                />
                <Text style={styles.adminActionText}>{mainActionLabel}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    backgroundColor: colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressBarContainer: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: colors.border,
    marginTop: 12,
  },
  progressBarFill: {
    backgroundColor: colors.primary,
  },
  headerTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  form: {
    padding: 16,
  },
  stepContent: {
    marginTop: 12,
  },
  stepQuestion: {
    fontSize: fonts.base,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  projectTileRow: {
    flexDirection: 'row',
    gap: 12,
  },
  projectTileRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  projectTileThird: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 100,
    maxWidth: '100%',
  },
  stepHint: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  projectTile: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-between',
  },
  projectTileActive: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.background,
  },
  projectTileTitle: {
    marginTop: 12,
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  projectTileSubtitle: {
    marginTop: 4,
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: fonts.base,
    fontFamily: fonts.medium,
  },
  tileGroup: {
    marginTop: 16,
    marginBottom: 8,
  },
  chipScrollContent: {
    paddingVertical: 4,
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
    borderColor: colors.primaryLight ,
    backgroundColor: colors.primaryExtraLight ,
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
  priorityContainer: {
    marginTop: 12,
  },
  priorityLabel: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  priorityOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  priorityOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primaryExtraLight,
    borderWidth: 1,
    borderColor: colors.primaryLight || colors.primary,
    marginRight: 8,
    marginBottom: 8,
  },
  priorityOptionLast: {
    marginRight: 0,
  },
  priorityOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark || colors.primary,
    borderWidth: 2,
  },
  priorityOptionText: {
    fontSize: fonts.sm,
    color: colors.primaryDark || colors.primary,
    fontWeight: '500',
  },
  priorityOptionTextActive: {
    fontSize: fonts.sm,
    color: colors.textWhite,
    fontWeight: '600',
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
  footerActions: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  adminActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  adminActionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  adminActionButtonSecondary: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  adminActionText: {
    color: colors.textWhite,
    fontFamily: fonts.medium,
    fontSize: 14,
    marginLeft: 8,
  },
  adminActionSecondaryText: {
    color: colors.primary,
  },
  errorText: {
    color: colors.error,
    fontSize: fonts.sm,
    marginTop: 4,
    marginLeft: 4,
  },
  dropdownContainer: {
    marginBottom: 12,
  },
  dropdownLabel: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    minHeight: 44,
  },
  dropdownText: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    flex: 1,
  },
  dropdownPlaceholder: {
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    backgroundColor: colors.background,
    borderRadius: 12,
    // padding: 10,
    minWidth: 300,
    maxWidth: '80%',
    height: '50%',
    overflow: 'scroll',
    shadowColor: colors.shadow || colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 10 },
    
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight || colors.border,
  },
  dropdownOptionSelected: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 10,
    margin: 10,
   borderBottomColor: colors.primary,
   borderBottomWidth: 2,
   borderRadius: 10,
   shadowColor: colors.shadow || colors.textPrimary,
  },
  dropdownOptionText: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    marginLeft: 10,
  },
  dropdownOptionTextSelected: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  disabledDropdown: {
    backgroundColor: colors.backgroundSecondary,
    opacity: 0.6,
  },
  disabledText: {
    color: colors.textSecondary,
  },
  weightRow: {
    flexDirection: 'row',
    gap: 12,
  },
  weightInput: {
    flex: 1,
  },
  datePickerContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  datePickerCancel: {
    padding: 8,
  },
  datePickerCancelText: {
    fontSize: fonts.base,
    color: colors.textSecondary,
  },
  datePickerTitle: {
    fontSize: fonts.lg,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  datePickerDone: {
    padding: 8,
  },
  datePickerDoneText: {
    fontSize: fonts.base,
    color: colors.primary,
    fontWeight: '600',
  },
  datePicker: {
    width: '100%',
    height: 200,
  },
});

export default AddEnquiryStep1Screen;

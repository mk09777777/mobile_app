import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandedAlert from '../../components/common/BrandedAlert';
import { Input, Button } from '../../components/common';
import { AnimatedLogoLoader } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { useAuth } from '../../context/AuthContext';
import { useGetUserByIdQuery, useCreateUserMutation, useUpdateUserMutation, useDeleteUserMutation, useGetRolesQuery, useGetClientsQuery } from '../../store/api';

const CreateUserScreen = ({ navigation, route }) => {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.roleNumber === 1;
  const { userId } = route.params || {};
  const isEditMode = !!userId;

  const CLIENT_HANDLER_ROLE_ID = 5;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 4,
    phone: '',
    clientId: '',
    skills: '',
    clientsHandled: [],
  });
  const [errors, setErrors] = useState({});
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  // RTK Query hooks
  const { data: rolesData = [], isLoading: fetchingRoles } = useGetRolesQuery();
  const isClientHandler = Number(formData.role) === CLIENT_HANDLER_ROLE_ID;
  const { data: clientsData = [], isLoading: fetchingClients } = useGetClientsQuery(undefined, {
    skip: !isClientHandler,
  });
  const { data: userData, isLoading: fetchingUser } = useGetUserByIdQuery(userId, {
    skip: !isEditMode || !userId,
  });
  const [createUser, { isLoading: creating }] = useCreateUserMutation();
  const [updateUser, { isLoading: updating }] = useUpdateUserMutation();
  const [deleteUser, { isLoading: deleting }] = useDeleteUserMutation();

  const loading = creating || updating || deleting;

  // Map API roles to { label, value } shape — fallback to id as value
  const roleOptions = rolesData.map(r => ({ label: r.name, value: r.id }));

  // Populate form when user data is fetched
  useEffect(() => {
    if (userData && isEditMode) {
      setFormData({
        name: userData.name || '',
        email: userData.email || '',
        password: '',
        role: userData.role || 4,
        phone: userData.phone || '',
        clientId: userData.clientId || '',
        skills: userData.skills || '',
        clientsHandled: userData.clientsHandled || [],
      });
    }
  }, [userData, isEditMode]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!isEditMode && !formData.password) newErrors.password = 'Password is required';
    if (formData.password && formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (!formData.role) newErrors.role = 'Role is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    // Allow unauthenticated access (e.g. from login screen setup flow)
    if (currentUser && !isAdmin) {
      showAlert('Access Denied', 'Only administrators can create/edit users.', 'warning');
      return;
    }

    if (!validateForm()) {
      showAlert('Validation Error', 'Please fix the errors in the form', 'warning');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        phone: formData.phone || undefined,
        clientId: formData.clientId || undefined,
        skills: formData.skills || undefined,
        clientsHandled: isClientHandler ? formData.clientsHandled : undefined,
      };
      console.log('📤 [CreateUser] Submitting payload:', JSON.stringify(payload, null, 2));

      // Only include password for new user creation, not for updates
      if (!isEditMode && formData.password) {
        payload.password = formData.password;
      }

      let result;
      if (isEditMode) {
        result = await updateUser({ userId, ...payload }).unwrap();
      } else {
        result = await createUser(payload).unwrap();
      }

      showAlert('Success', result.message || (isEditMode ? 'User updated successfully' : 'User created successfully'), 'success', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      showAlert('Error', error.error || error.message || 'Failed to save user', 'error');
    }
  };

  const handleDelete = async () => {
    if (!isAdmin || !isEditMode) return;

    showAlert('Delete User', 'Are you sure you want to delete this user? This action cannot be undone.', 'warning', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const result = await deleteUser(userId).unwrap();
            showAlert('Success', result.message || 'User deleted successfully', 'success', [
              { text: 'OK', onPress: () => navigation.goBack() }
            ]);
          } catch (error) {
            showAlert('Error', error.error || error.message || 'Failed to delete user', 'error');
          }
        },
      },
    ]);
  };

  if (fetchingUser || fetchingRoles || (isClientHandler && fetchingClients)) {
    return <AnimatedLogoLoader size={80} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.form}>
          <Input
            label="Name"
            placeholder="Enter user name"
            value={formData.name}
            onChangeText={(text) => {
              setFormData(prev => ({ ...prev, name: text }));
              if (errors.name) setErrors(prev => ({ ...prev, name: null }));
            }}
            error={errors.name}
          />

          <Input
            label="Email"
            placeholder="Enter email address"
            value={formData.email}
            onChangeText={(text) => {
              setFormData(prev => ({ ...prev, email: text }));
              if (errors.email) setErrors(prev => ({ ...prev, email: null }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <Input
            label="Phone (optional)"
            placeholder="Enter phone number"
            value={formData.phone}
            onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
            keyboardType="phone-pad"
          />

          <Input
            label="Skills (optional)"
            placeholder="Enter skills (e.g., Design, CAD, 3D Modeling)"
            value={formData.skills}
            onChangeText={(text) => setFormData(prev => ({ ...prev, skills: text }))}
          />

          <Input
            label="Client ID (optional)"
            placeholder="Enter client ID"
            value={formData.clientId}
            onChangeText={(text) => setFormData(prev => ({ ...prev, clientId: text }))}
          />

          {!isEditMode && (
            <Input
              label="Password"
              placeholder="Enter password"
              value={formData.password}
              onChangeText={(text) => {
                setFormData(prev => ({ ...prev, password: text }));
                if (errors.password) setErrors(prev => ({ ...prev, password: null }));
              }}
              secureTextEntry
              error={errors.password}
            />
          )}

          <View style={styles.roleContainer}>
            <Text style={styles.roleLabel}>Role</Text>
            <View style={styles.roleOptions}>
              {roleOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.roleOption,
                    formData.role === option.value && styles.roleOptionSelected,
                  ]}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, role: option.value }));
                    if (errors.role) setErrors(prev => ({ ...prev, role: null }));
                  }}>
                  <Text
                    style={[
                      styles.roleOptionText,
                      formData.role === option.value && styles.roleOptionTextSelected,
                    ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.role && <Text style={styles.errorText}>{errors.role}</Text>}
          </View>

          {isClientHandler && (
            <View style={styles.roleContainer}>
              <Text style={styles.roleLabel}>
                Clients Handled ({formData.clientsHandled.length} selected)
              </Text>
              {clientsData.length === 0 ? (
                <Text style={styles.emptyText}>No clients available</Text>
              ) : (
                <View style={styles.clientsGrid}>
                  {clientsData.map(client => {
                    const selected = formData.clientsHandled.includes(client.id);
                    return (
                      <TouchableOpacity
                        key={client.id}
                        style={[styles.clientChip, selected && styles.clientChipSelected]}
                        onPress={() => {
                          setFormData(prev => ({
                            ...prev,
                            clientsHandled: selected
                              ? prev.clientsHandled.filter(id => id !== client.id)
                              : [...prev.clientsHandled, client.id],
                          }));
                        }}>
                        <Text style={[styles.clientChipText, selected && styles.clientChipTextSelected]}>
                          {client.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          <Button
            title={isEditMode ? 'Update User' : 'Create User'}
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitButton}
          />

          {isEditMode && (
            <Button
              title="Delete User"
              onPress={handleDelete}
              variant="outline"
              style={styles.deleteButton}
              textStyle={{ color: colors.error }}
            />
          )}
        </View>
      </ScrollView>
      <BrandedAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
};

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
  },
  form: {
    gap: 16,
  },
  roleContainer: {
    marginBottom: 8,
  },
  roleLabel: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  roleOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  roleOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleOptionText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  roleOptionTextSelected: {
    color: colors.textWhite,
  },
  errorText: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.error,
    marginTop: 4,
  },
  clientsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  clientChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  clientChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  clientChipText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  clientChipTextSelected: {
    color: colors.textWhite,
  },
  emptyText: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  submitButton: {
    marginTop: 8,
  },
  deleteButton: {
    marginTop: 8,
    borderColor: colors.error,
  },
});

export default CreateUserScreen;

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input, Button } from '../../components/common';
import { AnimatedLogoLoader } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { useAuth } from '../../context/AuthContext';
import { useGetUserByIdQuery, useCreateUserMutation, useUpdateUserMutation, useDeleteUserMutation } from '../../store/api';

const ROLE_OPTIONS = [
  { label: 'Admin', value: 1 },
  { label: 'Coral Designer', value: 2 },
  { label: 'CAD Designer', value: 3 },
  { label: 'Client', value: 4 },
];

const CreateUserScreen = ({ navigation, route }) => {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.roleNumber === 1;
  const { userId } = route.params || {};
  const isEditMode = !!userId;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 4,
    phone: '',
    clientId: '',
    skills: '',
  });
  const [errors, setErrors] = useState({});

  // RTK Query hooks
  const { data: userData, isLoading: fetchingUser } = useGetUserByIdQuery(userId, {
    skip: !isEditMode || !userId,
  });
  const [createUser, { isLoading: creating }] = useCreateUserMutation();
  const [updateUser, { isLoading: updating }] = useUpdateUserMutation();
  const [deleteUser, { isLoading: deleting }] = useDeleteUserMutation();

  const loading = creating || updating || deleting;

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
    if (!isAdmin) {
      Alert.alert('Access Denied', 'Only administrators can create/edit users.');
      return;
    }

    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors in the form');
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
      };

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

      Alert.alert(
        'Success',
        result.message || (isEditMode ? 'User updated successfully' : 'User created successfully'),
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', error.error || error.message || 'Failed to save user');
    }
  };

  const handleDelete = async () => {
    if (!isAdmin || !isEditMode) return;

    Alert.alert(
      'Delete User',
      'Are you sure you want to delete this user? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteUser(userId).unwrap();
              Alert.alert('Success', result.message || 'User deleted successfully', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              Alert.alert('Error', error.error || error.message || 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  if (loading || fetchingUser) {
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
              setFormData({ ...formData, name: text });
              if (errors.name) setErrors({ ...errors, name: null });
            }}
            error={errors.name}
          />

          <Input
            label="Email"
            placeholder="Enter email address"
            value={formData.email}
            onChangeText={(text) => {
              setFormData({ ...formData, email: text });
              if (errors.email) setErrors({ ...errors, email: null });
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <Input
            label="Phone (optional)"
            placeholder="Enter phone number"
            value={formData.phone}
            onChangeText={(text) => {
              setFormData({ ...formData, phone: text });
            }}
            keyboardType="phone-pad"
          />

          <Input
            label="Skills (optional)"
            placeholder="Enter skills (e.g., Design, CAD, 3D Modeling)"
            value={formData.skills}
            onChangeText={(text) => {
              setFormData({ ...formData, skills: text });
            }}
          />

          <Input
            label="Client ID (optional)"
            placeholder="Enter client ID"
            value={formData.clientId}
            onChangeText={(text) => {
              setFormData({ ...formData, clientId: text });
            }}
          />

          {!isEditMode && (
            <Input
              label="Password"
              placeholder="Enter password"
              value={formData.password}
              onChangeText={(text) => {
                setFormData({ ...formData, password: text });
                if (errors.password) setErrors({ ...errors, password: null });
              }}
              secureTextEntry
              error={errors.password}
            />
          )}

          <View style={styles.roleContainer}>
            <Text style={styles.roleLabel}>Role</Text>
            <View style={styles.roleOptions}>
              {ROLE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.roleOption,
                    formData.role === option.value && styles.roleOptionSelected,
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, role: option.value });
                    if (errors.role) setErrors({ ...errors, role: null });
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
  submitButton: {
    marginTop: 8,
  },
  deleteButton: {
    marginTop: 8,
    borderColor: colors.error,
  },
});

export default CreateUserScreen;

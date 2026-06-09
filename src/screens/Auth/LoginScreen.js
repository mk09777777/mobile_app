import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import BrandedAlert from '../../components/common/BrandedAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import secureStorage from '../../utils/secureStorage';
import { useLoginMutation } from '../../store/api';
import { setCredentials } from '../../features/auth/authSlice';
import { useAuth } from '../../context/AuthContext'; // Keeping for backward compatibility during migration
import { Input, Button } from '../../components/common';
import { Heading, BodyText } from '../../components/common/Text';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { images } from '../../constants/images';
import { validateEmail, validatePassword } from '../../utils/helpers';

const LoginScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const [loginMutation, { isLoading }] = useLoginMutation();
  const { login: contextLogin } = useAuth(); // For backward compatibility
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!validatePassword(formData.password)) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    try {
      // Call Redux login mutation
      const result = await loginMutation({
        email: formData.email,
        password: formData.password,
      }).unwrap();
      
      if (result.success) {
        // Console log the login token
        console.log('🔑 BEARER TOKEN (copy for Swagger):', result.token);
        
        // Fetch user details from API to get the actual name and clientId from database
        let userDetails = null;
        if (result.user.id) {
          try {
            const { API_BASE_URL } = require('../../config/apiConfig');
            const userResponse = await fetch(`${API_BASE_URL}/api/users/${result.user.id}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${result.token}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (userResponse.ok) {
              const userDataResponse = await userResponse.json();
              console.log('🔍 [LOGIN] Raw /api/users/:id response:', JSON.stringify(userDataResponse, null, 2));
              userDetails = userDataResponse.user || userDataResponse;
              console.log('🔍 [LOGIN] userDetails extracted:', JSON.stringify(userDetails, null, 2));
              
              // If ClientId is not in token but user is Role 4, get it from database
              if (result.user.roleNumber === 4 && !result.user.clientId && userDetails) {
                const dbClientId = userDetails.clientId || userDetails.ClientId;
                if (dbClientId) {
                  result.user.clientId = dbClientId;
               
                }
              }
            } else {
            }
          } catch (error) {
            // Continue with login even if user details fetch fails
         
          }
        }
        
        // Generate display name as fallback if name is not available
        const getDisplayName = (email, role) => {
          if (email) {
            const emailPart = email.split('@')[0];
            return emailPart.charAt(0).toUpperCase() + emailPart.slice(1);
          }
          const roleNames = {
            admin: 'Administrator',
            client: 'Client',
            coral: 'Coral Designer',
            cad: 'CAD Designer',
          };
          return roleNames[role] || 'User';
        };
        
        // Use name from database (userDetails), then from token, then generate from email
        const userName = userDetails?.name || userDetails?.Name || 
                        result.user.name || 
                        getDisplayName(formData.email, result.user.role);
        
        const userData = {
          ...result.user,
          email: formData.email,
          name: userName,
          clientId: result.user.clientId || userDetails?.clientId || userDetails?.ClientId,
          ...(userDetails && {
            phone: userDetails.phone || userDetails.Phone,
            clientsHandled: userDetails.clientsHandled || userDetails.ClientsHandled || [],
          }),
        };
        console.log('👤 [LOGIN] userData.clientsHandled:', userData.clientsHandled);
        
        if (__DEV__ && userData.roleNumber === 4) {
         
          if (!userData.clientId) {
            console.error('❌ [LOGIN] ERROR: ClientId is missing for Role 4 user!');
          }
        }
        
        
        // Store in secure storage
        await secureStorage.setItem('user', JSON.stringify(userData));
        await secureStorage.setItem('token', result.token);
        // Also store in AsyncStorage so screens using AsyncStorage.getItem('token') can find it
        await AsyncStorage.setItem('token', result.token);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        
        // Verify token was stored securely
        const tokenVerification = await secureStorage.verifyStorage('token');
        const userVerification = await secureStorage.verifyStorage('user');
        
        if (__DEV__) {
          console.log('🔐 [LOGIN] Storage Verification:');
          console.log('  Token:', tokenVerification.message);
          console.log('  User:', userVerification.message);
          
          if (tokenVerification.isSecure) {
            console.log('✅ Token is securely stored in Keychain/Keystore');
          } else {
            console.warn('⚠️ Token is NOT securely stored - using AsyncStorage fallback');
          }
        }
        
        // Verify token was stored
        const storedToken = await secureStorage.getItem('token');
        console.log('Token retrieved from storage:', storedToken?.substring(0, 50) + '...');
        
        // Update Redux store
        dispatch(setCredentials({ user: userData, token: result.token }));
        
        // Also update context for backward compatibility during migration
        await contextLogin(formData.email, formData.password);
        
        // Navigation handled by auth state
      } else {
        showAlert('Login Failed', result.error || 'Invalid credentials', 'error');
      }
    } catch (error) {
      console.error('Full error:', JSON.stringify(error, null, 2));
      
      const errorMessage = error.data?.error || error.message || 'Invalid credentials. Please try again.';
      showAlert('Login Failed', errorMessage, 'error');
    }
  };

  const demoCredentials = [
    { role: 'Admin', email: 'test@gmail.com', password: 'testing' },
    { role: 'Client', email: 'test@cl.com', password: '123456' },
    { role: 'Coral Designer', email: 'pitbull9792@gmail.com', password: 'sourav84206' },
    { role: 'CAD Designer', email: 'anupampatra386@gmail.com', password: 'anupam97698' },
    { role: 'Client Handler', email: 'mtest@gmail.com', password: 'Mayur@12' },
  ];

  const fillDemoCredentials = (email, password) => {
    setFormData({ email, password });
    setErrors({});
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled">
        
        <View style={styles.header}>
          <Image 
            source={images.logo} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Image 
            source={images.loginLogo} 
            style={styles.loginLogoImage}
            resizeMode="contain"
          />
          <BodyText color="secondary" style={styles.subtitle}>
            Welcome back! Please sign in to continue.
          </BodyText>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="Enter your email"
            value={formData.email}
            onChangeText={(value) => handleInputChange('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={formData.password}
            onChangeText={(value) => handleInputChange('password', value)}
            secureTextEntry
            error={errors.password}
          />

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={isLoading}
            style={styles.loginButton}
          />

        </View>

        <View style={styles.demoSection}>
          <BodyText color="secondary" style={styles.demoTitle}>
            Demo Credentials:
          </BodyText>
          {demoCredentials.map((cred, index) => (
            <Button
              key={index}
              title={`Login as ${cred.role}`}
              variant="outline"
              size="small"
              onPress={() => fillDemoCredentials(cred.email, cred.password)}
              style={styles.demoButton}
            />
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    backgroundColor: colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 8,
  },
  loginLogoImage: {
    width: 200,
    height: 60,
    marginBottom: 12,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: fonts.base,
  },
  form: {
    marginBottom: 32,
  },
  loginButton: {
    marginTop: 8,
    borderRadius: 20,
  },
  demoSection: {
    alignItems: 'center',
  },
  demoTitle: {
    marginBottom: 16,
    fontWeight: fonts.medium,
  },
  demoButton: {
    marginBottom: 8,
    minWidth: 200,
  },
});

export default LoginScreen;

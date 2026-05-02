import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import secureStorage from '../utils/secureStorage';
import { decodeJWT } from '../utils/helpers';
import { checkAuthState, logoutUser } from '../features/auth/authThunks';
import { useRemovePushTokenMutation } from '../store/api';
import { getStoredPushToken, clearStoredPushToken } from '../services/pushNotificationService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const [removePushToken] = useRemovePushTokenMutation();
  // Get auth state from Redux (single source of truth)
  const { user: reduxUser, token: reduxToken, isAuthenticated: reduxIsAuthenticated, isLoading: reduxIsLoading } = useSelector((state) => state.auth);
  
  // Local state for backward compatibility
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Check auth state on mount
    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeAuth = async () => {
    try {
      // Dispatch Redux checkAuthState which will handle validation
      await dispatch(checkAuthState()).unwrap();
    } catch (error) {
      // If checkAuthState fails, clear invalid tokens
      await clearInvalidAuth();
    } finally {
      setIsInitialized(true);
    }
  };

  const clearInvalidAuth = async () => {
    try {
      const storedToken = await secureStorage.getItem('token');
      if (storedToken) {
        // Check if token is expired
        const decodedToken = decodeJWT(storedToken);
        if (decodedToken) {
          const exp = decodedToken.exp || decodedToken.Exp;
          if (exp) {
            const currentTime = Math.floor(Date.now() / 1000);
            if (exp < currentTime) {
              // Token is expired, clear it
              await dispatch(logoutUser()).unwrap();
              return;
            }
          }
        }
      }
    } catch (error) {
      // If we can't decode token, it's invalid - clear it
      await dispatch(logoutUser()).unwrap();
    }
  };

  // Note: Login is now handled by Redux in LoginScreen
  // This function is kept for backward compatibility but should not be used
  // LoginScreen uses useLoginMutation from Redux directly
  const login = async (email, password) => {
    return { success: false, error: 'Please use Redux login' };
  };

  const logout = async () => {
    try {
      const storedPushToken = await getStoredPushToken();
      if (storedPushToken) {
        try {
          await removePushToken({ token: storedPushToken }).unwrap();
        } catch (error) {
        }
      }
      await clearStoredPushToken();
    } catch (err) {
    } finally {
      try {
        await dispatch(logoutUser()).unwrap();
      } catch (error) {
      }
    }
  };

  // Use Redux state as single source of truth
  // Show loading until Redux state is initialized
  const isLoading = !isInitialized || reduxIsLoading;
  const isAuthenticated = reduxIsAuthenticated && !!reduxUser && !!reduxToken;
  const user = reduxUser;

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

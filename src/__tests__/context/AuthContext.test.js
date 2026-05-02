/**
 * Tests for AuthContext
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { createTestStore } from '../utils/testUtils';
import { mockUsers } from '../utils/testUtils';

// Mock authThunks properly - Use actual createAsyncThunk to get proper structure
jest.mock('../../features/auth/authThunks', () => {
  const { createAsyncThunk } = require('@reduxjs/toolkit');
  
  return {
    checkAuthState: createAsyncThunk(
      'auth/checkAuthState',
      async () => {
        const { mockUsers } = require('../utils/testUtils');
        return {
          user: mockUsers.admin,
          token: 'mock-token',
        };
      }
    ),
    logoutUser: createAsyncThunk(
      'auth/logoutUser',
      async () => {
        return null;
      }
    ),
  };
});

describe('AuthContext', () => {
  let store;

  beforeEach(() => {
    store = createTestStore({
      auth: {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      },
    });
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should provide auth context', async () => {
    const wrapper = ({ children }) => (
      <Provider store={store}>
        <AuthProvider>{children}</AuthProvider>
      </Provider>
    );

    const { result, waitForNextUpdate } = renderHook(() => useAuth(), { wrapper });

    // Wait for initialization
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(result.current).toHaveProperty('user');
    expect(result.current).toHaveProperty('isAuthenticated');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('login');
    expect(result.current).toHaveProperty('logout');
  });

  it('should initialize auth state on mount', async () => {
    AsyncStorage.getItem.mockResolvedValue('mock-token');

    const wrapper = ({ children }) => (
      <Provider store={store}>
        <AuthProvider>{children}</AuthProvider>
      </Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for initialization
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should handle logout', async () => {
    store = createTestStore({
      auth: {
        user: mockUsers.admin,
        token: 'mock-token',
        isAuthenticated: true,
        isLoading: false,
      },
    });

    const wrapper = ({ children }) => (
      <Provider store={store}>
        <AuthProvider>{children}</AuthProvider>
      </Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await result.current.logout();

    await waitFor(() => {
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = jest.fn();

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    console.error = originalError;
  });

  it('should handle expired token', async () => {
    // Create expired token
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImV4cCI6MTAwMDAwMDAwMH0.signature';
    
    AsyncStorage.getItem.mockResolvedValue(expiredToken);

    const wrapper = ({ children }) => (
      <Provider store={store}>
        <AuthProvider>{children}</AuthProvider>
      </Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});


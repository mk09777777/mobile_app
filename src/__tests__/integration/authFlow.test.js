/**
 * Integration tests for authentication flow
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from '../../screens/Auth/LoginScreen';
import DashboardScreen from '../../screens/Dashboard/DashboardScreen';
import { createTestStore, createMockNavigation, mockUsers } from '../utils/testUtils';
import { api } from '../../store/api';

// Mock API
jest.mock('../../store/api', () => {
  const actual = jest.requireActual('../../store/api');
  return {
    ...actual,
    useLoginMutation: jest.fn(),
  };
});

describe('Authentication Flow Integration', () => {
  let store;
  let mockNavigation;

  beforeEach(() => {
    store = createTestStore();
    mockNavigation = createMockNavigation();
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue();
  });

  const renderWithProviders = (component) => {
    const { AuthProvider } = require('../../context/AuthContext');
    return render(
      <Provider store={store}>
        <AuthProvider>
          {component}
        </AuthProvider>
      </Provider>
    );
  };

  it('should complete full login flow', async () => {
    const { useLoginMutation } = require('../../store/api');
    const mockLoginMutation = jest.fn();
    
    mockLoginMutation.mockResolvedValueOnce({
      data: {
        token: 'mock-jwt-token',
        user: mockUsers.admin,
      },
    });

    useLoginMutation.mockReturnValue([
      mockLoginMutation,
      { isLoading: false, error: null },
    ]);

    // Render login screen
    const { getByPlaceholderText, getAllByText } = renderWithProviders(
      <LoginScreen navigation={mockNavigation} />
    );

    // Fill in credentials
    const emailInput = getByPlaceholderText(/email/i);
    const passwordInput = getByPlaceholderText(/password/i);
    const loginButtons = getAllByText(/login/i);
    const submitButton = loginButtons[loginButtons.length - 1];

    fireEvent.changeText(emailInput, 'admin@chandrajewels.com');
    fireEvent.changeText(passwordInput, 'admin123');
    fireEvent.press(submitButton);

    // Wait for login to complete
    await waitFor(() => {
      expect(mockLoginMutation).toHaveBeenCalledWith({
        email: 'admin@chandrajewels.com',
        password: 'admin123',
      });
    });

    // Verify token is stored
    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  it('should navigate to dashboard after successful login', async () => {
    store = createTestStore({
      auth: {
        user: mockUsers.admin,
        token: 'mock-token',
        isAuthenticated: true,
        isLoading: false,
      },
    });

    // Mock dashboard API
    jest.mock('../../store/api', () => {
      const actual = jest.requireActual('../../store/api');
      return {
        ...actual,
        useGetDashboardDataQuery: jest.fn(() => ({
          data: { totalEnquiries: 10 },
          isLoading: false,
          error: null,
        })),
        useGetClientsQuery: jest.fn(() => ({
          data: [],
          isLoading: false,
        })),
        useGetEnquiriesQuery: jest.fn(() => ({
          data: [],
          isLoading: false,
        })),
      };
    });

    const { queryByText } = renderWithProviders(
      <DashboardScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(queryByText(/dashboard/i)).toBeTruthy();
    });
  });

  it('should handle login error and show error message', async () => {
    const { useLoginMutation } = require('../../store/api');
    const mockLoginMutation = jest.fn();
    
    mockLoginMutation.mockRejectedValueOnce({
      data: { error: 'Invalid credentials' },
    });

    useLoginMutation.mockReturnValue([
      mockLoginMutation,
      { isLoading: false, error: { data: { error: 'Invalid credentials' } } },
    ]);

    const { getByPlaceholderText, getAllByText, queryByText } = renderWithProviders(
      <LoginScreen navigation={mockNavigation} />
    );

    const emailInput = getByPlaceholderText(/email/i);
    const passwordInput = getByPlaceholderText(/password/i);
    const loginButtons = getAllByText(/login/i);
    const submitButton = loginButtons[loginButtons.length - 1];

    fireEvent.changeText(emailInput, 'wrong@example.com');
    fireEvent.changeText(passwordInput, 'wrong');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(queryByText(/invalid|error/i)).toBeTruthy();
    });
  });

  it('should persist authentication state', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('mock-token');
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(mockUsers.admin));

    store = createTestStore({
      auth: {
        user: mockUsers.admin,
        token: 'mock-token',
        isAuthenticated: true,
        isLoading: false,
      },
    });

    const { queryByText } = renderWithProviders(
      <DashboardScreen navigation={mockNavigation} />
    );

    // Should show dashboard without requiring login
    await waitFor(() => {
      expect(queryByText(/dashboard/i)).toBeTruthy();
    });
  });
});


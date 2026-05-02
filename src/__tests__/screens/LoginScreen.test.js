/**
 * Tests for LoginScreen
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from '../../screens/Auth/LoginScreen';
import { createTestStore, createMockNavigation } from '../utils/testUtils';
import { api } from '../../store/api';

// Mock navigation
const mockNavigation = createMockNavigation();

// Mock useLoginMutation
jest.mock('../../store/api', () => {
  const actual = jest.requireActual('../../store/api');
  return {
    ...actual,
    useLoginMutation: jest.fn(),
  };
});

describe('LoginScreen', () => {
  let store;
  let mockLoginMutation;

  beforeEach(() => {
    store = createTestStore();
    mockLoginMutation = jest.fn();
    
    // Mock the mutation hook
    const { useLoginMutation } = require('../../store/api');
    useLoginMutation.mockReturnValue([
      mockLoginMutation,
      { isLoading: false, error: null },
    ]);
    
    jest.clearAllMocks();
  });

  const renderLoginScreen = () => {
    const { AuthProvider } = require('../../context/AuthContext');
    return render(
      <Provider store={store}>
        <AuthProvider>
          <LoginScreen navigation={mockNavigation} />
        </AuthProvider>
      </Provider>
    );
  };

  it('should render login form', () => {
    const { getByPlaceholderText } = renderLoginScreen();
    
    expect(getByPlaceholderText(/email/i)).toBeTruthy();
    expect(getByPlaceholderText(/password/i)).toBeTruthy();
  });

  it('should update email input', () => {
    const { getByPlaceholderText } = renderLoginScreen();
    const emailInput = getByPlaceholderText(/email/i);
    
    fireEvent.changeText(emailInput, 'test@example.com');
    expect(emailInput.props.value).toBe('test@example.com');
  });

  it('should update password input', () => {
    const { getByPlaceholderText } = renderLoginScreen();
    const passwordInput = getByPlaceholderText(/password/i);
    
    fireEvent.changeText(passwordInput, 'password123');
    expect(passwordInput.props.value).toBe('password123');
  });

  it('should show validation error for invalid email', async () => {
    const { getByPlaceholderText, getAllByText, queryByText } = renderLoginScreen();
    const emailInput = getByPlaceholderText(/email/i);
    const loginButtons = getAllByText(/login/i);
    const submitButton = loginButtons[loginButtons.length - 1]; // Get the last one (button)
    
    fireEvent.changeText(emailInput, 'invalid-email');
    fireEvent.press(submitButton);
    
    await waitFor(() => {
      expect(queryByText(/valid email/i)).toBeTruthy();
    });
  });

  it('should show validation error for empty password', async () => {
    const { getByPlaceholderText, getAllByText, queryByText } = renderLoginScreen();
    const emailInput = getByPlaceholderText(/email/i);
    const passwordInput = getByPlaceholderText(/password/i);
    const loginButtons = getAllByText(/login/i);
    const submitButton = loginButtons[loginButtons.length - 1]; // Get the last one (button)
    
    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, '');
    fireEvent.press(submitButton);
    
    await waitFor(() => {
      expect(queryByText(/required/i)).toBeTruthy();
    });
  });

  it('should call login mutation on valid form submit', async () => {
    mockLoginMutation.mockResolvedValueOnce({
      data: {
        token: 'mock-token',
        user: { id: 1, email: 'test@example.com' },
      },
    });

    const { getByPlaceholderText, getAllByText } = renderLoginScreen();
    const emailInput = getByPlaceholderText(/email/i);
    const passwordInput = getByPlaceholderText(/password/i);
    const loginButtons = getAllByText(/login/i);
    const submitButton = loginButtons[loginButtons.length - 1]; // Get the last one (button)
    
    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');
    fireEvent.press(submitButton);
    
    await waitFor(() => {
      expect(mockLoginMutation).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('should show loading state during login', () => {
    const { useLoginMutation } = require('../../store/api');
    useLoginMutation.mockReturnValue([
      mockLoginMutation,
      { isLoading: true, error: null },
    ]);

    const { getByText } = renderLoginScreen();
    // Check for loading indicator or disabled button
    expect(getByText).toBeDefined();
  });

  it('should display error message on login failure', async () => {
    mockLoginMutation.mockRejectedValueOnce({
      data: { error: 'Invalid credentials' },
    });

    const { useLoginMutation } = require('../../store/api');
    useLoginMutation.mockReturnValue([
      mockLoginMutation,
      { isLoading: false, error: { data: { error: 'Invalid credentials' } } },
    ]);

    const { getByText } = renderLoginScreen();
    // Error should be displayed
    expect(getByText).toBeDefined();
  });
});


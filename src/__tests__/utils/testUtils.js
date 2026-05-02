/**
 * Test utilities and helpers for testing React Native components
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { api } from '../../store/api';
import authReducer from '../../features/auth/authSlice';
import enquiriesReducer from '../../features/enquiries/enquiriesSlice';
import clientsReducer from '../../features/clients/clientsSlice';
import metalPricesReducer from '../../features/metalPrices/metalPricesSlice';
import usersReducer from '../../features/users/usersSlice';

/**
 * Create a test store with optional preloaded state
 * @param {object} preloadedState - Initial state for the store
 * @returns {object} Configured Redux store
 */
export const createTestStore = (preloadedState = {}) => {
  return configureStore({
    reducer: {
      api: api.reducer,
      auth: authReducer,
      enquiries: enquiriesReducer,
      clients: clientsReducer,
      metalPrices: metalPricesReducer,
      users: usersReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }).concat(api.middleware),
    preloadedState: {
      auth: {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      },
      ...preloadedState,
    },
  });
};

/**
 * Render a component with Redux Provider
 * @param {React.Component} component - Component to render
 * @param {object} options - Options including store, initial state, etc.
 * @returns {object} Render result with store
 */
export const renderWithProviders = (
  component,
  {
    preloadedState = {},
    store = createTestStore(preloadedState),
    ...renderOptions
  } = {}
) => {
  const Wrapper = ({ children }) => (
    <Provider store={store}>{children}</Provider>
  );

  return {
    store,
    ...render(component, { wrapper: Wrapper, ...renderOptions }),
  };
};

/**
 * Mock user data for testing
 */
export const mockUsers = {
  admin: {
    id: 1,
    email: 'admin@chandrajewels.com',
    name: 'Admin User',
    role: 'admin',
    roleId: 1,
  },
  client: {
    id: 2,
    email: 'john@example.com',
    name: 'John Doe',
    role: 'client',
    roleId: 4,
  },
  coral: {
    id: 3,
    email: 'coral@chandrajewels.com',
    name: 'Coral Designer',
    role: 'coral',
    roleId: 2,
  },
  cad: {
    id: 4,
    email: 'cad@chandrajewels.com',
    name: 'CAD Designer',
    role: 'cad',
    roleId: 3,
  },
};

/**
 * Mock enquiry data for testing
 */
export const mockEnquiry = {
  id: 1,
  enquiryNumber: 'ENQ-001',
  clientId: 2,
  clientName: 'John Doe',
  status: 'pending',
  priority: 'normal',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  description: 'Test enquiry description',
  metalType: 'Gold',
  weight: '10g',
};

/**
 * Mock API responses
 */
export const mockApiResponses = {
  login: {
    success: {
      token: 'mock-jwt-token',
      user: mockUsers.admin,
    },
    error: {
      error: 'Invalid credentials',
    },
  },
  enquiries: {
    list: [mockEnquiry],
    single: mockEnquiry,
  },
  roles: [
    { id: 1, code: 'AD', name: 'Admin' },
    { id: 2, code: 'CO', name: 'Coral Designer' },
    { id: 3, code: 'CD', name: 'CAD Designer' },
    { id: 4, code: 'CL', name: 'Client' },
  ],
};

/**
 * Wait for async operations to complete
 */
export const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Create a mock navigation object
 */
export const createMockNavigation = (overrides = {}) => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(),
  ...overrides,
});

/**
 * Create a mock route object
 */
export const createMockRoute = (params = {}) => ({
  params,
  name: 'MockScreen',
  key: 'mock-key',
});


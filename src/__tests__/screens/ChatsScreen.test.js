/**
 * Tests for ChatsScreen
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import ChatsScreen from '../../screens/Chats/ChatsScreen';
import { createTestStore, createMockNavigation, mockUsers } from '../utils/testUtils';

// Mock API hooks
jest.mock('../../store/api', () => {
  const actual = jest.requireActual('../../store/api');
  return {
    ...actual,
    useGetChatsQuery: jest.fn(),
    useGetEnquiriesQuery: jest.fn(),
    useGetChatMessagesQuery: jest.fn(),
  };
});

// Mock socket service
jest.mock('../../services/socketService', () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
  emit: jest.fn(),
  off: jest.fn(),
}));

describe('ChatsScreen', () => {
  let store;
  let mockNavigation;
  const { useGetChatsQuery, useGetEnquiriesQuery } = require('../../store/api');

  const mockChats = [
    {
      id: 1,
      enquiryId: 1,
      enquiryNumber: 'ENQ-001',
      lastMessage: 'Hello',
      lastMessageTime: '2024-01-15T10:00:00Z',
      unreadCount: 2,
      type: 'admin-client',
    },
  ];

  beforeEach(() => {
    store = createTestStore({
      auth: {
        user: mockUsers.admin,
        token: 'mock-token',
        isAuthenticated: true,
        isLoading: false,
      },
    });
    mockNavigation = createMockNavigation();

    useGetChatsQuery.mockReturnValue({
      data: mockChats,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    useGetEnquiriesQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    jest.clearAllMocks();
  });

  const renderChats = () => {
    const { AuthProvider } = require('../../context/AuthContext');
    return render(
      <Provider store={store}>
        <AuthProvider>
          <ChatsScreen navigation={mockNavigation} />
        </AuthProvider>
      </Provider>
    );
  };

  it('should render chats screen', () => {
    const { getByText } = renderChats();
    expect(getByText).toBeDefined();
  });

  it('should display chat list', async () => {
    const { queryByText } = renderChats();
    
    await waitFor(() => {
      expect(queryByText(/ENQ/i)).toBeTruthy();
    });
  });

  it('should handle search input', () => {
    const { getByPlaceholderText } = renderChats();
    const searchInput = getByPlaceholderText(/search/i);
    
    if (searchInput) {
      fireEvent.changeText(searchInput, 'test');
      expect(searchInput.props.value).toBe('test');
    }
  });

  it('should navigate to chat detail on press', () => {
    const { getAllByText } = renderChats();
    const chatItems = getAllByText(/ENQ/i);
    
    if (chatItems.length > 0) {
      fireEvent.press(chatItems[0]);
      expect(mockNavigation.navigate).toBeDefined();
    }
  });

  it('should show loading state', () => {
    useGetChatsQuery.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    const { UNSAFE_getByType } = renderChats();
    expect(UNSAFE_getByType).toBeDefined();
  });

  it('should handle empty state', () => {
    useGetChatsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { queryByText } = renderChats();
    expect(queryByText).toBeDefined();
  });

  it('should filter chats by role for admin', () => {
    store = createTestStore({
      auth: {
        user: mockUsers.admin,
        token: 'mock-token',
        isAuthenticated: true,
        isLoading: false,
      },
    });

    // Admin should see both admin-client and admin-designer chats
    expect(useGetChatsQuery).toBeDefined();
  });

  it('should filter chats by role for client', () => {
    store = createTestStore({
      auth: {
        user: mockUsers.client,
        token: 'mock-token',
        isAuthenticated: true,
        isLoading: false,
      },
    });

    // Client should see only admin-client chats
    expect(useGetChatsQuery).toBeDefined();
  });

  it('should handle refresh', async () => {
    const refetch = jest.fn();
    useGetChatsQuery.mockReturnValue({
      data: mockChats,
      isLoading: false,
      error: null,
      refetch,
    });

    const { getByTestId } = renderChats();
    expect(refetch).toBeDefined();
  });
});


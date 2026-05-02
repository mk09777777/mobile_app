/**
 * Tests for EnquiryListScreen
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import EnquiryListScreen from '../../screens/Enquiries/EnquiryListScreen';
import { createTestStore, createMockNavigation, mockUsers, mockEnquiry } from '../utils/testUtils';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue('test-token'),
}));

jest.mock('../../features/statuses/statusesHooks', () => ({
  useStatusOptions: () => [{ label: 'All', value: 'all' }],
}));

jest.mock('@react-native-firebase/messaging', () => () => ({
  onMessage: jest.fn(),
  requestPermission: jest.fn().mockResolvedValue(true),
  getToken: jest.fn().mockResolvedValue('push-token'),
}));

jest.mock('../../store/api', () => {
  const actual = jest.requireActual('../../store/api');
  return {
    ...actual,
    useGetClientsQuery: jest.fn(),
  };
});

const nodeTimers = require('timers');

jest.mock('../../components/cards/Cards', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');

  const MockCard = ({ children, onPress }) => (
    <TouchableOpacity onPress={onPress}>{children}</TouchableOpacity>
  );

  const CompactEnquiryCard = ({ enquiry, onPress }) => (
    <TouchableOpacity testID={`enquiry-${enquiry.id}`} onPress={onPress}>
      <Text>{enquiry.Name || enquiry.name || enquiry.title || 'Enquiry'}</Text>
    </TouchableOpacity>
  );

  return {
    EnquiryCard: MockCard,
    Card: MockCard,
    CompactEnquiryCard,
    CompactEnquiryCardMemo: CompactEnquiryCard,
  };
});

jest.mock('../../components/common/TopNavbar', () => 'TopNavbar');

if (!global.globalObj) {
  global.globalObj = global;
}
if (typeof global.globalObj.setTimeout !== 'function') {
  global.globalObj.setTimeout = nodeTimers.setTimeout;
  global.globalObj.clearTimeout = nodeTimers.clearTimeout;
}
if (typeof global.setTimeout !== 'function') {
  global.setTimeout = nodeTimers.setTimeout;
  global.clearTimeout = nodeTimers.clearTimeout;
}

describe('EnquiryListScreen', () => {
  let store;
  let mockNavigation;
  const { useGetClientsQuery } = require('../../store/api');
  const apiResponse = {
    data: [{ ...mockEnquiry, id: '1', Name: 'Sample Enquiry' }],
    total: 1,
    page: 1,
    limit: 10,
  };

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

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => apiResponse,
    });

    useGetClientsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = undefined;
  });

  const renderEnquiryList = () => {
    const { AuthProvider } = require('../../context/AuthContext');
    return render(
      <Provider store={store}>
        <AuthProvider>
          <EnquiryListScreen navigation={mockNavigation} />
        </AuthProvider>
      </Provider>
    );
  };

  it('fetches enquiries on mount and renders results', async () => {
    const { findByText } = renderEnquiryList();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    expect(await findByText('Sample Enquiry')).toBeTruthy();
  });

  it('updates search query and triggers another fetch', async () => {
    const { getByPlaceholderText } = renderEnquiryList();
    const searchInput = getByPlaceholderText(/search enquiries/i);

    fireEvent.changeText(searchInput, 'test query');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    expect(searchInput.props.value).toBe('test query');
  });

  it('navigates to enquiry detail on card press', async () => {
    const { findByTestId } = renderEnquiryList();
    const enquiryCard = await findByTestId('enquiry-1');

    fireEvent.press(enquiryCard);

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'SingleEnquiry',
      expect.objectContaining({
        enquiryId: '1',
      })
    );
  });
});

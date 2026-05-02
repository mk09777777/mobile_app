/**
 * Integration tests for enquiry management flow
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
    <TouchableOpacity testID={`integration-enquiry-${enquiry.id}`} onPress={onPress}>
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

describe('Enquiry Management Flow Integration', () => {
  let store;
  let navigation;
  const { useGetClientsQuery } = require('../../store/api');
  const apiResponse = {
    data: [{ ...mockEnquiry, id: '99', Name: 'Integration Enquiry' }],
    total: 1,
    page: 1,
    limit: 10,
  };

  const renderScreen = (customStore = store) => {
    const { AuthProvider } = require('../../context/AuthContext');
    return render(
      <Provider store={customStore}>
        <AuthProvider>
          <EnquiryListScreen navigation={navigation} />
        </AuthProvider>
      </Provider>
    );
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

    navigation = createMockNavigation();

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

  it('opens filter modal when filter button is pressed', async () => {
    const { getAllByText, findByText } = renderScreen();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    const filterButtons = getAllByText(/filter/i);
    fireEvent.press(filterButtons[0]);

    expect(await findByText(/apply filters/i)).toBeTruthy();
  });

  it('includes clientId in query params for client users', async () => {
    const clientStore = createTestStore({
      auth: {
        user: mockUsers.client,
        token: 'mock-token',
        isAuthenticated: true,
        isLoading: false,
      },
    });

    renderScreen(clientStore);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain(`clientId=${mockUsers.client.id}`);
  });

  it('includes assignedTo in query params for designer users', async () => {
    const designerStore = createTestStore({
      auth: {
        user: mockUsers.coral,
        token: 'mock-token',
        isAuthenticated: true,
        isLoading: false,
      },
    });

    renderScreen(designerStore);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain(`assignedTo=${mockUsers.coral.id}`);
  });
});

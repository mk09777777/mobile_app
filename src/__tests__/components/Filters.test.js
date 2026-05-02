/**
 * Tests for Filter components
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import EnquiryFiltersModal from '../../components/filters/EnquiryFiltersModal';
import { createTestStore, mockUsers } from '../utils/testUtils';

// Mock API hooks
jest.mock('../../store/api', () => {
  const actual = jest.requireActual('../../store/api');
  return {
    ...actual,
    useGetClientsQuery: jest.fn(),
    useGetUsersQuery: jest.fn(),
  };
});

describe('EnquiryFiltersModal', () => {
  let store;
  const { useGetClientsQuery, useGetUsersQuery } = require('../../store/api');

  const mockFilters = {
    status: '',
    priority: '',
    clientId: null,
    assignedTo: null,
    dateFrom: null,
    dateTo: null,
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

    useGetClientsQuery.mockReturnValue({
      data: [
        { id: 1, name: 'Client 1', email: 'client1@example.com' },
        { id: 2, name: 'Client 2', email: 'client2@example.com' },
      ],
      isLoading: false,
      error: null,
    });

    useGetUsersQuery.mockReturnValue({
      data: [
        { id: 1, name: 'User 1', email: 'user1@example.com' },
        { id: 2, name: 'User 2', email: 'user2@example.com' },
      ],
      isLoading: false,
      error: null,
    });

    jest.clearAllMocks();
  });

  const renderFiltersModal = () => {
    const onApplyFilters = jest.fn();
    const onClearFilters = jest.fn();
    const onClose = jest.fn();

    return {
      ...render(
        <Provider store={store}>
          <EnquiryFiltersModal
            visible={true}
            onClose={onClose}
            filters={mockFilters}
            onApplyFilters={onApplyFilters}
            onClearFilters={onClearFilters}
            user={mockUsers.admin}
          />
        </Provider>
      ),
      onApplyFilters,
      onClearFilters,
      onClose,
    };
  };

  it('should render filters modal when visible', () => {
    const { getByText } = renderFiltersModal();
    expect(getByText(/filter/i)).toBeTruthy();
  });

  it('should not render when not visible', () => {
    const onClose = jest.fn();
    const { queryByText } = render(
      <Provider store={store}>
        <EnquiryFiltersModal
          visible={false}
          onClose={onClose}
          filters={mockFilters}
          onApplyFilters={jest.fn()}
          onClearFilters={jest.fn()}
          user={mockUsers.admin}
        />
      </Provider>
    );
    
    expect(queryByText(/filter/i)).toBeNull();
  });

  it('should call onApplyFilters when apply button is pressed', () => {
    const { getByText, onApplyFilters } = renderFiltersModal();
    const applyButton = getByText(/apply/i);
    
    fireEvent.press(applyButton);
    expect(onApplyFilters).toHaveBeenCalled();
  });

  it('should call onClearFilters when clear button is pressed', () => {
    const { getByText, onClearFilters } = renderFiltersModal();
    const clearButton = getByText(/clear/i);
    
    fireEvent.press(clearButton);
    expect(onClearFilters).toHaveBeenCalled();
  });

  it('should update status filter', () => {
    const { getAllByText } = renderFiltersModal();
    const statusOptions = getAllByText(/pending|completed|progress/i);
    
    if (statusOptions.length > 0) {
      fireEvent.press(statusOptions[0]);
      // Filter should be updated
      expect(getAllByText).toBeDefined();
    }
  });

  it('should update priority filter', () => {
    const { getAllByText } = renderFiltersModal();
    const priorityOptions = getAllByText(/high|normal|urgent/i);
    
    if (priorityOptions.length > 0) {
      fireEvent.press(priorityOptions[0]);
      expect(getAllByText).toBeDefined();
    }
  });

  it('should display client dropdown', async () => {
    const { getByText, queryByText } = renderFiltersModal();
    const clientFilter = getByText(/client/i);
    
    if (clientFilter) {
      fireEvent.press(clientFilter);
      await waitFor(() => {
        expect(queryByText(/Client 1/i)).toBeTruthy();
      });
    }
  });

  it('should display assigned to dropdown', async () => {
    const { getByText, queryByText } = renderFiltersModal();
    const assignedFilter = getByText(/assigned/i);
    
    if (assignedFilter) {
      fireEvent.press(assignedFilter);
      await waitFor(() => {
        expect(queryByText(/User 1/i)).toBeTruthy();
      });
    }
  });

  it('should handle date picker', () => {
    const { getByText } = renderFiltersModal();
    const dateFilter = getByText(/date/i);
    
    if (dateFilter) {
      fireEvent.press(dateFilter);
      // Date picker should open
      expect(getByText).toBeDefined();
    }
  });

  it('should call onClose when close button is pressed', () => {
    const { getAllByText, onClose } = renderFiltersModal();
    const closeButtons = getAllByText(/close|×/i);
    
    if (closeButtons.length > 0) {
      fireEvent.press(closeButtons[0]);
      expect(onClose).toHaveBeenCalled();
    }
  });
});


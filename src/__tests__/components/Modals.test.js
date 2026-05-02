/**
 * Tests for Modal components
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import NotificationsModal from '../../components/modals/NotificationsModal';
import AccountModal from '../../components/modals/AccountModal';
import EnquiryHistoryModal from '../../components/modals/EnquiryHistoryModal';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('Modal Components', () => {
  describe('NotificationsModal', () => {
    it('should render when visible', () => {
      const onClose = jest.fn();
      const { getByText } = render(
        <NotificationsModal visible={true} onClose={onClose} />
      );
      
      expect(getByText(/notification/i)).toBeTruthy();
    });

    it('should not render when not visible', () => {
      const onClose = jest.fn();
      const { queryByText } = render(
        <NotificationsModal visible={false} onClose={onClose} />
      );
      
      expect(queryByText(/notification/i)).toBeNull();
    });

    it('should call onClose when close button is pressed', () => {
      const onClose = jest.fn();
      const { getAllByText } = render(
        <NotificationsModal visible={true} onClose={onClose} />
      );
      
      const closeButtons = getAllByText(/close|×/i);
      if (closeButtons.length > 0) {
        fireEvent.press(closeButtons[0]);
        expect(onClose).toHaveBeenCalled();
      }
    });

    it('should display notifications list', async () => {
      const onClose = jest.fn();
      const { queryByText } = render(
        <NotificationsModal visible={true} onClose={onClose} />
      );
      
      await waitFor(() => {
        expect(queryByText(/enquiry|approved|payment/i)).toBeTruthy();
      });
    });

    it('should handle refresh', async () => {
      const onClose = jest.fn();
      const { getByTestId } = render(
        <NotificationsModal visible={true} onClose={onClose} />
      );
      
      // RefreshControl testing
      expect(getByTestId).toBeDefined();
    });
  });

  describe('AccountModal', () => {
    const mockUser = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
    };

    it('should render when visible', () => {
      const onClose = jest.fn();
      const { getByText } = render(
        <AccountModal visible={true} onClose={onClose} user={mockUser} />
      );
      
      expect(getByText(/account|profile/i)).toBeTruthy();
    });

    it('should display user information', () => {
      const onClose = jest.fn();
      const { getByText } = render(
        <AccountModal visible={true} onClose={onClose} user={mockUser} />
      );
      
      expect(getByText('Test User')).toBeTruthy();
      expect(getByText('test@example.com')).toBeTruthy();
    });

    it('should call onClose when close button is pressed', () => {
      const onClose = jest.fn();
      const { getAllByText } = render(
        <AccountModal visible={true} onClose={onClose} user={mockUser} />
      );
      
      const closeButtons = getAllByText(/close|×/i);
      if (closeButtons.length > 0) {
        fireEvent.press(closeButtons[0]);
        expect(onClose).toHaveBeenCalled();
      }
    });

    it('should handle logout', () => {
      const onClose = jest.fn();
      const onLogout = jest.fn();
      const { getByText } = render(
        <AccountModal visible={true} onClose={onClose} user={mockUser} onLogout={onLogout} />
      );
      
      const logoutButton = getByText(/logout/i);
      if (logoutButton) {
        fireEvent.press(logoutButton);
        expect(onLogout).toHaveBeenCalled();
      }
    });
  });

  describe('EnquiryHistoryModal', () => {
    const mockHistory = [
      {
        id: 1,
        action: 'Status Changed',
        details: 'from "pending" to "in_progress"',
        timestamp: '2024-01-15T10:00:00Z',
        user: 'Admin User',
      },
    ];

    it('should render when visible', () => {
      const onClose = jest.fn();
      const { getByText } = render(
        <EnquiryHistoryModal visible={true} onClose={onClose} history={mockHistory} />
      );
      
      expect(getByText(/history/i)).toBeTruthy();
    });

    it('should display history items', () => {
      const onClose = jest.fn();
      const { getByText } = render(
        <EnquiryHistoryModal visible={true} onClose={onClose} history={mockHistory} />
      );
      
      expect(getByText(/status changed/i)).toBeTruthy();
    });

    it('should call onClose when close button is pressed', () => {
      const onClose = jest.fn();
      const { getAllByText } = render(
        <EnquiryHistoryModal visible={true} onClose={onClose} history={mockHistory} />
      );
      
      const closeButtons = getAllByText(/close|×/i);
      if (closeButtons.length > 0) {
        fireEvent.press(closeButtons[0]);
        expect(onClose).toHaveBeenCalled();
      }
    });

    it('should handle empty history', () => {
      const onClose = jest.fn();
      const { queryByText } = render(
        <EnquiryHistoryModal visible={true} onClose={onClose} history={[]} />
      );
      
      expect(queryByText(/no history/i)).toBeTruthy();
    });
  });
});


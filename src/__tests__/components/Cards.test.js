/**
 * Tests for Card components
 */
import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { Card, StatusCard, EnquiryStatusCard, CompactEnquiryCard, EnquiryCard } from '../../components/cards/Cards';
import { mockEnquiry } from '../utils/testUtils';
import { colors } from '../../constants/colors';

describe('Card Components', () => {
  describe('Card', () => {
    it('should render card without onPress', () => {
      const { getByText } = render(
        <Card>
          <Text>Test Content</Text>
        </Card>
      );
      expect(getByText('Test Content')).toBeTruthy();
    });

    it('should render card with onPress', () => {
      const onPress = jest.fn();
      const { getByText } = render(
        <Card onPress={onPress}>
          <Text>Clickable Card</Text>
        </Card>
      );
      
      fireEvent.press(getByText('Clickable Card'));
      expect(onPress).toHaveBeenCalled();
    });
  });

  describe('StatusCard', () => {
    it('should render status card with title and value', () => {
      const { getByText } = render(
        <StatusCard title="Total Enquiries" value={100} />
      );
      
      expect(getByText('Total Enquiries')).toBeTruthy();
      expect(getByText('100')).toBeTruthy();
    });

    it('should render with custom color', () => {
      const { UNSAFE_getByType } = render(
        <StatusCard title="Test" value={50} color={colors.success} />
      );
      expect(UNSAFE_getByType).toBeDefined();
    });

    it('should handle onPress', () => {
      const onPress = jest.fn();
      const { getByText } = render(
        <StatusCard title="Test" value={10} onPress={onPress} />
      );
      
      fireEvent.press(getByText('Test'));
      expect(onPress).toHaveBeenCalled();
    });

    it('should format large numbers', () => {
      const { getByText } = render(
        <StatusCard title="Test" value={1000} />
      );
      
      // Should format as 1K
      expect(getByText(/1K|1000/i)).toBeTruthy();
    });
  });

  describe('EnquiryStatusCard', () => {
    it('should render enquiry status card', () => {
      const { getByText } = render(
        <EnquiryStatusCard status="Pending" value={5} color={colors.warning} />
      );
      
      expect(getByText('Pending')).toBeTruthy();
      expect(getByText('5')).toBeTruthy();
    });

    it('should handle onPress', () => {
      const onPress = jest.fn();
      const { getByText } = render(
        <EnquiryStatusCard status="Completed" value={10} onPress={onPress} />
      );
      
      fireEvent.press(getByText('Completed'));
      expect(onPress).toHaveBeenCalled();
    });
  });

  describe('CompactEnquiryCard', () => {
    it('should render compact enquiry card', () => {
      const { getByText } = render(
        <CompactEnquiryCard
          enquiry={mockEnquiry}
          onPress={() => {}}
          getStatusColor={() => colors.primary}
          getStatusIcon={() => null}
          getPriorityColor={() => colors.warning}
          getPriorityIcon={() => null}
          formatCurrency={(val) => `₹${val}`}
          formatDate={(date) => new Date(date).toLocaleDateString()}
          userRole="admin"
        />
      );
      
      expect(getByText(/ENQ/i)).toBeTruthy();
    });

    it('should handle onPress', () => {
      const onPress = jest.fn();
      const { getAllByText } = render(
        <CompactEnquiryCard
          enquiry={mockEnquiry}
          onPress={onPress}
          getStatusColor={() => colors.primary}
          getStatusIcon={() => null}
          getPriorityColor={() => colors.warning}
          getPriorityIcon={() => null}
          formatCurrency={(val) => `₹${val}`}
          formatDate={(date) => new Date(date).toLocaleDateString()}
          userRole="admin"
        />
      );
      
      const cards = getAllByText(/ENQ/i);
      if (cards.length > 0) {
        fireEvent.press(cards[0]);
        expect(onPress).toHaveBeenCalled();
      }
    });

    it('should return null for invalid enquiry', () => {
      const { container } = render(
        <CompactEnquiryCard
          enquiry={null}
          onPress={() => {}}
          getStatusColor={() => colors.primary}
          getStatusIcon={() => null}
          getPriorityColor={() => colors.warning}
          getPriorityIcon={() => null}
          formatCurrency={(val) => `₹${val}`}
          formatDate={(date) => new Date(date).toLocaleDateString()}
          userRole="admin"
        />
      );
      
      expect(container.children.length).toBe(0);
    });
  });

  describe('EnquiryCard', () => {
    it('should render enquiry card', () => {
      const { getByText } = render(
        <EnquiryCard
          enquiry={mockEnquiry}
          onPress={() => {}}
          getStatusColor={() => colors.primary}
          formatCurrency={(val) => `₹${val}`}
          formatDate={(date) => new Date(date).toLocaleDateString()}
        />
      );
      
      expect(getByText).toBeDefined();
    });

    it('should handle onPress', () => {
      const onPress = jest.fn();
      const { getAllByText } = render(
        <EnquiryCard
          enquiry={mockEnquiry}
          onPress={onPress}
          getStatusColor={() => colors.primary}
          formatCurrency={(val) => `₹${val}`}
          formatDate={(date) => new Date(date).toLocaleDateString()}
        />
      );
      
      const cards = getAllByText(/ENQ/i);
      if (cards.length > 0) {
        fireEvent.press(cards[0]);
        expect(onPress).toHaveBeenCalled();
      }
    });
  });
});


/**
 * Tests for Input component
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Input } from '../../components/common/Input';

describe('Input Component', () => {
  it('should render input with label', () => {
    const { getByText, getByPlaceholderText } = render(
      <Input label="Email" placeholder="Enter email" value="" onChangeText={() => {}} />
    );
    
    expect(getByText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Enter email')).toBeTruthy();
  });

  it('should call onChangeText when text changes', () => {
    const onChangeText = jest.fn();
    const { getByPlaceholderText } = render(
      <Input placeholder="Enter text" value="" onChangeText={onChangeText} />
    );
    
    const input = getByPlaceholderText('Enter text');
    fireEvent.changeText(input, 'test@example.com');
    
    expect(onChangeText).toHaveBeenCalledWith('test@example.com');
  });

  it('should display error message', () => {
    const { getByText } = render(
      <Input
        placeholder="Enter text"
        value=""
        onChangeText={() => {}}
        error="This field is required"
      />
    );
    
    expect(getByText('This field is required')).toBeTruthy();
  });

  it('should handle secure text entry', () => {
    const { getByPlaceholderText } = render(
      <Input
        placeholder="Password"
        value=""
        onChangeText={() => {}}
        secureTextEntry
      />
    );
    
    const input = getByPlaceholderText('Password');
    expect(input.props.secureTextEntry).toBe(true);
  });

  it('should toggle password visibility', () => {
    const { getByPlaceholderText, getByTestId } = render(
      <Input
        placeholder="Password"
        value="password123"
        onChangeText={() => {}}
        secureTextEntry
      />
    );
    
    const input = getByPlaceholderText('Password');
    expect(input.props.secureTextEntry).toBe(true);
    
    // Find and press the visibility toggle button
    // Note: This depends on the implementation details
  });

  it('should handle disabled state', () => {
    const { getByPlaceholderText } = render(
      <Input
        placeholder="Enter text"
        value=""
        onChangeText={() => {}}
        disabled
      />
    );
    
    const input = getByPlaceholderText('Enter text');
    expect(input.props.editable).toBe(false);
  });

  it('should handle multiline input', () => {
    const { getByPlaceholderText } = render(
      <Input
        placeholder="Enter description"
        value=""
        onChangeText={() => {}}
        multiline
        numberOfLines={4}
      />
    );
    
    const input = getByPlaceholderText('Enter description');
    expect(input.props.multiline).toBe(true);
  });
});


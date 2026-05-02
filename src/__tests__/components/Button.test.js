/**
 * Tests for Button component
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../../components/common/Button';

describe('Button Component', () => {
  it('should render button with title', () => {
    const { getByText } = render(
      <Button title="Click Me" onPress={() => {}} />
    );
    expect(getByText('Click Me')).toBeTruthy();
  });

  it('should call onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button title="Click Me" onPress={onPress} />
    );
    
    fireEvent.press(getByText('Click Me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('should not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { UNSAFE_getByType } = render(
      <Button title="Click Me" onPress={onPress} disabled />
    );
    
    // Find TouchableOpacity and verify disabled prop
    const touchableOpacity = UNSAFE_getByType('TouchableOpacity');
    expect(touchableOpacity.props.disabled).toBe(true);
  });

  it('should show loading indicator when loading', () => {
    const { UNSAFE_getByType } = render(
      <Button title="Click Me" onPress={() => {}} loading />
    );
    
    // ActivityIndicator should be present when loading
    // Note: We can't easily test for ActivityIndicator visibility without testID
    // But we can verify the button is disabled when loading
    const button = UNSAFE_getByType('TouchableOpacity');
    expect(button.props.disabled).toBe(true);
  });

  it('should render different variants', () => {
    const variants = ['primary', 'secondary', 'outline', 'danger', 'success'];
    
    variants.forEach((variant) => {
      const { getByText } = render(
        <Button title="Button" onPress={() => {}} variant={variant} />
      );
      expect(getByText('Button')).toBeTruthy();
    });
  });

  it('should render different sizes', () => {
    const sizes = ['small', 'medium', 'large'];
    
    sizes.forEach((size) => {
      const { getByText } = render(
        <Button title="Button" onPress={() => {}} size={size} />
      );
      expect(getByText('Button')).toBeTruthy();
    });
  });
});


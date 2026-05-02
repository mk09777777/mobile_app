/**
 * @format
 * Basic App component test
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { createTestStore } from '../src/__tests__/utils/testUtils';
import App from '../App';

// Mock the splash screen to finish immediately
jest.mock('../src/screens/VideoSplashScreen', () => {
  const React = require('react');
  return ({ onAnimationFinish }) => {
    React.useEffect(() => {
      onAnimationFinish();
    }, []);
    return null;
  };
});

// Mock AnimatedLogoLoader to avoid animation loops
jest.mock('../src/components/common', () => ({
  AnimatedLogoLoader: () => null,
}));

test('App renders without crashing', () => {
  const store = createTestStore();
  
  const result = render(
    <Provider store={store}>
      <App />
    </Provider>
  );
  
  // Check that render completed successfully
  expect(result).toBeDefined();
  expect(result.UNSAFE_root || result.root || result).toBeTruthy();
});

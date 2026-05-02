/**
 * Sentry Test Utilities
 * Use these functions to test Sentry error tracking and crash reporting
 */

import * as Sentry from '@sentry/react-native';

/**
 * Test 1: Capture a simple error message
 */
export const testSimpleError = () => {
  try {
    Sentry.captureMessage('Test Error: This is a test error message from Sentry', 'error');
  } catch (error) {
  }
};

/**
 * Test 2: Capture an exception with stack trace
 */
export const testException = () => {
  try {
    throw new Error('Test Exception: This is a test exception for Sentry');
  } catch (error) {
    Sentry.captureException(error);
  }
};

/**
 * Test 3: Capture a crash (unhandled error)
 */
export const testCrash = () => {
  // This will cause an unhandled error that Sentry will capture
  setTimeout(() => {
    throw new Error('Test Crash: This simulates an app crash');
  }, 100);
};

/**
 * Test 4: Capture error with context and tags
 */
export const testErrorWithContext = () => {
  Sentry.withScope((scope) => {
    scope.setTag('test-type', 'manual-test');
    scope.setLevel('error');
    scope.setContext('test-info', {
      testName: 'Manual Sentry Test',
      timestamp: new Date().toISOString(),
      user: 'Test User',
    });
    Sentry.captureException(new Error('Test Error with Context and Tags'));
  });
};

/**
 * Test 5: Capture a warning
 */
export const testWarning = () => {
  Sentry.captureMessage('Test Warning: This is a warning level message', 'warning');
};

/**
 * Test 6: Capture an info message
 */
export const testInfo = () => {
  Sentry.captureMessage('Test Info: This is an info level message', 'info');
};

/**
 * Test 7: Simulate a network error
 */
export const testNetworkError = () => {
  const networkError = new Error('Network request failed');
  networkError.name = 'NetworkError';
  networkError.statusCode = 500;
  
  Sentry.withScope((scope) => {
    scope.setTag('error-type', 'network');
    scope.setContext('network', {
      url: 'https://api.example.com/test',
      method: 'GET',
      statusCode: 500,
    });
    Sentry.captureException(networkError);
  });
};

/**
 * Test 8: Capture error with breadcrumbs
 */
export const testErrorWithBreadcrumbs = () => {
  // Add breadcrumbs before the error
  Sentry.addBreadcrumb({
    message: 'User clicked test button',
    level: 'info',
    category: 'user-action',
  });
  
  Sentry.addBreadcrumb({
    message: 'Preparing to test error',
    level: 'debug',
    category: 'test',
  });
  
  // Now capture the error
  Sentry.captureException(new Error('Test Error with Breadcrumbs'));
};

/**
 * Test 9: Set user context and capture error
 */
export const testErrorWithUser = () => {
  Sentry.setUser({
    id: 'test-user-123',
    username: 'testuser',
    email: 'test@example.com',
  });
  
  Sentry.captureException(new Error('Test Error with User Context'));
  
  // Clear user after test
  setTimeout(() => {
    Sentry.setUser(null);
  }, 1000);
};

/**
 * Test 10: Performance monitoring test
 */
export const testPerformance = () => {
  const transaction = Sentry.startTransaction({
    name: 'Test Transaction',
    op: 'test',
  });
  
  // Simulate some work
  setTimeout(() => {
    transaction.finish();
  }, 500);
};


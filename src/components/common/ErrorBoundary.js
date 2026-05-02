/**
 * Error Boundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the app.
 * 
 * This is a class component because React Error Boundaries must be class components.
 * 
 * Usage:
 * <ErrorBoundary>
 *   <YourApp />
 * </ErrorBoundary>
 */

import React from 'react';
import ErrorScreen from './ErrorScreen';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    if (__DEV__) {
      console.error('🚨 Error Boundary caught an error:');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
      console.log('✅ Error Boundary is working! Dismiss the red screen to see Error Boundary UI.');
    }

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // You can also log the error to an error reporting service here
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleReset = () => {
    // Reset error state to allow retry
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoBack = () => {
    // Try to navigate back if navigation is available
    try {
      const { navigation } = this.props;
      if (navigation && navigation.goBack) {
        navigation.goBack();
        this.handleReset();
      } else {
        // If navigation not available, just reset
        this.handleReset();
      }
    } catch (err) {
      // If navigation fails, just reset
      this.handleReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // Render custom error UI
      return (
        <ErrorScreen
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleReset}
          onGoBack={this.handleGoBack}
        />
      );
    }

    // Normal render - return children unchanged
    return this.props.children;
  }
}

export default ErrorBoundary;


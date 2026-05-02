/**
 * Branded Alert Utility
 * 
 * This is a drop-in replacement for Alert.alert() that uses branded alerts
 * 
 * Usage:
 *   import { showAlert } from '../utils/alert';
 *   
 *   // Simple alert (replaces Alert.alert('Title', 'Message'))
 *   showAlert('Title', 'Message');
 *   
 *   // With buttons (replaces Alert.alert('Title', 'Message', buttons))
 *   showAlert('Title', 'Message', [
 *     { text: 'Cancel', style: 'cancel' },
 *     { text: 'OK', onPress: () => {} }
 *   ]);
 *   
 *   // Type-specific methods
 *   import { showSuccess, showError, showWarning, showInfo } from '../utils/alert';
 *   showSuccess('Success!', 'Operation completed');
 *   showError('Error', 'Something went wrong');
 */

import alertService from '../services/alertService';

// This will be initialized by AlertProvider
let alertContext = null;

export const initAlert = (context) => {
  alertContext = context;
};

/**
 * Show a branded alert
 * Compatible with Alert.alert() API
 */
export const showAlert = (title, message, buttons, type = 'info') => {
  if (alertContext) {
    alertContext.show(type, title, message, buttons);
  } else {
    // Fallback to console if not initialized
    console.warn(`[${type.toUpperCase()}] ${title}: ${message}`);
  }
};

/**
 * Show success alert
 */
export const showSuccess = (title, message, buttons) => {
  showAlert(title, message, buttons, 'success');
};

/**
 * Show error alert
 */
export const showError = (title, message, buttons) => {
  showAlert(title, message, buttons, 'error');
};

/**
 * Show warning alert
 */
export const showWarning = (title, message, buttons) => {
  showAlert(title, message, buttons, 'warning');
};

/**
 * Show info alert
 */
export const showInfo = (title, message, buttons) => {
  showAlert(title, message, buttons, 'info');
};

export default {
  show: showAlert,
  success: showSuccess,
  error: showError,
  warning: showWarning,
  info: showInfo,
};







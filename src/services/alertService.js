import React from 'react';
import { AppRegistry } from 'react-native';
import BrandedAlert from '../components/common/Alert';

/**
 * Branded Alert Service
 * Provides a centralized way to show branded alerts throughout the app
 */

class AlertService {
  constructor() {
    this.alertComponent = null;
    this.setAlertComponent = null;
  }

  /**
   * Initialize the alert service with a state setter
   * Call this in your root App component
   */
  init(setAlertState) {
    this.setAlertState = setAlertState;
  }

  /**
   * Show a success alert
   */
  success(title, message, buttons) {
    this.show('success', title, message, buttons);
  }

  /**
   * Show an error alert
   */
  error(title, message, buttons) {
    this.show('error', title, message, buttons);
  }

  /**
   * Show a warning alert
   */
  warning(title, message, buttons) {
    this.show('warning', title, message, buttons);
  }

  /**
   * Show an info alert
   */
  info(title, message, buttons) {
    this.show('info', title, message, buttons);
  }

  /**
   * Show a custom alert
   * @param {string} type - 'success', 'error', 'warning', 'info'
   * @param {string} title - Alert title
   * @param {string} message - Alert message
   * @param {array} buttons - Array of button objects: [{ text: 'OK', onPress: () => {}, style: 'default' }]
   */
  show(type, title, message, buttons) {
    if (this.setAlertState) {
      this.setAlertState({
        visible: true,
        type: type || 'info',
        title: title || '',
        message: message || '',
        buttons: buttons || [],
      });
    } else {
      // Fallback to console if service not initialized
      console.warn('AlertService not initialized. Call AlertService.init() in your App component.');
      console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
    }
  }

  /**
   * Hide the current alert
   */
  hide() {
    if (this.setAlertState) {
      this.setAlertState({
        visible: false,
        type: 'info',
        title: '',
        message: '',
        buttons: [],
      });
    }
  }
}

// Export singleton instance
export default new AlertService();







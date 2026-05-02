import { useState, useCallback } from 'react';
import BrandedAlert from '../components/common/Alert';

/**
 * Custom hook for showing branded alerts
 * 
 * @returns {object} { showAlert, AlertComponent }
 * 
 * @example
 * const { showAlert, AlertComponent } = useAlert();
 * 
 * // Show success alert
 * showAlert.success('Success!', 'Operation completed successfully');
 * 
 * // Show error alert
 * showAlert.error('Error', 'Something went wrong');
 * 
 * // Show with custom buttons
 * showAlert('error', 'Delete?', 'Are you sure?', [
 *   { text: 'Cancel', style: 'cancel', onPress: () => {} },
 *   { text: 'Delete', style: 'destructive', onPress: () => {} }
 * ]);
 * 
 * // In JSX
 * return (
 *   <View>
 *     {AlertComponent}
 *   </View>
 * );
 */
export const useAlert = () => {
  const [alertState, setAlertState] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    buttons: [],
  });

  const showAlert = useCallback((type, title, message, buttons) => {
    setAlertState({
      visible: true,
      type: type || 'info',
      title: title || '',
      message: message || '',
      buttons: buttons || [],
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertState(prev => ({ ...prev, visible: false }));
  }, []);

  // Convenience methods
  const alert = {
    show: showAlert,
    hide: hideAlert,
    success: (title, message, buttons) => showAlert('success', title, message, buttons),
    error: (title, message, buttons) => showAlert('error', title, message, buttons),
    warning: (title, message, buttons) => showAlert('warning', title, message, buttons),
    info: (title, message, buttons) => showAlert('info', title, message, buttons),
  };

  const AlertComponent = (
    <BrandedAlert
      visible={alertState.visible}
      type={alertState.type}
      title={alertState.title}
      message={alertState.message}
      buttons={alertState.buttons}
      onClose={hideAlert}
    />
  );

  return { showAlert: alert, AlertComponent };
};

export default useAlert;







import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import BrandedAlert from '../components/common/Alert';
import { initAlert } from '../utils/alert';

const AlertContext = createContext(null);

export const AlertProvider = ({ children }) => {
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

  // Initialize the utility function
  useEffect(() => {
    initAlert(alert);
  }, []);

  return (
    <AlertContext.Provider value={alert}>
      {children}
      <BrandedAlert
        visible={alertState.visible}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onClose={hideAlert}
      />
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return context;
};

export default AlertContext;


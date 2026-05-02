import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import socketService from '../../services/socketService';

/**
 * SocketConnectionManager
 * Manages socket connection lifecycle based on app state
 * - Reconnects when app comes to foreground
 * - Handles background/foreground transitions
 */
const SocketConnectionManager = () => {
  const { user, isAuthenticated } = useAuth();
  const appState = useRef(AppState.currentState);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      // Disconnect if user logs out
      if (socketService.isConnected()) {
        socketService.disconnect();
      }
      return;
    }

    // Initial connection when user is authenticated
    const connectSocket = async () => {
      if (!socketService.isConnected() && !socketService.isConnecting) {
        try {
          console.log('🔌 [SocketConnectionManager] Connecting socket on app start/foreground');
          await socketService.connect(user.id);
        } catch (error) {
          console.error('❌ [SocketConnectionManager] Failed to connect socket:', error);
        }
      }
    };

    // Connect on mount
    connectSocket();

    // Handle AppState changes
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousAppState = appState.current;
      appState.current = nextAppState;

      console.log('📱 [SocketConnectionManager] AppState changed:', {
        previous: previousAppState,
        current: nextAppState,
        isConnected: socketService.isConnected(),
      });

      // App came to foreground
      if (
        previousAppState.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('📱 [SocketConnectionManager] App came to foreground - reconnecting socket');
        
        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        // Reconnect after a short delay to ensure app is fully active
        reconnectTimeoutRef.current = setTimeout(async () => {
          const isCurrentlyConnected = socketService.isConnected();
          console.log('🔍 [SocketConnectionManager] Checking socket status before reconnect:', {
            isConnected: isCurrentlyConnected,
            userId: user?.id,
          });

          if (user?.id) {
            try {
              // Force reconnect to ensure fresh connection
              console.log('🔌 [SocketConnectionManager] Force reconnecting socket...');
              await socketService.connect(user.id, true); // forceReconnect = true
              
              // Wait a bit and verify connection
              await new Promise(resolve => setTimeout(resolve, 1000));
              const isNowConnected = socketService.isConnected();
              
              if (isNowConnected) {
                console.log('✅ [SocketConnectionManager] Socket reconnected successfully');
              } else {
                console.warn('⚠️ [SocketConnectionManager] Socket reconnect attempted but not connected yet');
              }
            } catch (error) {
              console.error('❌ [SocketConnectionManager] Failed to reconnect socket:', error);
            }
          }
        }, 500); // Small delay to ensure app is ready
      }

      // App went to background
      if (previousAppState === 'active' && nextAppState.match(/inactive|background/)) {
        console.log('📱 [SocketConnectionManager] App went to background');
        // Note: We don't disconnect here because:
        // 1. Socket.io has built-in reconnection
        // 2. OS may close the connection anyway
        // 3. FCM push notifications handle background notifications
        // The socket will automatically reconnect when app comes to foreground
      }
    });

    return () => {
      subscription?.remove();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [isAuthenticated, user?.id]);

  return null;
};

export default SocketConnectionManager;


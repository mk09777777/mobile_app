import { Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key for persisting notification state
const NOTIFICATION_STATE_KEY = '@chat_notifications_state';

// Store active chat notifications by chatId
// Format: { [chatId]: { notificationId, count, lastMessage, lastTimestamp } }
let activeChatNotifications = {};

// Lock to prevent race conditions when multiple messages arrive simultaneously
let isProcessing = false;
const processingQueue = [];

// Load notification state from persistent storage
const loadNotificationState = async () => {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_STATE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      activeChatNotifications = parsed || {};
      console.log('[Chat Notification] ✅ Loaded notification state from storage:', Object.keys(activeChatNotifications).length, 'chats');
    } else {
      activeChatNotifications = {};
      console.log('[Chat Notification] No stored state found, starting fresh');
    }
  } catch (error) {
    console.error('[Chat Notification] ❌ Error loading notification state:', error);
    activeChatNotifications = {};
  }
};

// Save notification state to persistent storage
const saveNotificationState = async () => {
  try {
    await AsyncStorage.setItem(NOTIFICATION_STATE_KEY, JSON.stringify(activeChatNotifications));
  } catch (error) {
    console.error('[Chat Notification] Error saving notification state:', error);
  }
};

// Initialize: Load state on module load (for killed state)
loadNotificationState();

/**
 * Group chat notifications by chatId
 * Updates existing notification instead of creating multiple notifications
 * 
 * @param {string} title - Notification title (usually sender name)
 * @param {string} body - Message body
 * @param {Object} data - Notification data (must include chatId)
 * @returns {Promise<string>} Notification ID
 */
export const displayGroupedChatNotification = async (title, body, data = {}) => {
  // Wait if another notification is being processed (prevent race conditions)
  while (isProcessing) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  isProcessing = true;
  
  try {
    // CRITICAL: Always load state first (especially important for killed state)
    await loadNotificationState();
    
    const chatId = data.chatId || data.ChatId || data.chat_id;
    const senderName = data.senderName || data.SenderName || title || 'Someone';
    
    console.log('[Chat Notification] ========================================');
    console.log('[Chat Notification] Processing notification:', {
      chatId,
      senderName,
      hasExistingState: !!activeChatNotifications[chatId],
      currentCount: activeChatNotifications[chatId]?.count || 0,
      fullData: JSON.stringify(data),
    });
    console.log('[Chat Notification] ========================================');
    
    if (!chatId) {
      // If no chatId, this shouldn't happen for chat notifications
      // But if it does, log and skip (don't create empty notification)
      console.error('[Chat Notification] ❌ ERROR: No chatId found for chat notification!');
      console.error('[Chat Notification] Data received:', JSON.stringify(data));
      console.error('[Chat Notification] Title:', title, 'Body:', body);
      // Don't create a notification without chatId - this causes empty notifications
      throw new Error('Chat notification missing chatId');
    }

    // Use consistent notification ID based on chatId (not timestamp)
    // This ensures notifications group even when app is killed
    const consistentNotificationId = `chat_${chatId}`;
    
    // Only do cleanup if we have valid content (title or body)
    if (!title && !body) {
      console.warn('[Chat Notification] ⚠️ No title or body - skipping notification creation');
      isProcessing = false;
      return null;
    }
    
    // ULTRA AGGRESSIVE CLEANUP: Cancel ALL notifications for this chatId BEFORE doing anything
    // This is critical to prevent individual notifications from appearing
    try {
      const allDisplayedNotifications = await notifee.getDisplayedNotifications();
      console.log(`[Chat Notification] 🔍 Checking ${allDisplayedNotifications.length} displayed notifications for cleanup`);
      
      const notificationsForThisChat = allDisplayedNotifications.filter(notif => {
        // Check by chatId in data
        const notifChatId = notif?.notification?.data?.chatId || 
                           notif?.notification?.data?.ChatId || 
                           notif?.notification?.data?.chat_id;
        // Also check by notification ID pattern (chat_*)
        const isChatNotification = notif.id?.startsWith('chat_');
        const matchesChatId = notifChatId === chatId;
        
        if (matchesChatId || (isChatNotification && notif.id === consistentNotificationId)) {
          console.log(`[Chat Notification] Found notification to cancel: ID=${notif.id}, chatId=${notifChatId}`);
          return true;
        }
        return false;
      });
      
      if (notificationsForThisChat.length > 0) {
        console.log(`[Chat Notification] 🧹 ULTRA AGGRESSIVE CLEANUP: Found ${notificationsForThisChat.length} notifications for chat ${chatId}, canceling ALL...`);
        for (const notif of notificationsForThisChat) {
          try {
            await notifee.cancelNotification(notif.id);
            console.log(`[Chat Notification] ✅ Canceled notification: ${notif.id}`);
          } catch (cancelError) {
            console.error('[Chat Notification] Error canceling notification:', cancelError);
          }
        }
        // Longer delay to ensure cancellations are fully processed by Android
        await new Promise(resolve => setTimeout(resolve, 200));
      } else {
        console.log(`[Chat Notification] ✅ No existing notifications found for chat ${chatId}`);
      }
    } catch (cleanupError) {
      console.error('[Chat Notification] ❌ Error in ultra aggressive cleanup:', cleanupError);
    }
    
    // ALWAYS check system notifications first (critical for killed state)
    // When app is killed, memory state is lost, but system notifications persist
    let existingNotification = null;
    let notificationId = consistentNotificationId;
    
    try {
      console.log('[Chat Notification] 🔍 Checking system notifications for chat:', chatId, 'ID:', consistentNotificationId);
      
      // Retry mechanism: Check system notifications up to 5 times with increasing delays
      // This handles cases where messages arrive very quickly and previous notification
      // hasn't been displayed yet
      let systemNotification = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        if (attempt > 0) {
          // Wait a bit before retrying (give previous notification time to appear)
          // Increasing delay: 300ms, 600ms, 900ms, 1200ms
          await new Promise(resolve => setTimeout(resolve, 300 * attempt));
        }
        
        const displayedNotifications = await notifee.getDisplayedNotifications();
        console.log(`[Chat Notification] Attempt ${attempt + 1}: Found ${displayedNotifications.length} displayed notifications in system`);
        
        // Find notification for this chat by ID or by checking data.chatId
        systemNotification = displayedNotifications.find(notif => {
          // Check by notification ID (consistent ID) - this is the most reliable
          if (notif.id === consistentNotificationId) {
            console.log('[Chat Notification] ✅ Found notification by consistent ID:', consistentNotificationId);
            return true;
          }
          // Check by chatId in data (fallback)
          const notifChatId = notif?.notification?.data?.chatId || 
                             notif?.notification?.data?.ChatId || 
                             notif?.notification?.data?.chat_id;
          if (notifChatId === chatId) {
            console.log('[Chat Notification] ✅ Found notification by chatId in data');
            return true;
          }
          return false;
        });
        
        if (systemNotification) {
          break; // Found it, stop retrying
        }
      }
      
      if (systemNotification) {
        // Recover state from system notification
        // IMPORTANT: Use consistent ID, not the system notification's ID
        // This ensures we can update the same notification even if IDs differ
        notificationId = consistentNotificationId;
        
        // Try to extract count from title if available
        const notificationTitle = systemNotification.notification?.title || '';
        const titleMatch = notificationTitle.match(/\((\d+) new messages?\)/);
        const count = titleMatch ? parseInt(titleMatch[1], 10) : 1;
        
        // If system notification has different ID, cancel it first
        if (systemNotification.id !== consistentNotificationId) {
          console.log('[Chat Notification] ⚠️ System notification has different ID, canceling old one:', {
            oldId: systemNotification.id,
            newId: consistentNotificationId,
          });
          try {
            await notifee.cancelNotification(systemNotification.id);
          } catch (cancelError) {
            console.error('[Chat Notification] Error canceling old notification:', cancelError);
          }
        }
        
        existingNotification = {
          notificationId: consistentNotificationId, // Always use consistent ID
          count,
          lastMessage: systemNotification.notification?.body || body,
          lastTimestamp: Date.now(),
        };
        
        // Restore to memory and storage
        activeChatNotifications[chatId] = existingNotification;
        await saveNotificationState();
        
        console.log(`[Chat Notification] ✅ Recovered notification state from system:`, {
          chatId,
          notificationId: consistentNotificationId,
          count,
          title: notificationTitle,
        });
      } else {
        // Check memory state as fallback
        existingNotification = activeChatNotifications[chatId];
        if (existingNotification) {
          console.log('[Chat Notification] ✅ Found notification in memory state');
        } else {
          console.log('[Chat Notification] ℹ️ No existing notification found (will create new)');
        }
      }
    } catch (error) {
      console.error('[Chat Notification] ❌ Error checking system notifications:', error);
      // Fallback to memory state
      existingNotification = activeChatNotifications[chatId];
    }
    
    if (existingNotification) {
      // Update existing notification with new message count
      const newCount = existingNotification.count + 1;
      const notificationId = existingNotification.notificationId;
      
      // Create grouped notification title
      const groupedTitle = newCount === 1 
        ? senderName 
        : `${senderName} (${newCount} new messages)`;
      
      // Create grouped body - show latest message
      const groupedBody = newCount === 1
        ? body
        : `${body}\n${newCount - 1} more message${newCount - 1 > 1 ? 's' : ''}`;
      
      // CRITICAL: Cancel ALL other notifications for this chat before updating
      // This prevents individual notifications from appearing alongside the grouped one
      try {
        const displayedNotifications = await notifee.getDisplayedNotifications();
        const notificationsToCancel = displayedNotifications.filter(notif => {
          // Find ALL notifications for this chat (except the one we're about to update)
          const notifChatId = notif?.notification?.data?.chatId || 
                             notif?.notification?.data?.ChatId || 
                             notif?.notification?.data?.chat_id;
          const isSameChat = notifChatId === chatId;
          const isNotOurNotification = notif.id !== notificationId;
          return isSameChat && isNotOurNotification;
        });
        
        if (notificationsToCancel.length > 0) {
          console.log(`[Chat Notification] 🧹 Canceling ${notificationsToCancel.length} duplicate/individual notifications for chat ${chatId} before update`);
          for (const notif of notificationsToCancel) {
            try {
              await notifee.cancelNotification(notif.id);
              console.log(`[Chat Notification] ✅ Canceled duplicate notification: ${notif.id}`);
            } catch (cancelError) {
              console.error('[Chat Notification] Error canceling duplicate:', cancelError);
            }
          }
          // Small delay to ensure cancellations are processed
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (cancelError) {
        console.error('[Chat Notification] Error checking for duplicates before update:', cancelError);
      }
      
      // IMMEDIATE cleanup after update
      try {
        await cleanupDuplicateNotifications(chatId);
      } catch (cleanupErr) {
        console.error('[Chat Notification] Error in immediate cleanup after update:', cleanupErr);
      }
      
      // Update the existing notification
      await notifee.displayNotification({
        id: notificationId, // Same ID to update instead of create
        title: groupedTitle,
        body: groupedBody,
        data: data,
        android: {
          channelId: 'default',
          importance: AndroidImportance.HIGH,
          pressAction: { id: 'default' },
          sound: 'default',
          smallIcon: 'ic_launcher',
          largeIcon: 'ic_launcher',
          color: '#FF6B35',
          groupId: `chat_${chatId}`, // Group notifications by chat
          groupSummary: false,
          timestamp: Date.now(),
          showTimestamp: true,
          // Show message count in notification
          style: {
            type: 1, // BIGTEXT style
            text: groupedBody,
          },
        },
        ios: {
          sound: 'default',
          badge: true,
          threadId: `chat_${chatId}`, // iOS threading
        },
      });
      
      // Update stored notification info
      activeChatNotifications[chatId] = {
        notificationId,
        count: newCount,
        lastMessage: body,
        lastTimestamp: Date.now(),
      };
      
      // Save to persistent storage
      await saveNotificationState();
      
      // IMMEDIATE cleanup: Cancel any duplicates right away
      try {
        await cleanupDuplicateNotifications(chatId);
      } catch (cleanupErr) {
        console.error('[Chat Notification] Error in immediate cleanup after update:', cleanupErr);
      }
      
      // Schedule multiple delayed cleanups to catch any that slip through
      setTimeout(() => {
        cleanupDuplicateNotifications(chatId).catch(err => {
          console.error('[Chat Notification] Error in delayed cleanup (1s):', err);
        });
      }, 1000);
      
      setTimeout(() => {
        cleanupDuplicateNotifications(chatId).catch(err => {
          console.error('[Chat Notification] Error in delayed cleanup (3s):', err);
        });
      }, 3000);
      
      setTimeout(() => {
        cleanupDuplicateNotifications(chatId).catch(err => {
          console.error('[Chat Notification] Error in delayed cleanup (5s):', err);
        });
      }, 5000);
      
      if (__DEV__) {
        console.log(`[Chat Notification] Updated notification for chat ${chatId}: ${newCount} messages`);
      }
      
      return notificationId;
    } else {
      // Create new notification for this chat
      // Use consistent ID based on chatId (not timestamp) so it can be updated
      const notificationId = consistentNotificationId;
      
      // CRITICAL: Cancel ALL existing notifications for this chat
      // This prevents duplicate/individual notifications when app is killed
      try {
        const displayedNotifications = await notifee.getDisplayedNotifications();
        const notificationsToCancel = displayedNotifications.filter(notif => {
          // Find ALL notifications for this chat (we'll create a new grouped one)
          const notifChatId = notif?.notification?.data?.chatId || 
                             notif?.notification?.data?.ChatId || 
                             notif?.notification?.data?.chat_id;
          const isSameChat = notifChatId === chatId;
          return isSameChat; // Cancel all notifications for this chat
        });
        
        if (notificationsToCancel.length > 0) {
          console.log(`[Chat Notification] 🧹 Canceling ${notificationsToCancel.length} existing notifications for chat ${chatId} before creating grouped one`);
          for (const notif of notificationsToCancel) {
            try {
              await notifee.cancelNotification(notif.id);
              console.log(`[Chat Notification] ✅ Canceled notification: ${notif.id}`);
            } catch (cancelError) {
              console.error('[Chat Notification] Error canceling notification:', cancelError);
            }
          }
        }
      } catch (cancelError) {
        console.error('[Chat Notification] Error checking for duplicates:', cancelError);
      }
      
      await notifee.displayNotification({
        id: notificationId,
        title: senderName,
        body: body,
        data: data,
        android: {
          channelId: 'default',
          importance: AndroidImportance.HIGH,
          pressAction: { id: 'default' },
          sound: 'default',
          smallIcon: 'ic_launcher',
          largeIcon: 'ic_launcher',
          color: '#FF6B35',
          groupId: `chat_${chatId}`, // Group notifications by chat
          groupSummary: false,
          timestamp: Date.now(),
          showTimestamp: true,
          style: {
            type: 1, // BIGTEXT style
            text: body,
          },
        },
        ios: {
          sound: 'default',
          badge: true,
          threadId: `chat_${chatId}`, // iOS threading
        },
      });
      
      // Store notification info
      activeChatNotifications[chatId] = {
        notificationId,
        count: 1,
        lastMessage: body,
        lastTimestamp: Date.now(),
      };
      
      // Save to persistent storage
      await saveNotificationState();
      
      // IMMEDIATE cleanup: Cancel any duplicates right away
      try {
        await cleanupDuplicateNotifications(chatId);
      } catch (cleanupErr) {
        console.error('[Chat Notification] Error in immediate cleanup after create:', cleanupErr);
      }
      
      // Schedule multiple delayed cleanups to catch any that slip through
      setTimeout(() => {
        cleanupDuplicateNotifications(chatId).catch(err => {
          console.error('[Chat Notification] Error in delayed cleanup (1s):', err);
        });
      }, 1000);
      
      setTimeout(() => {
        cleanupDuplicateNotifications(chatId).catch(err => {
          console.error('[Chat Notification] Error in delayed cleanup (3s):', err);
        });
      }, 3000);
      
      setTimeout(() => {
        cleanupDuplicateNotifications(chatId).catch(err => {
          console.error('[Chat Notification] Error in delayed cleanup (5s):', err);
        });
      }, 5000);
      
      if (__DEV__) {
        console.log(`[Chat Notification] Created new notification for chat ${chatId}`);
      }
      
      return notificationId;
    }
  } catch (error) {
    console.error('[Chat Notification] ❌ Error displaying grouped notification:', error);
    throw error;
  } finally {
    isProcessing = false;
  }
};

/**
 * Clear notification for a specific chat
 * Call this when user opens the chat
 * 
 * @param {string} chatId - Chat ID to clear notification for
 */
export const clearChatNotification = async (chatId) => {
  try {
    const notification = activeChatNotifications[chatId];
    if (notification) {
      await notifee.cancelNotification(notification.notificationId);
      delete activeChatNotifications[chatId];
      
      // Save to persistent storage
      await saveNotificationState();
      
      if (__DEV__) {
        console.log(`[Chat Notification] Cleared notification for chat ${chatId}`);
      }
    }
  } catch (error) {
    console.error('[Chat Notification] Error clearing notification:', error);
  }
};

/**
 * Clear all chat notifications
 */
export const clearAllChatNotifications = async () => {
  try {
    const chatIds = Object.keys(activeChatNotifications);
    for (const chatId of chatIds) {
      await clearChatNotification(chatId);
    }
  } catch (error) {
    console.error('[Chat Notification] Error clearing all notifications:', error);
  }
};

/**
 * Get active notification count for a chat
 * 
 * @param {string} chatId - Chat ID
 * @returns {number} Notification count
 */
export const getChatNotificationCount = (chatId) => {
  return activeChatNotifications[chatId]?.count || 0;
};

/**
 * Clean up duplicate notifications for a specific chat
 * This removes individual notifications when a grouped one exists
 * 
 * @param {string} chatId - Chat ID to clean up
 */
export const cleanupDuplicateNotifications = async (chatId) => {
  try {
    if (!chatId) {
      console.log('[Chat Notification] ⚠️ No chatId provided for cleanup');
      return;
    }
    
    const consistentNotificationId = `chat_${chatId}`;
    const displayedNotifications = await notifee.getDisplayedNotifications();
    
    console.log(`[Chat Notification] 🧹 Cleanup: Checking ${displayedNotifications.length} displayed notifications for chat ${chatId}`);
    
    // Find ALL notifications for this chat (by chatId in data OR by ID pattern)
    const chatNotifications = displayedNotifications.filter(notif => {
      const notifChatId = notif?.notification?.data?.chatId || 
                         notif?.notification?.data?.ChatId || 
                         notif?.notification?.data?.chat_id;
      const matchesChatId = notifChatId === chatId;
      const matchesId = notif.id === consistentNotificationId || notif.id?.startsWith(`chat_${chatId}_`);
      
      if (matchesChatId || matchesId) {
        console.log(`[Chat Notification] Found notification for chat ${chatId}: ID=${notif.id}, chatId=${notifChatId}`);
        return true;
      }
      return false;
    });
    
    console.log(`[Chat Notification] Found ${chatNotifications.length} notifications for chat ${chatId}`);
    
    if (chatNotifications.length === 0) {
      console.log(`[Chat Notification] ✅ No notifications to clean up for chat ${chatId}`);
      return;
    }
    
    // If we have a grouped notification (with consistent ID), cancel ALL others
    const hasGroupedNotification = chatNotifications.some(notif => notif.id === consistentNotificationId);
    
    if (hasGroupedNotification) {
      // Cancel ALL notifications except the grouped one
      const duplicatesToCancel = chatNotifications.filter(notif => notif.id !== consistentNotificationId);
      if (duplicatesToCancel.length > 0) {
        console.log(`[Chat Notification] 🧹 Cleaning up ${duplicatesToCancel.length} duplicate notifications for chat ${chatId}`);
        for (const notif of duplicatesToCancel) {
          try {
            await notifee.cancelNotification(notif.id);
            console.log(`[Chat Notification] ✅ Cleaned up duplicate: ${notif.id}`);
          } catch (error) {
            console.error('[Chat Notification] Error cleaning up duplicate:', error);
          }
        }
      } else {
        console.log(`[Chat Notification] ✅ Only grouped notification exists for chat ${chatId}`);
      }
    } else {
      // If we have multiple notifications but no grouped one, keep ONLY the one with consistent ID
      // If consistent ID doesn't exist, keep the most recent and cancel all others
      console.log(`[Chat Notification] ⚠️ Found ${chatNotifications.length} notifications but no grouped one`);
      
      const groupedNotif = chatNotifications.find(notif => notif.id === consistentNotificationId);
      let notificationToKeep = groupedNotif;
      
      // If no consistent ID notification, keep the most recent one
      if (!notificationToKeep) {
        notificationToKeep = chatNotifications.sort((a, b) => {
          const timeA = a.notification?.android?.timestamp || 0;
          const timeB = b.notification?.android?.timestamp || 0;
          return timeB - timeA; // Most recent first
        })[0];
        console.log(`[Chat Notification] Keeping most recent notification: ${notificationToKeep.id}`);
      }
      
      // Cancel ALL except the one to keep
      for (const notif of chatNotifications) {
        if (notif.id !== notificationToKeep.id) {
          try {
            await notifee.cancelNotification(notif.id);
            console.log(`[Chat Notification] ✅ Canceled duplicate notification: ${notif.id}`);
          } catch (error) {
            console.error('[Chat Notification] Error canceling duplicate:', error);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Chat Notification] ❌ Error in cleanupDuplicateNotifications:', error);
  }
};


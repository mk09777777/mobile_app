import { useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useAuth } from '../../context/AuthContext';
import socketService from '../../services/socketService';
import {
  patchAllGetChatsCachesForNewMessage,
  patchGetChatsByEnquiryV2ForNewMessage,
  patchAllCachesForMessagesRead,
  invalidateAllChatListQueries,
} from '../../utils/chatListRealtimeCache';

/**
 * Global socket sync for chat lists (main Chats tab + ChatGroups / enquiry chats).
 * Updates RTK caches in memory for instant unread + last message + order (newest first).
 * Only hits the API when no cached row matches (e.g. brand-new chat) via a single invalidation.
 */
const ChatListSocketSync = () => {
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useAuth();

  const handleNewMessage = useCallback(
    (message) => {
      const uidRaw = user?.id ?? user?._id;
      if (uidRaw == null) return;
      const patchedMain = patchAllGetChatsCachesForNewMessage(dispatch, message, uidRaw);
      const patchedEnquiry = patchGetChatsByEnquiryV2ForNewMessage(dispatch, message, uidRaw);
      if (!patchedMain && !patchedEnquiry) {
        invalidateAllChatListQueries(dispatch);
      }
    },
    [dispatch, user?.id, user?._id]
  );

  const handleMessagesRead = useCallback(
    (data) => {
      const uidRaw = user?.id ?? user?._id;
      if (uidRaw == null) return;
      const patched = patchAllCachesForMessagesRead(dispatch, data, uidRaw);
      if (!patched) {
        invalidateAllChatListQueries(dispatch);
      }
    },
    [dispatch, user?.id, user?._id]
  );

  useEffect(() => {
    if (!isAuthenticated || !(user?.id ?? user?._id)) {
      return undefined;
    }

    const unsubNew = socketService.on('newMessage', handleNewMessage);
    const unsubRead = socketService.on('messagesRead', handleMessagesRead);

    return () => {
      if (typeof unsubNew === 'function') unsubNew();
      if (typeof unsubRead === 'function') unsubRead();
    };
  }, [isAuthenticated, user?.id, user?._id, handleNewMessage, handleMessagesRead]);

  return null;
};

export default ChatListSocketSync;

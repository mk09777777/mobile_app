import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Text,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useGetChatsQuery, useGetEnquiriesQuery, useGetChatMessagesQuery, api } from '../../store/api';
import { useSelector, useDispatch } from 'react-redux';
import { Card } from '../../components/cards/Cards';
import { SearchInput } from '../../components/common';
// Removed custom Text components to fix crashes
import { AnimatedLogoLoader } from '../../components/common';
import TopNavbar from '../../components/common/TopNavbar';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatDateTime, truncateText } from '../../utils/helpers';
import { getUserName } from '../../utils/userUtils';

// Format time like WhatsApp (short format)
const formatShortTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffTime = today - messageDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    // Today - show time only
    return date.toLocaleString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).toLowerCase();
  } else if (diffDays === 1) {
    // Yesterday
    return 'Yesterday';
  } else if (diffDays < 7) {
    // This week - show day name
    return date.toLocaleDateString('en-IN', { weekday: 'short' });
  } else {
    // Older - show date
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  }
};
import { useUsers } from '../../features/users/usersHooks';
import socketService from '../../services/socketService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config/apiConfig';

/** Newest activity first — uses same fields as socket/cache patches so list order stays correct without refetch */
function getChatActivityTimeMs(chat) {
  if (!chat) return 0;
  try {
    const raw =
      chat.lastMessageTime ||
      chat.LastMessageTime ||
      chat.LastMessage?.Timestamp ||
      chat._originalData?.LastMessage?.Timestamp ||
      chat._originalData?.LastMessageTime ||
      chat.updatedAt ||
      chat.UpdatedAt ||
      0;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : 0;
  } catch {
    return 0;
  }
}

function sortChatsByRecentActivity(list) {
  if (!Array.isArray(list) || list.length < 2) return Array.isArray(list) ? list : [];
  return [...list].sort((a, b) => getChatActivityTimeMs(b) - getChatActivityTimeMs(a));
}

const ChatsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  // Track typing status per chat: { chatId: { isTyping: boolean, userName: string } }
  const [typingStatus, setTypingStatus] = useState({});
  const typingTimeoutsRef = useRef({}); // Store timeouts per chat
  
  // Pagination state for both chat types
  const [page1, setPage1] = useState(1);
  const [page2, setPage2] = useState(1);
  const [hasMore1, setHasMore1] = useState(true);
  const [hasMore2, setHasMore2] = useState(true);
  const [isLoadingMore1, setIsLoadingMore1] = useState(false);
  const [isLoadingMore2, setIsLoadingMore2] = useState(false);
  const [allChats1, setAllChats1] = useState([]); // Accumulated chats for type 1
  const [allChats2, setAllChats2] = useState([]); // Accumulated chats for type 2
  // When false, list reads directly from RTK (instant cache patches + sort). When true, "load more" merged local state.
  const [useAccumulatedChats1, setUseAccumulatedChats1] = useState(false);
  const [useAccumulatedChats2, setUseAccumulatedChats2] = useState(false);
  const PAGE_SIZE = 25; // Load 25 chats per page
  
  // Load users to enable name lookup by ID
  const { users: usersList } = useUsers();
  const usersMap = useSelector(state => state.users?.usersMap || {});

  // Helper function to get user name from SenderId using cached users
  const getSenderNameFromId = useCallback((senderId) => {
    if (!senderId || !usersMap || Object.keys(usersMap).length === 0) {
      return null;
    }
    
    const idStr = String(senderId).trim();
    
    // Try exact match
    if (usersMap[idStr]) {
      return usersMap[idStr].name || usersMap[idStr].Name || usersMap[idStr].email || usersMap[idStr].Email || null;
    }
    
    // Try with spaces removed
    const noSpacesId = idStr.replace(/\s/g, '');
    if (usersMap[noSpacesId]) {
      return usersMap[noSpacesId].name || usersMap[noSpacesId].Name || usersMap[noSpacesId].email || usersMap[noSpacesId].Email || null;
    }
    
    // Try ObjectId format cleanup
    const cleanId = idStr.replace(/^ObjectId\(/, '').replace(/\)$/, '').replace(/\s/g, '');
    if (usersMap[cleanId]) {
      return usersMap[cleanId].name || usersMap[cleanId].Name || usersMap[cleanId].email || usersMap[cleanId].Email || null;
    }
    
    // Try iterating through usersMap to find by id or _id
    const foundUser = Object.values(usersMap).find(user => {
      const userIdFromMap = String(user.id || user._id || '').trim();
      return userIdFromMap === idStr || userIdFromMap === noSpacesId || userIdFromMap === cleanId;
    });
    
    if (foundUser) {
      return foundUser.name || foundUser.Name || foundUser.email || foundUser.Email || null;
    }
    
    return null;
  }, [usersMap]);

  // Get role ID (preferred) or fallback to role string
  const roleId = user?.roleId || user?.roleNumber;
  const roleString = user?.role?.toLowerCase();
  
  // Determine chat types based on role ID (following the specification)
  // Role ID 1 (Admin/AD) → See both admin-client and admin-designer
  // Role ID 2 (Coral/CO) → See only admin-designer
  // Role ID 3 (CAD/CD) → See only admin-designer
  // Role ID 4 (Client/CL) → See only admin-client
  const getChatTypes = () => {
    // Use role ID if available (preferred method)
    if (roleId !== undefined && roleId !== null) {
      if (roleId === 1) {
        // Admin: see both types
        return { chatType1: 'admin-client', chatType2: 'admin-designer', isAdmin: true };
      } else if (roleId === 4) {
        // Client: see only admin-client
        return { chatType1: 'admin-client', chatType2: null, isAdmin: false };
      } else if (roleId === 2 || roleId === 3) {
        // Worker/Designer (Coral/CAD): see only admin-designer
        return { chatType1: 'admin-designer', chatType2: null, isAdmin: false };
      }
    }
    
    // Fallback to role string (for backward compatibility)
    if (roleString === 'admin') {
      return { chatType1: 'admin-client', chatType2: 'admin-designer', isAdmin: true };
    } else if (roleString === 'client') {
      return { chatType1: 'admin-client', chatType2: null, isAdmin: false };
    } else if (roleString === 'coral' || roleString === 'cad' || roleString === 'worker' || roleString === 'designer') {
      return { chatType1: 'admin-designer', chatType2: null, isAdmin: false };
    }
    
    // Default: assume client
    return { chatType1: 'admin-client', chatType2: null, isAdmin: false };
  };

  const { chatType1, chatType2, isAdmin } = getChatTypes();

  // Log component mount and initial state
  useEffect(() => {
    console.log('🚀 [ChatsScreen] Component mounted/updated', {
      timestamp: new Date().toISOString(),
      userId: user?.id,
      chatType1,
      chatType2,
      isAdmin,
      roleId,
      roleString,
      isConnected: socketService.isConnected(),
    });
  }, []);

  // Fetch first chat type (or only type for non-admins)
  // Hybrid approach: WebSocket for instant updates + shorter polling as safety net
  const { 
    data: chatsFromAPI1 = [], 
    isLoading: chatsLoading1, 
    error: chatsError1, 
    refetch: refetchChats1 
  } = useGetChatsQuery(
    { page: 1, limit: PAGE_SIZE, search: searchQuery, type: chatType1 },
    {
      skip: !user,
      refetchOnFocus: false, // Only refetch on mount and manual refresh; use cache otherwise
    }
  );

  // Fetch second chat type (only for admins)
  const { 
    data: chatsFromAPI2 = [], 
    isLoading: chatsLoading2, 
    error: chatsError2, 
    refetch: refetchChats2 
  } = useGetChatsQuery(
    { page: 1, limit: PAGE_SIZE, search: searchQuery, type: chatType2 },
    {
      skip: !user || !isAdmin || !chatType2,
      refetchOnFocus: false, // Only refetch on mount and manual refresh; use cache otherwise
    }
  );

  // Reset pagination when search query changes
  useEffect(() => {
    setPage1(1);
    setPage2(1);
    setAllChats1([]);
    setAllChats2([]);
    setUseAccumulatedChats1(false);
    setUseAccumulatedChats2(false);
    setHasMore1(true);
    setHasMore2(true);
    hasLoadedMore1Ref.current = false; // Reset refs when search changes
    hasLoadedMore2Ref.current = false;
  }, [searchQuery, chatType1, chatType2]);

  // Update accumulated chats when API data changes (for first page only)
  // Use a ref to track if we've manually loaded more pages to prevent overwriting
  const hasLoadedMore1Ref = useRef(false);
  const hasLoadedMore2Ref = useRef(false);

  useEffect(() => {
    if (!chatsLoading1 && chatsFromAPI1 && Array.isArray(chatsFromAPI1) && chatsFromAPI1.length > 0) {
      // Only update if we're on page 1 and haven't manually loaded more pages
      if (page1 === 1 && !hasLoadedMore1Ref.current) {
        // First page - replace all chats
        if (__DEV__) {
          console.log('🔄 [ChatsScreen] Updating allChats1 from RTK Query (page 1):', {
            count: chatsFromAPI1.length,
          });
        }
        setAllChats1(chatsFromAPI1);
        // Check if there are more pages
        const hasMore = chatsFromAPI1.length >= PAGE_SIZE;
        setHasMore1(hasMore);
      } else if (page1 === 1 && hasLoadedMore1Ref.current) {
        // Page was reset to 1 (e.g., after search or refresh), reset the ref
        hasLoadedMore1Ref.current = false;
        setAllChats1(chatsFromAPI1);
        const hasMore = chatsFromAPI1.length >= PAGE_SIZE;
        setHasMore1(hasMore);
      }
    }
  }, [chatsFromAPI1, chatsLoading1, page1]);

  useEffect(() => {
    if (!chatsLoading2 && chatsFromAPI2 && Array.isArray(chatsFromAPI2) && chatsFromAPI2.length > 0) {
      // Only update if we're on page 2 and haven't manually loaded more pages
      if (page2 === 1 && !hasLoadedMore2Ref.current) {
        // First page - replace all chats
        if (__DEV__) {
          console.log('🔄 [ChatsScreen] Updating allChats2 from RTK Query (page 1):', {
            count: chatsFromAPI2.length,
          });
        }
        setAllChats2(chatsFromAPI2);
        // Check if there are more pages
        const hasMore = chatsFromAPI2.length >= PAGE_SIZE;
        setHasMore2(hasMore);
      } else if (page2 === 1 && hasLoadedMore2Ref.current) {
        // Page was reset to 1 (e.g., after search or refresh), reset the ref
        hasLoadedMore2Ref.current = false;
        setAllChats2(chatsFromAPI2);
        const hasMore = chatsFromAPI2.length >= PAGE_SIZE;
        setHasMore2(hasMore);
      }
    }
  }, [chatsFromAPI2, chatsLoading2, page2]);

  // If user has loaded more chats, the UI uses `allChats*` (accumulated state).
  // RTK cache patches update `chatsFromAPI*` but may not automatically update `allChats*`,
  // so merge updated first-page chats into the accumulated arrays to keep sender-side ordering correct.
  useEffect(() => {
    if (!useAccumulatedChats1) return;
    if (!Array.isArray(chatsFromAPI1) || chatsFromAPI1.length === 0) return;
    setAllChats1((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;

      const keyOf = (c) => String(c?.id || c?._id || '').trim();
      const map = new Map(prev.map((c) => [keyOf(c), c]));

      chatsFromAPI1.forEach((apiChat) => {
        const k = keyOf(apiChat);
        if (!k || k === 'undefined' || k === 'null') return;
        map.set(k, apiChat);
      });

      const merged = Array.from(map.values()).filter((c) => !!c);
      return sortChatsByRecentActivity(merged);
    });
  }, [chatsFromAPI1, useAccumulatedChats1]);

  useEffect(() => {
    if (!useAccumulatedChats2) return;
    if (!Array.isArray(chatsFromAPI2) || chatsFromAPI2.length === 0) return;
    setAllChats2((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;

      const keyOf = (c) => String(c?.id || c?._id || '').trim();
      const map = new Map(prev.map((c) => [keyOf(c), c]));

      chatsFromAPI2.forEach((apiChat) => {
        const k = keyOf(apiChat);
        if (!k || k === 'undefined' || k === 'null') return;
        map.set(k, apiChat);
      });

      const merged = Array.from(map.values()).filter((c) => !!c);
      return sortChatsByRecentActivity(merged);
    });
  }, [chatsFromAPI2, useAccumulatedChats2]);

  // Helper function to normalize chat data (same as RTK Query transformResponse)
  const normalizeChat = useCallback((chat) => {
    // Handle MongoDB ObjectId format for enquiryId
    let enquiryId = chat.EnquiryId || chat.enquiryId;
    if (enquiryId?.$oid) {
      enquiryId = enquiryId.$oid;
    } else if (enquiryId?._id) {
      enquiryId = enquiryId._id;
    }
    
    // Handle MongoDB ObjectId format for chat ID
    let chatId = chat._id;
    if (chatId?.$oid) {
      chatId = chatId.$oid;
    } else if (chatId?._id) {
      chatId = chatId._id;
    } else {
      chatId = chatId || chat.id;
    }
    
    // Handle timestamp
    let lastMessageTime = chat.LastMessageTime || chat.lastMessageTime || chat.updatedAt || chat.UpdatedAt;
    if (lastMessageTime?.$date) {
      lastMessageTime = lastMessageTime.$date;
    } else if (lastMessageTime?.Timestamp) {
      lastMessageTime = lastMessageTime.Timestamp;
    }
    
    // Handle LastMessage
    let lastMessageText = '';
    let lastMessageSenderName = '';
    let lastMessageSenderId = '';
    const lastMessageObj = chat.LastMessage || chat.lastMessage;
    if (lastMessageObj) {
      if (typeof lastMessageObj === 'string') {
        lastMessageText = lastMessageObj;
      } else if (typeof lastMessageObj === 'object') {
        lastMessageText = lastMessageObj.Message || lastMessageObj.message || lastMessageObj.text || lastMessageObj.Text || '';
        if (lastMessageObj.Sender && typeof lastMessageObj.Sender === 'object') {
          lastMessageSenderName = lastMessageObj.Sender.name || lastMessageObj.Sender.Name || '';
          lastMessageSenderId = lastMessageObj.Sender._id || lastMessageObj.Sender.Id || lastMessageObj.Sender.id || '';
        } else if (typeof lastMessageObj.Sender === 'string') {
          lastMessageSenderName = lastMessageObj.Sender;
        } else {
          lastMessageSenderName = lastMessageObj.SenderName || lastMessageObj.senderName || lastMessageObj.sender || '';
        }
        lastMessageSenderId = lastMessageSenderId || lastMessageObj.SenderId || lastMessageObj.senderId || '';
      }
    } else {
      lastMessageText = chat.message || '';
    }
    
    // Handle LastSender
    let lastSenderName = lastMessageSenderName || '';
    let lastSenderId = chat.LastSenderId || chat.lastSenderId || lastMessageSenderId;
    const lastSenderObj = chat.LastSender || chat.lastSender;
    if (lastSenderObj && !lastSenderName) {
      if (typeof lastSenderObj === 'string') {
        lastSenderName = lastSenderObj;
      } else if (typeof lastSenderObj === 'object') {
        lastSenderId = lastSenderId || lastSenderObj.Id || lastSenderObj._id || lastSenderObj.id || lastSenderObj.SenderId || lastSenderObj.senderId;
        lastSenderName = lastSenderObj.Name || lastSenderObj.name || lastSenderObj.SenderName || lastSenderObj.senderName || '';
      }
    }
    
    // Extract unread count
    let unreadCount = 0;
    if (chat.UnreadCount !== undefined && chat.UnreadCount !== null) {
      unreadCount = Number(chat.UnreadCount) || 0;
    } else if (chat.unreadCount !== undefined && chat.unreadCount !== null) {
      unreadCount = Number(chat.unreadCount) || 0;
    }
    
    return {
      id: chatId,
      _id: chatId,
      enquiryId: enquiryId || chat.Enquiry?.id || chat.enquiry?.id,
      enquiryTitle: chat.EnquiryName || chat.enquiryName || chat.EnquiryTitle || chat.enquiryTitle || chat.Enquiry?.Name || chat.Enquiry?.title || 'Untitled Chat',
      clientName: chat.ClientName || chat.clientName || chat.Client?.Name || chat.client?.name || '',
      lastMessage: lastMessageText,
      lastMessageTime: lastMessageTime || new Date().toISOString(),
      unreadCount: unreadCount,
      _originalData: chat,
      isGroup: chat.IsGroup || chat.isGroup || false,
      participants: chat.Participants || chat.participants || [],
      lastSender: lastSenderName,
      lastSenderId: lastSenderId,
      lastMessageSenderName: lastMessageSenderName,
      lastMessageSenderId: lastMessageSenderId,
      status: chat.Status || chat.status || 'active',
      isClient: chat.IsClient || chat.isClient || false,
      type: chat.Type || chat.type || chat.chatType || chat.ChatType || null,
      Type: chat.Type || chat.type || chat.chatType || chat.ChatType || null,
    };
  }, []);

  // Load more chats for type 1
  const loadMoreChats1 = useCallback(async () => {
    if (isLoadingMore1 || !hasMore1 || !chatType1) {
      if (__DEV__) {
        console.log('⏸️ [ChatsScreen] loadMoreChats1 skipped:', {
          isLoadingMore1,
          hasMore1,
          chatType1,
          page1,
        });
      }
      return;
    }

    if (__DEV__) {
      console.log('🔄 [ChatsScreen] Loading more chats (type 1):', {
        currentPage: page1,
        nextPage: page1 + 1,
        currentCount: allChats1.length,
        hasMore1,
      });
    }

    setIsLoadingMore1(true);
    try {
      const nextPage = page1 + 1;
      const token = await AsyncStorage.getItem('token');
      const params = new URLSearchParams();
      params.append('page', nextPage.toString());
      params.append('limit', PAGE_SIZE.toString());
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      params.append('type', chatType1);

      const url = `${API_BASE_URL}/api/chats?${params.toString()}`;
      if (__DEV__) {
        console.log('📡 [ChatsScreen] Fetching:', url);
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      let rawChats = [];
      
      if (Array.isArray(data)) {
        rawChats = data;
      } else if (data.Data && Array.isArray(data.Data)) {
        rawChats = data.Data;
      } else if (data.chats && Array.isArray(data.chats)) {
        rawChats = data.chats;
      } else if (data.data && Array.isArray(data.data)) {
        rawChats = data.data;
      }

      if (__DEV__) {
        console.log('📥 [ChatsScreen] Received raw chats:', {
          count: rawChats.length,
          page: nextPage,
        });
      }

      if (rawChats.length > 0) {
        // Normalize chats using the same logic as RTK Query
        const normalizedChats = rawChats.map(normalizeChat);
        
        if (__DEV__) {
          console.log('📦 [ChatsScreen] Normalized chats (type 1):', {
            rawCount: rawChats.length,
            normalizedCount: normalizedChats.length,
            sampleIds: normalizedChats.slice(0, 3).map(c => c.id || c._id),
          });
        }
        
        // Merge with existing chats, avoiding duplicates
        setAllChats1(prev => {
          const existingIds = new Set(prev.map(c => String(c.id || c._id || '')));
          const uniqueNew = normalizedChats.filter(c => {
            const chatId = String(c.id || c._id || '');
            return chatId && chatId !== 'undefined' && chatId !== 'null' && !existingIds.has(chatId);
          });
          const merged = [...prev, ...uniqueNew];
          
          if (__DEV__) {
            console.log('✅ [ChatsScreen] Merged chats (type 1):', {
              previousCount: prev.length,
              newCount: uniqueNew.length,
              totalCount: merged.length,
              hasMore: normalizedChats.length >= PAGE_SIZE,
            });
          }
          
          return merged;
        });
        setPage1(nextPage);
        hasLoadedMore1Ref.current = true; // Mark that we've manually loaded more
        setUseAccumulatedChats1(true);
        // Update hasMore: true if we got a full page, false otherwise
        const stillHasMore = normalizedChats.length >= PAGE_SIZE;
        setHasMore1(stillHasMore);
        
        if (__DEV__) {
          console.log('📊 [ChatsScreen] Updated pagination state (type 1):', {
            newPage: nextPage,
            hasMore: stillHasMore,
            receivedCount: normalizedChats.length,
            pageSize: PAGE_SIZE,
          });
        }
      } else {
        if (__DEV__) {
          console.log('ℹ️ [ChatsScreen] No more chats to load (type 1) - empty response');
        }
        setHasMore1(false);
      }
    } catch (error) {
      console.error('❌ [ChatsScreen] Error loading more chats (type 1):', error);
      setHasMore1(false);
    } finally {
      setIsLoadingMore1(false);
    }
  }, [page1, hasMore1, isLoadingMore1, chatType1, searchQuery, allChats1.length, normalizeChat]);

  // Load more chats for type 2
  const loadMoreChats2 = useCallback(async () => {
    if (isLoadingMore2 || !hasMore2 || !chatType2 || !isAdmin) {
      if (__DEV__) {
        console.log('⏸️ [ChatsScreen] loadMoreChats2 skipped:', {
          isLoadingMore2,
          hasMore2,
          chatType2,
          isAdmin,
          page2,
        });
      }
      return;
    }

    if (__DEV__) {
      console.log('🔄 [ChatsScreen] Loading more chats (type 2):', {
        currentPage: page2,
        nextPage: page2 + 1,
        currentCount: allChats2.length,
        hasMore2,
      });
    }

    setIsLoadingMore2(true);
    try {
      const nextPage = page2 + 1;
      const token = await AsyncStorage.getItem('token');
      const params = new URLSearchParams();
      params.append('page', nextPage.toString());
      params.append('limit', PAGE_SIZE.toString());
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      params.append('type', chatType2);

      const url = `${API_BASE_URL}/api/chats?${params.toString()}`;
      if (__DEV__) {
        console.log('📡 [ChatsScreen] Fetching:', url);
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      let rawChats = [];
      
      if (Array.isArray(data)) {
        rawChats = data;
      } else if (data.Data && Array.isArray(data.Data)) {
        rawChats = data.Data;
      } else if (data.chats && Array.isArray(data.chats)) {
        rawChats = data.chats;
      } else if (data.data && Array.isArray(data.data)) {
        rawChats = data.data;
      }

      if (__DEV__) {
        console.log('📥 [ChatsScreen] Received raw chats:', {
          count: rawChats.length,
          page: nextPage,
        });
      }

      if (rawChats.length > 0) {
        // Normalize chats using the same logic as RTK Query
        const normalizedChats = rawChats.map(normalizeChat);
        
        if (__DEV__) {
          console.log('📦 [ChatsScreen] Normalized chats (type 2):', {
            rawCount: rawChats.length,
            normalizedCount: normalizedChats.length,
            sampleIds: normalizedChats.slice(0, 3).map(c => c.id || c._id),
          });
        }
        
        // Merge with existing chats, avoiding duplicates
        setAllChats2(prev => {
          const existingIds = new Set(prev.map(c => String(c.id || c._id || '')));
          const uniqueNew = normalizedChats.filter(c => {
            const chatId = String(c.id || c._id || '');
            return chatId && chatId !== 'undefined' && chatId !== 'null' && !existingIds.has(chatId);
          });
          const merged = [...prev, ...uniqueNew];
          
          if (__DEV__) {
            console.log('✅ [ChatsScreen] Merged chats (type 2):', {
              previousCount: prev.length,
              newCount: uniqueNew.length,
              totalCount: merged.length,
              hasMore: normalizedChats.length >= PAGE_SIZE,
            });
          }
          
          return merged;
        });
        setPage2(nextPage);
        hasLoadedMore2Ref.current = true; // Mark that we've manually loaded more
        setUseAccumulatedChats2(true);
        // Update hasMore: true if we got a full page, false otherwise
        const stillHasMore = normalizedChats.length >= PAGE_SIZE;
        setHasMore2(stillHasMore);
        
        if (__DEV__) {
          console.log('📊 [ChatsScreen] Updated pagination state (type 2):', {
            newPage: nextPage,
            hasMore: stillHasMore,
            receivedCount: normalizedChats.length,
            pageSize: PAGE_SIZE,
          });
        }
      } else {
        if (__DEV__) {
          console.log('ℹ️ [ChatsScreen] No more chats to load (type 2) - empty response');
        }
        setHasMore2(false);
      }
    } catch (error) {
      console.error('❌ [ChatsScreen] Error loading more chats (type 2):', error);
      setHasMore2(false);
    } finally {
      setIsLoadingMore2(false);
    }
  }, [page2, hasMore2, isLoadingMore2, chatType2, searchQuery, isAdmin, allChats2.length, normalizeChat]);

  // Log when chat data changes
  useEffect(() => {
    console.log('📊 [ChatsScreen] Chat data updated', {
      timestamp: new Date().toISOString(),
      chatsFromAPI1Count: chatsFromAPI1?.length || 0,
      chatsFromAPI2Count: chatsFromAPI2?.length || 0,
      chatsLoading1,
      chatsLoading2,
      chatsError1: !!chatsError1,
      chatsError2: !!chatsError2,
      firstFewChatIds1: chatsFromAPI1?.slice(0, 3).map(c => ({
        id: c.id || c._id,
        enquiryId: c.enquiryId || c.EnquiryId,
        unreadCount: c.unreadCount || c.UnreadCount,
      })) || [],
      firstFewChatIds2: chatsFromAPI2?.slice(0, 3).map(c => ({
        id: c.id || c._id,
        enquiryId: c.enquiryId || c.EnquiryId,
        unreadCount: c.unreadCount || c.UnreadCount,
      })) || [],
    });
  }, [chatsFromAPI1, chatsFromAPI2, chatsLoading1, chatsLoading2, chatsError1, chatsError2]);

  // Helper function to enrich chats with sender names from cached users
  const enrichChatsWithSenderNames = useCallback((chats) => {
    if (!Array.isArray(chats) || Object.keys(usersMap).length === 0) {
      return chats;
    }
    
    return chats.map(chat => {
      console.log('🔄 [ChatsScreen] Enriching chat with sender name', {
        chatId: chat.id || chat._id,
        senderId: chat._originalData?.LastMessage?.SenderId,
        senderName: chat._originalData?.LastMessage?.Sender,
      });
      // Check if chat has _originalData.LastMessage with SenderId but no Sender name
      if (chat._originalData?.LastMessage?.SenderId && !chat._originalData.LastMessage.Sender) {
        const senderId = chat._originalData.LastMessage.SenderId;
        const senderName = getSenderNameFromId(senderId);
        if (senderName) {
          // Create a new chat object with enriched data
          return {
            ...chat,
            _originalData: {
              ...chat._originalData,
              LastMessage: {
                ...chat._originalData.LastMessage,
                Sender: senderName,
              },
            },
          };
        }
      }
      return chat;
    });
  }, [usersMap, getSenderNameFromId]);

  // Helper function to filter chats by role (as per specification)
  const filterChatsByRole = useCallback((chats, userRoleId) => {
    if (!Array.isArray(chats)) return [];
    
    // Role ID 1 (Admin) → return all chats
    if (userRoleId === 1) return chats;
    
    // Role ID 4 (Client) → filter to only admin-client
    if (userRoleId === 4) {
      return chats.filter(chat => {
        const chatType = (chat.type || chat.Type || chat.chatType || chat.ChatType || chat._originalData?.Type || chat._originalData?.type || '').toLowerCase();
        if (!chatType) return true; // Accept if backend omitted type
        return chatType === 'admin-client';
      });
    }
    
    // Role ID 2 or 3 (Worker/Designer) → filter to only admin-designer
    if (userRoleId === 2 || userRoleId === 3) {
      return chats.filter(chat => {
        const chatType = (chat.type || chat.Type || chat.chatType || chat.ChatType || chat._originalData?.Type || chat._originalData?.type || '').toLowerCase();
        if (!chatType) return true; // Accept if backend omitted type
        return chatType === 'admin-designer';
      });
    }
    
    // Unknown role → return empty array
    return [];
  }, []);

  // Merge chat types for admins; prefer live RTK data unless user has used "load more" (accumulated arrays).
  const chatsFromAPI = useMemo(() => {
    const raw1 = useAccumulatedChats1 ? allChats1 : chatsFromAPI1;
    const raw2 = useAccumulatedChats2 ? allChats2 : chatsFromAPI2;

    console.log('🔄 [ChatsScreen] Computing chatsFromAPI', {
      timestamp: new Date().toISOString(),
      isAdmin,
      chatType2,
      useAccumulatedChats1,
      useAccumulatedChats2,
      raw1Count: raw1?.length || 0,
      raw2Count: raw2?.length || 0,
    });

    if (isAdmin && chatType2) {
      const allChats = [...(raw1 || []), ...(raw2 || [])];
      const uniqueChats = Array.from(
        new Map(allChats.map(chat => [chat.id || chat._id, chat])).values()
      );
      const filteredChats = filterChatsByRole(uniqueChats, roleId);
      const result = sortChatsByRecentActivity(enrichChatsWithSenderNames(filteredChats));
      console.log('✅ [ChatsScreen] Combined chats (admin)', {
        allChatsCount: allChats.length,
        uniqueChatsCount: uniqueChats.length,
        resultCount: result.length,
        firstFewChats: result.slice(0, 3).map(c => ({
          id: c.id || c._id,
          enquiryId: c.enquiryId || c.EnquiryId,
          unreadCount: c.unreadCount || c.UnreadCount,
          lastMessage: (c.lastMessage || c.LastMessage || '').substring(0, 30),
        })),
      });
      return result;
    }

    const chats = raw1 || [];
    if (chats.length > 0 && roleId) {
      const filteredChats = filterChatsByRole(chats, roleId);
      const enrichedChats = sortChatsByRecentActivity(enrichChatsWithSenderNames(filteredChats));
      console.log('✅ [ChatsScreen] Combined chats (non-admin, role-based)', {
        inputCount: chats.length,
        resultCount: enrichedChats.length,
        firstFewChats: enrichedChats.slice(0, 3).map(c => ({
          id: c.id || c._id,
          enquiryId: c.enquiryId || c.EnquiryId,
          unreadCount: c.unreadCount || c.UnreadCount,
          lastMessage: (c.lastMessage || c.LastMessage || '').substring(0, 30),
        })),
      });
      return enrichedChats;
    }

    if (!isAdmin && chats.length > 0) {
      const filteredChats = chats.filter(chat => {
        const cType = chat.type || chat.Type || chat.chatType || chat.ChatType || chat._originalData?.Type || chat._originalData?.type;
        if (cType) {
          const chatType = cType.toLowerCase();
          return chatType === chatType1.toLowerCase();
        }
        return true;
      });
      const enrichedChats = sortChatsByRecentActivity(enrichChatsWithSenderNames(filteredChats));
      console.log('✅ [ChatsScreen] Combined chats (non-admin, type-based)', {
        inputCount: chats.length,
        resultCount: enrichedChats.length,
        firstFewChats: enrichedChats.slice(0, 3).map(c => ({
          id: c.id || c._id,
          enquiryId: c.enquiryId || c.EnquiryId,
          unreadCount: c.unreadCount || c.UnreadCount,
          lastMessage: (c.lastMessage || c.LastMessage || '').substring(0, 30),
        })),
      });
      return enrichedChats;
    }

    const enrichedChats = sortChatsByRecentActivity(enrichChatsWithSenderNames(chats));
    console.log('✅ [ChatsScreen] Combined chats (fallback)', {
      resultCount: enrichedChats.length,
      firstFewChats: enrichedChats.slice(0, 3).map(c => ({
        id: c.id || c._id,
        enquiryId: c.enquiryId || c.EnquiryId,
        unreadCount: c.unreadCount || c.UnreadCount,
        lastMessage: (c.lastMessage || c.LastMessage || '').substring(0, 30),
      })),
    });
    return enrichedChats;
  }, [
    allChats1,
    allChats2,
    chatsFromAPI1,
    chatsFromAPI2,
    useAccumulatedChats1,
    useAccumulatedChats2,
    isAdmin,
    chatType2,
    chatType1,
    roleId,
    filterChatsByRole,
    enrichChatsWithSenderNames,
  ]);

  // Combined loading and error states
  const chatsLoading = chatsLoading1 || (isAdmin && chatsLoading2);
  const chatsError = chatsError1 || chatsError2;
  
  // Combined refetch function
  const refetchChats = useCallback(async () => {
    if (__DEV__) {
      console.log('🔄 [ChatsScreen] Refetching chats...', {
        isAdmin,
        chatType1,
        chatType2,
        timestamp: new Date().toISOString(),
      });
    }
    try {
      const results = await Promise.all([
        refetchChats1(),
        isAdmin && chatType2 ? refetchChats2() : Promise.resolve(),
      ]);
      if (__DEV__) {
        console.log('✅ [ChatsScreen] Chats refetched successfully', {
          result1Count: results[0]?.data?.length || 'N/A',
          result2Count: results[1]?.data?.length || 'N/A',
        });
      }
      return results;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ [ChatsScreen] Error refetching chats:', error);
      }
      throw error;
    }
  }, [refetchChats1, refetchChats2, isAdmin, chatType2, chatType1]);

  // List order + last message: RTK cache patches (socket + local send) + sortChatsByRecentActivity.
  // No refetch on every focus — avoids extra /api/chats calls; pull-to-refresh still refetches.

  // Fetch enquiries to create chats from them if chats API doesn't exist
  const { data: enquiriesResponse, isLoading: enquiriesLoading } = useGetEnquiriesQuery(user?.role, {
    skip: !user,
  });
  
  // Extract enquiries array from response (new API returns { data, pagination })
  const enquiries = enquiriesResponse?.data || [];

  // Check if chats API works, otherwise create chats from enquiries
  const chats = useMemo(() => {
    try {
      // If chats API returned data, use it
      if (chatsFromAPI && Array.isArray(chatsFromAPI) && chatsFromAPI.length > 0) {
        
        return chatsFromAPI;
      }

      // If chats API returned 404 or empty array, create chats from enquiries
      // Also check if there's an error (but not a network error)
      const hasError = chatsError && (
        chatsError.status === 404 || 
        chatsError.originalStatus === 404 ||
        chatsError.status === 'FETCH_ERROR' // Network error
      );

      // IMPORTANT: Only use fallback if API explicitly returns empty AND we're not still loading
      // If API is working but just has no chats, that's fine - show empty list
      // Only fallback if there's an actual error (404) or if we're sure API returned empty after loading completes
      const shouldUseFallback = (
        (!chatsFromAPI || !Array.isArray(chatsFromAPI) || chatsFromAPI.length === 0) && 
        (hasError || (!chatsLoading && chatsFromAPI !== undefined)) && // Only if loading is done and we got a response
        enquiries && Array.isArray(enquiries) && enquiries.length > 0 // Only if we have enquiries to fallback to
      );

      // If API returned empty or error, fall back to enquiries
      if (shouldUseFallback) {
        
        
        // Create chat summaries from enquiries
        // IMPORTANT: Filter by chat type to ensure users only see their allowed chats
        // Note: Last messages will be fetched on-demand when user opens ChatDetailScreen
        if (enquiries && Array.isArray(enquiries) && enquiries.length > 0) {
          // Filter enquiries by chat type based on role ID
          // Role ID 1 (Admin) → include all enquiries
          // Role ID 4 (Client) → only admin-client enquiries
          // Role ID 2/3 (Worker/Designer) → only admin-designer enquiries
          const filteredEnquiries = enquiries.filter(enquiry => {
            if (!enquiry || !(enquiry.id || enquiry._id)) return false;
            
            // If admin (Role ID 1), include all enquiries
            if (roleId === 1 || isAdmin) return true;
            
            // For non-admins, we need to determine which enquiries belong to which chat type
            // Since enquiries don't have a direct "chatType" field, we'll use the enquiry's status/type
            // or check if it's a client enquiry vs designer enquiry
            
            // Role ID 4 (Client) → should only see admin-client enquiries
            // NOTE: Enquiries don't have a chat type field, so we rely on backend filtering
            // The backend should already filter enquiries by user role (clients see only their enquiries)
            // For clients, the enquiries API should only return enquiries where they are the client
            if (roleId === 4) {
              // CRITICAL: Backend should filter by client ownership, but if it doesn't,
              // we need to filter on frontend as a safety measure
              // Check if enquiry's ClientId matches user's clientId (if available)
              const userClientId = user?.clientId || user?.ClientId;
              const enquiryClientId = enquiry?.ClientId || enquiry?.clientId;
              
              // If we have both IDs, filter by matching client ownership
              if (userClientId && enquiryClientId) {
                const matches = String(userClientId).trim() === String(enquiryClientId).trim();
                if (!matches) {
                  if (__DEV__) {
                    console.log(`🔍 Filtering out enquiry ${enquiry.id || enquiry._id}: ClientId mismatch (user: ${userClientId}, enquiry: ${enquiryClientId})`);
                  }
                  return false; // Filter out enquiries that don't belong to this client
                }
                return true; // Include enquiries that belong to this client
              }
              
              // If we don't have clientId, we can't filter properly
              // This is a backend issue - backend should filter by client ownership
              
              
              // For now, include all (backend should filter, but if it doesn't, we show all)
              // This is not ideal, but better than showing nothing
              return true;
            }
            
            // Role ID 2 or 3 (Worker/Designer) → should only see admin-designer enquiries
            // NOTE: Enquiries don't have a chat type field, so we rely on backend filtering
            // The backend should already filter enquiries by user role (designers see only their workflow enquiries)
            if (roleId === 2 || roleId === 3) {
              // Backend should filter, but we can't do much here since enquiries don't have Type field
              // The enquiries API is called with user.role, so backend should handle filtering
              return true; // Trust backend to filter correctly
            }
            
            // Fallback to role string if role ID not available
            if (roleString === 'client') {
              return true; // Backend should filter
            }
            if (roleString === 'coral' || roleString === 'cad' || roleString === 'designer') {
              return true; // Backend should filter
            }
            
            return true; // Default: include all (shouldn't reach here)
          });
          
          
          
          return filteredEnquiries
            .map(enquiry => ({
              id: enquiry.id || enquiry._id,
              enquiryId: enquiry.id || enquiry._id,
              enquiryTitle: enquiry.title || enquiry.Name || 'Untitled Chat',
              clientName: enquiry.clientName || enquiry.client || 'Unknown Client',
              lastMessage: '', // Will be populated when backend adds /api/chats endpoint with last message
              lastMessageTime: enquiry.updatedAt || enquiry.createdAt || new Date().toISOString(),
              unreadCount: 0,
              isGroup: true,
              participants: [],
              lastSender: '',
              status: enquiry.status || 'active',
              isClient: false,
              // Add chat type to help with filtering
              chatType: chatType1, // Mark which type this chat belongs to
              isFallback: true, // Identify this as a fallback chat summary
            }))
            .sort((a, b) => {
              // Sort by last message time (newest first)
              try {
                return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
              } catch (e) {
                return 0; // If date parsing fails, maintain order
              }
            });
        }
      }

      // Default: empty array
      return [];
    } catch (error) {
      
      // Return empty array on error to prevent crash
      return [];
    }
  }, [chatsFromAPI, chatsError, enquiries, chatsLoading, chatType1, isAdmin, user]);

  const loading = chatsLoading || enquiriesLoading;

  // Debug logs
  useEffect(() => {
    if (__DEV__) {
      try {
        console.log('🔍 USER DEBUG:', {
          userId: user?.id,
          roleId: roleId,
          roleString: user?.role,
          roleNumber: user?.roleNumber,
          isAdmin: isAdmin,
        });
        
        // Detailed API response debug
        if (chatsFromAPI1 && Array.isArray(chatsFromAPI1)) {
          console.log('🔍 CHATS API RESPONSE DEBUG (Type 1):', {
            count: chatsFromAPI1.length,
            chats: chatsFromAPI1.slice(0, 3).map(c => ({
              id: c.id || c._id,
              enquiryId: c.enquiryId || c.EnquiryId,
              type: c.type || c.Type,
              enquiryName: c.enquiryTitle || c.EnquiryName,
            })),
            allTypes: chatsFromAPI1.map(c => c.type || c.Type || 'unknown'),
          });
        } else {
          console.log('Chats from API (Type 1):', chatsFromAPI1 ? 'Not an array' : 'null/undefined');
        }
        
        if (chatsError1) {
          console.log('❌ Chats API Error (Type 1):', {
            status: chatsError1.status,
            originalStatus: chatsError1.originalStatus,
            message: chatsError1.message || chatsError1.data?.message,
          });
        }
        
        if (isAdmin) {
          console.log('Chats from API (Type 2):', Array.isArray(chatsFromAPI2) ? chatsFromAPI2.length : 'Not an array');
          if (chatsError2) {
            console.log('Chats API Error (Type 2):', {
              status: chatsError2.status,
              originalStatus: chatsError2.originalStatus,
              message: chatsError2.message || chatsError2.data?.message,
            });
          }
        }
        
        console.log('Merged Chats from API:', Array.isArray(chatsFromAPI) ? chatsFromAPI.length : 'Not an array');
        
        // Show chat types for debugging
        if (Array.isArray(chatsFromAPI) && chatsFromAPI.length > 0) {
          const chatTypes = chatsFromAPI.map(c => c.type || c.Type || 'unknown').filter(Boolean);
          const uniqueTypes = [...new Set(chatTypes)];
          if (!isAdmin && uniqueTypes.length > 1) {
          }
          if (!isAdmin && uniqueTypes.some(t => t.toLowerCase() !== chatType1.toLowerCase())) {
          }
        }
        
        // Enquiries debug
        if (enquiries && Array.isArray(enquiries)) {
          const userClientId = user?.clientId || user?.ClientId;
          console.log('🔍 ENQUIRIES DEBUG:', {
            count: enquiries.length,
            userClientId: userClientId || 'NOT AVAILABLE',
            sample: enquiries.slice(0, 3).map(e => ({
              id: e.id || e._id,
              enquiryClientId: e.clientId || e.ClientId,
              title: e.title || e.Name,
              matchesUser: userClientId ? (String(e.clientId || e.ClientId || '').trim() === String(userClientId).trim()) : 'unknown',
            })),
            allClientIds: [...new Set(enquiries.map(e => e.clientId || e.ClientId).filter(Boolean))],
          });
          
          // Warn if backend returned all enquiries for a client user
          if (roleId === 4 && enquiries.length > 10) {
            console.warn('⚠️ Backend should filter /api/enquiries by client ownership (ClientId)');
          }
        }
        
        console.log('Final Chats:', Array.isArray(chats) ? chats.length : 'Not an array');
        if (Array.isArray(chats) && chats.length > 0) {
          const finalTypes = [...new Set(chats.map(c => c.type || c.Type || c.chatType || 'unknown').filter(Boolean))];
        }
      } catch (error) {
      }
    }
  }, [chats, loading, chatsError, chatsFromAPI, chatsFromAPI1, chatsFromAPI2, enquiries, user, isAdmin, chatType1, chatType2, roleId, chatsError1, chatsError2]);

  // Apply search filter
  const filteredChats = useMemo(() => {
    try {
      // Ensure chats is an array
      if (!Array.isArray(chats)) {
        return [];
      }

      if (!searchQuery) {
        return chats;
      }

      const query = searchQuery.toLowerCase();
      return chats.filter(chat => {
        if (!chat) return false;
        return (
          chat.enquiryTitle?.toLowerCase().includes(query) ||
          chat.clientName?.toLowerCase().includes(query) ||
          chat.lastMessage?.toLowerCase().includes(query)
        );
      });
    } catch (error) {
      
      return Array.isArray(chats) ? chats : [];
    }
  }, [chats, searchQuery]);

  // newMessage / messagesRead list updates: see ChatListSocketSync + utils/chatListRealtimeCache.js

  // Listen to typing events from socket
  useEffect(() => {
    if (!user) return;

    const handleUserTyping = (data) => {
      if (__DEV__) {
        console.log('🔤 [ChatsScreen] Typing event received:', {
          chatId: data.chatId,
          userId: data.userId,
          isTyping: data.isTyping,
          userName: data.user?.name,
          hasUser: !!data.user,
        });
      }

      if (!data.chatId) {
        if (__DEV__) {
          console.warn('⚠️ [ChatsScreen] Typing event missing chatId:', data);
        }
        return;
      }

      const chatId = String(data.chatId).trim();
      const typingUserId = String(data.userId || '').trim();
      const currentUserId = String(user?.id || '').trim();

      // Ignore typing events from current user
      if (typingUserId === currentUserId) {
        if (__DEV__) {
          console.log('🔤 [ChatsScreen] Ignoring typing event from current user');
        }
        return;
      }

      // Clear existing timeout for this chat
      if (typingTimeoutsRef.current[chatId]) {
        clearTimeout(typingTimeoutsRef.current[chatId]);
        delete typingTimeoutsRef.current[chatId];
      }

      if (data.isTyping && data.user) {
        // Set typing status
        const userName = data.user.name || data.user.Name || data.user.email || data.user.Email || 'Someone';
        if (__DEV__) {
          console.log('✅ [ChatsScreen] Setting typing status:', {
            chatId,
            userName,
            isTyping: true,
          });
        }
        setTypingStatus(prev => ({
          ...prev,
          [chatId]: {
            isTyping: true,
            userName,
          },
        }));

        // Auto-clear after 3 seconds
        typingTimeoutsRef.current[chatId] = setTimeout(() => {
          if (__DEV__) {
            console.log('⏰ [ChatsScreen] Auto-clearing typing status after 3 seconds:', chatId);
          }
          setTypingStatus(prev => {
            const updated = { ...prev };
            if (updated[chatId]) {
              delete updated[chatId];
            }
            return updated;
          });
          delete typingTimeoutsRef.current[chatId];
        }, 3000);
      } else {
        // Clear typing status immediately
        if (__DEV__) {
          console.log('🔤 [ChatsScreen] Clearing typing status:', chatId);
        }
        setTypingStatus(prev => {
          const updated = { ...prev };
          if (updated[chatId]) {
            delete updated[chatId];
          }
          return updated;
        });
      }
    };

    // Ensure WebSocket is connected before subscribing
    if (!socketService.isConnected()) {
      if (__DEV__) {
        console.warn('⚠️ [ChatsScreen] WebSocket NOT connected for typing listener, attempting to connect...');
      }
      if (user?.id) {
        socketService.connect(user.id).then(() => {
          if (__DEV__) {
            console.log('✅ [ChatsScreen] WebSocket connected successfully for typing listener');
          }
        }).catch(err => {
          if (__DEV__) {
            console.error('❌ [ChatsScreen] Failed to connect WebSocket for typing listener:', err);
          }
        });
      }
    } else {
      if (__DEV__) {
        console.log('✅ [ChatsScreen] WebSocket already connected for typing listener');
      }
    }

    // Register socket listener immediately
    // Even if socket isn't connected yet, the listener will be active once it connects
    const unsubscribeTyping = socketService.on('userTyping', handleUserTyping);

    if (__DEV__) {
      console.log('✅ [ChatsScreen] Subscribed to userTyping WebSocket event', {
        timestamp: new Date().toISOString(),
        isConnected: socketService.isConnected(),
        userId: user?.id,
      });
    }

    return () => {
      // Cleanup
      if (unsubscribeTyping) {
        unsubscribeTyping();
        if (__DEV__) {
          console.log('🔌 [ChatsScreen] Unsubscribed from userTyping event');
        }
      }
      // Clear all timeouts
      Object.values(typingTimeoutsRef.current).forEach(timeout => clearTimeout(timeout));
      typingTimeoutsRef.current = {};
    };
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Reset pagination state
    setPage1(1);
    setPage2(1);
    setAllChats1([]);
    setAllChats2([]);
    setUseAccumulatedChats1(false);
    setUseAccumulatedChats2(false);
    setHasMore1(true);
    setHasMore2(true);
    hasLoadedMore1Ref.current = false; // Reset refs on refresh
    hasLoadedMore2Ref.current = false;
    // Invalidate cache before refreshing
    dispatch(api.util.invalidateTags(['Chat']));
    await refetchChats();
    setRefreshing(false);
  };

  // Safety check - don't render if user is not loaded
  if (!user) {
    return <AnimatedLogoLoader size={60} />;
  }

  // Safety check for navigation
  if (!navigation) {
    
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textPrimary }}>Navigation not available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderChatItem = (chat) => {
    if (!chat || !chat.id) {
      return null; // Skip invalid chat items
    }

    // Get unread count - check multiple sources
    const getUnreadCount = () => {
      let count = 0;
      let source = 'none';
      
      if (chat.unreadCount !== undefined && chat.unreadCount !== null) {
        count = Number(chat.unreadCount) || 0;
        source = 'chat.unreadCount';
      } else if (chat.UnreadCount !== undefined && chat.UnreadCount !== null) {
        count = Number(chat.UnreadCount) || 0;
        source = 'chat.UnreadCount';
      } else if (chat._originalData?.UnreadCount !== undefined && chat._originalData?.UnreadCount !== null) {
        count = Number(chat._originalData.UnreadCount) || 0;
        source = '_originalData.UnreadCount';
      } else if (chat._originalData?.unreadCount !== undefined && chat._originalData?.unreadCount !== null) {
        count = Number(chat._originalData.unreadCount) || 0;
        source = '_originalData.unreadCount';
      }
      
      // Debug logging to help diagnose missing unread counts
      if (__DEV__) {
        if (count > 0) {
          console.log('[ChatsScreen] ✅ Unread count found:', {
            chatId: chat.id,
            enquiryTitle: chat.enquiryTitle,
            unreadCount: count,
            source,
          });
        } else {
          // Log first few chats with 0 unread to see what's available
          const chatIndex = filteredChats.findIndex(c => c?.id === chat.id);
          if (chatIndex < 3) {
         
          }
        }
      }
      
      return count;
    };
    
    const unreadCount = getUnreadCount();

    const rawChatType = chat.Type || chat.type || '';
    const chatTypeLabel =
      rawChatType === 'admin-client'
        ? 'Client'
        : rawChatType === 'admin-designer'
          ? 'Designer'
          : null;

    const senderLabel = (() => {
      // Get last sender ID from multiple possible fields
      // Priority: Use normalized fields first (most reliable), then fall back to _originalData
      const lastSenderId = chat.lastMessageSenderId ||  // ✅ From API normalization (LastMessage.SenderId)
                          chat.lastSenderId || 
                          chat.LastMessageSender?.name ||
                          chat.LastSenderId || 
                          chat._originalData?.LastMessage?.SenderId ||  // ✅ Direct from backend response
                          chat._originalData?.LastMessage?.senderId ||
                          chat._originalData?.LastSenderId || 
                          chat._originalData?.lastSenderId ||
                          (chat._originalData?.LastMessage?.Sender && typeof chat._originalData.LastMessage.Sender === 'object'
                            ? (chat._originalData.LastMessage.Sender._id || chat._originalData.LastMessage.Sender.Id || chat._originalData.LastMessage.Sender.id)
                            : null) ||
                          (chat._originalData?.LastSender && typeof chat._originalData.LastSender === 'object' 
                            ? (chat._originalData.LastSender.Id || chat._originalData.LastSender._id || chat._originalData.LastSender.id || chat._originalData.LastSender.SenderId || chat._originalData.LastSender.senderId)
                            : null);
      
      // Check if last sender is the current user - if yes, show "You"
      if (lastSenderId && user?.id && String(lastSenderId).trim() === String(user.id).trim()) {
        return 'You';
      }
      
      // Check _originalData.LastMessage.SenderId directly
      const originalSenderId = chat._originalData?.LastMessage?.SenderId;
      if (originalSenderId && user?.id && String(originalSenderId).trim() === String(user.id).trim()) {
        return 'You';
      }
      
      // Try to get sender name from _originalData.LastMessage.Sender first
      const senderName = chat._originalData?.LastMessage?.Sender;
      if (senderName && typeof senderName === 'string' && senderName !== 'Unknown' && senderName !== 'Someone') {
        return senderName;
      }
      
      // If we have SenderId but no Sender name, look it up from cached users
      if (lastSenderId || originalSenderId) {
        const senderIdToLookup = lastSenderId || originalSenderId;
        const lookedUpName = getSenderNameFromId(senderIdToLookup);
        if (lookedUpName) {
          return lookedUpName;
        }
      }
      
      // Final fallback
      return senderName || 'Someone';
    })();

    try {
      return (
        <TouchableOpacity
          key={chat.id}
          style={styles.chatItem}
          onPress={() => {
            console.log('👆 [ChatsScreen] Chat item pressed:', {
              chatId: chat.isFallback ? null : (chat._id || chat.id),
              enquiryId: chat.enquiryId || chat.EnquiryId,
              chatType: chat.type || chat.Type || chat.chatType || chatType1,
              hasNavigation: !!navigation,
              canNavigate: !!(navigation && navigation.navigate)
            });
            try {
              if (navigation && navigation.navigate) {
                navigation.navigate('ChatDetail', {
                  chatId: chat.isFallback ? null : (chat._id || chat.id), // Don't pass enquiryId as chatId!
                  chat: chat.isFallback ? null : chat, 
                  enquiryId: chat.enquiryId || chat.EnquiryId,
                  chatType: chat.type || chat.Type || chat.chatType || chatType1
                });
              } else {
                console.error('❌ [ChatsScreen] Navigation object is missing or invalid');
              }
            } catch (navError) {
              console.error('❌ [ChatsScreen] Navigation error:', navError);
            }
          }}>
          
          <View style={styles.chatAvatar}>
            <Icon name="account" size={20} color={colors.textWhite} />
          </View>

          <View style={styles.chatContent}>
            <View style={styles.chatHeader}>
              <View style={styles.chatTitleBlock}>
                <Text style={styles.chatTitle} numberOfLines={1} ellipsizeMode="tail">
                  {chat.enquiryTitle || 'Untitled Chat'}
                </Text>
                {isAdmin && chatTypeLabel ? (
                  <Text style={styles.chatTypeLabel} numberOfLines={1}>
                    {chatTypeLabel}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.chatTime}>
                {chat.lastMessageTime ? formatShortTime(chat.lastMessageTime) : ''}
              </Text>
            </View>

            <View style={styles.chatFooter}>
              {(() => {
                const chatId = String(chat._id || chat.id || '').trim();
                const typing = typingStatus[chatId];
                
                // Show typing indicator if someone is typing
                if (typing?.isTyping && typing.userName) {
                  return (
                    <Text style={[styles.chatMessage, { fontStyle: 'italic', color: colors.primary }]}>
                      {typing.userName} is typing...
                    </Text>
                  );
                }
                
                // Otherwise show last message
                return (
                  <Text style={styles.chatMessage}>
                    {chat.lastMessage && typeof chat.lastMessage === 'string'
                      ? `${senderLabel}: ${truncateText(chat.lastMessage, 50)}`
                      : 'No messages yet'}
                  </Text>
                );
              })()}
              {/* Unread count badge on the right */}
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 99 ? '99+' : String(unreadCount)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    } catch (error) {
      
      return null; // Return null on error to prevent crash
    }
  };

  if (loading) {
    return <AnimatedLogoLoader size={80} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopNavbar navigation={navigation} />
      <View style={styles.header}>
        <SearchInput
          placeholder="Search chats..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery('')}
        />
      </View>

      <FlatList
        data={filteredChats.filter(chat => chat && chat.id)}
        renderItem={({ item }) => renderChatItem(item)}
        keyExtractor={(item) => String(item.id || item._id)}
        style={styles.scrollView}
        contentContainerStyle={filteredChats.length === 0 ? styles.emptyContainer : styles.chatsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={() => {
          if (__DEV__) {
            console.log('📜 [ChatsScreen] onEndReached triggered:', {
              isAdmin,
              hasMore1,
              hasMore2,
              isLoadingMore1,
              isLoadingMore2,
              currentCount1: allChats1.length,
              currentCount2: allChats2.length,
            });
          }
          // Load more when scrolling to bottom
          if (isAdmin && chatType2) {
            // For admins, load more from both types
            if (hasMore1 && !isLoadingMore1) {
              loadMoreChats1();
            }
            if (hasMore2 && !isLoadingMore2) {
              loadMoreChats2();
            }
          } else {
            // For non-admins, load more from type 1 only
            if (hasMore1 && !isLoadingMore1) {
              loadMoreChats1();
            }
          }
        }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <Card style={styles.emptyCard}>
            <Icon name="chat" size={40} color={colors.textLight} />
            <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fonts.base }]}>
              {searchQuery ? 'No chats found' : 'No chats available'}
            </Text>
            <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
              {searchQuery ? 'Try adjusting your search' : 'Start a conversation from an enquiry'}
            </Text>
          </Card>
        }
        ListFooterComponent={
          (isLoadingMore1 || isLoadingMore2) ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Loading more chats...</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    padding: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingFooter: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: fonts.sm,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
  },
  scrollView: {
    flex: 1,
  },
  chatsList: {
    padding: 16,
  },
  chatItem: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.cardShadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  chatTitleBlock: {
    flex: 1,
    marginRight: 8,
    paddingRight: 4,
  },
  chatTitle: {
    fontSize: 14, // Smaller font size
    fontFamily: fonts.semibold || fonts.bold,
    color: colors.textPrimary,
  },
  chatTypeLabel: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 2,
  },
  chatTime: {
    color: colors.textLight,
    fontSize: 11, // Smaller font size
    fontFamily: fonts.regular,
    marginTop: 2, // Align with title baseline
    flexShrink: 0, // Don't shrink, take minimal space
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  chatMessage: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: colors.textWhite,
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  emptyCard: {
    margin: 16,
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 16,
    marginBottom: 8,
  },
});

export default ChatsScreen;

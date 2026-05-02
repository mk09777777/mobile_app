import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Text,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useGetChatsByEnquiryV2Query } from '../../store/api';
import { AnimatedLogoLoader } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatChatDate, formatDateTime, truncateText } from '../../utils/helpers';
import { useUsers } from '../../features/users/usersHooks';

const ChatGroupsScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { enquiry, enquiryId } = route.params || {};
  const [refreshing, setRefreshing] = useState(false);
  const [focusedChat, setFocusedChat] = useState(null);
  const [renderError, setRenderError] = useState(null);
  
  // Fetch all users for sender name lookup
  const { users: usersList } = useUsers();
  const usersListRef = useRef([]); // Store all users list for sender name lookup
  
  // Store users list in ref
  useEffect(() => {
    if (usersList && usersList.length > 0) {
      usersListRef.current = usersList;
    }
  }, [usersList]);
  
  // Helper function to get sender name from userId using ref
  const getSenderNameFromUserId = useCallback((userId) => {

    console.log('getSenderNameFromUserId', userId, usersListRef.current);
    if (!userId || !usersListRef.current || usersListRef.current.length === 0) {
      return null;
    }
    
    const idStr = String(userId).trim();
    
    // Try to find user in usersListRef
    const foundUser = usersListRef.current.find(u => {
      const userIdFromList = String(u.id || u._id || '').trim();
      const noSpacesId = idStr.replace(/\s/g, '');
      const cleanId = idStr.replace(/^ObjectId\(/, '').replace(/\)$/, '').replace(/\s/g, '');
      return userIdFromList === idStr || userIdFromList === noSpacesId || userIdFromList === cleanId;
    });
    
    if (foundUser) {
      return foundUser.name || foundUser.Name || foundUser.email || foundUser.Email || null;
    }
    
    return null;
  }, []);
  
  // Memoize enquiry ID to prevent infinite loops
  const currentEnquiryId = useMemo(() => {
    const id = enquiryId || enquiry?.id || enquiry?._id;
    // Normalize to string and trim to ensure consistency
    return id ? String(id).trim() : null;
  }, [enquiryId, enquiry?.id, enquiry?._id]);
  
  
  
  // Fetch all chats for this enquiry (both admin-client and admin-designer)
  // Use stable query parameters to prevent unnecessary refetches
  const queryParams = useMemo(() => {
    if (!currentEnquiryId) return null;
    return { enquiryId: currentEnquiryId };
  }, [currentEnquiryId]);
  
  const { 
    data: chatsData, 
    isLoading, 
    error, 
    refetch 
  } = useGetChatsByEnquiryV2Query(
    queryParams,
    {
      skip: !queryParams || !currentEnquiryId,
      refetchOnFocus: false, // Disable to prevent infinite loops
    }
  );
  
  // Ensure chats is always an array
  const chats = Array.isArray(chatsData) ? chatsData : [];

  // Newest activity first (matches main Chats tab behaviour)
  const sortedChats = useMemo(() => {
    if (!Array.isArray(chats) || chats.length === 0) return chats;
    return [...chats].sort((a, b) => {
      try {
        const ta = new Date(
          a.lastMessageTime || a.LastMessage?.Timestamp || a.updatedAt || 0
        ).getTime();
        const tb = new Date(
          b.lastMessageTime || b.LastMessage?.Timestamp || b.updatedAt || 0
        ).getTime();
        return tb - ta;
      } catch {
        return 0;
      }
    });
  }, [chats]);

  
  if (__DEV__) {
    console.log('ChatGroupsScreen - Chats data:', {
      chatsData,
      chatsArray: chats,
      chatsLength: chats.length,
      isLoading,
      error: error ? { message: error.message, data: error.data } : null,
    });
  }
  
  // Show error if enquiryId is missing (after hooks)
  if (!currentEnquiryId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>Invalid Enquiry</Text>
          <Text style={styles.errorSubtext}>
            Enquiry ID is missing. Please go back and try again.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              if (navigation?.goBack) {
                navigation.goBack();
              }
            }}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  // Show render error if any
  if (renderError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>Something went wrong</Text>
          <Text style={styles.errorSubtext}>
            {renderError?.message || 'Please try again'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setRenderError(null);
              if (navigation?.goBack) {
                navigation.goBack();
              }
            }}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const roleLower = user?.role?.toLowerCase();
  const isAdmin =
    roleLower === 'admin' ||
    roleLower === 'ad' ||
    user?.roleId === 1 ||
    user?.roleNumber === 1;

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleChatPress = (chat) => {
    try {
      // Get the actual chat ID from multiple possible sources and normalize to string
      const chatId = String(chat?._id || chat?.id || chat?._originalData?._id || '').trim();
      const chatType = chat?.Type || chat?.type || chat?._originalData?.Type;
      
      if (!chatId) {
        
        return;
      }
      
      
      
      if (navigation?.navigate) {
        navigation.navigate('ChatDetail', {
          chatId: chatId, // Pass the specific chat ID
          chat: chat, // Pass the full chat object
          enquiry: enquiry,
          enquiryId: currentEnquiryId,
          chatType: chatType
        });
      }
    } catch (error) {
      
      setRenderError(error);
    }
  };
  

  const renderChatGroup = (chat) => {
    if (!chat) return null;
  
    // Normalize chat object (support both original + wrapped)
    const chatDataOriginal = chat?._originalData || chat;
  console.log('chatDataOriginal', chatDataOriginal);
    // -------------------------------
    // Fix: Chat ID extraction
    // -------------------------------
    const chatId = String(
      chatDataOriginal?._id ||
      chatDataOriginal?.id ||
      chat?._originalData?._id ||
      ''
    ).trim();
  
    // -------------------------------
    // Fix: Enquiry Name (your dataset uses EnquiryName)
    // -------------------------------
    const enquiryName =
      chatDataOriginal?.EnquiryName ||
      chatDataOriginal?.enquiryTitle ||
      chat?.enquiryTitle ||
      chat?._originalData?.EnquiryName ||
      'Untitled Chat';
  
    // -------------------------------
    // Fix: Chat Type
    // -------------------------------
    const chatType =
      chatDataOriginal?.Type ||
      chat?.type ||
      chat?._originalData?.Type ||
      '';
  
    // -------------------------------
    // Build chat title + type label (admins only; shown below title)
    // -------------------------------
    const chatTitle = enquiryName;
    const chatTypeLabel =
      chatType === 'admin-client'
        ? 'Client'
        : chatType === 'admin-designer'
          ? 'Designer'
          : null;
  
    // -------------------------------
    // Fix: Last Message
    // -------------------------------
    let lastMessage = 'No messages yet';
  
    if (chat?.LastMessage) {
      const senderId =
        chat.LastMessage?.SenderId?._id ||
        chat.LastMessage?.Sender?._id ||
        chat.LastMessage?.SenderId ||
        chat.LastMessage?.senderId;
  
      const messageText =
        chat.LastMessage?.Message ||
        chat.LastMessage?.message ||
        chat.LastMessage?.text ||
        chat.LastMessage?.Text ||
        'No message yet';
  
      // First try to get sender name from LastMessage object
      let senderName =
        chat.LastMessage?.SenderId?.name ||
        chat.LastMessage?.senderName ||
        '';

      console.log('senderName123456+=========', senderName, senderId , chat.LastMessage);
      
      // If sender name not available, look up from users list using senderId
      if (!senderName && senderId) {
        senderName = getSenderNameFromUserId(senderId);
      }
  
      lastMessage =
        String(senderId).trim() === String(user?.id).trim()
          ? `You: ${messageText}`
          : senderName
          ? `${senderName}: ${messageText}`
          : messageText;
    } else if (chat?.lastMessage) {
      lastMessage = chat.lastMessage; // fallback for string messages
    }
  
    // -------------------------------
    // Fix: Last Message Time
    // -------------------------------
    const lastMessageTime =
      chat?.LastMessage?.updatedAt
        ? formatChatDate(chat.LastMessage.updatedAt)
        : chat?.LastMessage?.Timestamp
        ? formatChatDate(chat.LastMessage.Timestamp)
        : chat?.lastMessageTime
        ? formatChatDate(chat.lastMessageTime)
        : '';
  
    // -------------------------------
    // Unread count + group flag
    // -------------------------------
    const unreadCount = chat.unreadCount || chat.UnreadCount || 0;
    const isGroup = chat.isGroup || chat.IsGroup || false;
  
    // -------------------------------
    // Focused Chat Handling
    // -------------------------------
    const normalizedFocusedChat = focusedChat ? String(focusedChat).trim() : null;
    const isFocused = normalizedFocusedChat === chatId;
  
    // -------------------------------
    // Render component
    // -------------------------------
    return (
      <TouchableOpacity
        style={[styles.chatItem, isFocused && styles.chatItemFocused]}
        onPress={() => handleChatPress(chat)}
        activeOpacity={0.7}
        onPressIn={() => setFocusedChat(chatId)}
        onPressOut={() => setFocusedChat(null)}
      >
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Icon name="group" size={24} color={colors.textWhite} />
          </View>
        </View>
  
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <View style={styles.chatTitleBlock}>
              <Text style={styles.chatTitle} numberOfLines={1}>
                {chatTitle}
              </Text>
              {isAdmin && chatTypeLabel ? (
                <Text style={styles.chatTypeLabel} numberOfLines={1}>
                  {chatTypeLabel}
                </Text>
              ) : null}
            </View>
            {lastMessageTime ? (
              <Text style={styles.chatTime}>{lastMessageTime}</Text>
            ) : null}
          </View>
  
          <View style={styles.chatFooter}>
            <Text style={styles.chatMessage} numberOfLines={1}>
              {lastMessage}
            </Text>
  
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading && sortedChats.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <AnimatedLogoLoader size={80} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>Failed to load chat groups</Text>
          <Text style={styles.errorSubtext}>
            {error?.data?.message || error?.message || 'Please try again'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => refetch()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Safety check - ensure we always return valid JSX
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <AnimatedLogoLoader size={80} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {sortedChats.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="chat-bubble-outline" size={64} color={colors.textLight} />
            <Text style={styles.emptyText}>No chat groups found</Text>
            <Text style={styles.emptySubtext}>
              Start a conversation to see chat groups here
            </Text>
          </View>
        ) : (
          <>
            {sortedChats
              .filter(chat => chat && (chat.id || chat._id)) // Filter out invalid chats
              .map((chat, index) => {
                try {
                  // Ensure each chat has a unique key - normalize to string
                  const chatId = String(chat.id || chat._id || chat._originalData?._id || `chat-${index}`).trim();
                  const renderedChat = renderChatGroup(chat);
                  // Only render if renderChatGroup returned something valid
                  if (!renderedChat) return null;
                  return (
                    <View key={chatId}>
                      {renderedChat}
                    </View>
                  );
                } catch (error) {
                  
                  return null;
                }
              })
              .filter(item => item !== null) // Remove null items
            }
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textWhite,
    textAlign: 'center',
    marginLeft: -40, // Compensate for back button width
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    shadowColor: colors.cardShadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatContent: {
    flex: 1,
    justifyContent: 'center',
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
  },
  chatTitle: {
    fontSize: fonts.base,
    fontFamily: fonts.bold,
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
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.textLight,
    marginLeft: 8,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatMessage: {
    flex: 1,
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadBadgeText: {
    fontSize: fonts.xs,
    fontFamily: fonts.bold,
    color: colors.textWhite,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textWhite,
  },
  chatItemFocused: {
    backgroundColor: '#b7c2c2',
  },
});

export default ChatGroupsScreen;


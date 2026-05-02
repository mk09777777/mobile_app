import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Text,
} from 'react-native';
import { Card } from '../../components/cards/Cards';
import Icon from '../../components/common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { formatDateTime } from '../../utils/helpers';

const NotificationsModal = ({ visible, onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    // Simulate loading notifications
    const notificationData = [
      {
        id: '1',
        title: 'New Enquiry Received',
        message: 'John Smith has submitted a new enquiry for Gold Necklace Design',
        timestamp: '2024-01-15T10:30:00Z',
        type: 'enquiry',
        isRead: false,
      },
      {
        id: '2',
        title: 'Design Approved',
        message: 'Your Diamond Ring design has been approved by the client',
        timestamp: '2024-01-15T09:15:00Z',
        type: 'approval',
        isRead: false,
      },
      {
        id: '3',
        title: 'Payment Received',
        message: 'Payment of ₹25,000 has been received for enquiry #123',
        timestamp: '2024-01-14T16:45:00Z',
        type: 'payment',
        isRead: true,
      },
      {
        id: '4',
        title: 'Chat Message',
        message: 'You have a new message from Sarah Johnson',
        timestamp: '2024-01-14T14:20:00Z',
        type: 'chat',
        isRead: true,
      },
      {
        id: '5',
        title: 'System Update',
        message: 'App has been updated to version 1.2.0 with new features',
        timestamp: '2024-01-13T11:00:00Z',
        type: 'system',
        isRead: true,
      },
    ];

    setNotifications(notificationData);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const markAsRead = (notificationId) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, isRead: true }))
    );
  };

  const getNotificationIcon = (type) => {
    const icons = {
      enquiry: 'enquiry',
      approval: 'check',
      payment: 'dashboard',
      chat: 'chat',
      system: 'info',
    };
    return icons[type] || 'notification';
  };

  const getNotificationColor = (type) => {
    const colors = {
      enquiry: colors.info,
      approval: colors.success,
      payment: colors.success,
      chat: colors.primary,
      system: colors.warning,
    };
    return colors[type] || colors.textSecondary;
  };

  const renderNotification = (notification) => (
    <TouchableOpacity
      key={notification.id}
      style={[
        styles.notificationItem,
        !notification.isRead && styles.unreadNotification,
      ]}
      onPress={() => markAsRead(notification.id)}>
      
      <View style={styles.notificationIcon}>
        <Icon 
          name={getNotificationIcon(notification.type)} 
          size={20} 
          color={getNotificationColor(notification.type)} 
        />
      </View>

      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text
            style={[
              styles.notificationTitle,
              { color: colors.textPrimary, fontSize: fonts.base },
              !notification.isRead && styles.unreadText,
            ]}>
            {notification.title}
          </Text>
          <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
            {formatDateTime(notification.timestamp)}
          </Text>
        </View>

        <Text style={[styles.notificationMessage, { color: colors.textSecondary, fontSize: fonts.base }]}>
          {notification.message}
        </Text>
      </View>

      {!notification.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={{ fontSize: fonts['2xl'], fontWeight: 'bold', color: colors.textPrimary }}>
              Notifications
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={{ color: colors.textWhite, fontSize: fonts.sm }}>
                  {unreadCount}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
                <Text style={{ color: colors.primary, fontSize: fonts.sm }}>
                  Mark all read
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={{ fontSize: 20, color: colors.textPrimary }}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }>
          
          {notifications.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={{ fontSize: 40, color: colors.textLight }}>🔕</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fonts.base }]}>
                No notifications
              </Text>
              <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
                You're all caught up!
              </Text>
            </Card>
          ) : (
            <View style={styles.notificationsList}>
              {notifications.map(renderNotification)}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadBadge: {
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 12,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  notificationsList: {
    padding: 16,
  },
  notificationItem: {
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
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  notificationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontWeight: '500',
    flex: 1,
  },
  unreadText: {
    fontWeight: 'bold',
  },
  notificationMessage: {
    lineHeight: fonts.lineHeight.normal,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
    alignSelf: 'center',
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

export default NotificationsModal;

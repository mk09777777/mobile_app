import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Icon from '../common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';

const ChatHeader = ({ 
  title, 
  clientName, 
  isLoadingEnquiry, 
  onBack, 
  onInfo,
  isValidClientName 
}) => {
  const clientInitial = clientName?.charAt(0)?.toUpperCase() || 'C';

  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={onBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icon name="arrow-left" size={24} color={colors.textWhite} />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.headerAvatarContainer}
        activeOpacity={0.7}
      >
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>
            {clientInitial}
          </Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.headerText}>
        <Text style={styles.chatTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.clientName} numberOfLines={1}>
          {isLoadingEnquiry && !clientName ? 'Loading...' : clientName}
        </Text>
      </View>
      
      <View style={styles.headerActions}>
        <TouchableOpacity 
          style={styles.headerIconButton}
          onPress={onInfo}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="info" size={20} color={colors.textWhite} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 24,
    paddingBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarContainer: {
    marginRight: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.textWhite + '30',
  },
  headerAvatarText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  headerText: {
    flex: 1,
    justifyContent: 'center',
  },
  chatTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.textWhite,
    marginBottom: 2,
  },
  clientName: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textWhite,
    opacity: 0.85,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerIconButton: {
    padding: 8,
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChatHeader;



























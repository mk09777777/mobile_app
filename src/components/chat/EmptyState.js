import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from '../common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';

const EmptyState = ({ loading, error }) => {
  if (loading) {
    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fonts.base }]}>
          Loading messages...
        </Text>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.emptyState}>
        <Icon name="error" size={40} color={colors.error} />
        <Text style={[styles.emptyText, { color: colors.error, fontSize: fonts.base }]}>
          Error loading messages
        </Text>
        <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
          {error?.data?.error || error?.message || 'Unknown error'}
        </Text>
      </View>
    );
  }
  
  return (
    <View style={styles.emptyState}>
      <Icon name="chat" size={40} color={colors.textLight} />
      <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fonts.base }]}>
        Start the conversation
      </Text>
      <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
        Send a message to begin chatting about this enquiry
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 16,
    marginBottom: 8,
  },
});

export default EmptyState;








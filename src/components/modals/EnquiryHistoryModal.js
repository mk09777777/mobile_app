import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Text,
} from 'react-native';
import { Card } from '../../components/cards/Cards';
import Icon from '../../components/common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { formatDateTime, formatHistoryDetails } from '../../utils/helpers';
import { useUsers } from '../../features/users/usersHooks';
import { getUserName } from '../../utils/userUtils';

const EnquiryHistoryModal = ({ visible, onClose, enquiry }) => {
  // Fetch and cache users
  useUsers();

  // Extract StatusHistory from enquiry
  const statusHistory = enquiry?.StatusHistory || enquiry?._originalData?.StatusHistory || [];
  
  // Sort history by timestamp (oldest first, newest last)
  const sortedHistory = useMemo(() => {
    return [...statusHistory].sort((a, b) => {
      const dateA = new Date(a.Timestamp || a.timestamp || 0);
      const dateB = new Date(b.Timestamp || b.timestamp || 0);
      return dateA - dateB; // Ascending order (oldest first, newest last)
    });
  }, [statusHistory]);

  const renderHistoryItem = (item, index) => {
    const status = item.Status || item.status || 'N/A';
    const rawDetails = item.Details || item.details || '';
    const assignedToId = item.AssignedTo || item.assignedTo || '';
    const addedById = item.AddedBy || item.addedBy || '';
    const timestamp = item.Timestamp || item.timestamp || '';
    
    // Format details for better readability
    const formattedDetails = formatHistoryDetails(rawDetails);
    
    // Get names from IDs using cached users
    const assignedToName = getUserName(assignedToId);
    const addedByName = getUserName(addedById);
    
    return (
      <View key={index} style={styles.historyItem}>
        <View style={styles.historyRow}>
          <View style={styles.column}>
            <Text style={[styles.columnLabel, { color: colors.textSecondary, fontSize: 11 }]}>
              Status
            </Text>
            <Text style={[styles.columnValue, { color: colors.textPrimary, fontSize: 13 }]}>
              {status}
            </Text>
          </View>
          
          <View style={[styles.column, styles.detailsColumn]}>
            <Text style={[styles.columnLabel, { color: colors.textSecondary, fontSize: 11 }]}>
              Details
            </Text>
            <Text style={[styles.columnValue, styles.detailsValue, { color: colors.textSecondary, fontSize: 13 }]}>
              {formattedDetails || '-'}
            </Text>
          </View>
          
          <View style={styles.column}>
            <Text style={[styles.columnLabel, { color: colors.textSecondary, fontSize: 11 }]}>
              Assigned To
            </Text>
            <Text style={[styles.columnValue, { color: colors.textPrimary, fontSize: 13 }]}>
              {assignedToName || '-'}
            </Text>
          </View>
          
          <View style={styles.column}>
            <Text style={[styles.columnLabel, { color: colors.textSecondary, fontSize: 11 }]}>
              Added By
            </Text>
            <Text style={[styles.columnValue, { color: colors.textPrimary, fontSize: 13 }]}>
              {addedByName || 'N/A'}
            </Text>
          </View>
          
          <View style={styles.column}>
            <Text style={[styles.columnLabel, { color: colors.textSecondary, fontSize: 11 }]}>
              Timestamp
            </Text>
            <Text style={[styles.columnValue, { color: colors.textSecondary, fontSize: 13 }]}>
              {timestamp ? formatDateTime(timestamp) : '-'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.textPrimary }}>
            Enquiry History
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={{ fontSize: 20, color: colors.textPrimary }}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {sortedHistory.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Icon name="history" size={40} color={colors.textLight} />
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fonts.base }]}>
                No history available
              </Text>
              <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
                History will appear here as the enquiry progresses
              </Text>
            </Card>
          ) : (
            <View style={styles.historyContainer}>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerText, { color: colors.textSecondary, fontSize: 11, fontWeight: '600' }]}>
                  STATUS
                </Text>
                <Text style={[styles.headerText, { color: colors.textSecondary, fontSize: 11, fontWeight: '600' }]}>
                  DETAILS
                </Text>
                <Text style={[styles.headerText, { color: colors.textSecondary, fontSize: 11, fontWeight: '600' }]}>
                  ASSIGNED TO
                </Text>
                <Text style={[styles.headerText, { color: colors.textSecondary, fontSize: 11, fontWeight: '600' }]}>
                  ADDED BY
                </Text>
                <Text style={[styles.headerText, { color: colors.textSecondary, fontSize: 11, fontWeight: '600' }]}>
                  TIMESTAMP
                </Text>
              </View>
              
              {sortedHistory.map((item, index) => renderHistoryItem(item, index))}
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
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  historyContainer: {
    padding: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyItem: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  column: {
    flex: 1,
    minWidth: 100,
    marginBottom: 4,
  },
  detailsColumn: {
    flex: 1.5,
    minWidth: 150,
  },
  columnLabel: {
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  columnValue: {
    lineHeight: 18,
  },
  detailsValue: {
    flexWrap: 'wrap',
    lineHeight: 20,
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

export default EnquiryHistoryModal;


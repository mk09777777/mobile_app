import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGetStatusStatisticsQuery } from '../../store/api';
import { Card } from '../../components/cards/Cards';
import { AnimatedLogoLoader } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { Heading, CustomText } from '../../components/common/Text';
import Icon from '../../components/common/Icon';

const StatusStatisticsScreen = ({ navigation }) => {
  const { data: statusData, isLoading, refetch, isFetching, error } = useGetStatusStatisticsQuery();

  // Debug: Log the data being fetched
  React.useEffect(() => {
    if (__DEV__) {
      if (statusData?.statusStats) {
      }
    }
  }, [statusData, isLoading, isFetching, error]);

  const onRefresh = React.useCallback(() => {
    refetch();
  }, [refetch]);

  // Map status names to display names
  const getStatusDisplayName = (statusName) => {
    const statusMap = {
      'ENQUIRY CREATED': 'Enquiry Created',
      'CORAL': 'Coral',
      'CAD': 'CAD',
      'DESIGN APPROVAL PENDING': 'Design Approval Pending',
      'APPROVED CAD': 'Approved Cad',
      'ORDER PLACEMENT': 'Order Placement',
      'CAM PENDING': 'CAM Pending',
      'PRODUCTION': 'Production',
    };
    
    const upperStatus = statusName.toUpperCase();
    return statusMap[upperStatus] || statusName;
  };

  // Get status color
  const getStatusColor = (statusName) => {
    const upperStatus = statusName.toUpperCase();
    if (upperStatus.includes('CORAL')) return colors.primary;
    if (upperStatus.includes('CAD')) return colors.info;
    if (upperStatus.includes('APPROVAL')) return colors.warning;
    if (upperStatus.includes('APPROVED')) return colors.success;
    if (upperStatus.includes('ORDER') || upperStatus.includes('PLACEMENT')) return colors.accent;
    if (upperStatus.includes('CAM')) return colors.secondary;
    if (upperStatus.includes('PRODUCTION')) return colors.error;
    return colors.textSecondary;
  };

  const renderStatusCard = (statusName, count) => {
    const displayName = getStatusDisplayName(statusName);
    const statusColor = getStatusColor(statusName);

    return (
      <Card key={statusName} style={[styles.statusCard, { borderLeftColor: statusColor }]}>
        <View style={styles.statusCardContent}>
          <Text style={styles.statusLabel} numberOfLines={2}>
            {displayName}
          </Text>
          <Text style={[styles.statusValue, { color: statusColor }]}>
            {count || 0}
          </Text>
        </View>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <AnimatedLogoLoader size={80} />
      </SafeAreaView>
    );
  }

  const statusStats = statusData?.statusStats || [];
  const totalCount = statusStats.reduce((sum, item) => sum + (item.count || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={onRefresh} />
        }
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Enquiries</Text>
          <Text style={styles.summaryValue}>{totalCount}</Text>
        </View>

        <View style={styles.statusGrid}>
          {statusStats.length > 0 ? (
            statusStats.map((item) => {
              const statusName = item.name || item.status || item.Status || '';
              const count = item.count || item.Count || item.value || 0;
              return renderStatusCard(statusName, count);
            })
          ) : (
            <Card style={styles.emptyCard}>
              <Icon name="info" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>No status data available</Text>
            </Card>
          )}
        </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fonts.lg || 18,
    fontFamily: fonts.bold,
    color: colors.textWhite,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  summaryLabel: {
    fontSize: fonts.base || 16,
    fontFamily: fonts.medium,
    color: colors.textWhite,
    opacity: 0.95,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 40,
    fontFamily: fonts.bold,
    color: colors.textWhite,
    lineHeight: 48,
    letterSpacing: 0.5,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusCard: {
    width: '48%',
    padding: 16,
    backgroundColor: colors.textWhite,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  statusCardContent: {
    alignItems: 'flex-start',
  },
  statusLabel: {
    fontSize: fonts.sm || 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    marginBottom: 8,
    minHeight: 36,
  },
  statusValue: {
    fontSize: fonts.xxl || 28,
    fontFamily: fonts.bold,
  },
  emptyCard: {
    width: '100%',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: fonts.base || 16,
    fontFamily: fonts.medium,
    color: colors.textLight,
    marginTop: 16,
  },
});

export default StatusStatisticsScreen;


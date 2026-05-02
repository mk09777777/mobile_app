import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../../constants/colors';
import { fonts } from '../../../constants/fonts';
import useDeviceLayout from '../../../hooks/useDeviceLayout';

const DiamondRow = React.memo(({ diamond, index, onPress, onDelete }) => {
  const { isTablet } = useDeviceLayout();

  if (isTablet) {
    return (
      <TouchableOpacity
        style={[styles.tabletRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]}
        onPress={() => onPress(index, diamond)}
        activeOpacity={0.7}
      >
        <View style={[styles.tabletCell, { width: '15%' }]}>
          <Text style={styles.tabletText}>{diamond.Shape || '-'}</Text>
        </View>
        <View style={[styles.tabletCell, { width: '15%', alignItems: 'flex-end' }]}>
          <Text style={styles.tabletText}>{diamond.MmSize ?? '-'}</Text>
        </View>
        <View style={[styles.tabletCell, { width: '20%', alignItems: 'flex-end' }]}>
          <Text style={styles.tabletText}>{diamond.SieveSize || '-'}</Text>
        </View>
        <View style={[styles.tabletCell, { width: '15%', alignItems: 'flex-end' }]}>
          <Text style={styles.tabletText}>{diamond.Carat ?? '-'}</Text>
        </View>
        <View style={[styles.tabletCell, { width: '15%', alignItems: 'flex-end' }]}>
          <Text style={styles.tabletText}>{diamond.Price ?? '-'}</Text>
        </View>
        <View style={[styles.tabletCell, { width: '20%', flexDirection: 'row', justifyContent: 'center', gap: 12 }]}>
          <TouchableOpacity onPress={() => onPress(index, diamond)} style={styles.actionIcon}>
            <Icon name="edit" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(index)} style={styles.actionIcon}>
            <Icon name="delete" size={20} color={colors.error || '#F44336'} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => onPress(index, diamond)}
      style={[styles.rowContainer, index % 2 === 0 ? styles.evenRow : styles.oddRow]}
      activeOpacity={0.85}
    >
      <View style={styles.infoContainer}>
        <Text style={styles.typeText}>{diamond.Shape || '-'}</Text>
      </View>
      <View style={styles.metricsContainer}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Mm size</Text>
          <Text style={styles.metricValue}>{diamond.MmSize ?? '-'}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Sieve</Text>
          <Text style={styles.metricValue}>{diamond.SieveSize || '-'}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Carat</Text>
          <Text style={styles.metricValue}>{diamond.Carat ?? '-'}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Price</Text>
          <Text style={styles.metricValue}>{diamond.Price ?? '-'}</Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => onDelete(index)}
        style={styles.deleteButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icon name="delete" size={18} color={colors.error || '#F44336'} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}, (prev, next) => {
  return (
    prev.diamond === next.diamond &&
    prev.index === next.index
  );
});

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 50,
  },
  tabletCell: {
    paddingHorizontal: 4,
  },
  tabletText: {
    fontSize: fonts.sm,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
  },
  actionIcon: {
    padding: 4,
  },
  evenRow: {
    backgroundColor: colors.white,
  },
  oddRow: {
    backgroundColor: colors.background,
  },
  infoContainer: {
    flex: 1,
  },
  typeText: {
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  metricsContainer: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  metric: {
    alignItems: 'flex-end',
  },
  metricLabel: {
    fontSize: fonts.xs || 11,
    color: colors.textSecondary,
  },
  metricValue: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  deleteButton: {
    marginLeft: 16,
    padding: 4,
  },
});

export default DiamondRow;
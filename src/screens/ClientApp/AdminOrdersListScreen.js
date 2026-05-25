import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../constants/colors';
import catalogApi from '../../services/catalogApi';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'order_received', label: 'Received' },
  { key: 'order_confirmed', label: 'Confirmed' },
  { key: 'order_in_production', label: 'Production' },
  { key: 'order_shipped', label: 'Shipped' },
  { key: 'order_delivered', label: 'Delivered' },
  { key: 'order_cancelled', label: 'Cancelled' },
];

const STATUS_CONFIG = {
  order_received:    { bg: '#FEF3C7', text: '#92400E', accent: '#F59E0B', label: 'Received' },
  order_confirmed:   { bg: '#DBEAFE', text: '#1D4ED8', accent: '#3B82F6', label: 'Confirmed' },
  order_in_production:{ bg: '#EDE9FE', text: '#5B21B6', accent: '#8B5CF6', label: 'Production' },
  order_shipped:     { bg: '#D1FAE5', text: '#065F46', accent: '#10B981', label: 'Shipped' },
  order_delivered:   { bg: '#CFFAFE', text: '#155E75', accent: '#06B6D4', label: 'Delivered' },
  order_cancelled:   { bg: '#FEE2E2', text: '#991B1B', accent: '#EF4444', label: 'Cancelled' },
};

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
};

function AdminOrderCard({ order, onPress }) {
  const cfg = STATUS_CONFIG[order.status] || { bg: '#F3F4F6', text: '#374151', accent: '#9CA3AF', label: order.status };
  const itemCount = order.items?.length || 0;
  const totalPieces = order.items?.reduce((s, i) => s + Number(i.quantity || 0), 0) || 0;
  const clientLabel = order.clientName || order.clientUsername || 'Unknown Client';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(order)}
      activeOpacity={0.75}>
      {/* Status accent bar */}
      <View style={[styles.cardAccent, { backgroundColor: cfg.accent }]} />

      <View style={styles.cardBody}>
        {/* Top row: client name + status badge */}
        <View style={styles.cardTopRow}>
          <Text style={styles.clientName} numberOfLines={1}>{clientLabel}</Text>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.statusBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Order number + date */}
        <View style={styles.cardMidRow}>
          <Text style={styles.orderNum} numberOfLines={1}>{order.orderNumber || order._id}</Text>
          <Text style={styles.cardDate}>{formatDate(order.createdAt)}</Text>
        </View>

        {/* Footer: meta + chevron */}
        <View style={styles.cardFooter}>
          <Text style={styles.cardMeta}>
            {itemCount} item{itemCount !== 1 ? 's' : ''}
            {'  ·  '}
            {totalPieces} pcs
          </Text>
          <MaterialIcons name="chevron-right" size={20} color="#9BAAB3" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const AdminOrdersListScreen = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const res = await catalogApi.get('/admin/orders');
      setOrders(Array.isArray(res?.orders) ? res.orders : []);
    } catch (err) {
      setError(err?.message || 'Could not load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders]),
  );

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const countByStatus = useMemo(() => {
    const counts = {};
    orders.forEach((o) => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return counts;
  }, [orders]);

  const handleOrderPress = useCallback(
    (order) => {
      navigation.navigate('AdminOrderDetails', { orderId: order._id, order });
    },
    [navigation],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={navigation.goBack} style={styles.iconBtn} activeOpacity={0.8}>
          <MaterialIcons name="chevron-left" size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>All Orders</Text>
        </View>
        <TouchableOpacity onPress={() => loadOrders(true)} style={styles.iconBtn} activeOpacity={0.8}>
          <MaterialIcons name="refresh" size={22} color="#4B6E78" />
        </TouchableOpacity>
      </View>

      {/* Filter bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}>
        {STATUS_FILTERS.map((f) => {
          const count = f.key === 'all' ? orders.length : (countByStatus[f.key] || 0);
          const isActive = statusFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => setStatusFilter(f.key)}
              activeOpacity={0.75}>
              <Text style={[styles.filterPillLabel, isActive && styles.filterPillLabelActive]}>
                {f.label}
              </Text>
              {count > 0 && (
                <Text style={[styles.filterPillCount, isActive && styles.filterPillCountActive]}>
                  {count}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Total line */}
      {!loading && !error && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
            {statusFilter !== 'all' ? ` · ${orders.length} total` : ''}
          </Text>
        </View>
      )}

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading orders…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => loadOrders()} style={styles.retryBtn} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item._id || item.orderNumber}
          renderItem={({ item }) => <AdminOrderCard order={item} onPress={handleOrderPress} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <MaterialIcons name="inbox" size={44} color="#C8D5DC" />
              <Text style={styles.emptyText}>
                {statusFilter === 'all'
                  ? 'No orders yet.'
                  : `No ${STATUS_FILTERS.find(f => f.key === statusFilter)?.label?.toLowerCase() || ''} orders.`}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadOrders(true)} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F3F5',
  },

  // Header
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDE4EA',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.2,
  },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filter bar
  filterBar: {
    backgroundColor: '#E8EDF1',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D0D9E0',
    height: 56,
  },
  filterBarContent: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C8D3DA',
  },
  filterPillActive: {
    backgroundColor: '#1A5560',
    borderColor: '#1A5560',
  },
  filterPillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2A3D4A',
  },
  filterPillLabelActive: {
    color: '#FFFFFF',
  },
  filterPillCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7A8F9A',
  },
  filterPillCountActive: {
    color: 'rgba(255,255,255,0.65)',
  },

  // Summary
  summaryRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  summaryText: {
    fontSize: 12,
    color: '#7A8F9A',
    fontWeight: '500',
  },

  // List
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 28,
    gap: 8,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    flexDirection: 'row',
    overflow: 'hidden',
    // shadow
    shadowColor: '#1A3040',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  cardAccent: {
    width: 4,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 5,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  clientName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.1,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardMidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  orderNum: {
    flex: 1,
    fontSize: 12,
    color: '#2D6172',
    fontWeight: '500',
  },
  cardDate: {
    fontSize: 12,
    color: '#94A3AE',
  },
  cardFooter: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EDF0F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMeta: {
    fontSize: 13,
    color: '#4D6470',
    fontWeight: '500',
  },

  // States
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    color: '#7A8F9A',
  },
  errorText: {
    fontSize: 14,
    color: colors.error || '#C05252',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 14,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1A5560',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyWrap: {
    marginTop: 60,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3AE',
  },
});

export default AdminOrdersListScreen;

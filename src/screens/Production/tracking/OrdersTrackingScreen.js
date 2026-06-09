import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, TextInput, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../constants/colors';
import { fonts } from '../../../constants/fonts';
import Icon from '../../../components/common/Icon';
import { getOrdersDashboard } from '../../../services/productionApi';
import { formatDate } from '../../../utils/helpers';

const STATUS_COLORS = {
  in_progress:           colors.info,
  completed:             colors.success,
  on_hold:               colors.warning,
  cancelled:             colors.error,
  pending:               colors.textSecondary,
  proceed_cancel:        '#E53935',
  proceed_po:            '#7B1FA2',
  proceed_stock_assign:  '#1565C0',
  proceed_manufacturer:  '#2E7D32',
  proceed_pending:       '#F57F17',
};

const STATUS_LABELS = {
  in_progress:           'In Progress',
  completed:             'Completed',
  on_hold:               'On Hold',
  cancelled:             'Cancelled',
  pending:               'Pending',
  proceed_cancel:        'Proceed Cancel',
  proceed_po:            'Proceed PO',
  proceed_stock_assign:  'Proceed Stock',
  proceed_manufacturer:  'Proceed Mfr',
  proceed_pending:       'Proceed Pending',
};
const PRIORITY_COLORS = { critical: colors.error, urgent: colors.warning, normal: colors.info };

const HOLD_STAGE_CODES_SET = new Set(['HOLD', 'JW']);

/**
 * If order status is "on_hold" but the stage distribution has active (non-hold) stages,
 * display "in_progress" instead — on_hold is only meaningful when ALL pieces are held.
 */
const resolveOrderDisplayStatus = (order) => {
  if (!order) return 'pending';
  if (order.status === 'on_hold') {
    const dist = order.stageDistribution ?? [];
    const hasActive = dist.some(s => !HOLD_STAGE_CODES_SET.has(s.stageCode));
    if (hasActive) return 'in_progress';
  }
  return order.status;
};

const StagePill = ({ stage, qty }) => (
  <View style={[styles.stagePill, HOLD_STAGE_CODES_SET.has(stage) && styles.stagePillHold]}>
    <Text style={[styles.stagePillText, HOLD_STAGE_CODES_SET.has(stage) && styles.stagePillTextHold]}>
      {stage}: {qty}
    </Text>
  </View>
);

const OrderRow = React.memo(({ order, onPress }) => {
  const displayStatus = resolveOrderDisplayStatus(order);
  const statusColor = STATUS_COLORS[displayStatus] || colors.textSecondary;
  const isLate = order.worstLatenessDays > 0;
  const pct = order.totalQty > 0 ? Math.round((order.completedCount / order.totalPieces) * 100) : 0;

  return (
    <TouchableOpacity
      style={[styles.orderCard, isLate && styles.orderCardLate]}
      onPress={() => onPress(order)}
      activeOpacity={0.85}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderLeft}>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <Text style={styles.orderCustomer}>{order.customerCode}</Text>
        </View>
        <View style={styles.orderRight}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {STATUS_LABELS[displayStatus] ?? displayStatus?.replace(/_/g, ' ')}
            </Text>
          </View>
          {displayStatus !== order.status && (
            <Text style={styles.holdNote}>some on hold</Text>
          )}
          {order.priority && order.priority !== 'normal' && (
            <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[order.priority] + '22' }]}>
              <Text style={[styles.priorityText, { color: PRIORITY_COLORS[order.priority] }]}>{order.priority?.toUpperCase()}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.orderStats}>
        <Text style={styles.statItem}>{order.totalPieces} pieces · {order.totalQty} qty</Text>
        {isLate && <Text style={styles.lateText}>⚠️ {order.worstLatenessDays}d late</Text>}
        <Text style={styles.statItem}>Due {formatDate(order.expectedDeliveryAt)}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: isLate ? colors.error : colors.success }]} />
      </View>
      <Text style={styles.progressText}>{order.completedCount}/{order.totalPieces} completed</Text>

      {/* Stage distribution */}
      {order.stageDistribution?.length > 0 && (
        <View style={styles.stages}>
          {order.stageDistribution.slice(0, 5).map(s => (
            <StagePill key={s.stageCode} stage={s.stageCode} qty={s.qty} />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
});

const FILTERS = [
  'all', 'in_progress', 'on_hold', 'completed',
  'proceed_cancel', 'proceed_po', 'proceed_stock_assign',
  'proceed_manufacturer', 'proceed_pending',
];

const OrdersTrackingScreen = ({ navigation, route }) => {
  const initFilter = route?.params?.filter === 'late' ? 'late' : 'all';
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState(initFilter);
  const [search, setSearch] = useState('');
  const filterScrollRef = useRef(null);
  const filterOffsets = useRef({});
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(handler);
  }, [search]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const filteredOrders = useMemo(() => {
    if (!search) return orders;
    const q = search.toLowerCase();
    return orders.filter(o =>
      o.orderNumber?.toLowerCase().includes(q) ||
      o.customerCode?.toLowerCase().includes(q) ||
      o.gatiPieceCode?.toLowerCase().includes(q)
    );
  }, [orders, search]);

  // pageRef lets load() always read the current page without being a dep
  const pageRef = useRef(0);
  // Skip the useEffect on first mount — useFocusEffect handles the initial load
  const isFirstMount = useRef(true);

  const load = useCallback(async (reset = false) => {
    const skip = reset ? 0 : pageRef.current * 20;
    try {
      const params = { limit: 20, skip };
      if (filter !== 'all' && filter !== 'late') params.status = filter;
      if (filter === 'late') params.isLate = 'true';
      if (debouncedSearch) params.search = debouncedSearch;
      const data = await getOrdersDashboard(params);
      if (__DEV__) {
        console.log('[Tracking] orders response keys:', Object.keys(data || {}));
        console.log('[Tracking] total:', data?.total, '| count:', data?.items?.length ?? 0, '| raw:', JSON.stringify(data)?.slice(0, 500));
      }
      const list = data?.items || data?.orders || (Array.isArray(data) ? data : []);
      if (__DEV__) {
        console.log('[Tracking] list length:', list.length);
        if (list[0]) console.log('[Tracking] order[0] keys:', Object.keys(list[0]), '| order[0]:', JSON.stringify(list[0])?.slice(0, 400));
      }
      if (reset) {
        pageRef.current = 1;
        setOrders(list);
      } else {
        pageRef.current += 1;
        setOrders(prev => [...prev, ...list]);
      }
      setHasMore(list.length === 20);
    } catch (e) {
      if (__DEV__) console.error('[Tracking] load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, debouncedSearch]);

  // Reload when filter or search changes while screen is already visible.
  // Skips the very first render — useFocusEffect handles the initial load.
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    setLoading(true);
    setPage(0);
    pageRef.current = 0;
    load(true);
  }, [filter, debouncedSearch]);

  // Handles both initial load AND reload when user navigates back to this screen.
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setPage(0);
      pageRef.current = 0;
      setOrders([]);
      load(true);
    }, [load])
  );


  const handlePressOrder = useCallback(
    o => navigation.navigate('OrderDetail', { orderNumber: o.orderNumber }),
    [navigation]
  );

  const renderOrder = useCallback(
    ({ item }) => <OrderRow order={item} onPress={handlePressOrder} />,
    [handlePressOrder]
  );

  if (loading && orders.length === 0) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by customer code…"
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.textLight}
          />
        </View>
        <TouchableOpacity style={styles.allPiecesBtn} onPress={() => navigation.navigate('AllPieces')}>
          <Icon name="list" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter tabs — horizontal scrollable, auto-scrolls to active tab */}
      <ScrollView
        ref={filterScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {[...FILTERS, 'late'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onLayout={e => { filterOffsets.current[f] = e.nativeEvent.layout.x; }}
            onPress={() => {
              setFilter(f);
              const x = filterOffsets.current[f] ?? 0;
              filterScrollRef.current?.scrollTo({ x: Math.max(0, x - 12), animated: true });
            }}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f === 'late' ? 'Late' : (STATUS_LABELS[f] ?? f.replace(/_/g, ' '))}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredOrders}
        keyExtractor={o => o.orderNumber}
        renderItem={renderOrder}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setPage(0); load(true); }} colors={[colors.primary]} />}
        onEndReached={() => hasMore && load()}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="layers" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No orders found</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ImportOrders')}>
              <Text style={styles.emptyLink}>Import order file to get started</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchRow: { flexDirection: 'row', padding: 12, gap: 10, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.backgroundSecondary, borderRadius: 10, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, marginLeft: 8, fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textPrimary },
  allPiecesBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.backgroundSecondary, borderRadius: 10 },
  filterScroll: { backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border, height: 48, flexGrow: 0, flexShrink: 0 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center' },
  filterTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.backgroundSecondary },
  filterTabActive: { backgroundColor: colors.primary },
  filterText: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textSecondary },
  filterTextActive: { color: '#fff' },
  orderCard: {
    backgroundColor: colors.background, borderRadius: 12, padding: 14,
    elevation: 1, borderLeftWidth: 3, borderLeftColor: 'transparent',
  },
  orderCardLate: { borderLeftColor: colors.error },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  orderLeft: { flex: 1 },
  orderNumber: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  orderCustomer: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  orderRight: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontFamily: fonts.bold, fontSize: 10 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityText: { fontFamily: fonts.bold, fontSize: 10 },
  orderStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  statItem: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary },
  lateText: { fontFamily: fonts.bold, fontSize: fonts.xs, color: colors.error },
  progressBar: { height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary, marginBottom: 8 },
  stages: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  stagePill: { backgroundColor: colors.primaryExtraLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  stagePillText: { fontFamily: fonts.medium, fontSize: 10, color: colors.primary },
  stagePillHold: { backgroundColor: colors.warning + '20' },
  stagePillTextHold: { color: colors.warning },
  holdNote: { fontFamily: fonts.regular, fontSize: 9, color: colors.warning, fontStyle: 'italic', alignSelf: 'flex-end' },
  empty: { flex: 1, alignItems: 'center', padding: 40, gap: 12, marginTop: 40 },
  emptyText: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary },
  emptyLink: { color: colors.primary, fontFamily: fonts.medium, fontSize: fonts.sm },
});

export default OrdersTrackingScreen;

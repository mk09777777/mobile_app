import React, { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, TextInput, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../constants/colors';
import { fonts } from '../../../constants/fonts';
import Icon from '../../../components/common/Icon';
import { getJobCards } from '../../../services/productionApi';
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

const HOLD_STAGE_CODES = new Set(['HOLD']);

/**
 * Compute a representative status for display.
 * If stored status is "on_hold" but some pieces are at active (non-hold) stages,
 * show "in_progress" instead — on_hold only applies when ALL pieces are on hold.
 */
const resolveDisplayStatus = (jc) => {
  if (!jc) return 'pending';
  const dist = jc.currentStageDistribution ?? [];
  if (jc.status === 'on_hold' && dist.length > 0) {
    const hasActive = dist.some(s => !HOLD_STAGE_CODES.has(s.stageCode));
    if (hasActive) return 'in_progress';
  }
  return jc.status;
};

const PageSize = 20;

const PieceRow = React.memo(({ jc, onPress }) => {
  const eta = jc.plannedCompletionAt ? new Date(jc.plannedCompletionAt) : null;
  const due = jc.expectedDeliveryAt  ? new Date(jc.expectedDeliveryAt)  : null;
  const delayDays = eta && due ? Math.ceil((eta - due) / 86_400_000) : null;
  const isDelayed = delayDays !== null && delayDays > 0;
  const displayStatus = resolveDisplayStatus(jc);

  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(jc)} activeOpacity={0.85}>
      <View style={styles.rowLeft}>
        <Text style={styles.code}>{jc.gatiPieceCode?.split('/').slice(-2).join('/')}</Text>
        <Text style={styles.orderNum}>{jc.orderNumber}</Text>
        <Text style={styles.sub}>{jc.styleNo} · {jc.customerCode}</Text>
        <View style={styles.stages}>
          {jc.currentStageDistribution?.slice(0, 3).map(s => (
            <View key={`${s.stageCode}-${s.cellCode}`} style={[styles.stagePill, HOLD_STAGE_CODES.has(s.stageCode) && styles.stagePillHold]}>
              <Text style={[styles.stagePillText, HOLD_STAGE_CODES.has(s.stageCode) && styles.stagePillTextHold]}>{s.stageCode}: {s.qty}</Text>
            </View>
          ))}
        </View>
        {eta && (
          <View style={styles.etaRow}>
            <Text style={styles.etaLabel}>ETA </Text>
            <Text style={[styles.etaValue, isDelayed && styles.etaDelayed]}>
              {formatDate(eta)}
            </Text>
            {isDelayed && (
              <View style={styles.delayChip}>
                <Text style={styles.delayChipText}>+{delayDays}d late</Text>
              </View>
            )}
          </View>
        )}
      </View>
      <View style={styles.rowRight}>
        <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[displayStatus] || colors.textSecondary) + '22' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[displayStatus] || colors.textSecondary }]}>
            {STATUS_LABELS[displayStatus] ?? displayStatus?.replace(/_/g, ' ')}
          </Text>
        </View>
        {displayStatus !== jc.status && (
          <Text style={styles.holdNote}>has hold</Text>
        )}
        <Text style={styles.dueDate}>Due {formatDate(jc.expectedDeliveryAt)}</Text>
      </View>
    </TouchableOpacity>
  );
});

const STATUSES = [
  'all', 'in_progress', 'on_hold', 'completed',
  'proceed_cancel', 'proceed_po', 'proceed_stock_assign',
  'proceed_manufacturer', 'proceed_pending',
];

const AllPiecesScreen = ({ navigation }) => {
  const [pieces, setPieces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const filterScrollRef = useRef(null);
  const filterOffsets = useRef({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const pageRef = useRef(0);
  const isFirstMount = useRef(true);

  const load = useCallback(async (reset = false) => {
    const skip = reset ? 0 : pageRef.current * PageSize;
    try {
      const params = { limit: PageSize, skip };
      if (status !== 'all') params.status = status;
      if (search) params.orderNumber = search;
      const data = await getJobCards(params);
      if (__DEV__) {
        console.log('[AllPieces] response keys:', Object.keys(data || {}));
        console.log('[AllPieces] count:', data?.items?.length ?? 0, '| total:', data?.total, '| raw:', JSON.stringify(data)?.slice(0, 500));
        if (data?.items?.[0]) console.log('[AllPieces] item[0] keys:', Object.keys(data.items[0]));
      }
      const list = data?.items || data || [];
      if (reset) {
        pageRef.current = 1;
        setPieces(list);
      } else {
        pageRef.current += 1;
        setPieces(prev => [...prev, ...list]);
      }
      setHasMore(list.length === PageSize);
    } catch (e) {
      if (__DEV__) console.error('[AllPieces] load error:', e.message);
    } finally { setLoading(false); setRefreshing(false); }
  }, [status, search]);

  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    setLoading(true); setPage(0); pageRef.current = 0; load(true);
  }, [status, search]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setPage(0);
      pageRef.current = 0;
      setPieces([]);
      load(true);
    }, [load])
  );

  const handlePressRow = useCallback(
    jc => navigation.navigate('JobCardDetail', { jobCardId: jc._id }),
    [navigation]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by order#…"
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.textLight}
          />
        </View>
      </View>
      <ScrollView
        ref={filterScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {STATUSES.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterTab, status === s && styles.filterTabActive]}
            onLayout={e => { filterOffsets.current[s] = e.nativeEvent.layout.x; }}
            onPress={() => {
              setStatus(s);
              // Smoothly scroll to keep selected tab visible
              const x = filterOffsets.current[s] ?? 0;
              filterScrollRef.current?.scrollTo({ x: Math.max(0, x - 12), animated: true });
            }}
          >
            <Text style={[styles.filterText, status === s && styles.filterTextActive]}>
              {s === 'all' ? 'All' : (STATUS_LABELS[s] ?? s.replace('_', ' '))}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {loading && pieces.length === 0
        ? <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        : (
          <FlatList
            data={pieces}
            keyExtractor={p => p._id}
            renderItem={({ item }) => <PieceRow jc={item} onPress={handlePressRow} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setPage(0); load(true); }} colors={[colors.primary]} />}
            onEndReached={() => hasMore && load()}
            onEndReachedThreshold={0.4}
            contentContainerStyle={{ padding: 12, gap: 6, paddingBottom: 32 }}
            ListEmptyComponent={<View style={styles.empty}><Icon name="inventory" size={48} color={colors.textSecondary} /><Text style={styles.emptyText}>No pieces found</Text></View>}
          />
        )
      }
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchRow: { flexDirection: 'row', padding: 12, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.backgroundSecondary, borderRadius: 10, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, marginLeft: 8, fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textPrimary },
  filterScroll: { backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border, height: 48, flexGrow: 0, flexShrink: 0 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 6, alignItems: 'center' },
  filterTab: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.backgroundSecondary },
  filterTabActive: { backgroundColor: colors.primary },
  filterText: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textSecondary },
  filterTextActive: { color: '#fff' },
  row: {
    flexDirection: 'row', backgroundColor: colors.background, borderRadius: 10,
    padding: 12, elevation: 1,
  },
  rowLeft: { flex: 1 },
  code: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  orderNum: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.primary, marginTop: 2 },
  sub: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  stages: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  stagePill: { backgroundColor: colors.primaryExtraLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  stagePillText: { fontFamily: fonts.medium, fontSize: 10, color: colors.primary },
  rowRight: { alignItems: 'flex-end', gap: 6, justifyContent: 'flex-start' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontFamily: fonts.bold, fontSize: 10 },
  dueDate: { fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary },
  holdNote: { fontFamily: fonts.regular, fontSize: 9, color: colors.warning, fontStyle: 'italic' },
  stagePillHold: { backgroundColor: colors.warning + '20' },
  stagePillTextHold: { color: colors.warning },
  etaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  etaLabel: { fontFamily: fonts.medium, fontSize: 10, color: colors.textSecondary },
  etaValue: { fontFamily: fonts.bold, fontSize: 10, color: colors.success },
  etaDelayed: { color: colors.error },
  delayChip: { backgroundColor: colors.error + '20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 },
  delayChipText: { fontFamily: fonts.bold, fontSize: 9, color: colors.error },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary },
});

export default AllPiecesScreen;

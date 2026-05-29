import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../constants/colors';
import { fonts } from '../../../constants/fonts';
import Icon from '../../../components/common/Icon';
import { getOrderDetail, getStages } from '../../../services/productionApi';

// Module-level cache — stages are static master data, fetch once per session.
let _stagesCache = null;
const getCachedStages = async () => {
  if (_stagesCache) return _stagesCache;
  const data = await getStages();
  _stagesCache = data?.stages || data || [];
  return _stagesCache;
};
import { formatDate } from '../../../utils/helpers';

const STATUS_COLORS = {
  in_progress: colors.info, completed: colors.success,
  on_hold: colors.warning,
};

const JobCardRow = ({ jc, onPress }) => {
  const isLate = jc.latenessDays > 0;
  const eta = jc.plannedCompletionAt ? new Date(jc.plannedCompletionAt) : null;
  const due = jc.expectedDeliveryAt  ? new Date(jc.expectedDeliveryAt)  : null;
  const delayDays = eta && due ? Math.ceil((eta - due) / 86_400_000) : null;
  const isDelayed = delayDays !== null && delayDays > 0;

  return (
    <TouchableOpacity
      style={[styles.jcRow, (isLate || isDelayed) && { borderLeftColor: colors.error }]}
      onPress={() => onPress(jc)}
      activeOpacity={0.85}
    >
      <View style={styles.jcLeft}>
        <Text style={styles.jcCode}>{jc.gatiPieceCode?.split('/').slice(-2).join('/')}</Text>
        <Text style={styles.jcStyle}>{jc.styleNo} · Size {jc.size} · Qty {jc.totalQty}</Text>
        <View style={styles.stagePills}>
          {jc.currentStageDistribution?.slice(0, 4).map(s => (
            <View key={`${s.stageCode}-${s.cellCode}`} style={styles.stagePill}>
              <Text style={styles.stagePillText}>{s.stageCode}: {s.qty}</Text>
            </View>
          ))}
        </View>
        {eta && (
          <View style={styles.jcEtaRow}>
            <Text style={styles.jcEtaLabel}>ETA </Text>
            <Text style={[styles.jcEtaValue, isDelayed && { color: colors.error }]}>
              {formatDate(eta)}
            </Text>
            {isDelayed && (
              <View style={styles.jcDelayChip}>
                <Text style={styles.jcDelayChipText}>+{delayDays}d late</Text>
              </View>
            )}
          </View>
        )}
      </View>
      <View style={styles.jcRight}>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[jc.status] || colors.textSecondary }]} />
        {isLate && <Text style={styles.lateFlag}>⚠️{jc.latenessDays}d</Text>}
      </View>
    </TouchableOpacity>
  );
};

const OrderDetailScreen = ({ route, navigation }) => {
  const { orderNumber } = route.params || {};
  const [data, setData] = useState(null);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, stagesData] = await Promise.all([
        getOrderDetail(orderNumber),
        getCachedStages(),
      ]);
      if (__DEV__) {
        console.log('[OrderDetail] response keys:', Object.keys(d || {}));
        if (d?.order) console.log('[OrderDetail] order keys:', Object.keys(d.order));
        if (d?.pieces?.[0]) console.log('[OrderDetail] piece[0] keys:', Object.keys(d.pieces[0]));
      }
      setData(d);
      setStages(stagesData);
    } catch (e) {
      if (__DEV__) console.error('[OrderDetail] load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderNumber]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!data) return (
    <View style={styles.center}>
      <Icon name="error" size={48} color={colors.error} />
      <Text style={styles.errorText}>Order not found</Text>
    </View>
  );

  // Backend returns { order, pieces } — support both keys for safety
  const { order } = data;
  const jobCards = data.pieces || data.jobCards || [];
  const totalPieces = jobCards.length;
  const completed = jobCards?.filter(j => j.status === 'completed').length || 0;
  const pct = totalPieces > 0 ? Math.round((completed / totalPieces) * 100) : 0;

  // Aggregate stage distribution
  const stageTotals = {};
  jobCards?.forEach(jc => {
    jc.currentStageDistribution?.forEach(s => {
      stageTotals[s.stageCode] = (stageTotals[s.stageCode] || 0) + s.qty;
    });
  });

  // Main production flow only — exclude PENDING (displayOrder: -1),
  // HOLD (98), JW (99), and any other out-of-flow or pre-production stages
  const flowStages = stages.filter(s => s.displayOrder >= 1 && s.displayOrder < 90);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}
        contentContainerStyle={styles.content}
      >
        {/* Order header */}
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderTop}>
            <Text style={styles.orderNum}>{order?.orderNumber || orderNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[order?.status] || colors.textSecondary) + '22' }]}>
              <Text style={[styles.statusText, { color: STATUS_COLORS[order?.status] || colors.textSecondary }]}>
                {order?.status?.replace('_', ' ')}
              </Text>
            </View>
          </View>
          <Text style={styles.orderCustomer}>{order?.customerCode}</Text>
          <Text style={styles.orderDelivery}>
            Due: {formatDate(order?.expectedDeliveryAt)}
          </Text>
          {order?.plannedCompletionAt && (
            <View style={styles.etaRow}>
              <Text style={styles.etaLabel}>ETA: </Text>
              <Text style={[
                styles.etaValue,
                order.expectedDeliveryAt && new Date(order.plannedCompletionAt) > new Date(order.expectedDeliveryAt)
                  ? { color: colors.error }
                  : { color: colors.success }
              ]}>
                {formatDate(order.plannedCompletionAt)}
              </Text>
            </View>
          )}

          {/* Progress */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.progressText}>{completed}/{totalPieces} pieces completed ({pct}%)</Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalPieces}</Text>
              <Text style={styles.statLabel}>Pieces</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.success }]}>{completed}</Text>
              <Text style={styles.statLabel}>Done</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.warning }]}>{jobCards?.filter(j => j.status === 'in_progress').length || 0}</Text>
              <Text style={styles.statLabel}>In Progress</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.error }]}>{jobCards?.filter(j => j.latenessDays > 0).length || 0}</Text>
              <Text style={styles.statLabel}>Late</Text>
            </View>
          </View>
        </View>

        {/* Stage flow */}
        {flowStages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Stage Flow</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stageFlow}>
              {flowStages.map((stage, idx) => {
                const qty = stageTotals[stage.code] || 0;
                const isActive = qty > 0;
                return (
                  <React.Fragment key={stage.code}>
                    {idx > 0 && (
                      <View style={[styles.sfConnector, isActive && styles.sfConnectorActive]} />
                    )}
                    <View style={styles.sfWrap}>
                      <View style={[styles.sfDot, isActive && styles.sfDotActive]}>
                        {isActive && <Text style={styles.sfDotQty}>{qty}</Text>}
                      </View>
                      <Text style={[styles.sfCode, isActive && styles.sfCodeActive]} numberOfLines={1}>
                        {stage.code}
                      </Text>
                    </View>
                  </React.Fragment>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Job cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Items ({totalPieces})</Text>
          {jobCards?.map(jc => (
            <JobCardRow
              key={jc._id}
              jc={jc}
              onPress={j => navigation.navigate('JobCardDetail', { jobCardId: j._id })}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontFamily: fonts.medium, fontSize: fonts.base, color: colors.error },
  content: { paddingBottom: 32 },
  orderHeader: { backgroundColor: colors.background, padding: 16, marginBottom: 8 },
  orderHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  orderNum: { fontFamily: fonts.bold, fontSize: fonts.lg, color: colors.textPrimary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontFamily: fonts.bold, fontSize: fonts.xs },
  orderCustomer: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, marginBottom: 4 },
  orderDelivery: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, marginBottom: 4 },
  etaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  etaLabel: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.textSecondary },
  etaValue: { fontFamily: fonts.bold, fontSize: fonts.sm },
  progressBar: { height: 8, backgroundColor: colors.borderLight, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 4 },
  progressText: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginBottom: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: fonts.bold, fontSize: fonts.xl, color: colors.textPrimary },
  statLabel: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary },
  section: { backgroundColor: colors.background, marginHorizontal: 0, marginBottom: 8, padding: 16 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary, marginBottom: 12 },
  stagePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stagePill: { backgroundColor: colors.primaryExtraLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  stagePillText: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.primary },
  jcRow: {
    borderLeftWidth: 3, borderLeftColor: 'transparent', paddingLeft: 10,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  jcLeft: { flex: 1 },
  jcCode: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  jcStyle: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  jcRight: { alignItems: 'flex-end', gap: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  lateFlag: { fontFamily: fonts.bold, fontSize: 10, color: colors.error },
  jcEtaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  jcEtaLabel: { fontFamily: fonts.medium, fontSize: 10, color: colors.textSecondary },
  jcEtaValue: { fontFamily: fonts.bold, fontSize: 10, color: colors.success },
  jcDelayChip: { backgroundColor: colors.error + '20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 },
  jcDelayChipText: { fontFamily: fonts.bold, fontSize: 9, color: colors.error },
  // Stage flow
  stageFlow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4 },
  sfWrap: { alignItems: 'center', width: 56 },
  sfDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.borderLight, justifyContent: 'center', alignItems: 'center' },
  sfDotActive: { backgroundColor: colors.primary },
  sfDotQty: { fontFamily: fonts.bold, fontSize: 9, color: '#fff' },
  sfCode: { fontFamily: fonts.regular, fontSize: 9, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  sfCodeActive: { color: colors.primary, fontFamily: fonts.bold },
  sfConnector: { width: 14, height: 2, backgroundColor: colors.borderLight, marginTop: 11, flexShrink: 0 },
  sfConnectorActive: { backgroundColor: colors.primary },
});

export default OrderDetailScreen;

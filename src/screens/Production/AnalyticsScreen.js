import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { getAnalytics } from '../../services/productionApi';

const PERIODS = [
  { label: '7d', from: 7 },
  { label: '30d', from: 30 },
  { label: '90d', from: 90 },
];

const KPICard = ({ label, value, sub, icon, color = colors.primary }) => (
  <View style={[styles.kpiCard, { borderLeftColor: color }]}>
    <Icon name={icon} size={22} color={color} />
    <View style={styles.kpiBody}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </View>
  </View>
);

const AnomalyRow = ({ item }) => {
  const sevColor = item.severity === 'critical' ? colors.error : item.severity === 'warning' ? colors.warning : colors.info;
  return (
    <View style={styles.anomalyRow}>
      <View style={[styles.anomalyDot, { backgroundColor: sevColor }]} />
      <View style={styles.anomalyBody}>
        <Text style={styles.anomalyType}>{item.type || item._id}</Text>
        <Text style={styles.anomalyCount}>{item.count} occurrence{item.count !== 1 ? 's' : ''}</Text>
      </View>
      <View style={[styles.severityBadge, { backgroundColor: sevColor + '22' }]}>
        <Text style={[styles.severityText, { color: sevColor }]}>{item.severity?.toUpperCase() || 'INFO'}</Text>
      </View>
    </View>
  );
};

const StageBarRow = ({ item }) => {
  const max = item._maxDays || 1;
  const pct = Math.min((item.avgDays || 0) / max, 1);
  return (
    <View style={styles.stageRow}>
      <Text style={styles.stageCode} numberOfLines={1}>{item.stageCode || item._id}</Text>
      <View style={styles.stageBarTrack}>
        <View style={[styles.stageBarFill, { width: `${Math.round(pct * 100)}%` }]} />
      </View>
      <Text style={styles.stageDays}>{(item.avgDays ?? 0).toFixed(1)}d</Text>
    </View>
  );
};

const AnalyticsScreen = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState(30);

  const load = useCallback(async () => {
    try {
      const to = new Date();
      const from = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
      const res = await getAnalytics({ from: from.toISOString(), to: to.toISOString() });
      if (__DEV__) console.log('[Analytics] raw:', JSON.stringify(res)?.slice(0, 500));
      // Backend returns { snapshot: { onTime, avgOrderCycleDays, totalCompleted, totalInProgress, totalDelayed, cycleTimeByStage[], anomalyCountsByType[], materialLossSummary } }
      const snap = res?.snapshot || res;
      setData(snap);
    } catch (e) {
      if (__DEV__) console.error('[Analytics] load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { setLoading(true); load(); }, [period]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  const onTimePct = data?.onTime?.onTimePct ?? data?.onTimeDeliveryPct ?? null;
  const avgCycleDays = data?.avgOrderCycleDays ?? null;
  const totalAnomalies = (data?.anomalyCountsByType || []).reduce((s, r) => s + (r.count ?? 0), 0);
  // Backend field is cycleTimeByStage (not stageAvgDays)
  const stageAvgDays = (data?.cycleTimeByStage || []).map(s => ({
    ...s, _maxDays: Math.max(...(data?.cycleTimeByStage || []).map(x => x.avgDays || 0), 1),
  }));
  const anomalies = data?.anomalyCountsByType || [];

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}
      >
        {/* Period selector */}
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.label}
              style={[styles.periodBtn, period === p.from && styles.periodBtnActive]}
              onPress={() => setPeriod(p.from)}
            >
              <Text style={[styles.periodText, period === p.from && styles.periodTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* KPI Cards */}
        <View style={styles.kpiGrid}>
          <KPICard
            label="On-Time Delivery"
            value={onTimePct != null ? `${onTimePct.toFixed(1)}%` : '—'}
            icon="check-circle"
            color={onTimePct != null && onTimePct >= 80 ? colors.success : colors.error}
          />
          <KPICard
            label="Avg Cycle Time"
            value={avgCycleDays != null ? `${avgCycleDays.toFixed(1)} days` : '—'}
            icon="timer"
            color={colors.primary}
          />
        </View>
        <View style={styles.kpiGrid}>
          <KPICard
            label="Anomalies Detected"
            value={`${totalAnomalies}`}
            icon="warning"
            color={totalAnomalies > 0 ? colors.warning : colors.success}
          />
          <KPICard
            label="Completed Orders"
            value={data?.totalCompleted != null ? `${data.totalCompleted}` : '—'}
            icon="done-all"
            color={colors.success}
          />
        </View>

        {/* Stage cycle times */}
        {stageAvgDays.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Avg Cycle Time by Stage</Text>
            {stageAvgDays.map((s, i) => <StageBarRow key={i} item={s} />)}
          </View>
        )}

        {/* Anomaly breakdown */}
        {anomalies.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Anomaly Breakdown</Text>
            {anomalies.map((a, i) => <AnomalyRow key={i} item={a} />)}
          </View>
        )}

        {/* Empty state */}
        {!data && (
          <View style={styles.empty}>
            <Icon name="analytics" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No analytics data yet</Text>
            <Text style={styles.emptySub}>Upload orders and WIP files to generate production analytics.</Text>
          </View>
        )}

        {data && onTimePct == null && stageAvgDays.length === 0 && (
          <View style={styles.infoCard}>
            <Icon name="info" size={16} color={colors.info} />
            <Text style={styles.infoText}>
              Analytics require completed job card cycles. Upload WIP data and recompute baselines to populate this screen.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  periodBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.backgroundSecondary },
  periodBtnActive: { backgroundColor: colors.primary },
  periodText: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.textSecondary },
  periodTextActive: { color: '#fff' },
  kpiGrid: { flexDirection: 'row', gap: 10 },
  kpiCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderRadius: 12, padding: 14, elevation: 1, borderLeftWidth: 4 },
  kpiBody: { flex: 1 },
  kpiLabel: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary },
  kpiValue: { fontFamily: fonts.bold, fontSize: fonts.base, marginTop: 2 },
  kpiSub: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  section: { backgroundColor: colors.background, borderRadius: 12, padding: 16, elevation: 1 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fonts.base, color: colors.textPrimary, marginBottom: 12 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  stageCode: { fontFamily: fonts.bold, fontSize: fonts.xs, color: colors.textPrimary, width: 80 },
  stageBarTrack: { flex: 1, height: 14, backgroundColor: colors.backgroundSecondary, borderRadius: 7, overflow: 'hidden' },
  stageBarFill: { height: '100%', backgroundColor: colors.primary + 'CC', borderRadius: 7 },
  stageDays: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, width: 36, textAlign: 'right' },
  anomalyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  anomalyDot: { width: 8, height: 8, borderRadius: 4 },
  anomalyBody: { flex: 1 },
  anomalyType: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  anomalyCount: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  severityText: { fontFamily: fonts.bold, fontSize: 10 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 40, paddingHorizontal: 32, gap: 12 },
  emptyText: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.textSecondary, textAlign: 'center' },
  emptySub: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  infoCard: { flexDirection: 'row', gap: 10, backgroundColor: colors.info + '15', borderRadius: 10, padding: 12 },
  infoText: { flex: 1, fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.info },
});

export default AnalyticsScreen;

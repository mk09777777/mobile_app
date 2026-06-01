import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../constants/colors';
import { fonts } from '../../../constants/fonts';
import { getLoadColor } from '../../../utils/helpers';
import Icon from '../../../components/common/Icon';
import { getCapacityDashboard, recomputeBaselines } from '../../../services/productionApi';

const StageRow = ({ stage }) => {
  const load = stage.capacityPerDay > 0 ? Math.min((stage.queueUnits / (stage.capacityPerDay * 30)) * 100, 100) : 0;
  const isOverdue = (stage.overduePieces ?? 0) > 0;
  const loadColor = (stage.isBottleneck || isOverdue) ? colors.error : getLoadColor(load);

  const expectedHrs = stage.expectedDurationHours;
  const expectedLabel = expectedHrs != null
    ? expectedHrs >= 24 ? `${Math.round(expectedHrs / 24)}d/pc` : `${expectedHrs}h/pc`
    : null;

  const vf = stage.velocityFactor ?? 1.0;
  const velocityLabel = vf > 1.05
    ? `${vf.toFixed(1)}× slow`
    : vf < 0.95
    ? `${vf.toFixed(1)}× fast`
    : null;

  return (
    <View style={[styles.stageRow, (stage.isBottleneck || isOverdue) && styles.stageRowBottleneck]}>
      <View style={styles.stageLeft}>
        <View style={styles.stageLabelRow}>
          <Text style={styles.stageName}>{stage.stageCode}</Text>
          {stage.isBottleneck && (
            <View style={styles.bottleneckBadge}>
              <Text style={styles.bottleneckText}>BOTTLENECK</Text>
            </View>
          )}
          {!stage.isBottleneck && isOverdue && (
            <View style={styles.overdueBadge}>
              <Text style={styles.bottleneckText}>{stage.overduePieces} OVERDUE</Text>
            </View>
          )}
          {expectedLabel && <Text style={styles.expectedLabel}>{expectedLabel}</Text>}
          {velocityLabel && (
            <Text style={[styles.velocityLabel, { color: vf > 1.05 ? colors.error : colors.success }]}>
              {velocityLabel}
            </Text>
          )}
        </View>
        <Text style={styles.stageSub}>{stage.queueUnits} units queued</Text>
        <View style={styles.stageBar}>
          <View style={[styles.stageBarFill, { width: `${load}%`, backgroundColor: loadColor }]} />
        </View>
      </View>
      <View style={styles.stageRight}>
        <Text style={[styles.queueDays, { color: loadColor }]}>{stage.queueDays?.toFixed(1)}</Text>
        <Text style={styles.queueDaysLabel}>days</Text>
      </View>
    </View>
  );
};

const CapacityDashboardScreen = ({ navigation }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await getCapacityDashboard();
      if (__DEV__) {
        console.log('[Planning] capacity keys:', Object.keys(d || {}));
        console.log('[Planning] monthLoad:', JSON.stringify(d?.monthLoad), '| bottlenecks:', d?.bottlenecks?.length, '| stages:', d?.stages?.length);
        console.log('[Planning] capacity raw:', JSON.stringify(d)?.slice(0, 500));
        if (d?.stages?.[0]) console.log('[Planning] stage[0] keys:', Object.keys(d.stages[0]));
        if (d?.bottlenecks?.[0]) console.log('[Planning] bottleneck[0] keys:', Object.keys(d.bottlenecks[0]));
      }
      setData(d);
    } catch (e) {
      if (__DEV__) console.error('[Planning] load error:', e.message);
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Re-fetch whenever the screen comes into focus (e.g. after returning from
  // WIP import), and auto-refresh every 60 seconds while visible.
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => load(), 300);
      const interval = setInterval(() => load(), 60_000);
      return () => { clearTimeout(timer); clearInterval(interval); };
    }, [load])
  );

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      await recomputeBaselines();
      await load();
    } catch { /* */ }
    finally { setRecomputing(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  if (error) return (
    <View style={styles.center}>
      <Icon name="cloud-off" size={48} color={colors.textSecondary} />
      <Text style={styles.errorTitle}>Could not load dashboard</Text>
      <Text style={styles.errorMsg}>{error}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
        <Icon name="refresh" size={16} color="#fff" />
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  // Backend: { stages, bottlenecks, monthLoad: { pct, totalQueueUnits, monthCapacityUnits } }
  const monthLoad = data?.monthLoad?.pct ?? data?.monthLoadPct ?? 0;
  const loadColor = getLoadColor(monthLoad);
  const bottlenecks = data?.bottlenecks || data?.stages?.filter(s => s.isBottleneck) || [];

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}
        contentContainerStyle={styles.content}
      >
        {/* Month gauge */}
        <View style={styles.gaugeCard}>
          <Text style={styles.gaugeTitle}>Monthly Capacity</Text>
          <View style={styles.gauge}>
            <Text style={[styles.gaugeValue, { color: loadColor }]}>{Math.round(monthLoad)}%</Text>
          </View>
          <View style={styles.gaugeBar}>
            <View style={[styles.gaugeFill, { width: `${Math.min(monthLoad, 100)}%`, backgroundColor: loadColor }]} />
          </View>
          <Text style={styles.gaugeSub}>
            {data?.monthLoad?.totalQueueUnits ?? 0} units queued · {data?.stages?.length ?? 0} stages
          </Text>
          <TouchableOpacity style={styles.recomputeBtn} onPress={handleRecompute} disabled={recomputing}>
            {recomputing ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="refresh" size={16} color={colors.primary} />}
            <Text style={styles.recomputeText}>{recomputing ? 'Recomputing…' : 'Recompute Baselines'}</Text>
          </TouchableOpacity>
        </View>

        {/* Bottlenecks */}
        {bottlenecks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Current Bottlenecks</Text>
            {bottlenecks.map(b => (
              <View key={b.stageCode} style={styles.bottleneckAlert}>
                <Icon name="warning" size={16} color={colors.error} />
                <Text style={styles.bottleneckAlertText}>{b.stageCode} — {b.queueDays?.toFixed(1)} days queue</Text>
              </View>
            ))}
          </View>
        )}

        {/* Stage table */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Stages ({data?.stages?.length ?? 0})</Text>
            <TouchableOpacity onPress={() => navigation.navigate('NewOrderCalculator')}>
              <Text style={styles.calcLink}>+ New Order Check</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 2 }]}>Stage</Text>
            <Text style={[styles.th, { textAlign: 'right' }]}>Queue Days</Text>
          </View>
          {data?.stages?.length > 0
            ? data.stages.map(s => <StageRow key={s.stageCode} stage={s} />)
            : (
              <View style={styles.emptyStages}>
                <Text style={styles.emptyStagesText}>No stage data yet.</Text>
                <Text style={styles.emptyStagesSub}>
                  1. Set up stages in Settings → Stages{'\n'}
                  2. Upload a WIP file in Imports{'\n'}
                  3. Tap "Recompute Baselines" above
                </Text>
              </View>
            )
          }
        </View>

        {/* What-if link */}
        <TouchableOpacity style={styles.whatIfBtn} onPress={() => navigation.navigate('WhatIfSimulator')}>
          <Icon name="science" size={20} color={colors.primary} />
          <Text style={styles.whatIfText}>Open What-If Simulator</Text>
          <Icon name="arrow-forward" size={18} color={colors.primary} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  errorTitle: { fontFamily: fonts.bold, fontSize: fonts.base, color: colors.textPrimary, textAlign: 'center' },
  errorMsg: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8, marginTop: 4 },
  retryText: { color: '#fff', fontFamily: fonts.bold, fontSize: fonts.sm },
  content: { paddingBottom: 32 },
  gaugeCard: {
    backgroundColor: colors.background, margin: 12, borderRadius: 14, padding: 20,
    alignItems: 'center', elevation: 2,
  },
  gaugeTitle: { fontFamily: fonts.bold, fontSize: fonts.lg, color: colors.textPrimary, marginBottom: 12 },
  gauge: { marginBottom: 12 },
  gaugeValue: { fontFamily: fonts.black, fontSize: 56, lineHeight: 64 },
  gaugeBar: { width: '100%', height: 12, backgroundColor: colors.borderLight, borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
  gaugeFill: { height: '100%', borderRadius: 6 },
  gaugeSub: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary },
  recomputeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, padding: 10, borderRadius: 8, backgroundColor: colors.primaryExtraLight },
  recomputeText: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.primary },
  section: { backgroundColor: colors.background, margin: 12, marginTop: 0, borderRadius: 12, padding: 16, elevation: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fonts.base, color: colors.textPrimary, marginBottom: 12 },
  calcLink: { color: colors.primary, fontFamily: fonts.medium, fontSize: fonts.sm },
  tableHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4 },
  th: { fontFamily: fonts.bold, fontSize: fonts.xs, color: colors.textSecondary, flex: 1 },
  stageRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  stageRowBottleneck: { backgroundColor: colors.error + '08', borderRadius: 8, paddingHorizontal: 8 },
  stageLeft: { flex: 1 },
  stageLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  stageName: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  stageSub: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginBottom: 6 },
  stageBar: { height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: 'hidden', marginRight: 12 },
  stageBarFill: { height: '100%', borderRadius: 3 },
  stageRight: { alignItems: 'flex-end', width: 56 },
  queueDays: { fontFamily: fonts.bold, fontSize: fonts.xl },
  queueDaysLabel: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary },
  bottleneckBadge: { backgroundColor: colors.error + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  bottleneckText: { fontFamily: fonts.bold, fontSize: 9, color: colors.error },
  expectedLabel: { fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary, marginLeft: 4 },
  overdueBadge: { backgroundColor: colors.error + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  velocityLabel: { fontFamily: fonts.bold, fontSize: 10, marginLeft: 4 },
  bottleneckAlert: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  bottleneckAlertText: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.error },
  whatIfBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.background, margin: 12, marginTop: 0, borderRadius: 12,
    padding: 16, elevation: 1,
  },
  whatIfText: { flex: 1, fontFamily: fonts.bold, fontSize: fonts.base, color: colors.primary, marginLeft: 10 },
  emptyStages: { paddingVertical: 20, alignItems: 'center', gap: 10 },
  emptyStagesText: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textSecondary },
  emptyStagesSub: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, lineHeight: 20, textAlign: 'center' },
});

export default CapacityDashboardScreen;

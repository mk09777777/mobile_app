import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../../constants/colors';
import { fonts } from '../../../constants/fonts';
import { getLoadColor } from '../../../utils/helpers';
import Icon from '../../../components/common/Icon';
import {
  getAnalytics,
  getDashboardSummary,
} from '../../../services/productionApi';

const KpiCard = ({ icon, label, value, color, onPress }) => (
  <TouchableOpacity
    style={[styles.kpiCard, onPress && { cursor: 'pointer' }]}
    onPress={onPress}
    activeOpacity={onPress ? 0.8 : 1}
  >
    <View style={[styles.kpiIcon, { backgroundColor: color + '20' }]}>
      <Icon name={icon} size={22} color={color} />
    </View>
    <Text style={styles.kpiValue}>{value}</Text>
    <Text style={styles.kpiLabel}>{label}</Text>
  </TouchableOpacity>
);

const SeverityBadge = ({ severity }) => {
  const map = {
    critical: colors.error,
    warning: colors.warning,
    info: colors.info,
  };
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: (map[severity] || colors.info) + '22' },
      ]}
    >
      <Text style={[styles.badgeText, { color: map[severity] || colors.info }]}>
        {severity?.toUpperCase()}
      </Text>
    </View>
  );
};

const ProductionDashboardScreen = ({ navigation }) => {
  const [analytics, setAnalytics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [orderStats, setOrderStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      // 2 parallel calls: summary (order counts + capacity + alerts — one fast aggregation)
      // and analytics (30-day snapshot).
      const [anl, smry] = await Promise.allSettled([
        getAnalytics(),
        getDashboardSummary(),
      ]);

      if (__DEV__) {
        console.log('[Dashboard] analytics:', anl.status, anl.status !== 'fulfilled' ? anl.reason?.message : '');
        console.log('[Dashboard] summary:', smry.status, smry.status !== 'fulfilled' ? smry.reason?.message : '',
          smry.status === 'fulfilled' ? JSON.stringify(smry.value?.orders) : '');
      }

      if (anl.status === 'fulfilled') setAnalytics(anl.value?.snapshot || anl.value);
      if (smry.status === 'fulfilled') {
        const s = smry.value;
        setOrderStats({
          total:              s?.orders?.open             ?? 0,
          late:               s?.orders?.late             ?? 0,
          alertsTotal:        s?.alerts?.total            ?? 0,
          monthLoadPct:       s?.capacity?.monthLoadPct   ?? 0,
          totalQueueUnits:    s?.capacity?.totalQueueUnits ?? 0,
          monthCapacityUnits: s?.capacity?.monthCapacityUnits ?? 0,
          bottlenecks:        s?.capacity?.bottlenecks    ?? [],
        });
        setAlerts(s?.alerts?.items || []);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => load(), 1000);
      const interval = setInterval(() => load(), 60000);
      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const monthLoad = orderStats?.monthLoadPct ?? 0;
  const bottlenecks = orderStats?.bottlenecks ?? [];

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading production data…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
      >
        {error ? (
          <View style={styles.errorBox}>
            <Icon name="error" size={20} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={load}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* KPI Row */}
        <View style={styles.kpiRow}>
          <KpiCard
            icon="layers"
            label="Open Orders"
            value={orderStats?.total ?? '—'}
            color={colors.primary}
            onPress={() => navigation.navigate('ProductionTracking')}
          />
          <KpiCard
            icon="warning"
            label="Late Orders"
            value={orderStats?.late ?? '—'}
            color={colors.error}
            onPress={() =>
              navigation.navigate('ProductionTracking', { filter: 'late' })
            }
          />
          <KpiCard
            icon="speed"
            label="Load %"
            value={`${Math.round(monthLoad)}%`}
            color={getLoadColor(monthLoad)}
          />
          <KpiCard
            icon="notifications-active"
            label="Alerts"
            value={orderStats?.alertsTotal ?? alerts.length}
            color={colors.warning}
            onPress={() => navigation.navigate('ProductionAlerts')}
          />
        </View>

        {/* Capacity Gauge */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capacity — This Month</Text>
          <View style={styles.gaugeBar}>
            <View
              style={[
                styles.gaugeFill,
                {
                  width: `${Math.min(monthLoad, 100)}%`,
                  backgroundColor: getLoadColor(monthLoad),
                },
              ]}
            />
          </View>
          <Text style={styles.gaugeLabel}>
            {Math.round(monthLoad)}% used ·{' '}
            {orderStats?.totalQueueUnits ?? 0} /{' '}
            {orderStats?.monthCapacityUnits?.toFixed(1) ?? '—'}{' '}
            capacity units
          </Text>
        </View>

        {/* Bottlenecks */}
        {bottlenecks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Bottlenecks</Text>
            {bottlenecks.map(b => (
              <View key={b.stageCode} style={styles.bottleneckRow}>
                <View style={styles.bottleneckLeft}>
                  <Text style={styles.bottleneckStage}>{b.stageCode}</Text>
                  <Text style={styles.bottleneckSub}>
                    {b.queueUnits} units · {b.queueDays?.toFixed(1)} days queue
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: colors.error + '20' }]}>
                  <Text style={[styles.badgeText, { color: colors.error }]}>BOTTLENECK</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recent Critical Alerts */}
        {alerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Critical Alerts</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('ProductionAlerts')}
              >
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {alerts.slice(0, 5).map((a, i) => (
              <View key={a._id || i} style={styles.alertRow}>
                <SeverityBadge severity={a.severity} />
                <Text style={styles.alertMsg} numberOfLines={2}>
                  {a.message}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {[
              {
                icon: 'file-upload',
                label: 'Upload Orders',
                screen: 'ImportOrders',
              },
              { icon: 'update', label: 'Upload WIP', screen: 'ImportWip' },
              {
                icon: 'bar-chart',
                label: 'Capacity',
                screen: 'CapacityDashboard',
              },
              {
                icon: 'track-changes',
                label: 'Tracking',
                screen: 'ProductionTracking',
              },
              { icon: 'diamond', label: 'Inventory', screen: 'DiamondMaster' },
              {
                icon: 'shopping-cart',
                label: 'Purchase Orders',
                screen: 'PurchaseOrders',
              },
              { icon: 'analytics', label: 'Analytics', screen: 'Analytics' },
              {
                icon: 'warning',
                label: 'Material Loss',
                screen: 'MaterialLoss',
              },
              { icon: 'layers', label: 'Stages', screen: 'StagesSettings' },
              { icon: 'event', label: 'Calendar', screen: 'Calendar' },
              { icon: 'map', label: 'Column Maps', screen: 'ColumnMaps' },
              {icon:"calendar-view-week", label:"Schedule", screen:"ScheduleView" },
            ].map(({ icon, label, screen }) => (
              <TouchableOpacity
                key={label}
                style={styles.actionBtn}
                onPress={() => navigation.navigate(screen)}
                activeOpacity={0.8}
              >
                <Icon name={icon} size={24} color={colors.primary} />
                <Text style={styles.actionLabel}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Analytics Summary */}
        {analytics && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Analytics (30 days)</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Analytics')}
              >
                <Text style={styles.seeAll}>Full view →</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.analyticsRow}>
              <View style={styles.analyticsItem}>
                <Text style={styles.analyticsValue}>
                  {analytics?.onTime?.onTimePct != null
                    ? `${analytics.onTime.onTimePct.toFixed(1)}%`
                    : '—'}
                </Text>
                <Text style={styles.analyticsLabel}>On-Time Delivery</Text>
              </View>
              <View style={styles.analyticsItem}>
                <Text style={styles.analyticsValue}>
                  {analytics?.avgOrderCycleDays != null
                    ? `${analytics.avgOrderCycleDays.toFixed(1)}d`
                    : '—'}
                </Text>
                <Text style={styles.analyticsLabel}>Avg Cycle Time</Text>
              </View>
              <View style={styles.analyticsItem}>
                <Text style={styles.analyticsValue}>
                  {analytics?.anomalyCountsByType?.reduce(
                    (s, r) => s + (r.count ?? 0),
                    0,
                  ) ?? '—'}
                </Text>
                <Text style={styles.analyticsLabel}>Anomalies</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: fonts.sm,
  },

  errorBox: {
    margin: 16,
    backgroundColor: colors.error + '15',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontFamily: fonts.regular,
    fontSize: fonts.sm,
  },
  retryText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: fonts.sm,
  },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 16,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  kpiIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    fontFamily: fonts.bold,
    fontSize: fonts.lg,
    color: colors.textPrimary,
  },
  kpiLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  section: {
    backgroundColor: colors.background,
    margin: 12,
    marginTop: 8,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fonts.base,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  seeAll: {
    color: colors.primary,
    fontFamily: fonts.medium,
    fontSize: fonts.sm,
  },
  gaugeBar: {
    height: 12,
    backgroundColor: colors.borderLight,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  gaugeFill: { height: '100%', borderRadius: 6 },
  gaugeLabel: {
    fontFamily: fonts.regular,
    fontSize: fonts.xs,
    color: colors.textSecondary,
  },
  bottleneckRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  bottleneckLeft: { flex: 1 },
  bottleneckStage: {
    fontFamily: fonts.bold,
    fontSize: fonts.sm,
    color: colors.textPrimary,
  },
  bottleneckSub: {
    fontFamily: fonts.regular,
    fontSize: fonts.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontFamily: fonts.bold, fontSize: 10 },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  alertMsg: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fonts.sm,
    color: colors.textPrimary,
  },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    width: '30%',
    aspectRatio: 0,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
    padding: 15,
  },
  actionLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  analyticsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  analyticsItem: { alignItems: 'center' },
  analyticsValue: {
    fontFamily: fonts.bold,
    fontSize: fonts.xl,
    color: colors.primary,
  },
  analyticsLabel: {
    fontFamily: fonts.regular,
    fontSize: fonts.xs,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default ProductionDashboardScreen;

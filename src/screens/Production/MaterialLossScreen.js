import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, FlatList, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import {
  getMaterialLossSummary, getMaterialLossByStage,
  getMaterialLossByCell, getMaterialLossByJobCards,
} from '../../services/productionApi';

const TABS = ['Summary', 'By Stage', 'By Cell', 'By JobCard'];

// ── Summary Tab ────────────────────────────────────────────────────────────────
const SummaryTab = ({ data, refreshControl }) => {
  if (!data) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  // Backend returns: totalIssuedGrams, totalReturnedGrams, totalGoldLossGrams,
  //                  goldLossPct, totalStonesIn, totalStonesOut, totalStoneLoss, jobCardCount
  const goldLossGrams = data.totalGoldLossGrams ?? data.goldLossGrams ?? 0;
  const goldIssuedGrams = data.totalIssuedGrams ?? data.goldIssuedGrams ?? 0;
  const goldReturnedGrams = data.totalReturnedGrams ?? data.goldReturnedGrams ?? 0;
  const goldLossPct = data.goldLossPct ?? (goldIssuedGrams > 0 ? ((goldLossGrams / goldIssuedGrams) * 100) : 0);
  const stonesLost = data.totalStoneLoss ?? data.stoneLoss ?? data.stonesLost ?? 0;
  const stonesIn = data.totalStonesIn ?? data.stonesIn ?? 0;
  return (
    <ScrollView contentContainerStyle={styles.tabContent} refreshControl={refreshControl}>
      <View style={styles.kpiRow}>
        <KPICard label="Gold Issued" value={`${goldIssuedGrams.toFixed(2)}g`} icon="scale" color={colors.warning} />
        <KPICard label="Gold Returned" value={`${goldReturnedGrams.toFixed(2)}g`} icon="replay" color={colors.success} />
      </View>
      <View style={styles.kpiRow}>
        <KPICard label="Gold Loss" value={`${goldLossGrams.toFixed(2)}g`} icon="warning" color={colors.error} />
        <KPICard label="Loss %" value={`${goldLossPct.toFixed(2)}%`} icon="percent" color={goldLossGrams > 0 ? colors.error : colors.success} />
      </View>
      <View style={styles.kpiRow}>
        <KPICard label="Stones In" value={`${stonesIn}`} icon="diamond" color={colors.primary} />
        <KPICard label="Stones Lost" value={`${stonesLost}`} icon="error" color={stonesLost > 0 ? colors.error : colors.success} />
      </View>
      {data.jobCardCount != null && (
        <View style={styles.infoCard}>
          <Icon name="info" size={16} color={colors.info} />
          <Text style={styles.infoText}>Based on {data.jobCardCount} job cards in the selected period.</Text>
        </View>
      )}
      {(!goldIssuedGrams && !stonesIn) && (
        <View style={styles.empty}>
          <Icon name="assignment-late" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No material loss data yet</Text>
          <Text style={styles.emptySub}>Record metal issued/returned in Metal Ledger and stage movement weights to track loss.</Text>
        </View>
      )}
    </ScrollView>
  );
};

const KPICard = ({ label, value, icon, color }) => (
  <View style={[styles.kpiCard, { borderLeftColor: color }]}>
    <Icon name={icon} size={20} color={color} />
    <View style={styles.kpiBody}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
    </View>
  </View>
);

// ── By Stage / By Cell Tab ────────────────────────────────────────────────────
const BarListTab = ({ data, labelKey, navigation, refreshControl }) => {
  if (!data) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  const items = data?.items || data?.byStage || data?.byCell || [];
  // Backend: by-stage/cell returns `goldLoss`; by-job-card returns `goldLossGrams`
  const getLoss = (item) => Math.abs(item.goldLoss ?? item.goldLossGrams ?? 0);
  const maxLoss = Math.max(...items.map(getLoss), 1);
  if (items.length === 0) return (
    <ScrollView contentContainerStyle={styles.tabContent} refreshControl={refreshControl}>
      <View style={styles.empty}>
        <Icon name="bar-chart" size={48} color={colors.textSecondary} />
        <Text style={styles.emptyText}>No loss data by {labelKey === 'stageCode' ? 'stage' : 'cell'}</Text>
        <Text style={styles.emptySub}>Record weight in/out at each stage movement to track material loss.</Text>
      </View>
    </ScrollView>
  );
  return (
    <ScrollView contentContainerStyle={styles.tabContent} refreshControl={refreshControl}>
      {items.map((item, i) => {
        const loss = getLoss(item);
        const barW = `${Math.round((loss / maxLoss) * 100)}%`;
        return (
          <View key={i} style={styles.barRow}>
            <Text style={styles.barLabel}>{item[labelKey] || '—'}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: barW }]} />
            </View>
            <Text style={styles.barValue}>{loss.toFixed(3)}g</Text>
          </View>
        );
      })}
    </ScrollView>
  );
};

// ── By JobCard Tab ────────────────────────────────────────────────────────────
const ByJobCardTab = ({ navigation, refreshControl, refreshKey }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getMaterialLossByJobCards()
      .then(d => {
        if (__DEV__) {
          console.log('[MaterialLoss] byJobCard keys:', Object.keys(d || {}));
          console.log('[MaterialLoss] byJobCard count:', d?.items?.length ?? 0, '| raw:', JSON.stringify(d)?.slice(0, 500));
          if (d?.items?.[0]) console.log('[MaterialLoss] byJobCard item[0] keys:', Object.keys(d.items[0]));
        }
        setItems(d?.items || []);
      })
      .catch(e => { if (__DEV__) console.error('[MaterialLoss] byJobCard error:', e.message); })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (items.length === 0) return (
    <View style={styles.empty}>
      <Icon name="assignment" size={48} color={colors.textSecondary} />
      <Text style={styles.emptyText}>No per-JobCard loss data</Text>
      <Text style={styles.emptySub}>Record metal issued/returned or stage weights to see loss per card.</Text>
    </View>
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(_, i) => String(i)}
      contentContainerStyle={{ padding: 12, gap: 6 }}
      refreshControl={refreshControl}
      renderItem={({ item }) => {
        const isProvisional = item.status && item.status !== 'completed';
        return (
          <TouchableOpacity
            style={styles.jcRow}
            onPress={() => navigation?.navigate('JobCardDetail', { jobCardId: item.jobCardId })}
          >
            <View style={styles.jcLeft}>
              <View style={styles.jcCodeRow}>
                <Text style={styles.jcCode}>{item.gatiPieceCode || item.jobCardId}</Text>
                {isProvisional && (
                  <View style={styles.provisionalBadge}>
                    <Text style={styles.provisionalText}>In Progress</Text>
                  </View>
                )}
              </View>
              <Text style={styles.jcSub}>
                <Text style={{ color: item.goldLossGrams > 0 ? colors.error : colors.success }}>
                  Gold: {(item.goldLossGrams ?? 0).toFixed(3)}g{isProvisional ? ' (provisional)' : ''}
                </Text>
                {(item.stoneLoss ?? 0) > 0 ? ` · Stones: ${item.stoneLoss}` : ''}
                {item.metalType ? ` · ${item.metalType}` : ''}
              </Text>
            </View>
            <View style={styles.jcRight}>
              <Text style={[styles.jcLossPct, { color: item.goldLossPct > 5 ? colors.error : colors.success }]}>
                {item.goldLossPct}%
              </Text>
              <Text style={styles.jcMovements}>{item.movementCount} moves</Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        );
      }}
    />
  );
};

// ── Main Screen ────────────────────────────────────────────────────────────────
const MaterialLossScreen = ({ navigation }) => {
  const [tab, setTab] = useState(0);
  const [summaryData, setSummaryData] = useState(null);
  const [stageData, setStageData] = useState(null);
  const [cellData, setCellData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingStage, setLoadingStage] = useState(true);
  const [loadingCell, setLoadingCell] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadAll = useCallback(() => {
    setLoadingSummary(true);
    setLoadingStage(true);
    setLoadingCell(true);

    Promise.all([
      getMaterialLossSummary()
        .then(d => {
          if (__DEV__) {
            console.log('[MaterialLoss] summary keys:', Object.keys(d || {}));
            console.log('[MaterialLoss] summary raw:', JSON.stringify(d)?.slice(0, 500));
          }
          setSummaryData(d?.summary || d);
        })
        .catch(e => { if (__DEV__) console.error('[MaterialLoss] summary error:', e.message); })
        .finally(() => setLoadingSummary(false)),

      getMaterialLossByStage()
        .then(d => {
          if (__DEV__) {
            console.log('[MaterialLoss] byStage keys:', Object.keys(d || {}));
            console.log('[MaterialLoss] byStage count:', d?.items?.length ?? d?.byStage?.length ?? 0, '| raw:', JSON.stringify(d)?.slice(0, 400));
            if ((d?.items || d?.byStage)?.[0]) console.log('[MaterialLoss] byStage item[0] keys:', Object.keys((d?.items || d?.byStage)[0]));
          }
          setStageData(d);
        })
        .catch(e => { if (__DEV__) console.error('[MaterialLoss] byStage error:', e.message); })
        .finally(() => setLoadingStage(false)),

      getMaterialLossByCell()
        .then(d => {
          if (__DEV__) {
            console.log('[MaterialLoss] byCell keys:', Object.keys(d || {}));
            console.log('[MaterialLoss] byCell count:', d?.items?.length ?? d?.byCell?.length ?? 0, '| raw:', JSON.stringify(d)?.slice(0, 400));
            if ((d?.items || d?.byCell)?.[0]) console.log('[MaterialLoss] byCell item[0] keys:', Object.keys((d?.items || d?.byCell)[0]));
          }
          setCellData(d);
        })
        .catch(e => { if (__DEV__) console.error('[MaterialLoss] byCell error:', e.message); })
        .finally(() => setLoadingCell(false)),
    ]).finally(() => {
      setRefreshing(false);
      setRefreshKey(k => k + 1);
    });
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
  }, [loadAll]);

  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />;

  const renderTab = () => {
    if (tab === 0) return loadingSummary ? <View style={styles.center}><ActivityIndicator color={colors.primary} /></View> : <SummaryTab data={summaryData} refreshControl={refreshControl} />;
    if (tab === 1) return loadingStage ? <View style={styles.center}><ActivityIndicator color={colors.primary} /></View> : <BarListTab data={stageData} labelKey="stageCode" navigation={navigation} refreshControl={refreshControl} />;
    if (tab === 2) return loadingCell ? <View style={styles.center}><ActivityIndicator color={colors.primary} /></View> : <BarListTab data={cellData} labelKey="cellCode" navigation={navigation} refreshControl={refreshControl} />;
    if (tab === 3) return <ByJobCardTab navigation={navigation} refreshControl={refreshControl} refreshKey={refreshKey} />;
    return null;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <View style={styles.tabBar}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === i && styles.tabBtnActive]} onPress={() => setTab(i)}>
            <Text style={[styles.tabText, tab === i && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {renderTab()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabBar: { flexDirection: 'row', backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontFamily: fonts.medium, fontSize: 10, color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontFamily: fonts.bold },
  tabContent: { padding: 16, gap: 10, paddingBottom: 32 },
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpiCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderRadius: 12, padding: 14, elevation: 1, borderLeftWidth: 4 },
  kpiBody: { flex: 1 },
  kpiLabel: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary },
  kpiValue: { fontFamily: fonts.bold, fontSize: fonts.lg, marginTop: 2 },
  infoCard: { flexDirection: 'row', gap: 10, backgroundColor: colors.info + '15', borderRadius: 10, padding: 12 },
  infoText: { flex: 1, fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.info },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 12 },
  emptyText: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.textSecondary, textAlign: 'center' },
  emptySub: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  barLabel: { fontFamily: fonts.bold, fontSize: fonts.xs, color: colors.textPrimary, width: 80 },
  barTrack: { flex: 1, height: 16, backgroundColor: colors.backgroundSecondary, borderRadius: 8, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.error + 'CC', borderRadius: 8 },
  barValue: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.error, width: 60, textAlign: 'right' },
  jcRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 10, padding: 14, elevation: 1 },
  jcLeft: { flex: 1 },
  jcCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  jcCode: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  provisionalBadge: { backgroundColor: colors.warning + '25', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  provisionalText: { fontFamily: fonts.medium, fontSize: 9, color: colors.warning },
  jcSub: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  jcRight: { alignItems: 'flex-end', marginRight: 8 },
  jcLossPct: { fontFamily: fonts.bold, fontSize: fonts.sm },
  jcMovements: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary },
});

export default MaterialLossScreen;

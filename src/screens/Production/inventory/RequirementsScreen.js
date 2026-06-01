import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../constants/colors';
import { fonts } from '../../../constants/fonts';
import Icon from '../../../components/common/Icon';
import BrandedAlert from '../../../components/common/BrandedAlert';
import { getRequirements, generatePOsFromShortages } from '../../../services/productionApi';

const STATUS_COLORS = { ok: colors.success, low: colors.warning, shortage: colors.error, critical: colors.error };

const ReqRow = ({ item }) => {
  const statusColor = STATUS_COLORS[item.status] || colors.textSecondary;
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.code} numberOfLines={1}>{item.gSize}</Text>
        <Text style={styles.sub}>{item.sieve} · {item.mm}mm</Text>
        <View style={styles.statsRow}>
          <Text style={styles.stat}>On Hand: {item.onHand}</Text>
          <Text style={styles.stat}>Alloc: {item.allocated}</Text>
          <Text style={styles.stat}>Avail: {item.available}</Text>
        </View>
      </View>
      <View style={styles.rowRight}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{item.status?.toUpperCase()}</Text>
        </View>
        <Text style={[styles.delta, { color: item.delta < 0 ? colors.error : colors.success }]}>
          Δ {item.delta > 0 ? '+' : ''}{item.delta}
        </Text>
        <Text style={styles.required}>Need: {item.required}</Text>
      </View>
    </View>
  );
};

const FILTERS = ['all', 'shortage', 'low', 'ok'];

const RequirementsScreen = ({ navigation }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [generating, setGenerating] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const load = useCallback(async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const data = await getRequirements(params);
      if (__DEV__) {
        console.log('[Requirements] response keys:', Object.keys(data || {}));
        console.log('[Requirements] count:', data?.items?.length ?? 0, '| total:', data?.total, '| raw:', JSON.stringify(data)?.slice(0, 500));
        if (data?.items?.[0]) console.log('[Requirements] item[0] keys:', Object.keys(data.items[0]));
      }
      // Backend returns { items, total }
      setItems(data?.items || data?.requirements || []);
    } catch (e) {
      if (__DEV__) console.error('[Requirements] load error:', e.message);
    } finally { setLoading(false); setRefreshing(false); }
  }, [filter]);

  useEffect(() => { setLoading(true); load(); }, [filter]);

  const generatePOs = async () => {
    showAlert('Generate POs', 'Create purchase order drafts for all shortages?', 'info', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Generate',
        style: 'default',
        onPress: async () => {
          setGenerating(true);
          try {
            await generatePOsFromShortages();
            showAlert('Done', 'Purchase order drafts created', 'success');
            navigation.navigate('PurchaseOrders');
          } catch (e) { showAlert('Error', e.message, 'error'); }
          finally { setGenerating(false); }
        },
      },
    ]);
  };

  const shortages = items.filter(i => i.status === 'shortage' || i.status === 'critical');

  if (loading && items.length === 0) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      {shortages.length > 0 && (
        <TouchableOpacity style={styles.generateBtn} onPress={generatePOs} disabled={generating}>
          {generating ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="add-shopping-cart" size={18} color="#fff" />}
          <Text style={styles.generateBtnText}>
            {generating ? 'Generating…' : `Generate POs for ${shortages.length} shortage${shortages.length !== 1 ? 's' : ''}`}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f} style={[styles.filterTab, filter === f && styles.filterTabActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={i => i.diamondCode || i.code || String(Math.random())}
        renderItem={({ item }) => <ReqRow item={item} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}
        contentContainerStyle={{ padding: 12, gap: 6, paddingBottom: 32 }}
        ListEmptyComponent={<View style={styles.empty}><Icon name="diamond" size={48} color={colors.textSecondary} /><Text style={styles.emptyText}>No requirements data yet</Text></View>}
      />
      <BrandedAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.error, paddingVertical: 12, margin: 12, borderRadius: 10 },
  generateBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fonts.sm },
  filterRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.backgroundSecondary },
  filterTabActive: { backgroundColor: colors.primary },
  filterText: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textSecondary },
  filterTextActive: { color: '#fff' },
  row: {
    flexDirection: 'row', backgroundColor: colors.background, borderRadius: 10, padding: 14,
    elevation: 1,
  },
  rowLeft: { flex: 1 },
  code: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  sub: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  stat: { fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontFamily: fonts.bold, fontSize: 10 },
  delta: { fontFamily: fonts.bold, fontSize: fonts.base },
  required: { fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary },
});

export default RequirementsScreen;

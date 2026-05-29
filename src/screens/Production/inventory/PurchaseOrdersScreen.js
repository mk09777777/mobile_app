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
import { getPurchaseOrders, approvePurchaseOrder, cancelPurchaseOrder } from '../../../services/productionApi';

const STATUS_COLORS = {
  draft: colors.warning, approved: colors.info, sent: colors.primary,
  received: colors.success, cancelled: colors.textSecondary,
};

const TABS = ['draft', 'approved', 'sent', 'received', 'cancelled'];

const PORow = ({ po, onApprove, onCancel }) => {
  const statusColor = STATUS_COLORS[po.status] || colors.textSecondary;
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={styles.rowLeft}>
          <Text style={styles.poNumber}>{po.poNumber || po._id?.slice(-8)}</Text>
          <Text style={styles.supplier}>{po.supplier || 'Unknown supplier'}</Text>
          <Text style={styles.lines}>{po.lines?.length || 0} line{po.lines?.length !== 1 ? 's' : ''} · ₹{(po.totalCost ?? 0).toLocaleString()}</Text>
          <Text style={styles.date}>{new Date(po.createdAt).toLocaleDateString()}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{po.status?.toUpperCase()}</Text>
        </View>
      </View>
      {po.status === 'draft' && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.approveBtn} onPress={() => onApprove(po)}>
            <Icon name="check" size={14} color="#fff" />
            <Text style={styles.approveBtnText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => onCancel(po)}>
            <Icon name="close" size={14} color={colors.error} />
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const PurchaseOrdersScreen = () => {
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('draft');
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const load = useCallback(async () => {
    try {
      const data = await getPurchaseOrders({ status: tab, limit: 50 });
      if (__DEV__) {
        console.log('[PurchaseOrders] response keys:', Object.keys(data || {}));
        console.log('[PurchaseOrders] count:', data?.items?.length ?? 0, '| total:', data?.total, '| raw:', JSON.stringify(data)?.slice(0, 500));
        if (data?.items?.[0]) console.log('[PurchaseOrders] item[0] keys:', Object.keys(data.items[0]));
      }
      // Backend returns { items, total }
      setPos(data?.items || data?.purchaseOrders || []);
    } catch (e) {
      if (__DEV__) console.error('[PurchaseOrders] load error:', e.message);
    } finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useEffect(() => { setLoading(true); load(); }, [tab]);

  const handleApprove = (po) => {
    showAlert('Approve PO', `Approve ${po.poNumber || 'this PO'}?`, 'info', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', style: 'default', onPress: async () => {
        try { await approvePurchaseOrder(po._id); load(); }
        catch (e) { showAlert('Error', e.message, 'error'); }
      }},
    ]);
  };

  const handleCancel = (po) => {
    showAlert('Cancel PO', 'Are you sure?', 'warning', [
      { text: 'No', style: 'cancel' },
      { text: 'Cancel PO', style: 'destructive', onPress: async () => {
        try { await cancelPurchaseOrder(po._id); load(); }
        catch (e) { showAlert('Error', e.message, 'error'); }
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <View style={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading && pos.length === 0
        ? <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        : (
          <FlatList
            data={pos}
            keyExtractor={p => p._id || String(Math.random())}
            renderItem={({ item }) => <PORow po={item} onApprove={handleApprove} onCancel={handleCancel} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}
            contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 32 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Icon name="shopping-cart" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>No {tab} purchase orders</Text>
              </View>
            }
          />
        )
      }
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
  tabRow: { flexDirection: 'row', backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 8 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontFamily: fonts.medium, fontSize: 10, color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontFamily: fonts.bold },
  row: { backgroundColor: colors.background, borderRadius: 12, padding: 14, elevation: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rowLeft: { flex: 1 },
  poNumber: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  supplier: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, marginTop: 2 },
  lines: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  date: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontFamily: fonts.bold, fontSize: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.success, paddingVertical: 8, borderRadius: 8 },
  approveBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fonts.xs },
  cancelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.error + '15', borderWidth: 1, borderColor: colors.error + '44', paddingVertical: 8, borderRadius: 8 },
  cancelBtnText: { color: colors.error, fontFamily: fonts.bold, fontSize: fonts.xs },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary },
});

export default PurchaseOrdersScreen;

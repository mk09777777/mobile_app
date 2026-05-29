import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, TextInput, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../constants/colors';
import { fonts } from '../../../constants/fonts';
import Icon from '../../../components/common/Icon';
import BrandedAlert from '../../../components/common/BrandedAlert';
import { getDiamonds, updateDiamond } from '../../../services/productionApi';

const DiamondRow = ({ diamond, onEdit }) => (
  <TouchableOpacity style={styles.row} onPress={() => onEdit(diamond)} activeOpacity={0.85}>
    <View style={styles.rowLeft}>
      <Text style={styles.code} numberOfLines={1}>{diamond.code}</Text>
      <Text style={styles.sub}>{diamond.gSize} · {diamond.sieve} · {diamond.diaSizeMM}mm</Text>
      <View style={styles.statsRow}>
        {diamond.costPerStone != null && <Text style={styles.stat}>₹{diamond.costPerStone}/stone</Text>}
        {diamond.reorderThreshold != null && <Text style={styles.stat}>Reorder @ {diamond.reorderThreshold}</Text>}
      </View>
    </View>
    <View style={styles.rowRight}>
      <View style={[styles.activeBadge, { backgroundColor: diamond.active ? colors.success + '22' : colors.error + '22' }]}>
        <Text style={[styles.activeText, { color: diamond.active ? colors.success : colors.error }]}>
          {diamond.active ? 'Active' : 'Inactive'}
        </Text>
      </View>
      {diamond.preferredSupplier && <Text style={styles.supplier} numberOfLines={1}>{diamond.preferredSupplier}</Text>}
    </View>
  </TouchableOpacity>
);

const DiamondMasterScreen = ({ navigation }) => {
  const [diamonds, setDiamonds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  // Debounce search so we don't fire a request on every keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef(null);
  const handleSearchChange = (text) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(text), 300);
  };

  const load = useCallback(async () => {
    try {
      const params = {};
      if (debouncedSearch) params.q = debouncedSearch;
      const data = await getDiamonds(params);
      if (__DEV__) console.log('[Inventory] diamonds count:', (data?.items || []).length);
      setDiamonds(data?.items || data?.diamonds || []);
    } catch (e) {
      if (__DEV__) console.error('[Inventory] load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { setLoading(true); load(); }, [debouncedSearch]);

  const openEdit = (d) => {
    setEditTarget(d);
    setEditForm({
      costPerStone: String(d.costPerStone ?? ''),
      reorderThreshold: String(d.reorderThreshold ?? ''),
      reorderQty: String(d.reorderQty ?? ''),
      procurementLeadTimeDays: String(d.procurementLeadTimeDays ?? ''),
      preferredSupplier: d.preferredSupplier || '',
      clarity: d.clarity || '',
      color: d.color || '',
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {};
      if (editForm.costPerStone) payload.costPerStone = Number(editForm.costPerStone);
      if (editForm.reorderThreshold) payload.reorderThreshold = Number(editForm.reorderThreshold);
      if (editForm.reorderQty) payload.reorderQty = Number(editForm.reorderQty);
      if (editForm.procurementLeadTimeDays) payload.procurementLeadTimeDays = Number(editForm.procurementLeadTimeDays);
      if (editForm.preferredSupplier) payload.preferredSupplier = editForm.preferredSupplier;
      if (editForm.clarity) payload.clarity = editForm.clarity;
      if (editForm.color) payload.color = editForm.color;
      await updateDiamond(editTarget.code, payload);
      setEditTarget(null);
      load();
    } catch (e) { showAlert('Error', e.message, 'error'); }
    finally { setSaving(false); }
  };

  if (loading && diamonds.length === 0) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      {/* Quick nav to related ledger screens */}
      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigation?.navigate('DiamondLedger')}>
          <Icon name="receipt-long" size={16} color={colors.primary} />
          <Text style={styles.navBtnText}>Diamond Ledger</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigation?.navigate('MetalLedger')}>
          <Icon name="scale" size={16} color={colors.primary} />
          <Text style={styles.navBtnText}>Metal Ledger</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigation?.navigate('MaterialLoss')}>
          <Icon name="warning" size={16} color={colors.warning} />
          <Text style={[styles.navBtnText, { color: colors.warning }]}>Material Loss</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search code, gSize, sieve…"
            value={search}
            onChangeText={handleSearchChange}
            placeholderTextColor={colors.textLight}
          />
        </View>
      </View>

      <FlatList
        data={diamonds}
        keyExtractor={d => d.code || String(Math.random())}
        renderItem={({ item }) => <DiamondRow diamond={item} onEdit={openEdit} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}
        contentContainerStyle={{ padding: 12, gap: 6, paddingBottom: 32 }}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No diamonds found</Text></View>}
      />

      {/* Edit Modal */}
      <Modal visible={!!editTarget} animationType="slide" transparent onRequestClose={() => setEditTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Diamond</Text>
              <TouchableOpacity onPress={() => setEditTarget(null)}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            {editTarget && <Text style={styles.modalCode}>{editTarget.code}</Text>}
            <ScrollView>
              {[
                { key: 'costPerStone', label: 'Cost per Stone (₹)', kb: 'numeric' },
                { key: 'reorderThreshold', label: 'Reorder Threshold (stones)', kb: 'numeric' },
                { key: 'reorderQty', label: 'Reorder Qty', kb: 'numeric' },
                { key: 'procurementLeadTimeDays', label: 'Lead Time (days)', kb: 'numeric' },
                { key: 'preferredSupplier', label: 'Preferred Supplier', kb: 'default' },
                { key: 'clarity', label: 'Clarity', kb: 'default' },
                { key: 'color', label: 'Color', kb: 'default' },
              ].map(({ key, label, kb }) => (
                <View key={key} style={styles.field}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editForm[key]}
                    onChangeText={v => setEditForm(p => ({ ...p, [key]: v }))}
                    keyboardType={kb}
                    placeholderTextColor={colors.textLight}
                  />
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.saveBtn, saving && styles.btnDisabled]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : null}
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  searchRow: { padding: 12, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.backgroundSecondary, borderRadius: 10, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, marginLeft: 8, fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textPrimary },
  row: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: 10, padding: 14, elevation: 1 },
  rowLeft: { flex: 1 },
  code: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  sub: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  stat: { fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary },
  rowRight: { alignItems: 'flex-end', gap: 4, justifyContent: 'flex-start' },
  activeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  activeText: { fontFamily: fonts.bold, fontSize: 10 },
  supplier: { fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary, maxWidth: 100 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { fontFamily: fonts.bold, fontSize: fonts.lg, color: colors.textPrimary },
  modalCode: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginBottom: 16 },
  field: { marginBottom: 14 },
  fieldLabel: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textSecondary, marginBottom: 4 },
  fieldInput: {
    backgroundColor: colors.backgroundSecondary, borderRadius: 8, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textPrimary,
  },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fonts.base },
  navRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  navBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.backgroundSecondary, borderRadius: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  navBtnText: { fontFamily: fonts.medium, fontSize: 10, color: colors.primary },
});

export default DiamondMasterScreen;

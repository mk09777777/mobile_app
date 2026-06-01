import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../constants/colors';
import { fonts } from '../../../constants/fonts';
import Icon from '../../../components/common/Icon';
import BrandedAlert from '../../../components/common/BrandedAlert';
import { getDiamonds, getDiamondLedger, addLedgerEntry } from '../../../services/productionApi';

const MOVEMENT_ICONS = {
  receipt: 'add-circle',
  allocation: 'link',
  consumption: 'remove-circle',
  return: 'replay',
  adjustment: 'tune',
  loss: 'warning',
};
const MOVEMENT_COLORS = {
  receipt: colors.success,
  allocation: colors.warning,
  consumption: colors.error,
  return: colors.info,
  adjustment: colors.primary,
  loss: colors.error,
};

const EMPTY_FORM = { movementType: 'receipt', quantity: '', referenceDoc: '', notes: '' };
// Admin-writable entry types: receipt (GRN), return (from cancelled orders),
// loss (write-off for broken/chipped stones), adjustment (manual correction).
// allocation and consumption are written programmatically by the system.
const TYPES = ['receipt', 'return', 'loss', 'adjustment'];

// Quantity sign convention (spec):
//   receipt / return  → POSITIVE  (stones arriving)
//   loss              → NEGATIVE  (stones gone)
//   adjustment        → either sign
const QTY_HINT = {
  receipt:    'e.g. 100  (positive — stones received)',
  return:     'e.g. 25   (positive — stones returned from order)',
  loss:       'e.g. -3   (negative — broken / chipped / misplaced)',
  adjustment: 'e.g. -2 or +5  (signed correction)',
};

const LedgerRow = ({ entry, runningBalance }) => {
  const icon = MOVEMENT_ICONS[entry.movementType] || 'circle';
  const col = MOVEMENT_COLORS[entry.movementType] || colors.textSecondary;
  const signed = entry.quantity > 0 ? `+${entry.quantity}` : `${entry.quantity}`;
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: col + '20' }]}>
        <Icon name={icon} size={20} color={col} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowType}>{entry.movementType?.charAt(0).toUpperCase() + entry.movementType?.slice(1)}</Text>
        <Text style={styles.rowRef}>{entry.referenceDoc || entry.jobCardId || '—'}</Text>
        {entry.notes ? <Text style={styles.rowNotes}>{entry.notes}</Text> : null}
        <Text style={styles.rowDate}>{entry.at ? new Date(entry.at).toLocaleString() : '—'}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowQty, { color: entry.quantity >= 0 ? colors.success : colors.error }]}>{signed}</Text>
        <Text style={styles.rowBal}>Bal: {runningBalance}</Text>
      </View>
    </View>
  );
};

const DiamondLedgerScreen = () => {
  const [diamonds, setDiamonds] = useState([]);
  const [selectedCode, setSelectedCode] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [stats, setStats] = useState(null); // { onHand, totalReceived, totalLost, totalAllocated, totalConsumed }
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));
  const [diamondSearch, setDiamondSearch] = useState('');

  // Load diamond list for picker
  useEffect(() => {
    getDiamonds({ limit: 50 })
      .then(d => {
        if (__DEV__) {
          console.log('[DiamondLedger] diamonds list keys:', Object.keys(d || {}));
          console.log('[DiamondLedger] diamonds count:', d?.items?.length ?? 0, '| raw:', JSON.stringify(d)?.slice(0, 400));
          if (d?.items?.[0]) console.log('[DiamondLedger] diamond[0] keys:', Object.keys(d.items[0]));
        }
        setDiamonds(d?.items || d?.diamonds || []);
      })
      .catch(e => { if (__DEV__) console.error('[DiamondLedger] diamonds error:', e.message); });
  }, []);

  const loadLedger = useCallback(async () => {
    if (!selectedCode) return;
    setLoading(true);
    setStats(null); // clear previous SKU's stats immediately
    try {
      const data = await getDiamondLedger(selectedCode, 100);
      if (__DEV__) {
        console.log('[DiamondLedger] ledger keys:', Object.keys(data || {}));
        console.log('[DiamondLedger] entries:', (data?.items || data?.entries || data?.ledger)?.length ?? 0, '| stats:', JSON.stringify(data?.stats));
        const firstEntry = data?.items?.[0] || data?.entries?.[0] || data?.ledger?.[0];
        if (firstEntry) console.log('[DiamondLedger] entry[0] keys:', Object.keys(firstEntry));
      }
      const entries = data?.items || data?.entries || data?.ledger || [];
      setLedger(entries);

      // stats is returned by the updated backend alongside entries.
      // If the backend hasn't been restarted yet, derive the same numbers
      // client-side from the entries we already have (single pass).
      if (data?.stats) {
        setStats(data.stats);
      } else if (entries.length > 0) {
        const computed = entries.reduce(
          (acc, e) => {
            const qty = e.quantity ?? 0;
            acc.onHand += qty;
            if (e.movementType === 'receipt')    acc.totalReceived  += qty;
            if (e.movementType === 'return')     acc.totalReturned  += qty;
            if (e.movementType === 'loss')       acc.totalLost      += Math.abs(qty);
            if (e.movementType === 'allocation') acc.totalAllocated += Math.abs(qty);
            if (e.movementType === 'consumption')acc.totalConsumed  += Math.abs(qty);
            return acc;
          },
          { onHand: 0, totalReceived: 0, totalReturned: 0, totalLost: 0, totalAllocated: 0, totalConsumed: 0 }
        );
        setStats(computed);
        if (__DEV__) console.log('[DiamondLedger] stats derived from entries:', computed);
      }
    } catch (e) {
      if (__DEV__) console.error('[DiamondLedger] ledger error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCode]);

  useEffect(() => { loadLedger(); }, [loadLedger]);

  // Running balance — cumulative from oldest to newest
  const withBalance = () => {
    let bal = 0;
    return [...ledger].reverse().map(e => {
      bal += e.quantity ?? 0;
      return { ...e, _runningBalance: bal };
    }).reverse();
  };

  const handleAdd = async () => {
    if (!form.quantity || isNaN(Number(form.quantity))) {
      showAlert('Required', 'Quantity is required', 'warning'); return;
    }
    setSaving(true);
    try {
      await addLedgerEntry({ ...form, quantity: Number(form.quantity), diamondCode: selectedCode });
      setAddVisible(false);
      setForm(EMPTY_FORM);
      loadLedger();
    } catch (e) { showAlert('Error', e.message, 'error'); }
    finally { setSaving(false); }
  };

  const setF = k => v => setForm(p => ({ ...p, [k]: v }));

  const filteredDiamonds = diamonds.filter(d =>
    !diamondSearch || d.code?.toLowerCase().includes(diamondSearch.toLowerCase()) ||
    d.gSize?.toLowerCase().includes(diamondSearch.toLowerCase())
  );

  const displayCode = (code) => {
    if (!code) return '';
    const parts = code.split('|');
    return parts.length === 3 ? `${parts[0]} · ${parts[1]} · ${parts[2]}mm` : code;
  };

  const ledgerWithBal = withBalance();

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      {/* SKU picker */}
      <TouchableOpacity style={styles.skuBar} onPress={() => setPickerVisible(true)}>
        <Icon name="diamond" size={18} color={colors.primary} />
        <Text style={styles.skuBarText} numberOfLines={1}>
          {selectedCode ? displayCode(selectedCode) : 'Tap to select a diamond SKU'}
        </Text>
        <Icon name="expand-more" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Stone summary card — On Hand / Received / Lost */}
      {selectedCode && stats && (
        <View style={styles.statsRow}>
          <View style={[styles.statChip, { borderColor: colors.primary + '60' }]}>
            <Icon name="inventory" size={14} color={colors.primary} />
            <Text style={styles.statLabel}>On Hand</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.onHand}</Text>
          </View>
          <View style={[styles.statChip, { borderColor: colors.success + '60' }]}>
            <Icon name="add-circle" size={14} color={colors.success} />
            <Text style={styles.statLabel}>Received</Text>
            <Text style={[styles.statValue, { color: colors.success }]}>{stats.totalReceived}</Text>
          </View>
          <View style={[styles.statChip, { borderColor: colors.warning + '60' }]}>
            <Icon name="link" size={14} color={colors.warning} />
            <Text style={styles.statLabel}>Allocated</Text>
            <Text style={[styles.statValue, { color: colors.warning }]}>{stats.totalAllocated}</Text>
          </View>
          <View style={[styles.statChip, { borderColor: colors.error + '60' }]}>
            <Icon name="warning" size={14} color={colors.error} />
            <Text style={styles.statLabel}>Lost</Text>
            <Text style={[styles.statValue, { color: stats.totalLost > 0 ? colors.error : colors.textSecondary }]}>{stats.totalLost}</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : !selectedCode ? (
        <View style={styles.empty}>
          <Icon name="diamond" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyText}>Select a diamond SKU above to view its ledger</Text>
        </View>
      ) : (
        <FlatList
          data={ledgerWithBal}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <LedgerRow entry={item} runningBalance={item._runningBalance} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLedger(); }} colors={[colors.primary]} />}
          contentContainerStyle={{ padding: 12, gap: 6, paddingBottom: 80 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="receipt-long" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText}>No ledger entries for this SKU</Text>
              <Text style={styles.emptySub}>Use + to add a GRN or adjustment</Text>
            </View>
          }
        />
      )}

      {selectedCode && (
        <TouchableOpacity style={styles.fab} onPress={() => setAddVisible(true)}>
          <Icon name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* SKU Picker Modal */}
      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Diamond SKU</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by code or gSize…"
              placeholderTextColor={colors.textSecondary}
              value={diamondSearch}
              onChangeText={setDiamondSearch}
            />
            <FlatList
              data={filteredDiamonds}
              keyExtractor={d => d.code || String(Math.random())}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerRow, selectedCode === item.code && styles.pickerRowActive]}
                  onPress={() => { setSelectedCode(item.code); setPickerVisible(false); }}
                >
                  <Text style={[styles.pickerCode, selectedCode === item.code && styles.pickerCodeActive]}>{displayCode(item.code)}</Text>
                  <Text style={styles.pickerSub}>{item.gSize} · {item.sieve}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No diamonds found</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* Add Entry Modal */}
      <Modal visible={addVisible} animationType="slide" transparent onRequestClose={() => setAddVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Ledger Entry</Text>
              <TouchableOpacity onPress={() => setAddVisible(false)}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.typeRow}>
                {TYPES.map(t => (
                  <TouchableOpacity key={t} style={[styles.typeBtn, form.movementType === t && styles.typeBtnActive]} onPress={() => setF('movementType')(t)}>
                    <Text style={[styles.typeBtnText, form.movementType === t && styles.typeBtnTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Quantity *</Text>
              <TextInput style={styles.fieldInput} value={form.quantity} onChangeText={setF('quantity')} keyboardType="numeric" placeholderTextColor={colors.textSecondary} placeholder={QTY_HINT[form.movementType] || 'Quantity (signed)'} />
              <Text style={styles.fieldLabel}>Reference Doc</Text>
              <TextInput style={styles.fieldInput} value={form.referenceDoc} onChangeText={setF('referenceDoc')} placeholderTextColor={colors.textSecondary} placeholder="GRN#, PO#, etc." />
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput style={[styles.fieldInput, { height: 80 }]} value={form.notes} onChangeText={setF('notes')} multiline placeholderTextColor={colors.textSecondary} placeholder="Optional notes" />
            </ScrollView>
            <TouchableOpacity style={[styles.saveBtn, saving && styles.btnDisabled]} onPress={handleAdd} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : null}
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Add Entry'}</Text>
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
  skuBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.backgroundSecondary, margin: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border },
  skuBarText: { flex: 1, fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.textPrimary },
  statsRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  statChip: { flex: 1, alignItems: 'center', backgroundColor: colors.background, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 4, elevation: 1, borderWidth: 1, gap: 2 },
  statLabel: { fontFamily: fonts.regular, fontSize: 9, color: colors.textSecondary },
  statValue: { fontFamily: fonts.bold, fontSize: fonts.base },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 10, padding: 12, elevation: 1 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowBody: { flex: 1 },
  rowType: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  rowRef: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  rowNotes: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2, fontStyle: 'italic' },
  rowDate: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowQty: { fontFamily: fonts.bold, fontSize: fonts.base },
  rowBal: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 12 },
  emptyText: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.textSecondary, textAlign: 'center' },
  emptySub: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, textAlign: 'center' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontFamily: fonts.bold, fontSize: fonts.lg, color: colors.textPrimary },
  searchInput: { backgroundColor: colors.backgroundSecondary, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textPrimary, marginBottom: 8 },
  pickerRow: { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  pickerRowActive: { backgroundColor: colors.primaryExtraLight },
  pickerCode: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  pickerCodeActive: { color: colors.primary },
  pickerSub: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  typeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.backgroundSecondary, alignItems: 'center' },
  typeBtnActive: { backgroundColor: colors.primary },
  typeBtnText: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textSecondary },
  typeBtnTextActive: { color: '#fff' },
  fieldLabel: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textSecondary, marginBottom: 4, marginTop: 8 },
  fieldInput: { backgroundColor: colors.backgroundSecondary, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textPrimary },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fonts.base },
});

export default DiamondLedgerScreen;

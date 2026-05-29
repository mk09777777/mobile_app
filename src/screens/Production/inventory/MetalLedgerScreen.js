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
import { getJobCards, getMetalLedgerByJobCard, addMetalLedgerEntry } from '../../../services/productionApi';

const MOVEMENT_ICONS = { issue: 'send', return: 'replay', loss: 'warning', adjustment: 'tune' };
const MOVEMENT_COLORS = { issue: colors.primary, return: colors.success, loss: colors.error, adjustment: colors.warning };
const MOVEMENT_TYPES = ['issue', 'return', 'loss', 'adjustment'];

const EMPTY_FORM = { movementType: 'issue', metalType: 'GOLD', weightGrams: '', stageCode: '', notes: '' };

const MetalLedgerRow = ({ entry }) => {
  const col = MOVEMENT_COLORS[entry.movementType] || colors.textSecondary;
  const icon = MOVEMENT_ICONS[entry.movementType] || 'circle';
  const signed = entry.weightGrams > 0 ? `+${entry.weightGrams}g` : `${entry.weightGrams}g`;
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: col + '20' }]}>
        <Icon name={icon} size={20} color={col} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowType}>{entry.movementType?.charAt(0).toUpperCase() + entry.movementType?.slice(1)} · {entry.metalType}</Text>
        {entry.stageCode ? <Text style={styles.rowSub}>Stage: {entry.stageCode}</Text> : null}
        {entry.notes ? <Text style={styles.rowNotes}>{entry.notes}</Text> : null}
        <Text style={styles.rowDate}>{entry.at ? new Date(entry.at).toLocaleString() : '—'}</Text>
      </View>
      <Text style={[styles.rowWeight, { color: entry.weightGrams >= 0 ? colors.success : colors.error }]}>{signed}</Text>
    </View>
  );
};

const MetalLedgerScreen = ({ route }) => {
  const openPieceCode = route?.params?.gatiPieceCode;
  const [pieces, setPieces] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedCode, setSelectedCode] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [netGrams, setNetGrams] = useState(0);
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
  const [search, setSearch] = useState('');

  // Load pieces for picker
  useEffect(() => {
    getJobCards({ limit: 200 })
      .then(d => {
        if (__DEV__) {
          console.log('[MetalLedger] pieces list keys:', Object.keys(d || {}));
          console.log('[MetalLedger] pieces count:', d?.items?.length ?? 0, '| raw:', JSON.stringify(d)?.slice(0, 400));
          if (d?.items?.[0]) console.log('[MetalLedger] piece[0] keys:', Object.keys(d.items[0]));
        }
        setPieces(d?.items || []);
        // If opened with a gatiPieceCode, find and auto-select
        if (openPieceCode) {
          const found = (d?.items || []).find(p => p.gatiPieceCode === openPieceCode);
          if (found) { setSelectedId(found._id); setSelectedCode(found.gatiPieceCode); }
        }
      })
      .catch(e => { if (__DEV__) console.error('[MetalLedger] pieces error:', e.message); });
  }, [openPieceCode]);

  const loadLedger = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const data = await getMetalLedgerByJobCard(selectedId);
      if (__DEV__) {
        console.log('[MetalLedger] ledger keys:', Object.keys(data || {}));
        console.log('[MetalLedger] entries:', (data?.items || data?.entries || data?.ledger)?.length ?? 0, '| netGrams:', data?.netGrams, '| raw:', JSON.stringify(data)?.slice(0, 500));
        const firstEntry = data?.items?.[0] || data?.entries?.[0] || data?.ledger?.[0];
        if (firstEntry) console.log('[MetalLedger] entry[0] keys:', Object.keys(firstEntry));
      }
      const entries = data?.items || data?.entries || data?.ledger || [];
      setLedger(entries);
      setNetGrams(data?.netGrams ?? entries.reduce((s, e) => s + (e.weightGrams ?? 0), 0));
    } catch (e) {
      if (__DEV__) console.error('[MetalLedger] load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedId]);

  useEffect(() => { loadLedger(); }, [loadLedger]);

  const handleAdd = async () => {
    if (!form.weightGrams || isNaN(Number(form.weightGrams))) {
      showAlert('Required', 'Weight (grams) is required', 'warning'); return;
    }
    setSaving(true);
    try {
      await addMetalLedgerEntry({ ...form, weightGrams: Number(form.weightGrams), jobCardId: selectedId });
      setAddVisible(false);
      setForm(EMPTY_FORM);
      loadLedger();
    } catch (e) { showAlert('Error', e.message, 'error'); }
    finally { setSaving(false); }
  };

  const setF = k => v => setForm(p => ({ ...p, [k]: v }));
  const filtered = pieces.filter(p => !search || p.gatiPieceCode?.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      {/* JobCard picker */}
      <TouchableOpacity style={styles.skuBar} onPress={() => setPickerVisible(true)}>
        <Icon name="assignment" size={18} color={colors.primary} />
        <Text style={styles.skuBarText} numberOfLines={1}>
          {selectedCode || 'Tap to select a piece (JobCard)'}
        </Text>
        <Icon name="expand-more" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {selectedId && (
        <View style={styles.netCard}>
          <Icon name="scale" size={20} color={colors.primary} />
          <Text style={styles.netLabel}>Net metal weight:</Text>
          <Text style={[styles.netValue, { color: netGrams >= 0 ? colors.success : colors.error }]}>{netGrams.toFixed(3)}g</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : !selectedId ? (
        <View style={styles.empty}>
          <Icon name="scale" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyText}>Select a piece above to view its metal ledger</Text>
        </View>
      ) : (
        <FlatList
          data={ledger}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <MetalLedgerRow entry={item} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLedger(); }} colors={[colors.primary]} />}
          contentContainerStyle={{ padding: 12, gap: 6, paddingBottom: 80 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="receipt-long" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText}>No metal ledger entries</Text>
              <Text style={styles.emptySub}>Use + to add issue / return / loss entries</Text>
            </View>
          }
        />
      )}

      {selectedId && (
        <TouchableOpacity style={styles.fab} onPress={() => setAddVisible(true)}>
          <Icon name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Piece Picker Modal */}
      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Piece (JobCard)</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <TextInput style={styles.searchInput} placeholder="Search by piece code…" placeholderTextColor={colors.textSecondary} value={search} onChangeText={setSearch} />
            <FlatList
              data={filtered}
              keyExtractor={p => p._id || String(Math.random())}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerRow, selectedId === item._id && styles.pickerRowActive]}
                  onPress={() => { setSelectedId(item._id); setSelectedCode(item.gatiPieceCode); setPickerVisible(false); }}
                >
                  <Text style={[styles.pickerCode, selectedId === item._id && styles.pickerCodeActive]}>{item.gatiPieceCode}</Text>
                  <Text style={styles.pickerSub}>{item.styleNo} · {item.customerCode}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No pieces found</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* Add Entry Modal */}
      <Modal visible={addVisible} animationType="slide" transparent onRequestClose={() => setAddVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Metal Entry</Text>
              <TouchableOpacity onPress={() => setAddVisible(false)}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.typeRow}>
                {MOVEMENT_TYPES.map(t => (
                  <TouchableOpacity key={t} style={[styles.typeBtn, form.movementType === t && styles.typeBtnActive]} onPress={() => setF('movementType')(t)}>
                    <Text style={[styles.typeBtnText, form.movementType === t && styles.typeBtnTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Metal Type</Text>
              <TextInput style={styles.fieldInput} value={form.metalType} onChangeText={setF('metalType')} placeholderTextColor={colors.textSecondary} placeholder="GOLD, SILVER, etc." />
              <Text style={styles.fieldLabel}>Weight (grams) *</Text>
              <TextInput style={styles.fieldInput} value={form.weightGrams} onChangeText={setF('weightGrams')} keyboardType="decimal-pad" placeholderTextColor={colors.textSecondary} placeholder="e.g. 5.25 (use - for returns)" />
              <Text style={styles.fieldLabel}>Stage Code</Text>
              <TextInput style={styles.fieldInput} value={form.stageCode} onChangeText={setF('stageCode')} placeholderTextColor={colors.textSecondary} placeholder="e.g. FILING (optional)" />
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput style={[styles.fieldInput, { height: 60 }]} value={form.notes} onChangeText={setF('notes')} multiline placeholderTextColor={colors.textSecondary} placeholder="Optional notes" />
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
  netCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primaryExtraLight, marginHorizontal: 12, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  netLabel: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.textSecondary, flex: 1 },
  netValue: { fontFamily: fonts.bold, fontSize: fonts.base },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 10, padding: 12, elevation: 1 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowBody: { flex: 1 },
  rowType: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  rowSub: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  rowNotes: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2, fontStyle: 'italic' },
  rowDate: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  rowWeight: { fontFamily: fonts.bold, fontSize: fonts.base },
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
  typeRow: { flexDirection: 'row', gap: 6, marginBottom: 14, flexWrap: 'wrap' },
  typeBtn: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.backgroundSecondary },
  typeBtnActive: { backgroundColor: colors.primary },
  typeBtnText: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textSecondary },
  typeBtnTextActive: { color: '#fff' },
  fieldLabel: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textSecondary, marginBottom: 4, marginTop: 8 },
  fieldInput: { backgroundColor: colors.backgroundSecondary, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textPrimary },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fonts.base },
});

export default MetalLedgerScreen;

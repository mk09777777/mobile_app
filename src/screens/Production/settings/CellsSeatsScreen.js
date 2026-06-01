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
import { getCells, createCell, updateCell, deleteCell, getSeats, createSeat, deleteSeat } from '../../../services/productionApi';

const EMPTY_CELL_FORM = { code: '', name: '', description: '', stageCodes: '' };
const EMPTY_SEAT_FORM = { code: '', cellCode: '', stageCodes: '' };

const CellRow = ({ cell, onEdit, onDelete, onToggleSeats, seatsOpen, seats, loadingSeats, onAddSeat, onDeleteSeat }) => (
  <View style={styles.cellCard}>
    <View style={styles.cellHeader}>
      <View style={styles.cellLeft}>
        <Text style={styles.cellCode}>{cell.code}</Text>
        <Text style={styles.cellName}>{cell.name}</Text>
        {cell.stageCodes?.length > 0 && (
          <View style={styles.stageChips}>
            {cell.stageCodes.map(s => (
              <View key={s} style={styles.chip}><Text style={styles.chipText}>{s}</Text></View>
            ))}
          </View>
        )}
      </View>
      <View style={styles.cellActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit(cell)}><Icon name="edit" size={16} color={colors.primary} /></TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onDelete(cell)}><Icon name="delete" size={16} color={colors.error} /></TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onToggleSeats(cell.code)}>
          <Icon name={seatsOpen ? 'expand-less' : 'expand-more'} size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
    {seatsOpen && (
      <View style={styles.seatsSection}>
        <View style={styles.seatsSectionHeader}>
          <Text style={styles.seatsTitle}>Seats ({seats?.length || 0})</Text>
          <TouchableOpacity style={styles.addSeatBtn} onPress={() => onAddSeat(cell.code)}>
            <Icon name="add" size={14} color="#fff" />
            <Text style={styles.addSeatText}>Add Seat</Text>
          </TouchableOpacity>
        </View>
        {loadingSeats ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : seats?.length > 0 ? (
          seats.map(seat => (
            <View key={seat.code || seat._id} style={styles.seatRow}>
              <Text style={styles.seatCode}>{seat.code}</Text>
              {seat.stageCodes?.length > 0 && <Text style={styles.seatStages}>{seat.stageCodes.join(', ')}</Text>}
              <TouchableOpacity onPress={() => onDeleteSeat(seat)} style={styles.seatDelete}>
                <Icon name="delete-outline" size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={styles.noSeatsText}>No seats — tap "Add Seat" to create one</Text>
        )}
      </View>
    )}
  </View>
);

const CellsSeatsScreen = () => {
  const [cells, setCells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedCell, setExpandedCell] = useState(null);
  const [seatsMap, setSeatsMap] = useState({}); // { cellCode: Seat[] }
  const [loadingSeatsMap, setLoadingSeatsMap] = useState({});
  const [editTarget, setEditTarget] = useState(null); // 'new', Cell object, or null
  const [form, setForm] = useState(EMPTY_CELL_FORM);
  const [saving, setSaving] = useState(false);
  const [addSeatModal, setAddSeatModal] = useState(null); // cellCode or null
  const [seatForm, setSeatForm] = useState(EMPTY_SEAT_FORM);
  const [savingSeat, setSavingSeat] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const load = useCallback(async () => {
    try {
      const data = await getCells();
      if (__DEV__) {
        console.log('[CellsSeats] cells response keys:', Object.keys(data || {}));
        console.log('[CellsSeats] cells count:', data?.cells?.length ?? data?.items?.length ?? 0, '| raw:', JSON.stringify(data)?.slice(0, 500));
        const firstCell = data?.cells?.[0] || data?.items?.[0];
        if (firstCell) console.log('[CellsSeats] cell[0] keys:', Object.keys(firstCell));
      }
      setCells(data?.cells || data?.items || []);
    } catch (e) {
      if (__DEV__) console.error('[CellsSeats] load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadSeatsForCell = async (cellCode) => {
    setLoadingSeatsMap(p => ({ ...p, [cellCode]: true }));
    try {
      const data = await getSeats({ cellCode });
      if (__DEV__) {
        console.log('[CellsSeats] seats response keys:', Object.keys(data || {}));
        console.log('[CellsSeats] seats for', cellCode, '| count:', data?.seats?.length ?? data?.items?.length ?? 0, '| raw:', JSON.stringify(data)?.slice(0, 400));
        const firstSeat = data?.seats?.[0] || data?.items?.[0];
        if (firstSeat) console.log('[CellsSeats] seat[0] keys:', Object.keys(firstSeat));
      }
      setSeatsMap(p => ({ ...p, [cellCode]: data?.seats || data?.items || [] }));
    } catch (e) {
      if (__DEV__) console.error('[CellsSeats] seats error:', e.message);
    } finally {
      setLoadingSeatsMap(p => ({ ...p, [cellCode]: false }));
    }
  };

  const toggleSeats = (cellCode) => {
    if (expandedCell === cellCode) {
      setExpandedCell(null);
    } else {
      setExpandedCell(cellCode);
      if (!seatsMap[cellCode]) loadSeatsForCell(cellCode);
    }
  };

  const openNewCell = () => { setEditTarget('new'); setForm(EMPTY_CELL_FORM); };
  const openEditCell = (cell) => {
    setEditTarget(cell);
    setForm({ code: cell.code, name: cell.name || '', description: cell.description || '', stageCodes: (cell.stageCodes || []).join(', ') });
  };

  const saveCell = async () => {
    if (!form.code || !form.name) { showAlert('Required', 'Code and Name required', 'warning'); return; }
    setSaving(true);
    try {
      const payload = { ...form, stageCodes: form.stageCodes ? form.stageCodes.split(',').map(s => s.trim()).filter(Boolean) : [] };
      if (editTarget === 'new') await createCell(payload);
      else await updateCell(editTarget.code, payload);
      setEditTarget(null);
      load();
    } catch (e) { showAlert('Error', e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDeleteCell = (cell) => {
    showAlert('Delete Cell', `Delete "${cell.code}"?`, 'warning', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteCell(cell.code); load(); }
        catch (e) { showAlert('Error', e.message, 'error'); }
      }},
    ]);
  };

  const openAddSeat = (cellCode) => {
    setAddSeatModal(cellCode);
    setSeatForm({ ...EMPTY_SEAT_FORM, cellCode });
  };

  const saveSeat = async () => {
    if (!seatForm.code) { showAlert('Required', 'Seat code is required', 'warning'); return; }
    setSavingSeat(true);
    try {
      await createSeat({ ...seatForm, stageCodes: seatForm.stageCodes ? seatForm.stageCodes.split(',').map(s => s.trim()).filter(Boolean) : [] });
      setAddSeatModal(null);
      loadSeatsForCell(seatForm.cellCode);
    } catch (e) { showAlert('Error', e.message, 'error'); }
    finally { setSavingSeat(false); }
  };

  const handleDeleteSeat = (seat) => {
    showAlert('Delete Seat', `Delete seat "${seat.code}"?`, 'warning', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteSeat(seat.code); if (seat.cellCode || expandedCell) loadSeatsForCell(seat.cellCode || expandedCell); }
        catch (e) { showAlert('Error', e.message, 'error'); }
      }},
    ]);
  };

  const setF = k => v => setForm(p => ({ ...p, [k]: v }));
  const setSF = k => v => setSeatForm(p => ({ ...p, [k]: v }));

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={cells}
        keyExtractor={c => c.code || String(Math.random())}
        renderItem={({ item }) => (
          <CellRow
            cell={item}
            onEdit={openEditCell}
            onDelete={handleDeleteCell}
            onToggleSeats={toggleSeats}
            seatsOpen={expandedCell === item.code}
            seats={seatsMap[item.code]}
            loadingSeats={loadingSeatsMap[item.code]}
            onAddSeat={openAddSeat}
            onDeleteSeat={handleDeleteSeat}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 80 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="grid-view" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No cells defined</Text>
            <Text style={styles.emptySub}>Use + to create production cells. Each cell maps to one or more stages.</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={openNewCell}>
        <Icon name="add" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Cell Edit Modal */}
      <Modal visible={!!editTarget} animationType="slide" transparent onRequestClose={() => setEditTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editTarget === 'new' ? 'New Cell' : 'Edit Cell'}</Text>
              <TouchableOpacity onPress={() => setEditTarget(null)}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView>
              {[
                { key: 'code', label: 'Code (e.g. C1)', required: true, editable: editTarget === 'new' },
                { key: 'name', label: 'Name', required: true },
                { key: 'description', label: 'Description' },
                { key: 'stageCodes', label: 'Stage Codes (comma-separated, e.g. FILING, POLISH)' },
              ].map(({ key, label, required, editable = true }) => (
                <View key={key} style={styles.field}>
                  <Text style={styles.fieldLabel}>{label}{required ? ' *' : ''}</Text>
                  <TextInput
                    style={[styles.fieldInput, !editable && styles.fieldInputDisabled]}
                    value={form[key]}
                    onChangeText={setF(key)}
                    editable={editable}
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize={key === 'code' || key === 'stageCodes' ? 'characters' : 'none'}
                  />
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.saveBtn, saving && styles.btnDisabled]} onPress={saveCell} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : null}
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Cell'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Seat Add Modal */}
      <Modal visible={!!addSeatModal} animationType="slide" transparent onRequestClose={() => setAddSeatModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Seat to {addSeatModal}</Text>
              <TouchableOpacity onPress={() => setAddSeatModal(null)}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Seat Code *</Text>
              <TextInput style={styles.fieldInput} value={seatForm.code} onChangeText={setSF('code')} placeholderTextColor={colors.textSecondary} placeholder="e.g. S1" autoCapitalize="characters" />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Stage Codes (optional, comma-separated)</Text>
              <TextInput style={styles.fieldInput} value={seatForm.stageCodes} onChangeText={setSF('stageCodes')} placeholderTextColor={colors.textSecondary} placeholder="e.g. FILING" autoCapitalize="characters" />
            </View>
            <TouchableOpacity style={[styles.saveBtn, savingSeat && styles.btnDisabled]} onPress={saveSeat} disabled={savingSeat}>
              {savingSeat ? <ActivityIndicator color="#fff" size="small" /> : null}
              <Text style={styles.saveBtnText}>{savingSeat ? 'Saving…' : 'Add Seat'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <BrandedAlert visible={alertConfig.visible} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} buttons={alertConfig.buttons} onClose={hideAlert} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cellCard: { backgroundColor: colors.background, borderRadius: 12, elevation: 1, overflow: 'hidden' },
  cellHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 14 },
  cellLeft: { flex: 1 },
  cellCode: { fontFamily: fonts.bold, fontSize: fonts.base, color: colors.primary },
  cellName: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.textPrimary, marginTop: 2 },
  stageChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  chip: { backgroundColor: colors.primaryExtraLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  chipText: { fontFamily: fonts.medium, fontSize: 10, color: colors.primary },
  cellActions: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  actionBtn: { padding: 8 },
  seatsSection: { backgroundColor: colors.backgroundSecondary, padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
  seatsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  seatsTitle: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textSecondary },
  addSeatBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  addSeatText: { fontFamily: fonts.bold, fontSize: fonts.xs, color: '#fff' },
  seatRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  seatCode: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary, width: 60 },
  seatStages: { flex: 1, fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary },
  seatDelete: { padding: 4 },
  noSeatsText: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, fontStyle: 'italic', paddingVertical: 4 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 12 },
  emptyText: { fontFamily: fonts.bold, fontSize: fonts.base, color: colors.textSecondary },
  emptySub: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: fonts.bold, fontSize: fonts.lg, color: colors.textPrimary },
  field: { marginBottom: 14 },
  fieldLabel: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textSecondary, marginBottom: 4 },
  fieldInput: { backgroundColor: colors.backgroundSecondary, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textPrimary },
  fieldInputDisabled: { opacity: 0.5 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fonts.base },
});

export default CellsSeatsScreen;

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput, Switch, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../constants/colors';
import { fonts } from '../../../constants/fonts';
import Icon from '../../../components/common/Icon';
import BrandedAlert from '../../../components/common/BrandedAlert';
import { getStages, createStage, updateStage, deleteStage, devResetAll } from '../../../services/productionApi';

const EMPTY_FORM = { code: '', name: '', expectedDurationHours: '', isTerminal: false, isOptional: false, active: true };

// Reference list of predefined stages (seeded automatically by the backend on boot).
// This constant is kept here for documentation; stages are loaded live from the API.
const DEFAULT_STAGES = [
  { code: 'CAD',            name: 'CAD',             expectedDurationHours: 24 },
  { code: 'CAM',            name: 'CAM',             expectedDurationHours: 24 },
  { code: 'WAX',            name: 'Wax',             expectedDurationHours: 24 },
  { code: 'WAX_SET',        name: 'Wax Setting',     expectedDurationHours: 24 },
  { code: 'CASTING',        name: 'Casting',         expectedDurationHours: 24 },
  { code: 'CENTERING',      name: 'Centering',       expectedDurationHours: 24 },
  { code: 'GRN',            name: 'Grinding',        expectedDurationHours: 24 },
  { code: 'REFINING',       name: 'Refining',        expectedDurationHours: 24 },
  { code: 'FILING',         name: 'Filing',          expectedDurationHours: 24 },
  { code: 'ASSEMBLE',       name: 'Assemble',        expectedDurationHours: 24 },
  { code: 'POL',            name: 'Polish',          expectedDurationHours: 24 },
  { code: 'OTEC',           name: 'OTEC',            expectedDurationHours: 24, isOptional: true },
  { code: 'WFD',            name: 'WFD',             expectedDurationHours: 24, isOptional: true },
  { code: 'DIA_SET',        name: 'Diamond Setting', expectedDurationHours: 24 },
  { code: 'SETTING',        name: 'Setting',         expectedDurationHours: 24 },
  { code: 'FINAL_POLISH',   name: 'Final Polish',    expectedDurationHours: 24 },
  { code: 'QC',             name: 'Quality Check',   expectedDurationHours: 24 },
  { code: 'FINISHED_GOODS', name: 'Finished Goods',  expectedDurationHours: 24, isTerminal: true },
  { code: 'IGI',            name: 'IGI / GSL',       expectedDurationHours: 24 },
  { code: 'SAM',            name: 'Sampling',        expectedDurationHours: 24 },
  { code: 'MDL',            name: 'MDL',             expectedDurationHours: 24 },
];

const StageRow = ({ stage, onEdit, onDelete }) => (
  <View style={styles.row}>
    <View style={styles.rowLeft}>
      <Text style={styles.stageCode}>{stage.code}</Text>
      <Text style={styles.stageName}>{stage.name}</Text>
      {stage.expectedDurationHours ? <Text style={styles.stageSub}>{stage.expectedDurationHours}h expected</Text> : null}
      <View style={styles.pills}>
        {stage.isTerminal && <View style={styles.pill}><Text style={styles.pillText}>Terminal</Text></View>}
        {stage.isOptional && <View style={[styles.pill, styles.pillAlt]}><Text style={styles.pillText}>Optional</Text></View>}
        {!stage.active && <View style={[styles.pill, styles.pillInactive]}><Text style={styles.pillText}>Inactive</Text></View>}
      </View>
    </View>
    <View style={styles.rowActions}>
      <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(stage)}><Icon name="edit" size={16} color={colors.primary} /></TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(stage)}><Icon name="delete" size={16} color={colors.error} /></TouchableOpacity>
    </View>
  </View>
);

const StagesSettingsScreen = () => {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const load = useCallback(async () => {
    try {
      const data = await getStages();
      if (__DEV__) console.log('[Stages] load:', data?.stages?.length ?? 0, 'stages | raw:', JSON.stringify(data)?.slice(0, 200));
      setStages(data?.stages || data || []);
    } catch (e) {
      if (__DEV__) console.error('[Stages] load error:', e.message);
    }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditTarget('new'); setForm(EMPTY_FORM); };
  const openEdit = (stage) => { setEditTarget(stage); setForm({ ...EMPTY_FORM, ...stage, expectedDurationHours: String(stage.expectedDurationHours ?? '') }); };

  const save = async () => {
    if (!form.code || !form.name) { showAlert('Required', 'Code and Name are required', 'warning'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        expectedDurationHours: form.expectedDurationHours ? Number(form.expectedDurationHours) : undefined,
      };
      if (editTarget === 'new') await createStage(payload);
      else await updateStage(editTarget.code, payload);
      setEditTarget(null);
      load();
    } catch (e) { showAlert('Error', e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = (stage) => {
    showAlert('Delete Stage', `Delete "${stage.code}"? This may affect running imports.`, 'warning', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteStage(stage.code); load(); }
        catch (e) { showAlert('Error', e.message, 'error'); }
      }},
    ]);
  };

  const set = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const handleDevReset = () => {
    showAlert(
      '⚠️ Reset All Production Data',
      'This will permanently delete:\n• All job cards\n• All stage movements\n• All import runs\n• All column maps\n\nStage definitions and diamond masters are kept.\n\nThis cannot be undone.',
      'error',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              const res = await devResetAll();
              const d = res?.deleted ?? {};
              showAlert(
                'Reset Complete',
                `Deleted:\n• ${d.jobCards ?? 0} job cards\n• ${d.stageMovements ?? 0} stage movements\n• ${d.importRuns ?? 0} import runs\n• ${d.columnMaps ?? 0} column maps\n\nYou can now re-upload Order and WIP files.`,
                'success'
              );
            } catch (e) {
              showAlert('Error', e.message, 'error');
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={stages}
        keyExtractor={s => s.code || String(Math.random())}
        renderItem={({ item }) => <StageRow stage={item} onEdit={openEdit} onDelete={handleDelete} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}
        contentContainerStyle={{ padding: 12, gap: 6, paddingBottom: 80 }}
        ListFooterComponent={
          <View style={styles.devSection}>
            <View style={styles.devHeader}>
              <Icon name="developer-mode" size={16} color={colors.error} />
              <Text style={styles.devTitle}>Developer Tools</Text>
            </View>
            <Text style={styles.devDesc}>
              Wipes all job cards, stage movements, import runs, and column maps.{'\n'}
              Stage definitions and diamond masters are preserved.
            </Text>
            <TouchableOpacity
              style={[styles.resetBtn, resetting && styles.btnDisabled]}
              onPress={handleDevReset}
              disabled={resetting}
            >
              {resetting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Icon name="delete-sweep" size={18} color="#fff" />
              }
              <Text style={styles.resetBtnText}>
                {resetting ? 'Resetting…' : 'Reset All Production Data'}
              </Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="layers-clear" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No stages defined yet</Text>
            <Text style={styles.emptySub}>Stages are pre-seeded on the backend. Tap + to add a custom stage manually.</Text>
          </View>
        }
      />
      <TouchableOpacity style={styles.fab} onPress={openNew}>
        <Icon name="add" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal visible={!!editTarget} animationType="slide" transparent onRequestClose={() => setEditTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editTarget === 'new' ? 'New Stage' : 'Edit Stage'}</Text>
              <TouchableOpacity onPress={() => setEditTarget(null)}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView>
              {[
                { key: 'code', label: 'Code (e.g. FILING)', required: true },
                { key: 'name', label: 'Display Name', required: true },
                { key: 'expectedDurationHours', label: 'Expected Duration (hours)', kb: 'numeric' },
              ].map(({ key, label, kb = 'default', required }) => (
                <View key={key} style={styles.field}>
                  <Text style={styles.fieldLabel}>{label}{required && ' *'}</Text>
                  <TextInput
                    style={[styles.fieldInput, editTarget !== 'new' && key === 'code' && styles.fieldInputDisabled]}
                    value={form[key]}
                    onChangeText={set(key)}
                    keyboardType={kb}
                    editable={editTarget === 'new' || key !== 'code'}
                    placeholderTextColor={colors.textLight}
                  />
                </View>
              ))}
              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Terminal Stage</Text>
                <Switch value={form.isTerminal} onValueChange={set('isTerminal')} trackColor={{ true: colors.primary }} />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Optional Stage</Text>
                <Switch value={form.isOptional} onValueChange={set('isOptional')} trackColor={{ true: colors.primary }} />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Active</Text>
                <Switch value={form.active} onValueChange={set('active')} trackColor={{ true: colors.primary }} />
              </View>
            </ScrollView>
            <TouchableOpacity style={[styles.saveBtn, saving && styles.btnDisabled]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : null}
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Stage'}</Text>
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
  row: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: 10, padding: 14, elevation: 1 },
  rowLeft: { flex: 1 },
  stageCode: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.primary },
  stageName: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.textPrimary, marginTop: 2 },
  stageSub: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  pills: { flexDirection: 'row', gap: 6, marginTop: 6 },
  pill: { backgroundColor: colors.primaryExtraLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  pillAlt: { backgroundColor: colors.warning + '22' },
  pillInactive: { backgroundColor: colors.error + '22' },
  pillText: { fontFamily: fonts.medium, fontSize: 10, color: colors.textSecondary },
  rowActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  editBtn: { padding: 8 },
  deleteBtn: { padding: 8 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 12 },
  emptyText: { fontFamily: fonts.bold, fontSize: fonts.base, color: colors.textSecondary },
  emptySub: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56,
    borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    elevation: 6,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: fonts.bold, fontSize: fonts.lg, color: colors.textPrimary },
  field: { marginBottom: 14 },
  fieldLabel: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textSecondary, marginBottom: 4 },
  fieldInput: { backgroundColor: colors.backgroundSecondary, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textPrimary },
  fieldInputDisabled: { opacity: 0.5 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fonts.base },
  devSection: {
    margin: 12, marginTop: 8, backgroundColor: colors.error + '08',
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.error + '30',
  },
  devHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  devTitle: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.error },
  devDesc: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, lineHeight: 18, marginBottom: 12 },
  resetBtn: {
    backgroundColor: colors.error, borderRadius: 10, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  resetBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fonts.sm },
});

export default StagesSettingsScreen;

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
import { getStages, createStage, updateStage, deleteStage, devResetAll, reseedStages } from '../../../services/productionApi';

const JEWELRY_CATEGORIES = ['Ring','Bangle','Bracelet','Necklace','Pendant','Earring','Chain','Mangalsutra','Anklet','Kada',''];
const SETTING_STAGE_CODES = new Set(['DIA_SET','SETTING']);

const EMPTY_FORM = {
  code: '', name: '', expectedDurationHours: '',
  isTerminal: false, isOptional: false, active: true,
  durationRules: [],
};
// qty = reference qty for the rule (e.g. "10 pieces of Ring 5-10g take 6h")
const EMPTY_RULE = { category: '', weightLabel: '', weightMin: '', weightMax: '', qty: '10', hours: '' };

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

const StageRow = ({ stage, onEdit, onDelete }) => {
  const ruleCount = stage.durationRules?.length ?? 0;
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.stageCode}>{stage.code}</Text>
        <Text style={styles.stageName}>{stage.name}</Text>
        {stage.expectedDurationHours ? <Text style={styles.stageSub}>{stage.expectedDurationHours}h default</Text> : null}
        {ruleCount > 0 && <Text style={styles.stageSub}>{ruleCount} category rule{ruleCount > 1 ? 's' : ''}</Text>}
        <View style={styles.pills}>
          {stage.isTerminal && <View style={styles.pill}><Text style={styles.pillText}>Terminal</Text></View>}
          {stage.isOptional && <View style={[styles.pill, styles.pillAlt]}><Text style={styles.pillText}>Optional</Text></View>}
          {SETTING_STAGE_CODES.has(stage.code) && <View style={[styles.pill, { backgroundColor: colors.info + '20' }]}><Text style={[styles.pillText, { color: colors.info }]}>Stone-time formula</Text></View>}
          {!stage.active && <View style={[styles.pill, styles.pillInactive]}><Text style={styles.pillText}>Inactive</Text></View>}
        </View>
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(stage)}><Icon name="edit" size={16} color={colors.primary} /></TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(stage)}><Icon name="delete" size={16} color={colors.error} /></TouchableOpacity>
      </View>
    </View>
  );
};

const StagesSettingsScreen = () => {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [reseeding, setReseeding] = useState(false);
  const [newRule, setNewRule] = useState(EMPTY_RULE);
  const [showAddRule, setShowAddRule] = useState(false);
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

  const openNew = () => { setEditTarget('new'); setForm(EMPTY_FORM); setNewRule(EMPTY_RULE); setShowAddRule(false); };
  const openEdit = (stage) => {
    setEditTarget(stage);
    setForm({ ...EMPTY_FORM, ...stage, expectedDurationHours: String(stage.expectedDurationHours ?? ''), durationRules: stage.durationRules ?? [] });
    setNewRule(EMPTY_RULE);
    setShowAddRule(false);
  };

  const save = async () => {
    if (!form.code || !form.name) { showAlert('Required', 'Code and Name are required', 'warning'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        expectedDurationHours: form.expectedDurationHours ? Number(form.expectedDurationHours) : undefined,
        durationRules: (form.durationRules ?? []).map(r => ({
          category:    r.category ?? '',
          weightLabel: r.weightLabel ?? '',
          weightMin:   Number(r.weightMin) || 0,
          weightMax:   Number(r.weightMax) || 9999,
          qty:         Number(r.qty) || 10,
          hours:       Number(r.hours) || 0,
        })),
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
          <>
          <View style={styles.reseedSection}>
            <View style={styles.devHeader}>
              <Icon name="refresh" size={16} color={colors.primary} />
              <Text style={[styles.devTitle, { color: colors.primary }]}>Restore All Stages</Text>
            </View>
            <Text style={styles.devDesc}>
              Re-applies all predefined stage definitions from the server seed.{'\n'}
              Activates any stages that went inactive due to merge conflicts or manual changes.
            </Text>
            <TouchableOpacity
              style={[styles.reseedBtn, reseeding && styles.btnDisabled]}
              onPress={async () => {
                setReseeding(true);
                try {
                  const res = await reseedStages();
                  showAlert('Done', `Reseeded ${res?.count ?? '?'} stages successfully.`, 'success');
                  load();
                } catch (e) {
                  showAlert('Error', e.message, 'error');
                } finally { setReseeding(false); }
              }}
              disabled={reseeding}
            >
              {reseeding
                ? <ActivityIndicator size="small" color="#fff" />
                : <Icon name="layers" size={18} color="#fff" />
              }
              <Text style={styles.resetBtnText}>
                {reseeding ? 'Reseeding…' : 'Restore All Stages'}
              </Text>
            </TouchableOpacity>
          </View>

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
          </>
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
              {/* Basic fields */}
              {[
                { key: 'code', label: 'Code (e.g. FILING)', required: true },
                { key: 'name', label: 'Display Name', required: true },
                { key: 'expectedDurationHours', label: 'Default Expected Time (hours)', kb: 'numeric' },
              ].map(({ key, label, kb = 'default', required }) => (
                <View key={key} style={styles.field}>
                  <Text style={styles.fieldLabel}>{label}{required && ' *'}</Text>
                  <TextInput
                    style={[styles.fieldInput, editTarget !== 'new' && key === 'code' && styles.fieldInputDisabled]}
                    value={String(form[key] ?? '')}
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

              {/* ── Duration Rules ───────────────────────────────────────── */}
              <View style={styles.ruleSection}>
                <View style={styles.ruleSectionHeader}>
                  <Text style={styles.ruleSectionTitle}>Duration Rules</Text>
                  <Text style={styles.ruleSectionSub}>Category + weight overrides for expected time</Text>
                </View>

                {SETTING_STAGE_CODES.has(form.code) && (
                  <View style={styles.ruleInfoBox}>
                    <Icon name="info" size={14} color={colors.info} />
                    <Text style={styles.ruleInfoText}>
                      DIA_SET / SETTING use the stone-time formula (qty × diamond carats). Rules here apply as fallback when no stone data is available.
                    </Text>
                  </View>
                )}

                {/* Existing rules */}
                {(form.durationRules ?? []).map((rule, idx) => (
                  <View key={idx} style={styles.ruleRow}>
                    <View style={styles.ruleLeft}>
                      <Text style={styles.ruleCategory}>{rule.category || 'All categories'}</Text>
                      <Text style={styles.ruleDetail}>
                        {rule.weightLabel || `${rule.weightMin}–${rule.weightMax}g`}
                        {rule.qty && rule.qty !== 1 ? ` · ${rule.qty} pcs → ${rule.hours}h  (${(rule.hours / rule.qty).toFixed(2)}h/pc)` : ` → ${rule.hours}h`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.ruleDelete}
                      onPress={() => set('durationRules')((form.durationRules ?? []).filter((_, i) => i !== idx))}
                    >
                      <Icon name="close" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add rule form */}
                {showAddRule ? (
                  <View style={styles.addRuleForm}>
                    <Text style={styles.fieldLabel}>Jewelry Category</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {JEWELRY_CATEGORIES.map(cat => (
                          <TouchableOpacity
                            key={cat || '__all__'}
                            style={[styles.catChip, newRule.category === cat && styles.catChipActive]}
                            onPress={() => setNewRule(r => ({ ...r, category: cat }))}
                          >
                            <Text style={[styles.catChipText, newRule.category === cat && styles.catChipTextActive]}>
                              {cat || 'All'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    <Text style={styles.fieldLabel}>Weight Label (e.g. 5-10g)</Text>
                    <TextInput style={styles.fieldInput} value={newRule.weightLabel}
                      onChangeText={v => setNewRule(r => ({ ...r, weightLabel: v }))}
                      placeholder="e.g. 5-10g" placeholderTextColor={colors.textLight} />

                    <View style={styles.ruleNumRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Weight Min (g)</Text>
                        <TextInput style={styles.fieldInput} value={newRule.weightMin}
                          onChangeText={v => setNewRule(r => ({ ...r, weightMin: v }))}
                          keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textLight} />
                      </View>
                      <View style={{ width: 12 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Weight Max (g)</Text>
                        <TextInput style={styles.fieldInput} value={newRule.weightMax}
                          onChangeText={v => setNewRule(r => ({ ...r, weightMax: v }))}
                          keyboardType="numeric" placeholder="9999" placeholderTextColor={colors.textLight} />
                      </View>
                    </View>

                    <View style={styles.ruleNumRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Reference Qty</Text>
                        <TextInput style={styles.fieldInput} value={newRule.qty}
                          onChangeText={v => setNewRule(r => ({ ...r, qty: v }))}
                          keyboardType="numeric" placeholder="10" placeholderTextColor={colors.textLight} />
                      </View>
                      <View style={{ width: 12 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Hours (for qty)</Text>
                        <TextInput style={styles.fieldInput} value={newRule.hours}
                          onChangeText={v => setNewRule(r => ({ ...r, hours: v }))}
                          keyboardType="numeric" placeholder="e.g. 6" placeholderTextColor={colors.textLight} />
                      </View>
                    </View>
                    <Text style={styles.ruleFormulaHint}>
                      {`Formula: (actual qty / ${newRule.qty || '10'}) × ${newRule.hours || 'X'}h`}
                    </Text>

                    <View style={styles.addRuleActions}>
                      <TouchableOpacity style={styles.addRuleCancel} onPress={() => { setShowAddRule(false); setNewRule(EMPTY_RULE); }}>
                        <Text style={styles.addRuleCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.addRuleConfirm}
                        onPress={() => {
                          if (!newRule.hours) return;
                          set('durationRules')([...(form.durationRules ?? []), {
                            category:    newRule.category,
                            weightLabel: newRule.weightLabel,
                            weightMin:   Number(newRule.weightMin) || 0,
                            weightMax:   Number(newRule.weightMax) || 9999,
                            qty:         Number(newRule.qty) || 10,
                            hours:       Number(newRule.hours),
                          }]);
                          setNewRule(EMPTY_RULE);
                          setShowAddRule(false);
                        }}
                      >
                        <Icon name="check" size={14} color="#fff" />
                        <Text style={styles.addRuleConfirmText}>Add Rule</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addRuleBtn} onPress={() => setShowAddRule(true)}>
                    <Icon name="add" size={16} color={colors.primary} />
                    <Text style={styles.addRuleBtnText}>Add Duration Rule</Text>
                  </TouchableOpacity>
                )}
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
  // Duration Rules
  ruleSection: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.borderLight },
  ruleSectionHeader: { marginBottom: 10 },
  ruleSectionTitle: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  ruleSectionSub: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  ruleInfoBox: { flexDirection: 'row', gap: 8, backgroundColor: colors.info + '15', borderRadius: 8, padding: 10, marginBottom: 10 },
  ruleInfoText: { flex: 1, fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.info, lineHeight: 17 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.backgroundSecondary, borderRadius: 8, padding: 10, marginBottom: 6 },
  ruleLeft: { flex: 1 },
  ruleCategory: { fontFamily: fonts.bold, fontSize: fonts.xs, color: colors.textPrimary },
  ruleDetail: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  ruleDelete: { padding: 4 },
  addRuleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, justifyContent: 'center', marginTop: 4 },
  addRuleBtnText: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.primary },
  addRuleForm: { backgroundColor: colors.backgroundSecondary, borderRadius: 10, padding: 12, marginTop: 8 },
  ruleNumRow: { flexDirection: 'row', marginBottom: 4 },
  addRuleActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  addRuleCancel: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  addRuleCancelText: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.textSecondary },
  addRuleConfirm: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 8 },
  addRuleConfirmText: { fontFamily: fonts.bold, fontSize: fonts.sm, color: '#fff' },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border },
  catChipActive: { backgroundColor: colors.primaryExtraLight, borderColor: colors.primary },
  catChipText: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textSecondary },
  catChipTextActive: { color: colors.primary },
  ruleFormulaHint: { fontFamily: fonts.regular, fontSize: 10, color: colors.info, marginTop: 4, marginBottom: 8, fontStyle: 'italic' },
  reseedSection: {
    margin: 12, marginTop: 8, backgroundColor: colors.primary + '08',
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.primary + '30',
  },
  reseedBtn: {
    backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
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

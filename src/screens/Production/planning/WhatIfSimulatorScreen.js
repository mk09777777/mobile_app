import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../constants/colors';
import { fonts } from '../../../constants/fonts';
import Icon from '../../../components/common/Icon';
import BrandedAlert from '../../../components/common/BrandedAlert';
import { simulateWhatIf } from '../../../services/productionApi';

// ─────────────────────────────────────────────────────────────────────────────
// WhatIfSimulatorScreen
//
// Inputs sent to backend (WhatIfChanges):
//   overtimeHoursPerDay?: number
//   addCellsByStage?:     Record<stageCode, extraCells>   ← now supported
//   (newOrders / reprioritize skipped — complex, v2)
//
// Backend returns { result: WhatIfResult, changes }
// WhatIfResult shape:
//   baseline:        { bottleneckStage, totalOpenJobCards }
//   summary:         { ordersSaved, ordersSlipping }
//   stageLoadImpacts: { stageCode, oldCapacityPerDay, newCapacityPerDay,
//                       oldQueueDays, newQueueDays }[]
//   costDelta:       { overtimeHours, extraCellCount, notes[] }
//   jobCardImpacts:  { gatiPieceCode, oldCompletionDay, newCompletionDay,
//                       deltaDays, willSlip, willBeSaved }[]
// ─────────────────────────────────────────────────────────────────────────────

const WhatIfSimulatorScreen = () => {
  const [overtime, setOvertime] = useState('');
  // addCellsByStage — list of { stageCode, extraCells } rows the user fills in
  const [cellEntries, setCellEntries] = useState([{ stageCode: '', extraCells: '' }]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  // ── cell-entry helpers ──────────────────────────────────────────────────────
  const addCellRow    = () => setCellEntries(p => [...p, { stageCode: '', extraCells: '' }]);
  const removeCellRow = (i) => setCellEntries(p => p.filter((_, idx) => idx !== i));
  const updateCellRow = (i, field, val) =>
    setCellEntries(p => p.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));

  // ── simulate ────────────────────────────────────────────────────────────────
  const simulate = async () => {
    setLoading(true);
    try {
      const changes = {};
      if (overtime) changes.overtimeHoursPerDay = Number(overtime);

      // Build addCellsByStage — skip blank / zero rows
      const addCells = {};
      for (const { stageCode, extraCells } of cellEntries) {
        const code = stageCode.trim().toUpperCase();
        const n = parseInt(extraCells, 10);
        if (code && !isNaN(n) && n > 0) addCells[code] = n;
      }
      if (Object.keys(addCells).length > 0) changes.addCellsByStage = addCells;

      const res = await simulateWhatIf(changes);
      if (__DEV__) {
        console.log('[WhatIf] response keys:', Object.keys(res || {}));
        console.log('[WhatIf] raw:', JSON.stringify(res)?.slice(0, 800));
        const r = res?.result || res;
        if (r) console.log('[WhatIf] result keys:', Object.keys(r));
        if (r?.jobCardImpacts?.[0]) console.log('[WhatIf] impact[0] keys:', Object.keys(r.jobCardImpacts[0]));
        if (r?.stageLoadImpacts?.[0]) console.log('[WhatIf] stageLoad[0] keys:', Object.keys(r.stageLoadImpacts[0]));
      }
      setResult(res?.result || res);
    } catch (e) {
      showAlert('Error', e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Input card ── */}
        <View style={styles.card}>
          <Text style={styles.title}>What-If Simulator</Text>
          <Text style={styles.sub}>
            Adjust hypothetical parameters and see how they impact open orders
          </Text>

          {/* Overtime hours */}
          <View style={styles.field}>
            <Text style={styles.label}>Overtime Hours / Day</Text>
            <TextInput
              style={styles.input}
              value={overtime}
              onChangeText={setOvertime}
              placeholder="e.g. 2"
              keyboardType="numeric"
              placeholderTextColor={colors.textLight}
            />
          </View>

          {/* Extra cells by stage */}
          <View style={styles.field}>
            <Text style={styles.label}>Extra Cells by Stage (optional)</Text>
            {cellEntries.map((row, i) => (
              <View key={i} style={styles.cellRow}>
                <TextInput
                  style={[styles.input, { flex: 2 }]}
                  value={row.stageCode}
                  onChangeText={v => updateCellRow(i, 'stageCode', v)}
                  placeholder="Stage code"
                  autoCapitalize="characters"
                  placeholderTextColor={colors.textLight}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={row.extraCells}
                  onChangeText={v => updateCellRow(i, 'extraCells', v)}
                  placeholder="+cells"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textLight}
                />
                {cellEntries.length > 1 && (
                  <TouchableOpacity onPress={() => removeCellRow(i)} style={styles.removeBtn}>
                    <Icon name="close" size={16} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity onPress={addCellRow} style={styles.addRowBtn}>
              <Icon name="add" size={14} color={colors.primary} />
              <Text style={styles.addRowText}>Add stage</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={simulate}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Icon name="science" size={18} color="#fff" />}
            <Text style={styles.btnText}>{loading ? 'Simulating…' : 'Run Simulation'}</Text>
          </TouchableOpacity>
        </View>

        {result && (
          <>
            {/* ── Summary + Baseline ── */}
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>Simulation Results</Text>

              {/* Baseline pill row */}
              <View style={styles.baselineRow}>
                <View style={styles.baselinePill}>
                  <Text style={styles.baselineVal}>{result.baseline?.totalOpenJobCards ?? '—'}</Text>
                  <Text style={styles.baselineLabel}>Open Job Cards</Text>
                </View>
                <View style={styles.baselinePill}>
                  <Text style={styles.baselineVal} numberOfLines={1}>
                    {result.baseline?.bottleneckStage ?? '—'}
                  </Text>
                  <Text style={styles.baselineLabel}>Baseline Bottleneck</Text>
                </View>
              </View>

              {/* Orders saved / slipping */}
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: colors.success }]}>
                    {result.summary?.ordersSaved ?? 0}
                  </Text>
                  <Text style={styles.summaryLabel}>Orders Saved</Text>
                </View>
                <View style={styles.dividerV} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: colors.error }]}>
                    {result.summary?.ordersSlipping ?? 0}
                  </Text>
                  <Text style={styles.summaryLabel}>Orders Slipping</Text>
                </View>
              </View>
            </View>

            {/* ── Cost Delta ── */}
            {result.costDelta && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cost Delta</Text>
                <View style={styles.costRow}>
                  <View style={styles.costItem}>
                    <Text style={styles.costValue}>{result.costDelta.overtimeHours ?? 0}h</Text>
                    <Text style={styles.costLabel}>Overtime Hours</Text>
                  </View>
                  <View style={styles.costItem}>
                    <Text style={styles.costValue}>{result.costDelta.extraCellCount ?? 0}</Text>
                    <Text style={styles.costLabel}>Extra Cells</Text>
                  </View>
                </View>
                {result.costDelta.notes?.map((note, i) => (
                  <View key={i} style={styles.noteRow}>
                    <Icon name="info" size={12} color={colors.info} />
                    <Text style={styles.noteText}>{note}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ── Stage Load Impacts ── */}
            {result.stageLoadImpacts?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Stage Load Changes</Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.th, { flex: 1.4 }]}>Stage</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Queue (was)</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Queue (new)</Text>
                </View>
                {result.stageLoadImpacts.map((s, i) => {
                  const improved = s.newQueueDays < s.oldQueueDays;
                  return (
                    <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                      <Text style={[styles.td, { flex: 1.4, fontFamily: fonts.bold }]}>{s.stageCode}</Text>
                      <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                        {s.oldQueueDays?.toFixed(1)}d
                      </Text>
                      <Text style={[styles.td, {
                        flex: 1, textAlign: 'right',
                        color: improved ? colors.success : colors.error,
                        fontFamily: fonts.bold,
                      }]}>
                        {s.newQueueDays?.toFixed(1)}d
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Job Card Impacts ── */}
            {result.jobCardImpacts?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Job Card Impacts (top {Math.min(result.jobCardImpacts.length, 15)} of {result.jobCardImpacts.length})
                </Text>
                {result.jobCardImpacts.slice(0, 15).map((imp, i) => {
                  const deltaColor =
                    imp.deltaDays < 0 ? colors.success
                    : imp.deltaDays > 0 ? colors.error
                    : colors.textSecondary;
                  return (
                    <View key={i} style={styles.impactRow}>
                      <View style={styles.impactLeft}>
                        <Text style={styles.impactCode}>
                          {imp.gatiPieceCode?.split('/').slice(-2).join('/')}
                        </Text>
                        <Text style={styles.impactDays}>
                          {imp.oldCompletionDay?.toFixed(1)}d → {imp.newCompletionDay?.toFixed(1)}d
                        </Text>
                      </View>
                      <View style={styles.impactRight}>
                        <Text style={[styles.impactDelta, { color: deltaColor }]}>
                          {imp.deltaDays > 0 ? '+' : ''}{imp.deltaDays}d
                        </Text>
                        {imp.willBeSaved && (
                          <View style={[styles.impactBadge, { backgroundColor: colors.success + '22' }]}>
                            <Text style={[styles.impactBadgeText, { color: colors.success }]}>SAVED</Text>
                          </View>
                        )}
                        {imp.willSlip && (
                          <View style={[styles.impactBadge, { backgroundColor: colors.error + '22' }]}>
                            <Text style={[styles.impactBadgeText, { color: colors.error }]}>SLIPPING</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  content: { padding: 16, gap: 16, paddingBottom: 40 },

  // Input card
  card: { backgroundColor: colors.background, borderRadius: 14, padding: 20, elevation: 2 },
  title: { fontFamily: fonts.bold, fontSize: fonts.xl, color: colors.textPrimary, marginBottom: 6 },
  sub: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.backgroundSecondary, borderRadius: 10, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: fonts.regular, fontSize: fonts.base, color: colors.textPrimary,
  },
  cellRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  removeBtn: { padding: 8 },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  addRowText: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.primary },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.primary, paddingVertical: 14,
    borderRadius: 12, marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fonts.base },

  // Result card (summary + baseline)
  resultCard: { backgroundColor: colors.background, borderRadius: 14, padding: 20, elevation: 2 },
  resultTitle: { fontFamily: fonts.bold, fontSize: fonts.lg, color: colors.textPrimary, marginBottom: 14 },
  baselineRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  baselinePill: {
    flex: 1, backgroundColor: colors.backgroundSecondary, borderRadius: 10,
    padding: 12, alignItems: 'center',
  },
  baselineVal: { fontFamily: fonts.bold, fontSize: fonts.base, color: colors.textPrimary },
  baselineLabel: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 3 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontFamily: fonts.black, fontSize: fonts['3xl'] },
  summaryLabel: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 4 },
  dividerV: { width: 1, height: 48, backgroundColor: colors.borderLight },

  // Generic section card
  section: { backgroundColor: colors.background, borderRadius: 14, padding: 16, elevation: 2 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fonts.base, color: colors.textPrimary, marginBottom: 12 },

  // Cost delta
  costRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  costItem: {
    flex: 1, backgroundColor: colors.backgroundSecondary,
    borderRadius: 10, padding: 12, alignItems: 'center',
  },
  costValue: { fontFamily: fonts.bold, fontSize: fonts.xl, color: colors.textPrimary },
  costLabel: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 4 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
  noteText: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.info, flex: 1 },

  // Stage load table
  tableHeader: {
    flexDirection: 'row', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4,
  },
  th: { fontFamily: fonts.bold, fontSize: fonts.xs, color: colors.textSecondary },
  tableRow: {
    flexDirection: 'row', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  tableRowAlt: { backgroundColor: colors.backgroundSecondary },
  td: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textPrimary },

  // Job card impacts
  impactRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  impactLeft: { flex: 1 },
  impactCode: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.textPrimary },
  impactDays: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  impactRight: { alignItems: 'flex-end', gap: 4 },
  impactDelta: { fontFamily: fonts.bold, fontSize: fonts.sm },
  impactBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  impactBadgeText: { fontFamily: fonts.bold, fontSize: 9 },
});

export default WhatIfSimulatorScreen;

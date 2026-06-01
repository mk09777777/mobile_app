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
import { checkPlanning } from '../../../services/productionApi';

const LabelInput = ({ label, value, onChangeText, placeholder, keyboardType = 'numeric' }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType={keyboardType}
      placeholderTextColor={colors.textLight}
    />
  </View>
);

const NewOrderCalculatorScreen = () => {
  const [form, setForm] = useState({
    totalQty: '', totalStones: '', totalGrams: '',
    expectedDeliveryAt: '', priority: 'normal',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const set = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const calculate = async () => {
    if (!form.totalQty) { showAlert('Required', 'Enter total quantity', 'warning'); return; }
    setLoading(true);
    try {
      const res = await checkPlanning({
        totalQty: Number(form.totalQty),
        totalStones: form.totalStones ? Number(form.totalStones) : undefined,
        totalGrams: form.totalGrams ? Number(form.totalGrams) : undefined,
        expectedDeliveryAt: form.expectedDeliveryAt || undefined,
        priority: form.priority,
      });
      if (__DEV__) {
        console.log('[Calculator] response keys:', Object.keys(res || {}));
        // Expect: { plan: { capacityStatus, leadTimeDays, estimatedCompletionAt, warnings[], ... } }
        console.log('[Calculator] raw:', JSON.stringify(res)?.slice(0, 500));
        const plan = res?.plan || res;
        if (plan) console.log('[Calculator] plan keys:', Object.keys(plan));
      }
      // Backend returns { plan: { capacityStatus, leadTimeDays, ... } }
      setResult(res?.plan || res);
    } catch (e) {
      showAlert('Error', e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const PRIORITIES = ['normal', 'urgent', 'critical'];
  const STATUS_COLORS = { ok: colors.success, tight: colors.warning, overloaded: colors.error };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>New Order Calculator</Text>
          <Text style={styles.cardSub}>Enter order details to estimate capacity and lead time</Text>

          <LabelInput label="Total Quantity *" value={form.totalQty} onChangeText={set('totalQty')} placeholder="e.g. 10" />
          <LabelInput label="Total Stones" value={form.totalStones} onChangeText={set('totalStones')} placeholder="e.g. 570" />
          <LabelInput label="Total Gold (grams)" value={form.totalGrams} onChangeText={set('totalGrams')} placeholder="e.g. 45" />
          <LabelInput label="Expected Delivery (YYYY-MM-DD)" value={form.expectedDeliveryAt} onChangeText={set('expectedDeliveryAt')} placeholder="2026-08-01" keyboardType="default" />

          <View style={styles.field}>
            <Text style={styles.label}>Priority</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityBtn, form.priority === p && styles.priorityBtnActive]}
                  onPress={() => setForm(prev => ({ ...prev, priority: p }))}
                >
                  <Text style={[styles.priorityBtnText, form.priority === p && styles.priorityBtnTextActive]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={calculate} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Icon name="calculate" size={18} color="#fff" />}
            <Text style={styles.btnText}>{loading ? 'Calculating…' : 'Check Capacity'}</Text>
          </TouchableOpacity>
        </View>

        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Capacity Check Result</Text>

            <View style={[styles.statusBanner, { backgroundColor: (STATUS_COLORS[result.capacityStatus] || colors.info) + '20' }]}>
              <Text style={[styles.statusBannerText, { color: STATUS_COLORS[result.capacityStatus] || colors.info }]}>
                {result.capacityStatus?.toUpperCase() || 'UNKNOWN'}
              </Text>
            </View>

            {[
              { label: 'Lead Time', value: `${result.leadTimeDays ?? '—'} days` },
              { label: 'Est. Completion', value: result.estimatedCompletionAt ? new Date(result.estimatedCompletionAt).toLocaleDateString() : '—' },
              { label: 'On-Time Probability', value: result.onTimeProbability != null ? `${Math.round(result.onTimeProbability * 100)}%` : '—' },
              { label: 'Bottleneck Stage', value: result.bottleneckStage || '—' },
              { label: 'Overtime Hours Needed', value: result.overtimeHoursNeeded != null ? `${result.overtimeHoursNeeded}h` : '0h' },
            ].map(({ label, value }) => (
              <View key={label} style={styles.resultRow}>
                <Text style={styles.resultLabel}>{label}</Text>
                <Text style={styles.resultValue}>{value}</Text>
              </View>
            ))}

            {result.criticalPath?.length > 0 && (
              <View style={styles.criticalPath}>
                <Text style={styles.cpTitle}>Critical Path</Text>
                <Text style={styles.cpText}>{result.criticalPath.join(' → ')}</Text>
              </View>
            )}

            {result.warnings?.length > 0 && (
              <View style={styles.warnings}>
                {result.warnings.map((w, i) => (
                  <View key={i} style={styles.warningRow}>
                    <Icon name="warning" size={14} color={colors.warning} />
                    <Text style={styles.warningText}>{w}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.resetBtn} onPress={() => setResult(null)}>
              <Text style={styles.resetText}>Check another order</Text>
            </TouchableOpacity>
          </View>
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
  card: { backgroundColor: colors.background, borderRadius: 14, padding: 20, elevation: 2 },
  cardTitle: { fontFamily: fonts.bold, fontSize: fonts.xl, color: colors.textPrimary, marginBottom: 6 },
  cardSub: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.backgroundSecondary, borderRadius: 10, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: fonts.regular, fontSize: fonts.base, color: colors.textPrimary,
  },
  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', backgroundColor: colors.backgroundSecondary,
  },
  priorityBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  priorityBtnText: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.textSecondary },
  priorityBtnTextActive: { color: '#fff' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fonts.base },
  resultCard: { backgroundColor: colors.background, borderRadius: 14, padding: 20, elevation: 2 },
  resultTitle: { fontFamily: fonts.bold, fontSize: fonts.lg, color: colors.textPrimary, marginBottom: 16 },
  statusBanner: { borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 16 },
  statusBannerText: { fontFamily: fonts.black, fontSize: fonts['2xl'] },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  resultLabel: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary },
  resultValue: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  criticalPath: { marginTop: 16, backgroundColor: colors.primaryExtraLight, borderRadius: 10, padding: 12 },
  cpTitle: { fontFamily: fonts.bold, fontSize: fonts.xs, color: colors.primary, marginBottom: 6 },
  cpText: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textPrimary },
  warnings: { marginTop: 12, gap: 8 },
  warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  warningText: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.warning, flex: 1 },
  resetBtn: { marginTop: 16, alignItems: 'center', padding: 10 },
  resetText: { color: colors.primary, fontFamily: fonts.medium, fontSize: fonts.sm },
});

export default NewOrderCalculatorScreen;

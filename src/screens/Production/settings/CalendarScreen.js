import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Switch, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../constants/colors';
import { fonts } from '../../../constants/fonts';
import Icon from '../../../components/common/Icon';
import BrandedAlert from '../../../components/common/BrandedAlert';
import { getCalendar, updateCalendar } from '../../../services/productionApi';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CalendarScreen = () => {
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    defaultDailyHours: '8',
    weekendDays: [0, 6], // Sun, Sat
    shifts: [], // [{ name, startTime, endTime }]
    holidayDates: [], // ISO date strings
  });
  const [newShift, setNewShift] = useState({ name: '', startTime: '09:00', endTime: '18:00' });
  const [newHoliday, setNewHoliday] = useState('');
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const load = useCallback(async () => {
    try {
      const data = await getCalendar();
      if (__DEV__) console.log('[Calendar] raw:', JSON.stringify(data)?.slice(0, 400));
      const cal = data?.calendar || data;
      setCalendar(cal);
      if (cal) {
        setForm({
          defaultDailyHours: String(cal.defaultDailyHours ?? 8),
          weekendDays: cal.weekendDays || [0, 6],
          shifts: cal.shifts || [],
          holidayDates: cal.holidayDates || [],
        });
      }
    } catch (e) {
      if (__DEV__) console.error('[Calendar] load error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        defaultDailyHours: Number(form.defaultDailyHours) || 8,
      };
      await updateCalendar(payload);
      showAlert('Saved', 'Production calendar updated', 'success');
      load();
    } catch (e) {
      showAlert('Error', e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleWeekend = (dayIdx) => {
    setForm(p => ({
      ...p,
      weekendDays: p.weekendDays.includes(dayIdx)
        ? p.weekendDays.filter(d => d !== dayIdx)
        : [...p.weekendDays, dayIdx].sort(),
    }));
  };

  const addShift = () => {
    if (!newShift.name) { showAlert('Required', 'Shift name is required', 'warning'); return; }
    setForm(p => ({ ...p, shifts: [...p.shifts, { ...newShift }] }));
    setNewShift({ name: '', startTime: '09:00', endTime: '18:00' });
  };

  const removeShift = (i) => {
    setForm(p => ({ ...p, shifts: p.shifts.filter((_, idx) => idx !== i) }));
  };

  const addHoliday = () => {
    const trimmed = newHoliday.trim();
    if (!trimmed) return;
    // Basic date validation: YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      showAlert('Format', 'Enter date as YYYY-MM-DD (e.g. 2026-01-26)', 'warning'); return;
    }
    if (!form.holidayDates.includes(trimmed)) {
      setForm(p => ({ ...p, holidayDates: [...p.holidayDates, trimmed].sort() }));
    }
    setNewHoliday('');
  };

  const removeHoliday = (date) => {
    setForm(p => ({ ...p, holidayDates: p.holidayDates.filter(d => d !== date) }));
  };

  const setNS = k => v => setNewShift(p => ({ ...p, [k]: v }));

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Working hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Default Working Hours / Day</Text>
          <View style={styles.hoursRow}>
            <TextInput
              style={styles.hoursInput}
              value={form.defaultDailyHours}
              onChangeText={v => setForm(p => ({ ...p, defaultDailyHours: v }))}
              keyboardType="number-pad"
              placeholderTextColor={colors.textSecondary}
            />
            <Text style={styles.hoursUnit}>hours</Text>
          </View>
        </View>

        {/* Weekend days */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekend Days (off-days)</Text>
          <View style={styles.dayRow}>
            {DAYS.map((d, i) => (
              <TouchableOpacity
                key={d}
                style={[styles.dayBtn, form.weekendDays.includes(i) && styles.dayBtnActive]}
                onPress={() => toggleWeekend(i)}
              >
                <Text style={[styles.dayText, form.weekendDays.includes(i) && styles.dayTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.sectionNote}>Selected days are treated as off (no production capacity).</Text>
        </View>

        {/* Shifts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shifts</Text>
          {form.shifts.length === 0 && <Text style={styles.sectionNote}>No shifts configured — system uses defaultDailyHours as one shift.</Text>}
          {form.shifts.map((s, i) => (
            <View key={i} style={styles.shiftRow}>
              <View style={styles.shiftInfo}>
                <Text style={styles.shiftName}>{s.name}</Text>
                <Text style={styles.shiftTime}>{s.startTime} – {s.endTime}</Text>
              </View>
              <TouchableOpacity onPress={() => removeShift(i)} style={styles.removeBtn}>
                <Icon name="remove-circle" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.addShiftSection}>
            <Text style={styles.addShiftTitle}>Add Shift</Text>
            <View style={styles.addShiftRow}>
              <TextInput
                style={[styles.fieldInput, { flex: 1 }]}
                value={newShift.name}
                onChangeText={setNS('name')}
                placeholder="Name (e.g. Morning)"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Start time</Text>
                <TextInput style={styles.fieldInput} value={newShift.startTime} onChangeText={setNS('startTime')} placeholder="09:00" placeholderTextColor={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>End time</Text>
                <TextInput style={styles.fieldInput} value={newShift.endTime} onChangeText={setNS('endTime')} placeholder="18:00" placeholderTextColor={colors.textSecondary} />
              </View>
            </View>
            <TouchableOpacity style={styles.addShiftBtn} onPress={addShift}>
              <Icon name="add" size={16} color="#fff" />
              <Text style={styles.addShiftBtnText}>Add Shift</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Holidays */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Public Holidays</Text>
          {form.holidayDates.length === 0 && <Text style={styles.sectionNote}>No holidays added.</Text>}
          {form.holidayDates.map(date => (
            <View key={date} style={styles.holidayRow}>
              <Icon name="event-busy" size={18} color={colors.warning} />
              <Text style={styles.holidayDate}>{date}</Text>
              <TouchableOpacity onPress={() => removeHoliday(date)} style={styles.removeBtn}>
                <Icon name="close" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.addHolidayRow}>
            <TextInput
              style={[styles.fieldInput, { flex: 1 }]}
              value={newHoliday}
              onChangeText={setNewHoliday}
              placeholder="YYYY-MM-DD (e.g. 2026-01-26)"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numbers-and-punctuation"
            />
            <TouchableOpacity style={styles.addHolidayBtn} onPress={addHoliday}>
              <Icon name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity style={[styles.saveBtn, saving && styles.btnDisabled]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Icon name="save" size={18} color="#fff" />}
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Calendar'}</Text>
        </TouchableOpacity>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  section: { backgroundColor: colors.background, borderRadius: 12, padding: 16, elevation: 1 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fonts.base, color: colors.textPrimary, marginBottom: 12 },
  sectionNote: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, fontStyle: 'italic' },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hoursInput: { backgroundColor: colors.backgroundSecondary, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.bold, fontSize: fonts.lg, color: colors.textPrimary, width: 80, textAlign: 'center' },
  hoursUnit: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary },
  dayRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dayBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.backgroundSecondary },
  dayBtnActive: { backgroundColor: colors.primary },
  dayText: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textSecondary },
  dayTextActive: { color: '#fff' },
  shiftRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  shiftInfo: { flex: 1 },
  shiftName: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  shiftTime: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  removeBtn: { padding: 4 },
  addShiftSection: { marginTop: 12, gap: 8 },
  addShiftTitle: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textSecondary },
  addShiftRow: { flexDirection: 'row', gap: 8 },
  timeRow: { flexDirection: 'row', gap: 10 },
  fieldLabel: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textSecondary, marginBottom: 4 },
  fieldInput: { backgroundColor: colors.backgroundSecondary, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textPrimary },
  addShiftBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, paddingVertical: 10, borderRadius: 8 },
  addShiftBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fonts.sm },
  holidayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  holidayDate: { flex: 1, fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.textPrimary },
  addHolidayRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  addHolidayBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fonts.base },
});

export default CalendarScreen;

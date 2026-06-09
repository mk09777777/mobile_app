import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from './Icon';
import { Calendar } from 'react-native-calendars';

/**
 * CalendarPicker — date-range selector.
 *
 * Interaction:
 *   1st tap  → sets start date (highlighted)
 *   2nd tap  → sets end date  (range highlighted between start and end)
 *   3rd tap  → resets and starts a new selection
 *
 * Props
 * ─────────────────────────────────────────────────────────────────
 * @param {string}   startDate        – Current start date (YYYY-MM-DD) or null.
 * @param {string}   endDate          – Current end date   (YYYY-MM-DD) or null.
 * @param {function} onDatesSelected  – Called with { startDate, endDate } on Apply.
 * @param {string}   [label]          – Label above the trigger button.
 * @param {string}   [placeholder]    – Placeholder when no dates are selected.
 * @param {string}   [accentColor]    – Accent colour (default '#4CAF50').
 * @param {string}   [rangeFillColor] – Range fill colour (default '#E8F5E9').
 * @param {string}   [rangeTextColor] – Range text colour (default '#2E7D32').
 */
const CalendarPicker = ({
  startDate = null,
  endDate   = null,
  onDatesSelected,
  // label          = 'Select date range',
  placeholder    = 'Tap to select dates',
  accentColor    = '#4CAF50',
  rangeFillColor = '#E8F5E9',
  rangeTextColor = '#2E7D32',
}) => {
  const [showCalendar, setShowCalendar] = useState(false);

  // Committed dates — what shows on the trigger button
  const [committedStart, setCommittedStart] = useState(startDate);
  const [committedEnd,   setCommittedEnd]   = useState(endDate);

  // Internal selection state: two-tap logic
  const [selStart, setSelStart] = useState(null);
  const [selEnd,   setSelEnd]   = useState(null);

  // ── format YYYY-MM-DD → "Jun 10, 2026" ───────────────────────
  const fmt = (str) => {
    if (!str) return '';
    const [y, m, d] = str.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
  };

  // ── helpers ───────────────────────────────────────────────────
  const dateRange = useCallback((a, b) => {
    const arr = [];
    const cur = new Date(a);
    const last = new Date(b);
    while (cur <= last) {
      arr.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return arr;
  }, []);

  // ── open modal → pre-fill from parent props ───────────────────
  const openCalendar = () => {
    setSelStart(committedStart);
    setSelEnd(committedEnd);
    setShowCalendar(true);
  };

  // ── tap handler: 1st tap = start, 2nd tap = end, 3rd = reset ─
  const handleDayPress = useCallback((day) => {
    const tapped = day.dateString;
    setSelStart(prev => {
      // No start yet → set start
      if (!prev) return tapped;
      // Start set, no end → if tapped >= start, set end; else reset start
      setSelEnd(prevEnd => {
        if (!prevEnd) {
          if (tapped >= prev) return tapped;   // valid end date
          setSelStart(tapped);                  // reset: new start
          return null;
        }
        // Both set → reset for new selection
        setSelStart(tapped);
        return null;
      });
      return prev;
    });
  }, []);

  // ── markedDates for the calendar ──────────────────────────────
  const markedDates = useMemo(() => {
    if (!selStart) return {};
    const marked = {};

    marked[selStart] = { startingDay: true, color: accentColor, textColor: '#fff' };

    if (selEnd && selEnd !== selStart) {
      marked[selEnd] = { endingDay: true, color: accentColor, textColor: '#fff' };
      dateRange(selStart, selEnd).forEach(d => {
        if (d !== selStart && d !== selEnd) {
          marked[d] = { color: rangeFillColor, textColor: rangeTextColor };
        }
      });
    } else if (!selEnd) {
      // Only start selected — style it as both start and end
      marked[selStart] = {
        startingDay: true, endingDay: true,
        color: accentColor, textColor: '#fff',
      };
    }
    return marked;
  }, [selStart, selEnd, accentColor, rangeFillColor, rangeTextColor, dateRange]);

  // ── hint text inside the modal ────────────────────────────────
  const hintText = useMemo(() => {
    if (!selStart) return 'Tap to select start date';
    if (!selEnd)   return `${fmt(selStart)}  —  tap end date`;
    return `${fmt(selStart)}  →  ${fmt(selEnd)}`;
  }, [selStart, selEnd]);

  // ── trigger display text (reads local committed state) ────────
  const displayText = useMemo(() => {
    if (!committedStart) return placeholder;
    if (committedEnd && committedEnd !== committedStart)
      return `${fmt(committedStart)}  →  ${fmt(committedEnd)}`;
    return fmt(committedStart);
  }, [committedStart, committedEnd, placeholder]);




  // ── apply / cancel ────────────────────────────────────────────
  const handleApply = () => {
    if (!selStart) return;
    const finalEnd = selEnd ?? selStart;
    // Save committed dates so trigger shows them immediately
    setCommittedStart(selStart);
    setCommittedEnd(finalEnd);
    onDatesSelected?.({
      startDate: selStart,
      endDate:   finalEnd,
      flexibleDates: selEnd ? dateRange(selStart, selEnd) : [selStart],
    });
    setShowCalendar(false);
  };

  const handleCancel = () => {
    setSelStart(committedStart);
    setSelEnd(committedEnd);
    setShowCalendar(false);
  };

  const today = new Date().toISOString().split('T')[0];


  

  return (
    <View>
      {/* {label ? <Text style={styles.label}>{label}</Text> : null} */}

      {/* Trigger button — shows committed range from parent */}
      <TouchableOpacity style={styles.trigger} onPress={openCalendar}>
        <Text style={[styles.triggerText, !committedStart && styles.placeholder]}>
          {displayText} 
        </Text>
        <Icon name="calendar-today" size={20} color={accentColor} />
      </TouchableOpacity>

      {/* Calendar modal */}
      <Modal
        visible={showCalendar}
        animationType="slide"
        transparent
        onRequestClose={handleCancel}
      >
        <View style={styles.overlay}>
          <View style={styles.modalCard}>

            {/* Range hint */}
            <Text style={[styles.hint, selEnd && { color: accentColor }]}>
              {hintText}
            </Text>

            <Calendar
              markedDates={markedDates}
              onDayPress={handleDayPress}
              markingType="period"
              minDate={today}
              theme={{
                selectedDayBackgroundColor: accentColor,
                selectedDayTextColor: '#ffffff',
                todayTextColor: accentColor,
                dotColor: accentColor,
                arrowColor: accentColor,
                monthTextColor: '#333',
                textMonthFontWeight: 'bold',
                textDayFontSize: 13,
                textMonthFontSize: 15,
                textDayHeaderFontSize: 13,
                backgroundColor: '#ffffff',
              }}
            />

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={handleCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: selStart ? accentColor : '#ccc' }]}
                onPress={handleApply}
                disabled={!selStart}
              >
                <Text style={styles.applyText}>
                  {selEnd ? 'Apply Range' : selStart ? 'Apply Date' : 'Apply'}
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  label:           { fontSize: 15, fontWeight: '500', color: '#374151', marginBottom: 8 },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, backgroundColor: '#fff',
  },
  triggerText:     { fontSize: 15, fontWeight: '500', color: '#1F2937', flex: 1 },
  placeholder:     { color: '#9CA3AF' },
  overlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    width: '92%', maxHeight: '85%',
  },
  hint: {
    textAlign: 'center', fontSize: 13, fontWeight: '500',
    color: '#9CA3AF', marginBottom: 10,
  },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 10 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  cancelBtn:   { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  cancelText:  { fontWeight: '500', fontSize: 15, color: '#1F2937' },
  applyText:   { fontWeight: '600', fontSize: 15, color: '#fff' },
});

export default CalendarPicker;

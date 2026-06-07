import React, { useEffect, useCallback, useMemo } from 'react';
import {
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import CalendarPicker from '../../../components/common/datePicker';
import {
  getScheduleAnalytics,
  getFullSchedule,
  getScheduleByDateRange,
  getLiveStages,
  getTodaySchedule,
} from '../../../services/productionApi';
import { colors } from '../../../constants/colors';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

function daysBetween(start, end) {
  if (!start || !end) return 14;
  const ms = new Date(end + 'T00:00:00') - new Date(start + 'T00:00:00');
  const days = Math.round(ms / 86_400_000) + 1;
  return days > 0 ? days : 14;
}

function getDayLabelParts(offsetDays, baseDate = null) {
  const d = baseDate ? new Date(baseDate + 'T00:00:00') : new Date();
  d.setDate(d.getDate() + offsetDays);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return {
    day: dayNames[d.getDay()],
    date: d.getDate(),
    mon: monthNames[d.getMonth()],
  };
}

function cellColor(count) {
  if (!count || count === 0) return '#f1f3f4';
  if (count >= 10) return '#fce8e6';
  if (count >= 5) return '#fef3e2';
  return '#e6f4ea';
}

const CARDS = [
  {
    key: 'totalPieces',
    bg: '#e8f0fe',
    color: '#1a73e8',
    icon: '📦',
    label: 'Total Pieces',
  },
  {
    key: 'startToday',
    bg: '#e6f4ea',
    color: '#1e8e3e',
    icon: '🟢',
    label: 'Start Today',
  },
  {
    key: 'lateOrders',
    bg: '#fce8e6',
    color: '#d93025',
    icon: '🔴',
    label: 'Late Orders',
  },
  {
    key: 'bottlenecks',
    bg: '#fef3e2',
    color: '#e37400',
    icon: '⚠️',
    label: 'Bottlenecks',
  },
];

const getPriorityColor = priority => {
  const p = (priority || '').toLowerCase();
  if (p === 'super high' || p === 'critical' || p === 'super urgent') return '#EF4444';
  if (p === 'high' || p === 'urgent') return '#F59E0B';
  if (p === 'medium') return '#3B82F6';
  if (p === 'low' || p === 'normal') return '#10B981';
  return '#6B7280';
};

const getPriorityBg = priority => {
  const p = (priority || '').toLowerCase();
  if (p === 'super high' || p === 'critical' || p === 'super urgent') return '#FEF2F2';
  if (p === 'high' || p === 'urgent') return '#FFFBEB';
  if (p === 'medium') return '#EFF6FF';
  if (p === 'low' || p === 'normal') return '#ECFDF5';
  return '#F9FAFB';
};

const CELL_W = 64;
const STAGE_W = 72;

export default function ProductionSchedule() {
  const [selectedDates, setSelectedDates] = React.useState({
    startDate: null,
    endDate: null,
  });
  const [analyticsData, setAnalyticsData] = React.useState(null);
  const [gridData, setGridData] = React.useState([]);
  const [liveStages, setLiveStages] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = React.useState(0);
  const [calendarKey, setCalendarKey] = React.useState(0);
  const [showTodayModal,    setShowTodayModal]    = React.useState(false);
  const [todayScheduleData, setTodayScheduleData] = React.useState(null);
  const [todayLoading,      setTodayLoading]      = React.useState(false);
  const [showAllToday,      setShowAllToday]      = React.useState(false);

  const windowDays = useMemo(
    () => daysBetween(selectedDates.startDate, selectedDates.endDate),
    [selectedDates],
  );

  // All stage codes from grid
  const stageList = useMemo(() => {
    if (!gridData || gridData.length === 0) return [];
    return Object.keys(gridData[0]?.byStage || {});
  }, [gridData]);

  // Live stage map for quick lookup
  const liveMap = useMemo(() => {
    const map = {};
    for (const s of liveStages) map[s.stageCode] = s.pieceCount;
    return map;
  }, [liveStages]);

  const isDateRangeSelected = !!(
    selectedDates.startDate && selectedDates.endDate
  );

  // Get piece count for a stage on a given day index
  // Default (no date range): day 0 = live, day 1+ = grid
  // Date range selected: all days = grid (scheduled data for those dates)
  const getCount = useCallback(
    (stageCode, dayIndex) => {
      if (!isDateRangeSelected && dayIndex === 0) {
        return liveMap[stageCode] ?? 0;
      }
      const dayObj = gridData[dayIndex] || {};
      const st = dayObj.byStage?.[stageCode] || {};
      return Object.values(st.byCell || {}).flat().length;
    },
    [isDateRangeSelected, liveMap, gridData],
  );

  const fetchSchedule = useCallback(async (days = 14, startDate = null) => {
    setLoading(true);
    try {
      // Run both in parallel:
      // /Analytics  → flat counts for summary cards
      // /schedule   → grid[] for the calendar (with optional startDate)
      const [analytics, gridRes] = await Promise.all([
        getScheduleAnalytics({ days }),
        startDate
          ? getScheduleByDateRange(startDate, days)
          : getFullSchedule({ days }),
      ]);

      setAnalyticsData({
        bottlenecks: analytics?.bottlenecks ?? 0,
        lateOrders: analytics?.lateOrders ?? 0,
        startToday: analytics?.startToday ?? 0,
        totalPieces: analytics?.totalPieces ?? 0,
      });

      setGridData(gridRes?.grid || []);

      if (__DEV__) {
        console.log('[ProductionSchedule] analytics:', analytics);
        console.log('[ProductionSchedule] grid days:', gridRes?.grid?.length);
      }
    } catch (e) {
      if (__DEV__) console.error('[ProductionSchedule] error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLiveStages = useCallback(async () => {
    try {
      const res = await getLiveStages();
      setLiveStages(res?.stages || []);
    } catch (e) {
      if (__DEV__) console.error('[ProductionSchedule] live error:', e.message);
    }
  }, []);

  useEffect(() => {
    fetchSchedule(14);
    fetchLiveStages();
  }, [fetchSchedule, fetchLiveStages]);

  useEffect(() => {
    if (analyticsData)
      console.log(
        '[ProductionSchedule] analyticsData:',
        JSON.stringify(analyticsData),
      );
  }, [analyticsData]);

  const fetchTodaySchedule = useCallback(async () => {
    setTodayLoading(true);
    try {
      const res = await getTodaySchedule();
      setTodayScheduleData(res);
      if (__DEV__) console.log('[ProductionSchedule] today data:', JSON.stringify(res));
    } catch (e) {
      if (__DEV__) console.error('[ProductionSchedule] today error:', e.message);
    } finally {
      setTodayLoading(false);
    }
  }, []);

  const handleDatesSelected = ({ startDate, endDate }) => {
    setSelectedDates({ startDate, endDate });
    setSelectedDayIndex(0);
    fetchSchedule(daysBetween(startDate, endDate), startDate);
  };

  const handleClear = () => {
    setSelectedDates({ startDate: null, endDate: null });
    setSelectedDayIndex(0);
    setCalendarKey(k => k + 1);
    fetchSchedule(14);
    fetchLiveStages();
  };

  

  return (
    <View style={styles.container}>
      {/* Date picker + clear */}
      <View style={styles.pickerRow}>
        <View style={styles.pickerFlex}>
          <CalendarPicker
            key={calendarKey}
            onDatesSelected={handleDatesSelected}
            startDate={selectedDates.startDate}
            endDate={selectedDates.endDate}
            placeholder="Filter by date range"
            accentColor={colors.primary}
          />
        </View>
        {(selectedDates.startDate || selectedDates.endDate) && (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
            <MaterialIcons name="refresh" size={16} color={colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* Heading */}
      <Text style={styles.heading}>
        Next {windowDays} day{windowDays !== 1 ? 's' : ''} schedule
      </Text>

      {/* Summary cards */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 8 }} color={colors.primary} />
      ) : (
        analyticsData && (
          <View style={styles.cardsRow}>
            {CARDS.map(card => (
              <View
                key={card.key}
                style={[styles.card, { backgroundColor: card.bg }]}
              >
                <Text style={styles.cardIcon}>{card.icon}</Text>
                <Text style={[styles.cardValue, { color: card.color }]}>
                  {analyticsData[card.key]}
                </Text>
                <Text style={[styles.cardLabel, { color: card.color }]}>
                  {card.label}
                </Text>
              </View>
            ))}
          </View>
        )
      )}

      {/* Calendar grid */}
      {!loading && stageList.length > 0 && (
        <ScrollView
          style={styles.gridScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.gridWrapper}>
            {/* Fixed left — stage names */}
            <View style={styles.stageColumn}>
              <View style={styles.cornerCell}>
                <Text style={styles.cornerText}>STAGE</Text>
              </View>
              {stageList.map(code => (
                <View key={code} style={styles.stageCell}>
                  <Text style={styles.stageName} numberOfLines={1}>
                    {code}
                  </Text>
                </View>
              ))}
            </View>

            {/* Scrollable right — day cards + data */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
            >
              <View>
                {/* Day header cards */}
                <View style={styles.headerRow}>
                  {gridData.map((_, i) => {
                    // Date range selected → show selected dates, else show from today
                    const { day, date, mon } = getDayLabelParts(
                      i,
                      selectedDates.startDate || null,
                    );
                    const isSelected = i === selectedDayIndex;
                    const isLiveDay = !isDateRangeSelected && i === 0;
                    return (
                      <TouchableOpacity
                        key={i}
                        activeOpacity={0.7}
                        onPress={() => {
                          setSelectedDayIndex(i);
                          setShowTodayModal(true);
                          fetchTodaySchedule();
                        }}
                        style={[
                          styles.DayCard,
                          isSelected && styles.DayCardSelected,
                        ]}
                      >
                        {isLiveDay && (
                          <Text
                            style={[
                              styles.liveTag,
                              isSelected && styles.liveTagSelected,
                            ]}
                          >
                            LIVE
                          </Text>
                        )}
                        <Text
                          style={[
                            styles.DayCardText,
                            isSelected && styles.DayCardTextSelected,
                          ]}
                        >
                          {day}
                        </Text>
                        <Text
                          style={[
                            styles.DayCardText2,
                            isSelected && styles.DayCardTextSelected,
                          ]}
                        >
                          {date} {mon}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Data rows — one per stage */}
                {stageList.map(code => (
                  <View key={code} style={styles.dataRow}>
                    {gridData.map((_, i) => {
                      const count = getCount(code, i);
                      const isSelected = i === selectedDayIndex;
                      const bg = cellColor(count);
                      return (
                        <View
                          key={i}
                          style={[styles.dataCell, { backgroundColor: bg }]}
                        >
                          <Text
                            style={[
                              styles.dataCellText,
                              isSelected &&
                                count > 0 &&
                                styles.dataCellTextSelected,
                            ]}
                          >
                            {count > 0 ? count : '—'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}
      {/* ── Today Schedule Modal ───────────────────────────────────────── */}
      <Modal
        visible={showTodayModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowTodayModal(false); setShowAllToday(false); }}
      >
        <View style={styles.container2}>
          <TouchableOpacity
            style={styles.overlayTop}
            activeOpacity={1}
            onPress={() => { setShowTodayModal(false); setShowAllToday(false); }}
          />
          <View style={styles.modalBox}>
            <View style={styles.handle} />

            {/* Modal header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.headerText}>
                  {(() => {
                    const { day, date, mon } = getDayLabelParts(selectedDayIndex, selectedDates.startDate || null);
                    return `${day}, ${date} ${mon}`;
                  })()}
                </Text>
                <Text style={styles.headerSubText}>
                  Total: {todayScheduleData?.startToday?.length || 0} pieces
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => { setShowTodayModal(false); setShowAllToday(false); }}
              >
                <MaterialIcons name="close" size={18} color={colors.textLight} />
              </TouchableOpacity>
            </View>

            {/* Start Today row */}
            <View style={styles.startTodayRow}>
              <Text style={styles.startTodayText}>
                Start Today — {todayScheduleData?.startToday?.length || 0}
              </Text>
              {(todayScheduleData?.startToday?.length || 0) > 2 && (
                <TouchableOpacity onPress={() => setShowAllToday(v => !v)}>
                  <Text style={styles.viewAllText}>
                    {showAllToday ? 'Show Less' : `View All (${todayScheduleData.startToday.length})`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {todayLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
                {(showAllToday
                  ? todayScheduleData?.startToday || []
                  : (todayScheduleData?.startToday || []).slice(0, 2)
                ).map((item, idx) => {
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.todayCard,
                        { backgroundColor: getPriorityBg(item.priority) },
                      ]}
                    >
                      {/* Top row: order number + priority badge */}
                      <View style={styles.todayCardHeader}>
                        <View style={styles.todayCardTitleGroup}>
                          <Text style={styles.todayCardTitle}>
                            {item.orderNumber}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.priorityBadge,
                            { backgroundColor: getPriorityColor(item.priority) },
                          ]}
                        >
                          <Text style={styles.priorityBadgeText}>
                            {item.priority?.toUpperCase() || 'NORMAL'}
                          </Text>
                        </View>
                      </View>

                      {/* Bottom row: category + qty */}
                      <View style={styles.todayCardBody}>
                        <View style={styles.todayCardMetaRow}>
                          <Text style={styles.todayCardMeta}>
                            {item.itemCategory}
                          </Text>
                        </View>
                        <Text style={styles.todayCardDue}>
                          Qty: {item.qty}
                        </Text>
                      </View>
                    </View>
                  );
                })}

                {(todayScheduleData?.startToday?.length || 0) === 0 && !todayLoading && (
                  <Text style={styles.emptyText}>No pieces need to start today</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickerFlex: { flex: 1 },
  clearBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f3f4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heading: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5f6368',
    marginTop: 12,
    marginBottom: 6,
  },

  cardsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  card: {
    width: '23%',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
  },
  cardIcon: { fontSize: 16, marginBottom: 2 },
  cardValue: { fontSize: 16, fontWeight: 'bold' },
  cardLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },

  // Grid
  gridScroll: { flex: 1, marginTop: 4 },
  gridWrapper: { flexDirection: 'row' },
  stageColumn: { width: STAGE_W },
  cornerCell: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f3f4',
    borderRadius: 6,
    marginBottom: 2,
  },
  cornerText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textLight,
    letterSpacing: 0.5,
  },
  stageCell: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginBottom: 2,
  },
  stageName: { fontSize: 11, fontWeight: '600', color: colors.textBlack },

  // Day header cards
  headerRow: { flexDirection: 'row', marginBottom: 2 },
  DayCard: {
    width: CELL_W,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    marginRight: 2,
  },
  DayCardText: { fontSize: 11, color: colors.textLight, fontWeight: '500' },
  DayCardText2: { fontSize: 12, color: colors.textBlack, fontWeight: '600' },
  DayCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderWidth: 1,
  },
  DayCardTextSelected: {
    color: colors.textWhite,
    fontWeight: '600',
    fontSize: 12,
  },
  liveTag: {
    fontSize: 8,
    fontWeight: '700',
    color: '#1e8e3e',
    letterSpacing: 0.5,
  },
  liveTagSelected: { color: colors.textWhite },

  // Data cells
  dataRow: { flexDirection: 'row', marginBottom: 2 },
  dataCell: {
    width: CELL_W,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    marginRight: 2,
  },
  dataCellSelected: { borderWidth: 1.5, borderColor: colors.primary },
  dataCellText: { fontSize: 12, fontWeight: '600', color: '#1e293b' },
  dataCellTextSelected: { color: colors.primary, fontWeight: '700' },

  // selected Day modal
  container2: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  overlayTop: {
    flex: 1,
  },
  modalBox: {
    backgroundColor: colors.background,
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    padding: 24,
    maxHeight: '80%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  // Modal header
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
  },
  headerText:    { fontSize: 16, fontWeight: '700', color: colors.textBlack },
  headerSubText: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#f1f3f4',
  },

  // Start today row
  startTodayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  startTodayText: { fontSize: 13, fontWeight: '600', color: colors.textBlack },
  viewAllText:    { fontSize: 12, fontWeight: '600', color: colors.primary },
  emptyText:      { fontSize: 13, color: colors.textLight, textAlign: 'center', marginTop: 20 },

  // Today piece cards
  todayCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  todayCardTitleGroup: { flex: 1, marginRight: 8 },
  todayCardTitle:      { fontSize: 14, fontWeight: '700', color: colors.textBlack },
  todayCardSubTitle:   { fontSize: 11, color: colors.textLight, marginTop: 2 },
  priorityBadge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityBadgeText:   { fontSize: 10, fontWeight: '700', color: colors.textWhite },
  todayCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  todayCardMetaRow: { flexDirection: 'row', alignItems: 'center' },
  todayCardMeta:    { fontSize: 12, color: colors.textSecondary },
  todayCardDue:     { fontSize: 12, fontWeight: '600' },
});

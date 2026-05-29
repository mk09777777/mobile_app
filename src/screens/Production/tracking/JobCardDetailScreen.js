import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../constants/colors';
import { fonts } from '../../../constants/fonts';
import Icon from '../../../components/common/Icon';
import BrandedAlert from '../../../components/common/BrandedAlert';
import {
  getJobCardById, getJobCardMovements, setFindings, setPriority,
  createAllocation, consumeAllocation, releaseAllocation, getAllocationsByJobCard,
  getStages,
} from '../../../services/productionApi';

// Module-level cache — stages are static master data, fetch once per session.
let _stagesCache = null;
const getCachedStages = async () => {
  if (_stagesCache) return _stagesCache;
  const data = await getStages();
  _stagesCache = data?.stages || data || [];
  return _stagesCache;
};
import { formatDate } from '../../../utils/helpers';

const STATUS_COLORS = {
  in_progress: colors.info, completed: colors.success,
  on_hold: colors.warning, cancelled: colors.error,
};
const PRIORITY_COLORS = { critical: colors.error, urgent: colors.warning, normal: colors.info };

// Construct Diamond.code from a diamondSpec sub-document (matches backend auto-key logic).
const specToCode = (d) => `${d.gSize}|${d.sieve}|${d.diaSizeMM}`;
const specLabel = (d) => `${d.gSize} · ${d.sieve} · ${d.diaSizeMM}mm`;

const MovementRow = ({ mv, expectedHours }) => {
  const isOpen = !mv.exitedAt;
  const liveHours = isOpen
    ? (Date.now() - new Date(mv.enteredAt).getTime()) / 3_600_000
    : null;
  const dur = mv.durationHours
    ? `${mv.durationHours.toFixed(1)}h`
    : liveHours != null ? `${liveHours.toFixed(1)}h (live)` : 'open';

  const delayHours = isOpen && expectedHours > 0 && liveHours != null
    ? liveHours - expectedHours
    : null;

  return (
    <View style={styles.mvRow}>
      <View style={[styles.mvDot, isOpen && delayHours > 0 && { backgroundColor: colors.error }]} />
      <View style={styles.mvBody}>
        <View style={styles.mvStageRow}>
          <Text style={styles.mvStage}>{mv.toStageCode} {mv.cellCode ? `(${mv.cellCode})` : ''}</Text>
          {isOpen && delayHours > 0 && (
            <View style={styles.mvDelayBadge}>
              <Text style={styles.mvDelayText}>+{delayHours.toFixed(1)}h delay</Text>
            </View>
          )}
          {isOpen && delayHours !== null && delayHours <= 0 && (
            <View style={styles.mvOnTimeBadge}>
              <Text style={styles.mvOnTimeText}>on time</Text>
            </View>
          )}
        </View>
        <Text style={styles.mvTime}>
          {new Date(mv.enteredAt).toLocaleString()} · {dur}
          {isOpen && expectedHours > 0 ? ` · expected ${expectedHours}h` : ''}
        </Text>
        {mv.qcResult && (
          <View style={[styles.qcBadge, { backgroundColor: mv.qcResult === 'pass' ? colors.success + '20' : colors.error + '20' }]}>
            <Text style={[styles.qcText, { color: mv.qcResult === 'pass' ? colors.success : colors.error }]}>QC: {mv.qcResult}</Text>
          </View>
        )}
        {(mv.weightInGrams || mv.weightOutGrams) && (
          <Text style={styles.mvWeight}>In: {mv.weightInGrams}g · Out: {mv.weightOutGrams}g</Text>
        )}
        {(mv.stonesIn || mv.stonesOut) && (
          <Text style={styles.mvWeight}>Stones In: {mv.stonesIn ?? 0} · Out: {mv.stonesOut ?? 0}</Text>
        )}
      </View>
    </View>
  );
};

const JobCardDetailScreen = ({ route, navigation }) => {
  const { jobCardId, pieceCode } = route.params || {};
  const [jc, setJc] = useState(null);
  const [movements, setMovements] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // FAB / action sheet
  const [fabSheetVisible, setFabSheetVisible] = useState(false);

  // Allocate Stones modal
  const [allocateVisible, setAllocateVisible] = useState(false);
  const [selectedSpec, setSelectedSpec] = useState(null); // diamondSpec object
  const [allocateQty, setAllocateQty] = useState('');
  const [allocateNotes, setAllocateNotes] = useState('');
  const [savingAllocation, setSavingAllocation] = useState(false);

  // Manage Allocations modal
  const [manageVisible, setManageVisible] = useState(false);
  const [allocations, setAllocations] = useState([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);

  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const load = useCallback(async () => {
    try {
      const [cardRes, mvs, stagesData] = await Promise.all([
        getJobCardById(jobCardId),
        getJobCardMovements(jobCardId),
        getCachedStages(),
      ]);
      if (__DEV__) {
        console.log('[JobCardDetail] card response keys:', Object.keys(cardRes || {}));
        console.log('[JobCardDetail] card raw:', JSON.stringify(cardRes)?.slice(0, 500));
        const card = cardRes?.jobCard || cardRes;
        if (card) console.log('[JobCardDetail] jobCard keys:', Object.keys(card));
        console.log('[JobCardDetail] movements count:', mvs?.movements?.length ?? mvs?.items?.length ?? mvs?.length ?? 0);
        const firstMv = mvs?.movements?.[0] || mvs?.items?.[0] || mvs?.[0];
        if (firstMv) console.log('[JobCardDetail] movement[0] keys:', Object.keys(firstMv));
      }
      setJc(cardRes?.jobCard || cardRes);
      setMovements(mvs?.movements || mvs?.items || mvs || []);
      setStages(stagesData);
    } catch (e) {
      if (__DEV__) console.error('[JobCardDetail] load error:', e.message);
      showAlert('Error', e.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [jobCardId]);

  useEffect(() => { load(); }, [load]);

  // ── Priority ──────────────────────────────────────────────────────────────
  const handlePriority = () => {
    showAlert('Change Priority', 'Select priority', 'info', [
      { text: 'Normal', style: 'default', onPress: () => updatePriority('normal') },
      { text: 'Urgent', style: 'default', onPress: () => updatePriority('urgent') },
      { text: 'Critical', style: 'destructive', onPress: () => updatePriority('critical') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const updatePriority = async (priority) => {
    try {
      const res = await setPriority(jobCardId, priority);
      setJc(res?.jobCard || res);
    } catch (e) { showAlert('Error', e.message, 'error'); }
  };

  const toggleFindings = async () => {
    try {
      const res = await setFindings(jobCardId, !jc.findingsReceived);
      setJc(res?.jobCard || res);
    } catch (e) { showAlert('Error', e.message, 'error'); }
  };

  // ── Allocate Stones ───────────────────────────────────────────────────────
  const openAllocate = () => {
    const specs = jc?.diamondSpecs || [];
    setSelectedSpec(specs.length === 1 ? specs[0] : null);
    setAllocateQty('');
    setAllocateNotes('');
    setAllocateVisible(true);
  };

  const handleAllocate = async () => {
    if (!selectedSpec) { showAlert('Required', 'Select a diamond spec', 'warning'); return; }
    const qty = parseInt(allocateQty, 10);
    if (!qty || qty <= 0) { showAlert('Required', 'Enter a valid stone quantity', 'warning'); return; }
    setSavingAllocation(true);
    try {
      await createAllocation({
        jobCardId,
        diamondCode: specToCode(selectedSpec),
        qty,
        notes: allocateNotes || undefined,
      });
      setAllocateVisible(false);
      await loadAllocations(); // refresh inline section
      showAlert('Allocated', `${qty} stones allocated from vault. Available stock reduced.`, 'success');
    } catch (e) { showAlert('Error', e.message, 'error'); }
    finally { setSavingAllocation(false); }
  };

  // ── Manage Allocations ────────────────────────────────────────────────────
  const loadAllocations = useCallback(async () => {
    setLoadingAllocations(true);
    try {
      const res = await getAllocationsByJobCard(jobCardId);
      if (__DEV__) console.log('[JobCardDetail] allocations:', JSON.stringify(res)?.slice(0, 400));
      setAllocations(res?.allocations || res?.items || (Array.isArray(res) ? res : []));
    } catch (e) {
      if (__DEV__) console.error('[JobCardDetail] allocations error:', e.message);
    } finally { setLoadingAllocations(false); }
  }, [jobCardId]);

  // Load allocations alongside job card data
  useEffect(() => { loadAllocations(); }, [loadAllocations]);

  const openManageAllocations = () => {
    setManageVisible(true);
    loadAllocations();
  };

  const handleConsume = (alloc) => {
    const remaining = alloc.quantityAllocated - alloc.quantityConsumed;
    showAlert(
      'Consume Stones',
      `Mark all ${remaining} remaining stone(s) of\n${alloc.diamondCode}\nas set into jewelry?`,
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: async () => {
            try {
              await consumeAllocation(alloc._id);
              await loadAllocations();
            } catch (e) { showAlert('Error', e.message, 'error'); }
          },
        },
      ]
    );
  };

  const handleRelease = (alloc) => {
    const remaining = alloc.quantityAllocated - alloc.quantityConsumed;
    showAlert(
      'Release Allocation',
      `Return ${remaining} unused stone(s) of\n${alloc.diamondCode}\nback to vault stock?`,
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release',
          style: 'destructive',
          onPress: async () => {
            try {
              await releaseAllocation(alloc._id);
              await loadAllocations();
            } catch (e) { showAlert('Error', e.message, 'error'); }
          },
        },
      ]
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!jc) return <View style={styles.center}><Text style={styles.errorText}>Job card not found</Text></View>;

  const statusColor = STATUS_COLORS[jc.status] || colors.textSecondary;
  const priorityColor = PRIORITY_COLORS[jc.priority] || colors.info;
  const specs = jc.diamondSpecs || [];

  // ETA delay calculation
  const eta = jc.plannedCompletionAt ? new Date(jc.plannedCompletionAt) : null;
  const due = jc.expectedDeliveryAt  ? new Date(jc.expectedDeliveryAt)  : null;
  const etaDelayDays = eta && due ? Math.ceil((eta - due) / 86_400_000) : null;
  const etaIsDelayed = etaDelayDays !== null && etaDelayDays > 0;
  const etaIsEarly   = etaDelayDays !== null && etaDelayDays < 0;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}
        contentContainerStyle={styles.content}
      >
        {/* Header card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.pieceCode}>{jc.gatiPieceCode}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{jc.status?.replace('_', ' ')}</Text>
            </View>
          </View>
          <Text style={styles.sub}>{jc.orderNumber} · {jc.customerCode}</Text>
          <Text style={styles.sub}>Due: {formatDate(jc.expectedDeliveryAt)}</Text>
          {eta && (
            <View style={styles.etaRow}>
              <Icon name="schedule" size={13} color={etaIsDelayed ? colors.error : colors.success} />
              <Text style={[styles.etaText, { color: etaIsDelayed ? colors.error : colors.success }]}>
                ETA: {formatDate(eta)}
              </Text>
              {etaIsDelayed && (
                <View style={styles.etaChip}>
                  <Text style={styles.etaChipText}>+{etaDelayDays}d late</Text>
                </View>
              )}
              {etaIsEarly && (
                <View style={[styles.etaChip, { backgroundColor: colors.success + '20' }]}>
                  <Text style={[styles.etaChipText, { color: colors.success }]}>
                    {Math.abs(etaDelayDays)}d early
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.badgesRow}>
            <TouchableOpacity onPress={handlePriority} style={[styles.priorityBadge, { backgroundColor: priorityColor + '22' }]}>
              <Icon name="flag" size={12} color={priorityColor} />
              <Text style={[styles.priorityText, { color: priorityColor }]}>{jc.priority?.toUpperCase()}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleFindings} style={[styles.findingsBtn, { backgroundColor: jc.findingsReceived ? colors.success + '22' : colors.borderLight }]}>
              <Icon name={jc.findingsReceived ? 'check-circle' : 'radio-button-unchecked'} size={14} color={jc.findingsReceived ? colors.success : colors.textSecondary} />
              <Text style={[styles.findingsText, { color: jc.findingsReceived ? colors.success : colors.textSecondary }]}>
                Findings {jc.findingsReceived ? 'Received' : 'Pending'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stage flow + delay summary */}
        {stages.length > 0 && (() => {
          const flowStages = stages.filter(s => s.displayOrder >= 1 && s.displayOrder < 90);
          const completedCodes = new Set(movements.filter(m => m.exitedAt).map(m => m.toStageCode));
          const currentByStage = new Map();
          jc.currentStageDistribution?.forEach(s => {
            const e = currentByStage.get(s.stageCode);
            if (e) { e.qty += s.qty; e.cells.push(s.cellCode); }
            else currentByStage.set(s.stageCode, { qty: s.qty, cells: [s.cellCode] });
          });

          // ── Delay calculation ─────────────────────────────────────────────
          // For each open movement, compute hours-in-stage vs expectedDurationHours.
          const stageExpected = new Map(stages.map(s => [s.code, s.expectedDurationHours ?? 0]));
          const delayByStage = new Map();
          for (const mv of movements) {
            if (mv.exitedAt) continue;
            const expected = stageExpected.get(mv.toStageCode) ?? 0;
            if (expected <= 0) continue;
            const hoursInStage = (Date.now() - new Date(mv.enteredAt).getTime()) / 3_600_000;
            const delay = hoursInStage - expected;
            const existing = delayByStage.get(mv.toStageCode);
            if (!existing || delay > existing.delay) {
              delayByStage.set(mv.toStageCode, { hoursInStage, expected, delay });
            }
          }
          const overdueStages = [...delayByStage.entries()]
            .filter(([, v]) => v.delay > 0)
            .sort((a, b) => b[1].delay - a[1].delay);

          return (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Stage Progress</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stageFlow}>
                  {flowStages.map((stage, idx) => {
                    const cur = currentByStage.get(stage.code);
                    const isCurrent = !!cur;
                    const isDone = completedCodes.has(stage.code) && !isCurrent;
                    const delayInfo = isCurrent ? delayByStage.get(stage.code) : null;
                    const isOverdue = delayInfo && delayInfo.delay > 0;
                    return (
                      <React.Fragment key={stage.code}>
                        {idx > 0 && (
                          <View style={[
                            styles.sfConnector,
                            isDone ? styles.sfConnectorDone : isCurrent ? styles.sfConnectorCurrent : null,
                          ]} />
                        )}
                        <View style={styles.sfWrap}>
                          <View style={[
                            styles.sfDot,
                            isDone ? styles.sfDotDone
                              : isOverdue ? styles.sfDotOverdue
                              : isCurrent ? styles.sfDotCurrent
                              : null,
                          ]}>
                            {isDone
                              ? <Icon name="check" size={12} color="#fff" />
                              : isCurrent
                                ? <Text style={styles.sfDotQty}>{cur.qty}</Text>
                                : null
                            }
                          </View>
                          <Text style={[
                            styles.sfCode,
                            isDone ? styles.sfCodeDone
                              : isOverdue ? styles.sfCodeOverdue
                              : isCurrent ? styles.sfCodeCurrent
                              : null,
                          ]} numberOfLines={1}>
                            {stage.code}
                          </Text>
                          {isCurrent && cur.cells?.length > 0 && (
                            <Text style={styles.sfCell} numberOfLines={1}>{cur.cells[0]}</Text>
                          )}
                          {isOverdue && (
                            <Text style={styles.sfDelay} numberOfLines={1}>
                              +{delayInfo.delay.toFixed(1)}h
                            </Text>
                          )}
                        </View>
                      </React.Fragment>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Delay detail cards — only shown when a stage is overdue */}
              {overdueStages.length > 0 && (
                <View style={styles.delaySection}>
                  <Text style={styles.delaySectionTitle}>⏱ Stage Delays</Text>
                  {overdueStages.map(([code, info]) => (
                    <View key={code} style={styles.delayRow}>
                      <View style={styles.delayLeft}>
                        <Text style={styles.delayStage}>{code}</Text>
                        <Text style={styles.delaySub}>
                          In stage {info.hoursInStage.toFixed(1)}h · Expected {info.expected}h
                        </Text>
                      </View>
                      <View style={styles.delayBadge}>
                        <Text style={styles.delayBadgeText}>+{info.delay.toFixed(1)}h late</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          );
        })()}

        {/* Diamond Specs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diamond Specs</Text>
          {specs.map((d, i) => (
            <View key={i} style={styles.specRow}>
              <Text style={styles.specLabel}>Spec {i + 1}</Text>
              <View style={styles.specDetails}>
                <Text style={styles.specText}>{d.gSize} · {d.sieve} · {d.diaSizeMM}mm</Text>
                <Text style={styles.specText}>{d.pointer}ct ea · {d.stonesPerPiece} stones/pc · {d.totalCaratsPerPiece}ct total</Text>
              </View>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Total Stones</Text>
            <Text style={styles.specValue}>{jc.totalStones}</Text>
          </View>
        </View>

        {/* Stone Allocations */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Stone Allocations</Text>
            <TouchableOpacity onPress={() => { setFabSheetVisible(false); openAllocate(); }} style={styles.sectionAddBtn}>
              <Icon name="add" size={14} color={colors.primary} />
              <Text style={styles.sectionAddText}>Allocate</Text>
            </TouchableOpacity>
          </View>

          {loadingAllocations ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start' }} />
          ) : allocations.length === 0 ? (
            <View style={styles.allocInlineEmpty}>
              <Icon name="diamond" size={18} color={colors.textSecondary} />
              <Text style={styles.allocInlineEmptyText}>No stones allocated yet — tap Allocate to check out from vault</Text>
            </View>
          ) : (
            <>
              {/* Summary row */}
              {(() => {
                const totalAllocated = allocations.reduce((s, a) => s + (a.quantityAllocated ?? 0), 0);
                const totalConsumed  = allocations.reduce((s, a) => s + (a.quantityConsumed  ?? 0), 0);
                const totalRemaining = totalAllocated - totalConsumed;
                return (
                  <View style={styles.allocSummaryRow}>
                    <View style={styles.allocSummaryChip}>
                      <Text style={styles.allocSummaryNum}>{totalAllocated}</Text>
                      <Text style={styles.allocSummaryLbl}>Allocated</Text>
                    </View>
                    <View style={[styles.allocSummaryChip, { borderColor: colors.success + '50' }]}>
                      <Text style={[styles.allocSummaryNum, { color: colors.success }]}>{totalConsumed}</Text>
                      <Text style={styles.allocSummaryLbl}>Consumed</Text>
                    </View>
                    <View style={[styles.allocSummaryChip, { borderColor: (totalRemaining > 0 ? colors.warning : colors.textSecondary) + '50' }]}>
                      <Text style={[styles.allocSummaryNum, { color: totalRemaining > 0 ? colors.warning : colors.textSecondary }]}>{totalRemaining}</Text>
                      <Text style={styles.allocSummaryLbl}>Remaining</Text>
                    </View>
                  </View>
                );
              })()}

              {/* Per-SKU breakdown */}
              {allocations.map((alloc, i) => {
                const remaining = alloc.quantityAllocated - alloc.quantityConsumed;
                const isActive = alloc.status === 'active';
                const statusCol = alloc.status === 'completed' ? colors.success : alloc.status === 'released' ? colors.textSecondary : colors.warning;
                return (
                  <View key={alloc._id || i} style={styles.allocInlineRow}>
                    <View style={styles.allocInlineLeft}>
                      <Text style={styles.allocInlineCode} numberOfLines={1}>{alloc.diamondCode}</Text>
                      <Text style={styles.allocInlineCounts}>
                        {alloc.quantityAllocated} alloc · {alloc.quantityConsumed} set · {remaining} left
                      </Text>
                    </View>
                    <View style={[styles.allocInlineBadge, { backgroundColor: statusCol + '20' }]}>
                      <Text style={[styles.allocInlineBadgeText, { color: statusCol }]}>{alloc.status}</Text>
                    </View>
                    {isActive && remaining > 0 && (
                      <TouchableOpacity style={styles.allocInlineAction} onPress={() => handleConsume(alloc)}>
                        <Icon name="check-circle" size={16} color={colors.success} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              <TouchableOpacity style={styles.manageAllocBtn} onPress={openManageAllocations}>
                <Text style={styles.manageAllocBtnText}>Manage All Allocations</Text>
                <Icon name="chevron-right" size={16} color={colors.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Metal Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metal</Text>
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Type</Text>
            <Text style={styles.specValue}>{jc.metalType}</Text>
          </View>
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Weight/pc</Text>
            <Text style={styles.specValue}>{jc.metalWeightPerPiece}g</Text>
          </View>
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Total</Text>
            <Text style={styles.specValue}>{jc.totalMetalWeight}g</Text>
          </View>
        </View>

        {/* Findings */}
        {jc.findings?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Findings</Text>
            {jc.findings.map((f, i) => (
              <Text key={i} style={styles.specText}>{f.code}: {f.qty}</Text>
            ))}
          </View>
        )}

        {/* Movement timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stage Timeline ({movements.length})</Text>
          {movements.length === 0 ? (
            <Text style={styles.emptyText}>No stage movements yet</Text>
          ) : (
            <View style={styles.timeline}>
              {movements.map((mv, i) => (
                <MovementRow
                  key={mv._id || i}
                  mv={mv}
                  expectedHours={stages.find(s => s.code === mv.toStageCode)?.expectedDurationHours ?? 0}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── FAB ──────────────────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.fab} onPress={() => setFabSheetVisible(true)}>
        <Icon name="add" size={26} color="#fff" />
      </TouchableOpacity>

      {/* ── FAB action sheet ─────────────────────────────────────────────── */}
      <Modal visible={fabSheetVisible} animationType="slide" transparent onRequestClose={() => setFabSheetVisible(false)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setFabSheetVisible(false)}>
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>Actions</Text>

            <TouchableOpacity style={styles.sheetBtn} onPress={() => { setFabSheetVisible(false); handlePriority(); }}>
              <Icon name="flag" size={20} color={colors.warning} />
              <Text style={styles.sheetBtnText}>Change Priority</Text>
              <Icon name="chevron-right" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetBtn} onPress={() => { setFabSheetVisible(false); openAllocate(); }}>
              <Icon name="diamond" size={20} color={colors.primary} />
              <Text style={styles.sheetBtnText}>Allocate Stones</Text>
              <Icon name="chevron-right" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetBtn} onPress={() => { setFabSheetVisible(false); openManageAllocations(); }}>
              <Icon name="inventory" size={20} color={colors.info} />
              <Text style={styles.sheetBtnText}>Consume / Release Allocation</Text>
              <Icon name="chevron-right" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Allocate Stones modal ─────────────────────────────────────────── */}
      <Modal visible={allocateVisible} animationType="slide" transparent onRequestClose={() => setAllocateVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Allocate Stones</Text>
              <TouchableOpacity onPress={() => setAllocateVisible(false)}>
                <Icon name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {/* Diamond spec picker */}
              <Text style={styles.fieldLabel}>Diamond Spec *</Text>
              {specs.length === 0 ? (
                <Text style={styles.emptyText}>No diamond specs on this job card</Text>
              ) : (
                <View style={styles.specPills}>
                  {specs.map((d, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.specPill, selectedSpec === d && styles.specPillActive]}
                      onPress={() => setSelectedSpec(d)}
                    >
                      <Text style={[styles.specPillText, selectedSpec === d && styles.specPillTextActive]}>
                        {specLabel(d)}
                      </Text>
                      <Text style={[styles.specPillSub, selectedSpec === d && { color: colors.primary + 'CC' }]}>
                        {d.stonesPerPiece} stones/pc
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>Quantity (stones) *</Text>
              <TextInput
                style={styles.fieldInput}
                value={allocateQty}
                onChangeText={setAllocateQty}
                keyboardType="number-pad"
                placeholder={specs.length > 0 && selectedSpec ? `e.g. ${selectedSpec.stonesPerPiece * (jc?.totalQty ?? 1)}` : 'Number of stones'}
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={styles.fieldInput}
                value={allocateNotes}
                onChangeText={setAllocateNotes}
                placeholder="Optional"
                placeholderTextColor={colors.textSecondary}
              />

              {selectedSpec && (
                <View style={styles.allocInfoCard}>
                  <Icon name="info" size={14} color={colors.info} />
                  <Text style={styles.allocInfoText}>
                    Allocating from vault SKU: {specToCode(selectedSpec)}{'\n'}
                    These stones will be removed from available stock immediately.
                  </Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, savingAllocation && styles.btnDisabled]}
              onPress={handleAllocate}
              disabled={savingAllocation}
            >
              {savingAllocation ? <ActivityIndicator color="#fff" size="small" /> : <Icon name="diamond" size={18} color="#fff" />}
              <Text style={styles.saveBtnText}>{savingAllocation ? 'Allocating…' : 'Allocate to Job Card'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Manage Allocations modal ──────────────────────────────────────── */}
      <Modal visible={manageVisible} animationType="slide" transparent onRequestClose={() => setManageVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Allocations</Text>
              <TouchableOpacity onPress={() => setManageVisible(false)}>
                <Icon name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {loadingAllocations ? (
              <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
            ) : allocations.length === 0 ? (
              <View style={styles.allocEmpty}>
                <Icon name="diamond" size={40} color={colors.textSecondary} />
                <Text style={styles.emptyText}>No allocations for this job card</Text>
                <Text style={styles.emptySubText}>Use "Allocate Stones" to check out diamonds from the vault.</Text>
              </View>
            ) : (
              <FlatList
                data={allocations}
                keyExtractor={a => String(a._id)}
                style={{ maxHeight: 420 }}
                contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
                renderItem={({ item: alloc }) => {
                  const remaining = alloc.quantityAllocated - alloc.quantityConsumed;
                  const isActive = alloc.status === 'active';
                  const statusCol = alloc.status === 'completed' ? colors.success : alloc.status === 'released' ? colors.textSecondary : colors.warning;
                  return (
                    <View style={styles.allocRow}>
                      <View style={styles.allocTop}>
                        <Text style={styles.allocCode} numberOfLines={1}>{alloc.diamondCode}</Text>
                        <View style={[styles.allocBadge, { backgroundColor: statusCol + '20' }]}>
                          <Text style={[styles.allocBadgeText, { color: statusCol }]}>{alloc.status}</Text>
                        </View>
                      </View>
                      <View style={styles.allocStats}>
                        <Text style={styles.allocStat}>Allocated: <Text style={styles.allocStatVal}>{alloc.quantityAllocated}</Text></Text>
                        <Text style={styles.allocStat}>Consumed: <Text style={[styles.allocStatVal, { color: colors.success }]}>{alloc.quantityConsumed}</Text></Text>
                        <Text style={styles.allocStat}>Remaining: <Text style={[styles.allocStatVal, { color: remaining > 0 ? colors.warning : colors.textSecondary }]}>{remaining}</Text></Text>
                      </View>
                      {isActive && remaining > 0 && (
                        <View style={styles.allocActions}>
                          <TouchableOpacity style={styles.allocActBtn} onPress={() => handleConsume(alloc)}>
                            <Icon name="check-circle" size={14} color={colors.success} />
                            <Text style={[styles.allocActText, { color: colors.success }]}>Consume</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.allocActBtn, { borderColor: colors.error + '40' }]} onPress={() => handleRelease(alloc)}>
                            <Icon name="undo" size={14} color={colors.error} />
                            <Text style={[styles.allocActText, { color: colors.error }]}>Release</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                }}
              />
            )}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontFamily: fonts.medium, fontSize: fonts.base, color: colors.error },
  content: { paddingBottom: 100 },

  // Header
  headerCard: { backgroundColor: colors.background, padding: 16, marginBottom: 8 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  pieceCode: { fontFamily: fonts.bold, fontSize: fonts.base, color: colors.textPrimary, flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontFamily: fonts.bold, fontSize: fonts.xs },
  sub: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, marginBottom: 2 },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  etaText: { fontFamily: fonts.bold, fontSize: fonts.sm },
  etaChip: { backgroundColor: colors.error + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  etaChipText: { fontFamily: fonts.bold, fontSize: 10, color: colors.error },
  badgesRow: { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  priorityText: { fontFamily: fonts.bold, fontSize: fonts.xs },
  findingsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  findingsText: { fontFamily: fonts.medium, fontSize: fonts.xs },

  // Sections
  section: { backgroundColor: colors.background, marginBottom: 8, padding: 16 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary, marginBottom: 12 },
  stagePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stagePill: { backgroundColor: colors.primaryExtraLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  stagePillText: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.primary },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 6 },
  specLabel: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textSecondary, width: 90 },
  specValue: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary, flex: 1, textAlign: 'right' },
  specText: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textPrimary, flex: 1, textAlign: 'right' },
  specDetails: { flex: 1, alignItems: 'flex-end' },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 8 },
  emptyText: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, textAlign: 'center', paddingVertical: 16 },
  emptySubText: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, textAlign: 'center' },

  // Stage flow
  stageFlow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4 },
  sfWrap: { alignItems: 'center', width: 60 },
  sfDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.borderLight, justifyContent: 'center', alignItems: 'center' },
  sfDotDone: { backgroundColor: colors.success },
  sfDotCurrent: { backgroundColor: colors.primary },
  sfDotOverdue: { backgroundColor: colors.error },
  sfDotQty: { fontFamily: fonts.bold, fontSize: 9, color: '#fff' },
  sfCode: { fontFamily: fonts.regular, fontSize: 9, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  sfCodeDone: { color: colors.success, fontFamily: fonts.medium },
  sfCodeCurrent: { color: colors.primary, fontFamily: fonts.bold },
  sfCodeOverdue: { color: colors.error, fontFamily: fonts.bold },
  sfCell: { fontFamily: fonts.regular, fontSize: 8, color: colors.primary + 'CC', textAlign: 'center', marginTop: 1 },
  sfDelay: { fontFamily: fonts.bold, fontSize: 8, color: colors.error, textAlign: 'center', marginTop: 1 },
  sfConnector: { width: 14, height: 2, backgroundColor: colors.borderLight, marginTop: 11, flexShrink: 0 },
  sfConnectorDone: { backgroundColor: colors.success },
  sfConnectorCurrent: { backgroundColor: colors.primary },

  // Delay section
  delaySection: {
    backgroundColor: colors.error + '08', marginBottom: 8, paddingHorizontal: 16, paddingVertical: 12,
    borderLeftWidth: 3, borderLeftColor: colors.error,
  },
  delaySectionTitle: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.error, marginBottom: 10 },
  delayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  delayLeft: { flex: 1 },
  delayStage: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  delaySub: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 1 },
  delayBadge: { backgroundColor: colors.error + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  delayBadgeText: { fontFamily: fonts.bold, fontSize: fonts.xs, color: colors.error },

  // Timeline
  timeline: { gap: 0 },
  mvRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  mvDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 4, marginRight: 12 },
  mvBody: { flex: 1 },
  mvStageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  mvStage: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  mvDelayBadge: { backgroundColor: colors.error + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  mvDelayText: { fontFamily: fonts.bold, fontSize: 10, color: colors.error },
  mvOnTimeBadge: { backgroundColor: colors.success + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  mvOnTimeText: { fontFamily: fonts.medium, fontSize: 10, color: colors.success },
  mvTime: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  mvWeight: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  qcBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  qcText: { fontFamily: fonts.bold, fontSize: 10 },

  // FAB
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 6 },

  // FAB action sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetCard: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  sheetTitle: { fontFamily: fonts.bold, fontSize: fonts.base, color: colors.textPrimary, marginBottom: 12 },
  sheetBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  sheetBtnText: { flex: 1, fontFamily: fonts.medium, fontSize: fonts.base, color: colors.textPrimary },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: fonts.bold, fontSize: fonts.lg, color: colors.textPrimary },
  fieldLabel: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textSecondary, marginBottom: 6, marginTop: 12 },
  fieldInput: { backgroundColor: colors.backgroundSecondary, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textPrimary },

  // Spec pills (allocate modal)
  specPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  specPill: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.backgroundSecondary },
  specPillActive: { borderColor: colors.primary, backgroundColor: colors.primaryExtraLight },
  specPillText: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textPrimary },
  specPillTextActive: { color: colors.primary },
  specPillSub: { fontFamily: fonts.regular, fontSize: 9, color: colors.textSecondary, marginTop: 2 },

  allocInfoCard: { flexDirection: 'row', gap: 8, backgroundColor: colors.info + '15', borderRadius: 10, padding: 12, marginTop: 12 },
  allocInfoText: { flex: 1, fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.info, lineHeight: 18 },

  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fonts.base },

  // Section header with add button
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.primaryExtraLight },
  sectionAddText: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.primary },

  // Inline allocations section (on main screen)
  allocInlineEmpty: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, opacity: 0.7 },
  allocInlineEmptyText: { flex: 1, fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary },
  allocSummaryRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  allocSummaryChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.primary + '50', backgroundColor: colors.primaryExtraLight },
  allocSummaryNum: { fontFamily: fonts.bold, fontSize: fonts.lg, color: colors.primary },
  allocSummaryLbl: { fontFamily: fonts.regular, fontSize: 9, color: colors.textSecondary, marginTop: 2 },
  allocInlineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: 8 },
  allocInlineLeft: { flex: 1 },
  allocInlineCode: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textPrimary },
  allocInlineCounts: { fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  allocInlineBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  allocInlineBadgeText: { fontFamily: fonts.bold, fontSize: 9 },
  allocInlineAction: { padding: 4 },
  manageAllocBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, marginTop: 8 },
  manageAllocBtnText: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.primary },

  // Allocation rows (manage modal)
  allocEmpty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  allocRow: { backgroundColor: colors.backgroundSecondary, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.border },
  allocTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  allocCode: { fontFamily: fonts.bold, fontSize: fonts.xs, color: colors.textPrimary, flex: 1, marginRight: 8 },
  allocBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  allocBadgeText: { fontFamily: fonts.bold, fontSize: 10 },
  allocStats: { flexDirection: 'row', gap: 14, marginBottom: 10 },
  allocStat: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary },
  allocStatVal: { fontFamily: fonts.bold, color: colors.textPrimary },
  allocActions: { flexDirection: 'row', gap: 10 },
  allocActBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.success + '40' },
  allocActText: { fontFamily: fonts.medium, fontSize: fonts.xs },
});

export default JobCardDetailScreen;

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

/**
 * Resolve jewelry category — mirrors backend resolveItemCategory().
 * 1. Uses itemCategory if explicitly set on the job card
 * 2. Falls back to parsing the first 1-2 chars of styleNo
 */
/**
 * Style-code token → jewelry category.
 * Category code can be ANYWHERE in the style number (start, middle, end).
 * e.g. "001R", "R-001", "RNG-001", "001-R-05" all → Ring
 */
const STYLE_CODE_MAP = {
  RNG:'Ring',   BNG:'Bangle', BRC:'Bracelet', NCK:'Necklace', PND:'Pendant',
  EAR:'Earring',CHN:'Chain',  MGS:'Mangalsutra',ANK:'Anklet', KDA:'Kada',
  RG:'Ring',    BN:'Bangle',  BR:'Bracelet',  NK:'Necklace',  PD:'Pendant',
  ER:'Earring', CH:'Chain',   MG:'Mangalsutra',AK:'Anklet',   KD:'Kada',
  R:'Ring', B:'Bracelet', A:'Anklet', E:'Earring', P:'Pendant',
  N:'Necklace', C:'Chain', K:'Kada', M:'Mangalsutra',
};

const resolveItemCategory = (itemCategory, styleNo) => {
  if (itemCategory?.trim()) return itemCategory.trim();
  if (!styleNo?.trim()) return undefined;
  const s = styleNo.trim().toUpperCase();
  // Split by separators then by digit↔letter boundaries
  const parts = s
    .split(/[-_\/\s.]+/)
    .flatMap(p => p.split(/(?=[A-Z])(?<=[0-9])|(?=[0-9])(?<=[A-Z])/));
  for (const part of parts) {
    const letters = part.replace(/\d/g, '').trim();
    if (letters && STYLE_CODE_MAP[letters]) return STYLE_CODE_MAP[letters];
  }
  return undefined;
};

/** Stage codes that use the setting-time-table formula (mirrors backend) */
const SETTING_STAGE_CODES = new Set(['DIA_SET', 'SETTING']);

/** Reference table: X pieces of Y carats diamond (NetWeight) take Z hours */
const SETTING_TIME_TABLE = [
  { diamondCarats: 0.05, baseQty: 10, baseTimeHours: 0.5  },
  { diamondCarats: 0.10, baseQty: 10, baseTimeHours: 1.0  },
  { diamondCarats: 0.15, baseQty: 10, baseTimeHours: 1.5  },
  { diamondCarats: 0.20, baseQty: 10, baseTimeHours: 2.0  },
  { diamondCarats: 0.25, baseQty: 10, baseTimeHours: 2.5  },
  { diamondCarats: 0.30, baseQty: 10, baseTimeHours: 3.0  },
  { diamondCarats: 0.40, baseQty: 10, baseTimeHours: 3.5  },
  { diamondCarats: 0.50, baseQty: 10, baseTimeHours: 4.0  },
  { diamondCarats: 0.60, baseQty: 10, baseTimeHours: 4.5  },
  { diamondCarats: 0.75, baseQty: 10, baseTimeHours: 5.0  },
  { diamondCarats: 1.00, baseQty: 10, baseTimeHours: 6.0  },
  { diamondCarats: 1.25, baseQty: 10, baseTimeHours: 7.0  },
  { diamondCarats: 1.50, baseQty: 10, baseTimeHours: 8.0  },
  { diamondCarats: 2.00, baseQty: 10, baseTimeHours: 10.0 },
  { diamondCarats: 2.50, baseQty: 10, baseTimeHours: 12.0 },
  { diamondCarats: 3.00, baseQty: 10, baseTimeHours: 14.0 },
];

/** Sum totalCaratsPerPiece across all diamond specs (= NetWeight from diamond rows) */
const getTotalDiamondCarats = (diamondSpecs) => {
  if (!diamondSpecs?.length) return undefined;
  const total = diamondSpecs.reduce((sum, d) => sum + (d.totalCaratsPerPiece ?? 0), 0);
  return total > 0 ? total : undefined;
};

const resolvePerPcPieces = (jc) => {
  if (jc.perPcPieces && jc.perPcPieces > 0) return jc.perPcPieces;
  const fromSpecs = jc.diamondSpecs?.reduce((s, d) => s + (d.stonesPerPiece ?? 0), 0) ?? 0;
  return fromSpecs > 0 ? fromSpecs : undefined;
};

/**
 * Setting stage expected hours = NetWeight lookup × PerPc_Pieces qty.
 *   NetWeight (= totalCaratsPerPiece) → table lookup → perItemTime
 *   PerPc_Pieces (= stonesPerPiece)  → qty
 *   stoneTime = perItemTime × qty
 */
const calculateSettingTimeHours = (totalCaratsPerPiece, stonesPerPiece, fallback = 0) => {
  if (!totalCaratsPerPiece || totalCaratsPerPiece <= 0 || !stonesPerPiece || stonesPerPiece <= 0) {
    return fallback;
  }
  const entry = SETTING_TIME_TABLE.reduce((best, e) =>
    Math.abs(e.diamondCarats - totalCaratsPerPiece) < Math.abs(best.diamondCarats - totalCaratsPerPiece) ? e : best
  );
  const perItemTime = entry.baseTimeHours / entry.baseQty;
  const result = perItemTime * stonesPerPiece;

  if (__DEV__) {
    console.log(
      `[SettingTime] ${entry.baseTimeHours}h/${entry.baseQty}pcs @ ${entry.diamondCarats}ct → ${perItemTime.toFixed(4)}h/pc × ${stonesPerPiece}pcs = ${result.toFixed(2)}h`
    );
  }

  return result;
};


/**
 * Mirror of the backend getExpectedHours() helper.
 * Case-insensitive category matching (Excel sends "EARRING", rules saved as "Earring").
 */
const getExpectedHours = (stage, itemCategory, weightGrams, actualQty) => {
  const rules  = stage?.durationRules;
  const weight = weightGrams ?? 0;
  const cat    = (itemCategory ?? '').toLowerCase();
  const defaultH = stage?.expectedDurationHours ?? 0;

  const applyRule = (r) => {
    if (r.qty && r.qty > 1 && actualQty && actualQty > 0) {
      return (actualQty / r.qty) * r.hours;
    }
    return r.hours;
  };

  if (!rules?.length) return defaultH;

  const exact = rules.find(r =>
    r.category.toLowerCase() === cat &&
    weight >= r.weightMin && weight <= r.weightMax
  );
  if (exact) return applyRule(exact);

  const anyCat = rules.find(r =>
    r.category === '' && weight >= r.weightMin && weight <= r.weightMax
  );
  if (anyCat) return applyRule(anyCat);

  return defaultH;
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

const MovementRow = React.memo(({ mv, expectedHours }) => {
  const isOpen = !mv.exitedAt;

  // Live hours = time since enteredAt (our smart-estimated entry time)
  const liveHours = isOpen
    ? (Date.now() - new Date(mv.enteredAt).getTime()) / 3_600_000
    : null;

  // Actual hours resolution:
  //  1. durationHours  — stored on the movement when it was closed (most accurate)
  //  2. exitedAt - enteredAt — compute from timestamps if durationHours missing
  //  3. liveHours  — for open movements (now - enteredAt)
  const computedClosedHours =
    !isOpen && mv.exitedAt && mv.enteredAt
      ? (new Date(mv.exitedAt).getTime() - new Date(mv.enteredAt).getTime()) / 3_600_000
      : null;

  const rawActualHours =
    (mv.durationHours != null && mv.durationHours > 0) ? mv.durationHours :
    computedClosedHours != null                         ? computedClosedHours :
    liveHours;

  // If closed and both timestamps are within the same import batch (< 5 min),
  // we have no real context — treat as unknown rather than showing 0.0h.
  const hasNoContext = !isOpen && rawActualHours != null && rawActualHours < 0.083; // < 5 min

  const actualHours = hasNoContext ? null : rawActualHours;

  const delayHours = expectedHours > 0 && actualHours != null
    ? actualHours - expectedHours
    : isOpen && expectedHours > 0 && liveHours != null
      ? liveHours - expectedHours
      : null;

  // Progress bar: how far through expected time (capped at 100%)
  const progressPct = expectedHours > 0 && actualHours != null
    ? Math.min((actualHours / expectedHours) * 100, 100)
    : null;

  const progressColor = delayHours == null
    ? colors.primary                           // no duration context
    : delayHours > 0 ? colors.error            // overdue
    : delayHours > -expectedHours * 0.1 ? colors.warning  // within 10% of expected
    : colors.success;                           // plenty of time left

  return (
    <View style={styles.mvRow}>
      <View style={[styles.mvDot, isOpen && delayHours > 0 && { backgroundColor: colors.error }]} />
      <View style={styles.mvBody}>

        {/* Stage + badges */}
        <View style={styles.mvStageRow}>
          <Text style={styles.mvStage}>{mv.toStageCode}{mv.cellCode ? ` (${mv.cellCode})` : ''}</Text>
          {delayHours > 0 && (
            <View style={styles.mvDelayBadge}>
              <Text style={styles.mvDelayText}>+{delayHours.toFixed(1)}h delay</Text>
            </View>
          )}
          {delayHours !== null && delayHours <= 0 && (
            <View style={styles.mvOnTimeBadge}>
              <Text style={styles.mvOnTimeText}>on time</Text>
            </View>
          )}
        </View>

        {/* Time detail row */}
        <View style={styles.mvTimeRow}>
          <Text style={styles.mvTime}>
            {new Date(mv.enteredAt).toLocaleString()}
          </Text>
        </View>

        {/* Time progress */}
        {expectedHours > 0 && (
          <View style={styles.mvProgressWrap}>
            {actualHours != null ? (
              <>
                <View style={styles.mvProgressTrack}>
                  <View style={[
                    styles.mvProgressFill,
                    { width: `${progressPct}%`, backgroundColor: progressColor }
                  ]} />
                </View>
                <View style={styles.mvProgressLabels}>
                  <Text style={[styles.mvProgressActual, { color: progressColor }]}>
                    {isOpen
                      ? `${actualHours.toFixed(1)}h in stage`
                      : `${actualHours.toFixed(1)}h taken`}
                  </Text>
                  <Text style={styles.mvProgressExpected}>
                    {`/ ${parseFloat(expectedHours.toFixed(2))}h expected`}
                  </Text>
                </View>
              </>
            ) : (
              // No meaningful duration data — same-import batch, no context
              <Text style={styles.mvNoContext}>
                {'— duration unknown (passed in same import)  / '}
                {`${parseFloat(expectedHours.toFixed(2))}h expected`}
              </Text>
            )}
          </View>
        )}
        {mv.qcResult != null && (
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
});

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
  const [showAllSpecs, setShowAllSpecs] = useState(false);

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

  // ── Precomputed memos ─────────────────────────────────────────────────────

  // O(1) stage lookup — rebuilt only when stages list changes
  const stageMap = useMemo(() => new Map(stages.map(s => [s.code, s])), [stages]);

  // Resolved item category and diamond carats are constant for a given job card
  const resolvedCategory = useMemo(
    () => jc ? resolveItemCategory(jc.itemCategory, jc.styleNo) : null,
    [jc]
  );
  // Stage progress analysis — the heavy delay-calculation block, runs only when
  // jc, movements, or stages change (not on every render).
  const stageAnalysis = useMemo(() => {
    if (!stages.length || !jc) return null;

    const flowStages = stages.filter(s => s.displayOrder >= 1 && s.displayOrder < 90);
    const completedCodes = new Set(movements.filter(m => m.exitedAt).map(m => m.toStageCode));
    const currentByStage = new Map();
    jc.currentStageDistribution?.forEach(s => {
      const e = currentByStage.get(s.stageCode);
      if (e) { e.qty += s.qty; e.cells.push(s.cellCode); }
      else currentByStage.set(s.stageCode, { qty: s.qty, cells: [s.cellCode] });
    });

    const category = resolveItemCategory(jc.itemCategory, jc.styleNo);
    const sMap = new Map(stages.map(s => [s.code, s]));
    const delayByStage = new Map();
    const now = Date.now();

    const sortedMvs = [...movements].sort((a, b) =>
      new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime()
    );

    // ── Per-stage delay (open movements only, for UI indicators) ────────
    for (const mv of movements) {
      if (mv.exitedAt) continue;
      const stage = sMap.get(mv.toStageCode);
      if (!stage) continue;

      let expected = getExpectedHours(stage, category, jc.metalWeightPerPiece);
      if (SETTING_STAGE_CODES.has(mv.toStageCode)) {
        const nw = getTotalDiamondCarats(jc.diamondSpecs);
        const pp = resolvePerPcPieces(jc);
        expected += calculateSettingTimeHours(nw, pp, 0);
      }

      if (expected > 0) {
        const enteredMs = new Date(mv.enteredAt).getTime();
        const hoursInStage = (now - enteredMs) / 3_600_000;
        const delay = hoursInStage - expected;
        const existing = delayByStage.get(mv.toStageCode);
        if (!existing || delay > existing.delay) {
          delayByStage.set(mv.toStageCode, { hoursInStage, expected, delay });
        }
      }
    }

    const overdueStages = [...delayByStage.entries()]
      .filter(([, v]) => v.delay > 0)
      .sort((a, b) => b[1].delay - a[1].delay);

    // ── Stage Delay Calculation (following Stage Delay Calculation Notes) ──
    if (__DEV__) {
      (function calcLogger() {
        const L = (msg) => msg; // just for formatting consistency
        const lines = [];
        const push = (s) => lines.push(s);

        push(L(`\n╔══════════════════════════════════════════════════════════════════╗`));
        push(L(`║     STAGE DELAY CALCULATION  —  ${jc.gatiPieceCode}${' '.repeat(Math.max(0, 46 - jc.gatiPieceCode.length))}║`));
        push(L(`╚══════════════════════════════════════════════════════════════════╝`));

        // ── 1. STAGE FLOW ──────────────────────────────────────────────────
        const sortedFlow = [...flowStages].sort((a, b) => a.displayOrder - b.displayOrder);

        const firstMvStage = sortedMvs.length > 0 ? sortedMvs[0].toStageCode : null;
        const firstStageIdx = firstMvStage
          ? sortedFlow.findIndex(s => s.code === firstMvStage)
          : -1;

        const openMvs = sortedMvs.filter(m => !m.exitedAt);
        const currentMvStage = openMvs.length > 0 ? openMvs[openMvs.length - 1].toStageCode : null;
        const currentStageIdx = currentMvStage
          ? sortedFlow.findIndex(s => s.code === currentMvStage)
          : -1;

        const startIdx = firstStageIdx >= 0 ? firstStageIdx : 0;
        const currIdx = currentStageIdx >= 0 ? currentStageIdx : sortedFlow.length - 1;
        const movementSet = new Set(sortedMvs.map(m => m.toStageCode));

        push(L(`\n  ── Step 1: Stage Flow ────────────────────────────────────────`));
        push(L(`  Start Stage  : ${firstMvStage ?? 'N/A'} (first movement entered)`));
        push(L(`  Current Stage: ${currentMvStage ?? 'N/A'} (latest open movement)`));
        push(L(`  Full Stage Flow (Start → Current):`));
        for (let i = startIdx; i <= currIdx; i++) {
          const s = sortedFlow[i];
          const hasMv = movementSet.has(s.code);
          const isCurrent = s.code === currentMvStage;
          const isStart = s.code === firstMvStage;
          const marker = isCurrent ? ' ◀ CURRENT' : isStart ? ' ▶ START' : hasMv ? ' •' : ' (no movement)';
          push(L(`    ${(i - startIdx + 1).toString().padStart(2)}. ${s.code.padEnd(18)} displayOrder=${s.displayOrder}${marker}`));
        }

        // ── Job Start Timestamp ────────────────────────────────────────────
        const firstEntryMs = sortedMvs.length > 0 ? new Date(sortedMvs[0].enteredAt).getTime() : now;
        const currentEntryMs = currentMvStage
          ? (() => { const m = openMvs.find(mv => mv.toStageCode === currentMvStage); return m ? new Date(m.enteredAt).getTime() : now; })()
          : now;

        push(L(`\n  ── Step 2: Job Start & Current Timestamps ────────────────────`));
        push(L(`  Job Start Timestamp  : ${new Date(firstEntryMs).toLocaleString()} (first movement enteredAt)`));
        push(L(`  Current Stage Time   : ${new Date(currentEntryMs).toLocaleString()} (current stage enteredAt)`));

        // ── 3. EXPECTED TIME PER STAGE ──────────────────────────────────────
        push(L(`\n  ── Step 3: Expected Time Per Stage ─────────────────────────`));

        let cumulativeExpected = 0;
        let expectedTillCurrent = 0;
        let actualTillCurrent = 0;
        const stageDetails = [];

        for (let i = startIdx; i <= currIdx; i++) {
          const s = sortedFlow[i];
          const mvsForStage = sortedMvs.filter(m => m.toStageCode === s.code);
          const isSetting = SETTING_STAGE_CODES.has(s.code);

          let expectedH = 0;
          let calcDetail = '';
          let ruleRef = '';
          const weight = jc.metalWeightPerPiece ?? 0;

          const catWtTime = getExpectedHours(s, category, weight);
          let stoneTime = 0;
          if (isSetting) {
            const nw = getTotalDiamondCarats(jc.diamondSpecs);
            const pp = resolvePerPcPieces(jc);
            stoneTime = calculateSettingTimeHours(nw, pp, 0);
          }
          ruleRef = `cat+wt = ${catWtTime.toFixed(2)}h`;
          if (stoneTime > 0) ruleRef += ` | stone(NetWeight×PerPc) = ${stoneTime.toFixed(2)}h`;

          expectedH = parseFloat((catWtTime + stoneTime).toFixed(2));
          calcDetail = ` = ${catWtTime.toFixed(2)}h${stoneTime > 0 ? ` + ${stoneTime.toFixed(2)}h(stone)` : ''}`;

          // Actual time for this stage (for info — not used in spec formula)
          let actualH = 0;
          let hasMovements = mvsForStage.length > 0;
          if (hasMovements) {
            let stageEntryMs = null;
            let stageExitMs = null;
            for (const mv of mvsForStage) {
              const eMs = new Date(mv.enteredAt).getTime();
              const xMs = mv.exitedAt ? new Date(mv.exitedAt).getTime() : null;
              if (stageEntryMs === null || eMs < stageEntryMs) stageEntryMs = eMs;
              if (xMs !== null && (stageExitMs === null || xMs > stageExitMs)) stageExitMs = xMs;
            }
            actualH = stageExitMs !== null
              ? (stageExitMs - stageEntryMs) / 3_600_000
              : (now - stageEntryMs) / 3_600_000;
          }

          cumulativeExpected += expectedH;

          const isStartStage = s.code === firstMvStage;
          const isCurrStage = s.code === currentMvStage;
          const stageMarker = isCurrStage ? ' ◀ CURRENT' : isStartStage ? ' ▶ START' : '';

          stageDetails.push({ code: s.code, expectedH, actualH, hasMovement: hasMovements, isSetting, ruleRef, calcDetail, stageMarker });
        }

        expectedTillCurrent = cumulativeExpected;
        actualTillCurrent = (currentEntryMs - firstEntryMs) / 3_600_000;

        // Print per-stage details with actual time, individual delay, and cumulative delay
        // Note: "actual" = time spent in that specific stage (from movement data).
        // Stages with no movement records show N/A — the piece passed through them
        // (per the backend stage flow) but WIP snapshots don't capture individual timestamps.
        // Their expected time IS still counted in the cumulative expected sum.
        let cumExpected = 0;
        let cumActual = 0;
        push(L(`\n    ── Per-Stage Breakdown (flow order) ──────────────`));
        push(L(`    Stages without movement data show N/A for actual/delay.`));
        push(L(`    Expected time IS counted in cumulative Σ regardless.`));
        for (const sd of stageDetails) {
          cumExpected += sd.expectedH;
          if (sd.hasMovement) cumActual += sd.actualH;
          const stageDelay = sd.hasMovement ? sd.actualH - sd.expectedH : null;
          const delayIcon = stageDelay !== null ? (stageDelay > 0 ? '🔴' : stageDelay > -sd.expectedH * 0.1 ? '🟡' : '🟢') : '⬜';
          const line = sd.isSetting ? 'Setting' : 'Normal';
          push(L(`\n    ${sd.code}${sd.stageMarker}`));
          push(L(`    type       : ${line}`));
          push(L(`    expected   :${sd.calcDetail}`));
          if (sd.hasMovement) {
            push(L(`    actual     : ${sd.actualH.toFixed(2)}h (time spent in this stage)`));
            push(L(`    stage delay: ${delayIcon} ${stageDelay >= 0 ? '+' : ''}${stageDelay.toFixed(2)}h`));
          } else {
            push(L(`    actual     : N/A (no movement data — WIP snapshot covers this)`));
            push(L(`    stage delay: ⬜ N/A`));
          }
          push(L(`    cumulative : Σexp=${cumExpected.toFixed(2)}h  Σact=${cumActual.toFixed(2)}h  Σdelay=${delayIcon} ${(cumActual - cumExpected) >= 0 ? '+' : ''}${(cumActual - cumExpected).toFixed(2)}h`));
          push(L(`    reference  : ${sd.ruleRef}`));
        }

        push(L(`\n    ── Expected Time Summary ──`));
        push(L(`    Σ Expected (Start → Current) = ${expectedTillCurrent.toFixed(2)}h`));

        // ── 4. ACTUAL TIME TILL CURRENT STAGE ─────────────────────────────
        push(L(`\n  ── Step 4: Actual Time Till Current Stage ───────────────────`));
        push(L(`  Formula: Current Stage Timestamp - Job Start Timestamp`));
        push(L(`    = ${new Date(currentEntryMs).toLocaleString()} - ${new Date(firstEntryMs).toLocaleString()}`));
        push(L(`    = ${actualTillCurrent.toFixed(2)}h`));
        push(L(`  Note: This is the TOTAL wall-clock time from job start to now.`));
        push(L(`        Per-stage actual hours above are informational breakdown.`));

        // ── 5. REVERSE STAGE LOGIC ─────────────────────────────────────────
        push(L(`\n  ── Step 5: Reverse Stage Logic (Rework Detection) ────────────`));

        const displayOrderMap = new Map(flowStages.map(s => [s.code, s.displayOrder]));

        let totalReverseDelay = 0;
        let foundReverse = false;
        const reverseSegments = [];

        for (let i = 1; i < sortedMvs.length; i++) {
          const prev = sortedMvs[i - 1];
          const curr = sortedMvs[i];
          const prevOrder = displayOrderMap.get(prev.toStageCode);
          const currOrder = displayOrderMap.get(curr.toStageCode);
          if (prevOrder != null && currOrder != null && currOrder < prevOrder) {
            // Reverse detected: moved backward
            foundReverse = true;
            const prevStage = sMap.get(prev.toStageCode);
            const currStage = sMap.get(curr.toStageCode);
            const getExpected = (stg) => {
              if (!stg) return 0;
              const catWt = getExpectedHours(stg, category, jc.metalWeightPerPiece);
              if (SETTING_STAGE_CODES.has(stg.code)) {
                const nw = getTotalDiamondCarats(jc.diamondSpecs);
                const pp = resolvePerPcPieces(jc);
                return catWt + calculateSettingTimeHours(nw, pp, 0);
              }
              return catWt;
            };
            const prevExp = getExpected(prevStage);
            const currExp = getExpected(currStage);
            const revDelay = (prevExp || 0) + (currExp || 0);
            totalReverseDelay += revDelay;
            reverseSegments.push({
              fromStage: prev.toStageCode,
              toStage: curr.toStageCode,
              prevOrder,
              currOrder,
              prevExp: prevExp || 0,
              currExp: currExp || 0,
              revDelay,
            });
          }
        }

        if (foundReverse) {
          push(L(`  ⚠️  Reverse (rework) movements detected:`));
          for (const rs of reverseSegments) {
            push(L(`    ${rs.fromStage}(order=${rs.prevOrder}) → ${rs.toStage}(order=${rs.currOrder}) — backward step`));
            push(L(`    Reverse Delay = Expected(${rs.fromStage}) + Expected(${rs.toStage})`));
            push(L(`                  = ${rs.prevExp.toFixed(2)}h + ${rs.currExp.toFixed(2)}h = ${rs.revDelay.toFixed(2)}h`));
          }
          push(L(`    Total Reverse Delay = ${totalReverseDelay.toFixed(2)}h`));
        } else {
          push(L(`  ✅ No reverse movement detected (displayOrder strictly increasing)`));
        }

        const finalExpected = expectedTillCurrent + totalReverseDelay;

        // ── 6. FINAL EXPECTED TIME ────────────────────────────────────────
        push(L(`\n  ── Step 6: Final Expected Time ─────────────────────────────`));
        push(L(`  Formula: Expected Till Current Stage + Reverse Delay`));
        push(L(`    = ${expectedTillCurrent.toFixed(2)}h + ${totalReverseDelay.toFixed(2)}h`));
        push(L(`    = ${finalExpected.toFixed(2)}h`));

        // ── 7. STAGE DELAY ──────────────────────────────────────────────────
        const stageDelay = actualTillCurrent - finalExpected;

        push(L(`\n  ── Step 7: Stage Delay Calculation ─────────────────────────`));
        push(L(`  Formula: Actual Till Current Stage - Final Expected Time`));
        push(L(`    = ${actualTillCurrent.toFixed(2)}h - ${finalExpected.toFixed(2)}h`));
        push(L(`    = ${stageDelay >= 0 ? '+' : ''}${stageDelay.toFixed(2)}h`));

        // ── 8. STATUS ──────────────────────────────────────────────────────
        let status, statusIcon;
        if (stageDelay > 0) { status = 'DELAYED'; statusIcon = '🔴'; }
        else if (stageDelay === 0) { status = 'ON TIME'; statusIcon = '🟢'; }
        else { status = 'AHEAD OF SCHEDULE'; statusIcon = '🟢'; }

        push(L(`\n  ── Step 8: Delay Status ─────────────────────────────────────`));
        push(L(`  Stage Delay > 0  → ${statusIcon} ${status}`));

        push(L(`\n  ──────────────────────────────────────────────────────────────`));
        push(L(`  INPUT SUMMARY:`));
        push(L(`    Piece           : ${jc.gatiPieceCode}`));
        push(L(`    Category        : ${category ?? 'N/A'}`));
        push(L(`    Metal Weight    : ${jc.metalWeightPerPiece ?? 0}g`));
        push(L(`    Total Qty       : ${jc.totalQty}`));
        push(L(`  ──────────────────────────────────────────────────────────────`));
        push(L(`  FULL TIMELINE (past → current):`));
        for (let ti = 0; ti < stageDetails.length; ti++) {
          const sd = stageDetails[ti];
          const sDelay = sd.hasMovement ? sd.actualH - sd.expectedH : null;
          const icon = sDelay !== null ? (sDelay > 0 ? '🔴' : sDelay > -sd.expectedH * 0.1 ? '🟡' : '🟢') : '⬜';
          const actStr = sd.hasMovement ? `${sd.actualH.toFixed(2)}h` : 'N/A  ';
          const delayStr = sDelay !== null ? `${sDelay >= 0 ? '+' : ''}${sDelay.toFixed(2)}h` : 'N/A  ';
          push(L(`    ${(ti + 1).toString().padStart(2)}. ${sd.code.padEnd(16)} exp=${sd.expectedH.toFixed(2)}h  act=${actStr}  ${icon} ${delayStr}${sd.stageMarker}`));
        }
        push(L(`  ──────────────────────────────────────────────────────────────`));
        push(L(`  FINAL RESULT:`));
        push(L(`    ${statusIcon}  ${status}`));
        push(L(`    Actual Till Current   : ${actualTillCurrent.toFixed(2)}h  (wall clock: start→now)`));
        push(L(`    Expected Till Current : ${expectedTillCurrent.toFixed(2)}h  (Σ stage expectations)`));
        push(L(`    Reverse Delay         : ${totalReverseDelay.toFixed(2)}h  (rework penalty)`));
        push(L(`    Final Expected Time   : ${finalExpected.toFixed(2)}h  (expected + reverse)`));
        push(L(`    Stage Delay           : ${stageDelay >= 0 ? '+' : ''}${stageDelay.toFixed(2)}h  (actual − final expected)`));
        push(L(`  ══════════════════════════════════════════════════════════════\n`));

        console.log(lines.join('\n'));
      })();
    }

    return { flowStages, completedCodes, currentByStage, delayByStage, overdueStages };
  }, [jc, movements, stages]);

  // Allocation totals — recomputed only when allocations array changes
  const allocSummary = useMemo(() => {
    const totalAllocated = allocations.reduce((s, a) => s + (a.quantityAllocated ?? 0), 0);
    const totalConsumed  = allocations.reduce((s, a) => s + (a.quantityConsumed  ?? 0), 0);
    return { totalAllocated, totalConsumed, totalRemaining: totalAllocated - totalConsumed };
  }, [allocations]);

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

        {/* Stage flow + delay summary — driven by stageAnalysis useMemo */}
        {stageAnalysis && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Stage Progress</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stageFlow}>
                {stageAnalysis.flowStages.map((stage, idx) => {
                  const cur = stageAnalysis.currentByStage.get(stage.code);
                  const isCurrent = !!cur;
                  const isDone = stageAnalysis.completedCodes.has(stage.code) && !isCurrent;
                  const delayInfo = isCurrent ? stageAnalysis.delayByStage.get(stage.code) : null;
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

            {stageAnalysis.overdueStages.length > 0 && (
              <View style={styles.delaySection}>
                <Text style={styles.delaySectionTitle}>⏱ Stage Delays</Text>
                {stageAnalysis.overdueStages.map(([code, info]) => (
                  <View key={code} style={styles.delayRow}>
                    <View style={styles.delayLeft}>
                      <Text style={styles.delayStage}>{code}</Text>
                      <Text style={styles.delaySub}>
                        In stage {info.hoursInStage.toFixed(1)}h · Expected {parseFloat(info.expected.toFixed(2))}h
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
        )}

        {/* Diamond Specs */}
        {(() => {
          if (__DEV__ && specs.length > 0) {
            const lines = specs.map((d, i) => {
              return (
                `  Spec ${i+1}:\n` +
                `    gSize            : ${d.gSize}\n` +
                `    sieve            : ${d.sieve}\n` +
                `    diaSizeMM        : ${d.diaSizeMM}mm\n` +
                `    pointer          : ${d.pointer}ct`
              );
            }).join('\n');
            console.log(
              `\n[DiamondSpec] ── Job Card: ${jc.gatiPieceCode} ──────────────────\n` +
              lines + '\n'
            );
          }
          return (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Diamond Specs</Text>
                {specs.length > 1 && (
                  <TouchableOpacity onPress={() => setShowAllSpecs(s => !s)} style={styles.sectionAddBtn}>
                    <Text style={styles.sectionAddText}>
                      {showAllSpecs ? 'Show less' : `View all ${specs.length}`}
                    </Text>
                    <Icon name={showAllSpecs ? 'expand-less' : 'expand-more'} size={14} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
              {(showAllSpecs ? specs : specs.slice(0, 1)).map((d, i) => (
                <View key={i} style={styles.diaSpecCard}>
                  <View style={styles.diaSpecHeader}>
                    <Text style={styles.diaSpecTitle}>Spec {i + 1}</Text>
                    <Text style={styles.diaSpecSize}>{d.diaSizeMM}mm</Text>
                  </View>
                  <View style={styles.diaSpecRow}>
                    <Text style={styles.diaSpecLabel}>GSize</Text>
                    <Text style={styles.diaSpecVal}>{d.gSize}</Text>
                  </View>
                  <View style={styles.diaSpecRow}>
                    <Text style={styles.diaSpecLabel}>Sieve</Text>
                    <Text style={styles.diaSpecVal}>{d.sieve}</Text>
                  </View>
                  <View style={styles.diaSpecRow}>
                    <Text style={styles.diaSpecLabel}>Pointer</Text>
                    <Text style={styles.diaSpecVal}>{d.pointer}ct / stone</Text>
                  </View>
                </View>
              ))}
            </View>
          );
        })()}

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
              <View style={styles.allocSummaryRow}>
                <View style={styles.allocSummaryChip}>
                  <Text style={styles.allocSummaryNum}>{allocSummary.totalAllocated}</Text>
                  <Text style={styles.allocSummaryLbl}>Allocated</Text>
                </View>
                <View style={[styles.allocSummaryChip, { borderColor: colors.success + '50' }]}>
                  <Text style={[styles.allocSummaryNum, { color: colors.success }]}>{allocSummary.totalConsumed}</Text>
                  <Text style={styles.allocSummaryLbl}>Consumed</Text>
                </View>
                <View style={[styles.allocSummaryChip, { borderColor: (allocSummary.totalRemaining > 0 ? colors.warning : colors.textSecondary) + '50' }]}>
                  <Text style={[styles.allocSummaryNum, { color: allocSummary.totalRemaining > 0 ? colors.warning : colors.textSecondary }]}>{allocSummary.totalRemaining}</Text>
                  <Text style={styles.allocSummaryLbl}>Remaining</Text>
                </View>
              </View>

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
              {(() => { if (__DEV__) {
                const sorted = [...movements].sort((a, b) => new Date(a.enteredAt) - new Date(b.enteredAt));
                const now = Date.now();
                console.log('═══════════ Stage Timeline ═══════════');
                sorted.forEach((mv, i) => {
                  const s = stageMap.get(mv.toStageCode);
                  const catWt = s ? getExpectedHours(s, resolvedCategory, jc.metalWeightPerPiece) : 0;
                  let stoneT = 0;
                  if (s && SETTING_STAGE_CODES.has(s.code)) {
                    const nw = getTotalDiamondCarats(jc.diamondSpecs);
                    const pp = resolvePerPcPieces(jc);
                    stoneT = calculateSettingTimeHours(nw, pp, 0);
                  }
                  const expH = catWt + stoneT;
                  const enteredMs = new Date(mv.enteredAt).getTime();
                  const exitedMs = mv.exitedAt ? new Date(mv.exitedAt).getTime() : null;
                  const actualH = exitedMs ? (exitedMs - enteredMs) / 3600000 : (now - enteredMs) / 3600000;
                  const delay = expH > 0 ? actualH - expH : 0;
                  const status = !mv.exitedAt ? 'OPEN' : 'CLOSED';
                  console.log(
                    `[Timeline] #${i} ${mv.toStageCode}${mv.cellCode ? `(${mv.cellCode})` : ''} ${status}` +
                    `  entered=${new Date(mv.enteredAt).toLocaleString()}` +
                    `${mv.exitedAt ? '  exited=' + new Date(mv.exitedAt).toLocaleString() : ''}` +
                    `  actual=${actualH.toFixed(2)}h  expected=${expH.toFixed(2)}h  delay=${delay >= 0 ? '+' : ''}${delay.toFixed(2)}h`
                  );
                });
                console.log('══════════════════════════════════════');
              }})()}
              {movements.map((mv, i) => {
                const mvStage = stageMap.get(mv.toStageCode);
                const mvExpected = mvStage
                  ? (() => {
                      const catWt = getExpectedHours(mvStage, resolvedCategory, jc.metalWeightPerPiece);
                      if (SETTING_STAGE_CODES.has(mvStage.code)) {
                        const nw = getTotalDiamondCarats(jc.diamondSpecs);
                        const pp = resolvePerPcPieces(jc);
                        return catWt + calculateSettingTimeHours(nw, pp, 0);
                      }
                      return catWt;
                    })()
                  : 0;
                return (
                  <MovementRow
                    key={mv._id || i}
                    mv={mv}
                    expectedHours={mvExpected}
                  />
                );
              })}
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
                        {d.diaSizeMM}mm
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
                placeholder="Number of stones"
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
  // Diamond spec card
  diaSpecCard: { backgroundColor: colors.backgroundSecondary, borderRadius: 10, padding: 12, marginBottom: 8 },
  diaSpecHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  diaSpecTitle: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.primary },
  diaSpecSize: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  diaSpecRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  diaSpecHighlight: { backgroundColor: colors.primaryExtraLight, borderRadius: 6, paddingHorizontal: 6, marginVertical: 2 },
  diaSpecLabel: { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textSecondary },
  diaSpecVal: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textPrimary },
  diaSpecMuted: { fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary },
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
  mvTimeRow: { marginTop: 2 },
  mvTime: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary },
  mvProgressWrap: { marginTop: 6 },
  mvProgressTrack: { height: 4, backgroundColor: colors.borderLight, borderRadius: 2, overflow: 'hidden' },
  mvProgressFill: { height: '100%', borderRadius: 2 },
  mvProgressLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  mvProgressActual: { fontFamily: fonts.bold, fontSize: 10 },
  mvProgressExpected: { fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary },
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

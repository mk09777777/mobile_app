/**
 * ClientHandlerEnquiryScreen
 * Dedicated enquiry screen for client_handler role.
 *
 * Tabs: All | Assigned▼ | By Status▼ | New | Coral | CAD | Quotation | Shipment
 * Each tab sends status directly to API — no frontend status re-filtering.
 * Default sort: Priority (High → Medium → Low), then newest first.
 */

import React, {
  useState, useCallback, useMemo, useRef, useEffect,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
  FlatList, ActivityIndicator, RefreshControl, TextInput, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import {
  useGetEnquiriesQuery,
  useGetEnquiryByIdQuery,
  useGetUsersQuery,
  useUpdateEnquiryMutation,
  useDeleteEnquiryMutation,
} from '../../store/api';
import { useClients } from '../../features/clients/clientsHooks';
import NewCard from '../../components/cards/NewCard';
import Icon from '../../components/common/Icon';
import BrandedAlert from '../../components/common/BrandedAlert';
import CreateEnquiryModal from '../EditEnquiry/createEnquiryModal';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 30;

const TABS = [
  { key: 'all',       label: 'All' },
  { key: 'assigned',  label: 'Assigned',  hasDropdown: true },
  { key: 'status',    label: 'By Status', hasDropdown: true },
  { key: 'new',       label: 'New' },
  { key: 'coral',     label: 'Coral' },
  { key: 'cad',       label: 'CAD' },
  { key: 'quotation', label: 'Quotation' },
  { key: 'shipped',  label: 'Shipped' },
];

// Status values sent to the API for each tab
const TAB_STATUS_MAP = {
  new:       ['Enquiry Created', 'enquiry_created', 'Pending', 'pending', 'New', 'new'],
  coral:     ['Coral', 'coral'],
  cad:       ['CAD', 'cad', 'Cad'],
  quotation: ['Quotation', 'quotation'],
  shipped:  ['Shipped', 'shipped', 'Shipment', 'shipment'],
};

const STATUS_OPTIONS = [
  'Enquiry Created', 'Coral', 'CAD', 'Quotation',
  'Shipped', 'Design Approval Pending', 'Production', 'Completed', 'Rejected',
];

const SORT_OPTIONS = [
  { key: 'priority_asc',  label: 'Priority (High–Low)', icon: 'arrow-upward'  },
  { key: 'priority_desc', label: 'Priority (Low–High)', icon: 'arrow-downward' },
  { key: 'date_desc',     label: 'Newest First',        icon: 'schedule'       },
  { key: 'date_asc',      label: 'Oldest First',        icon: 'history'        },
];

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const getPriorityRank = p => PRIORITY_ORDER[String(p || '').toLowerCase()] ?? 1;

const sortItems = (items, sortKey) => {
  const arr = [...items];
  arr.sort((a, b) => {
    if (sortKey === 'priority_asc' || sortKey === 'priority_desc') {
      const diff = getPriorityRank(a.priority || a.Priority) - getPriorityRank(b.priority || b.Priority);
      if (diff !== 0) return sortKey === 'priority_asc' ? diff : -diff;
    }
    const da = new Date(a.updatedAt || a.createdAt || 0);
    const db = new Date(b.updatedAt || b.createdAt || 0);
    return sortKey === 'date_asc' ? da - db : db - da;
  });
  return arr;
};

// ─── Markdown / HTML → native renderer ────────────────────────────────────────
const _dec = (s = '') =>
  String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

const _strip = (s = '') => {
  let t = String(s).replace(/<[^>]*>/g, '');
  t = _dec(t);
  t = t.replace(/\*\*\*(.+?)\*\*\*/g, '$1').replace(/\*\*(.+?)\*\*/g, '$1')
       .replace(/\*(.+?)\*/g, '$1').replace(/__(.+?)__/g, '$1')
       .replace(/_(.+?)_/g, '$1').replace(/`(.+?)`/g, '$1')
       .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  return t.trim();
};

const renderMdSummary = (input, s) => {
  if (!input) return null;
  const text = (typeof input === 'string' ? input : String(input)).replace(/\\n/g, '\n');
  const sections = [];

  // HTML tables
  [...text.matchAll(/<table[\s\S]*?<\/table>/gi)].forEach((tbl, ti) =>
    [...tbl[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].forEach((row, ri) => {
      const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
      if (cells.length >= 2) {
        const label = _strip(cells[0][1]), val = _strip(cells.slice(1).map(c => c[1]).join(' '));
        if (label || val) sections.push({ type: 'row', label, val, key: `t${ti}r${ri}` });
      } else if (cells.length === 1) {
        const t2 = _strip(cells[0][1]);
        if (t2) sections.push({ type: 'text', text: t2, key: `tc${ti}${ri}` });
      }
    }));
  [...text.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].forEach((m, i) => {
    const t2 = _strip(m[1]); if (t2) sections.push({ type: 'bullet', text: t2, key: `li${i}` });
  });
  [...text.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)].forEach((m, i) => {
    const t2 = _strip(m[2]); if (t2) sections.push({ type: 'heading', level: parseInt(m[1], 10), text: t2, key: `hh${i}` });
  });
  const noTbl = text.replace(/<table[\s\S]*?<\/table>/gi, '').replace(/<[uo]l[\s\S]*?<\/[uo]l>/gi, '');
  [...noTbl.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].forEach((m, i) => {
    const t2 = _strip(m[1]); if (t2) sections.push({ type: 'text', text: t2, key: `pp${i}` });
  });

  if (sections.length === 0) {
    text.replace(/<[^>]*>/g, '').split('\n').forEach((raw, i) => {
      const line = raw.trimEnd(); if (!line.trim()) return;
      const mdH = line.match(/^(#{1,6})\s+(.+)$/);
      if (mdH) { const t2 = _strip(mdH[2]); if (t2) { sections.push({ type: 'heading', level: mdH[1].length, text: t2, key: `mh${i}` }); return; } }
      const bh = line.match(/^\*\*([^*]+)\*\*\s*[:：]?\s*$/);
      if (bh) { const t2 = _strip(bh[1]); if (t2) { sections.push({ type: 'heading', level: 2, text: t2, key: `bh${i}` }); return; } }
      const bl = line.match(/^[\*\-\+•]\s{1,4}(.+)$/);
      if (bl) {
        const kv = bl[1].match(/^\*\*([^*]+):\*\*\s*(.*)$/);
        if (kv) { const lbl = _strip(kv[1]); const val = _strip(kv[2]); if (lbl) { sections.push({ type: 'row', label: lbl, val: val || '—', key: `bkv${i}` }); return; } }
        const t2 = _strip(bl[1]); if (t2) { sections.push({ type: 'bullet', text: t2, key: `bl${i}` }); return; }
      }
      const kv2 = line.match(/^\*\*([^*]+):\*\*\s*(.+)$/);
      if (kv2) { const lbl = _strip(kv2[1]); const val = _strip(kv2[2]); if (lbl) { sections.push({ type: 'row', label: lbl, val, key: `kv${i}` }); return; } }
      const t2 = _strip(line); if (t2) sections.push({ type: 'text', text: t2, key: `pl${i}` });
    });
  }

  if (!sections.length) return null;
  return (
    <View style={s.mdContainer}>
      {sections.map(sec => {
        switch (sec.type) {
          case 'heading': return <Text key={sec.key} style={[s.mdHeading, sec.level <= 2 && s.mdHeadingLg]}>{sec.text}</Text>;
          case 'row':     return <View key={sec.key} style={s.mdRow}><Text style={s.mdKey} numberOfLines={2}>{sec.label}</Text><Text style={s.mdVal}>{sec.val}</Text></View>;
          case 'bullet':  return <View key={sec.key} style={s.mdBullet}><Text style={s.mdDot}>•</Text><Text style={s.mdBulletTxt}>{sec.text}</Text></View>;
          default:        return <Text key={sec.key} style={s.mdPara}>{sec.text}</Text>;
        }
      })}
    </View>
  );
};

// ─── Checklist field definitions ─────────────────────────────────────────────
//
//  type:
//    'text'    – free text, any input accepted
//    'numeric' – must be a positive number or the literal "NA"
//    'date'    – must match DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD or "NA"
//
const CL_FIELDS = [
  { key: 'Engraving',           label: 'Engraving',             multiline: false, type: 'text',    keyboardType: 'default',     placeholder: 'e.g. Custom text or NA' },
  { key: 'SizeLength',          label: 'Size (Length)',          multiline: false, type: 'numeric', keyboardType: 'decimal-pad', placeholder: 'e.g. 18.5 or NA'        },
  { key: 'SizeRingSize',        label: 'Size (Ring Size)',       multiline: false, type: 'numeric', keyboardType: 'decimal-pad', placeholder: 'e.g. 7 or NA'           },
  { key: 'DimensionsThickness', label: 'Dimensions (Thickness)', multiline: false, type: 'numeric', keyboardType: 'decimal-pad', placeholder: 'e.g. 2.5 or NA'         },
  { key: 'DeliveryDate',        label: 'Delivery Date',          multiline: false, type: 'date',    keyboardType: 'default',     placeholder: 'DD/MM/YYYY or NA'        },
  { key: 'EnamelPaintwork',     label: 'Enamel / Paintwork',     multiline: true,  type: 'text',    keyboardType: 'default',     placeholder: 'Describe or NA'          },
  { key: 'RhodiumInstructions', label: 'Rhodium Instructions',   multiline: true,  type: 'text',    keyboardType: 'default',     placeholder: 'Describe or NA'          },
  { key: 'Components',          label: 'Components',             multiline: true,  type: 'text',    keyboardType: 'default',     placeholder: 'List components or NA'   },
  { key: 'Findings',            label: 'Findings',               multiline: true,  type: 'text',    keyboardType: 'default',     placeholder: 'Describe findings or NA' },
];

// Returns an error string or null
const validateClField = (type, value) => {
  const v = String(value ?? '').trim();
  if (v === '' || v.toUpperCase() === 'NA') return null; // empty / NA always valid
  switch (type) {
    case 'numeric': {
      const n = Number(v);
      if (isNaN(n) || n < 0) return 'Must be a positive number or NA';
      return null;
    }
    case 'date': {
      // Accept DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, or any parseable date string
      const ddmm  = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v);
      const isoFmt = /^\d{4}-\d{2}-\d{2}$/.test(v);
      const parsed = new Date(v);
      if (!ddmm && !isoFmt && isNaN(parsed.getTime())) return 'Enter a valid date (DD/MM/YYYY) or NA';
      return null;
    }
    default:
      return null;
  }
};

// ─── Card with action bar ─────────────────────────────────────────────────────
const EnquiryCardItem = React.memo(({
  enquiry, navigation, onPreview, onSummary, onChecklist, onUpdate, onDelete, activeTab, isExpandedAll,
}) => (
  <View style={styles.cardWrapper}>
    <NewCard
      item={enquiry}
      navigation={navigation}
      onViewQuotation={() => {}}
      currentTab={activeTab}
      onUpdateEnquiry={onUpdate}
      onDeleteEnquiry={onDelete}
      isExpandedAll={isExpandedAll}
      onPress={() => navigation.navigate('SingleEnquiry', { enquiryId: enquiry.id || enquiry._id, enquiry })}
    />
    <View style={styles.actionBar}>
      <View style={styles.actionDivider} />
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onPreview(enquiry)} activeOpacity={0.7}>
          <Icon name="remove-red-eye" size={15} color={colors.primary} />
          <Text style={styles.actionBtnText}>Preview</Text>
        </TouchableOpacity>
        <View style={styles.actionSep} />
        <TouchableOpacity style={styles.actionBtn} onPress={() => onSummary(enquiry.id || enquiry._id)} activeOpacity={0.7}>
          <Icon name="assessment" size={15} color={colors.primary} />
          <Text style={styles.actionBtnText}>Summary</Text>
        </TouchableOpacity>
        <View style={styles.actionSep} />
        <TouchableOpacity style={styles.actionBtn} onPress={() => onChecklist(enquiry.id || enquiry._id)} activeOpacity={0.7}>
          <Icon name="fact-check" size={15} color={colors.primary} />
          <Text style={styles.actionBtnText}>Checklist</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
));

// ─── Main screen ──────────────────────────────────────────────────────────────
const ClientHandlerEnquiryScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Client context (when navigated from dashboard)
  const routeClient = route?.params?.client || null;
  const clientId    = routeClient?.id   || null;
  const clientName  = routeClient?.name || null;

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab,       setActiveTab]       = useState('all');
  const [assignedUserId,  setAssignedUserId]  = useState(null);
  const [selectedStatus,  setSelectedStatus]  = useState(null);
  const [showUserDrop,    setShowUserDrop]    = useState(false);
  const [showStatusDrop,  setShowStatusDrop]  = useState(false);
  const [showSortDrop,    setShowSortDrop]    = useState(false);
  const [sortKey,         setSortKey]         = useState('priority_asc');
  const [isExpandedAll,   setIsExpandedAll]   = useState(false);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [showSearch,      setShowSearch]      = useState(false);
  const searchRef = useRef(null);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [previewEnquiry,     setPreviewEnquiry]     = useState(null);
  const [summaryEnquiryId,   setSummaryEnquiryId]   = useState(null);
  const [checklistEnquiryId, setChecklistEnquiryId] = useState(null);
  const [editableChecklist,  setEditableChecklist]  = useState({});  // live-edit state
  const [checklistErrors,    setChecklistErrors]    = useState({});  // field-level validation errors
  const [checklistDirty,     setChecklistDirty]     = useState(false);
  const [checklistSaving,    setChecklistSaving]    = useState(false);
  const [showCreateModal,    setShowCreateModal]    = useState(false);

  // ── Alert ─────────────────────────────────────────────────────────────────
  const [alertCfg, setAlertCfg] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = useCallback((title, message, type = 'info', buttons = []) =>
    setAlertCfg({ visible: true, title, message, type, buttons }), []);
  const hideAlert = useCallback(() => setAlertCfg(p => ({ ...p, visible: false })), []);

  // ── Pagination ────────────────────────────────────────────────────────────
  const [page,       setPage]       = useState(1);
  const [allItems,   setAllItems]   = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const onEndMomentum  = useRef(false);
  const refreshTimer   = useRef(null);
  const refreshFetchSeen = useRef(false);

  useEffect(() => { setPage(1); setAllItems([]); }, [activeTab, assignedUserId, selectedStatus, clientId, searchQuery]);

  // ── Users ─────────────────────────────────────────────────────────────────
  const { data: usersData } = useGetUsersQuery();
  const allUsers = useMemo(() => {
    const arr = Array.isArray(usersData) ? usersData : (usersData?.users || usersData?.data || []);
    return arr.filter(u => !['client', 'cl'].includes(String(u.role || u.Role || '').toLowerCase()));
  }, [usersData]);

  // ── Client name resolution ────────────────────────────────────────────────
  const { clients: clientsData = [] } = useClients({ skip: !user });
  const clientNameMap = useMemo(() => {
    const m = new Map();
    (Array.isArray(clientsData) ? clientsData : []).forEach(c => {
      const id = String(c.id || c._id || '').trim();
      const n  = c.name || c.Name;
      if (id && n && n !== 'Unknown Client') { m.set(id, n); m.set(id.toLowerCase(), n); }
    });
    return m;
  }, [clientsData]);

  const resolveClient = useCallback(enq => {
    const ex = enq.clientName || enq.ClientName;
    if (ex && ex !== 'Unknown Client') return ex;
    const rawId = enq.clientId || enq.ClientId;
    if (!rawId) return 'Unknown Client';
    const id = String(rawId).trim();
    return clientNameMap.get(id) || clientNameMap.get(id.toLowerCase()) || 'Unknown Client';
  }, [clientNameMap]);

  // ── Query params ──────────────────────────────────────────────────────────
  // Tab status values — sent directly to API, no frontend re-filtering
  const statusValues = useMemo(() => {
    if (activeTab === 'assigned' || activeTab === 'all') return null;
    if (activeTab === 'status') return selectedStatus ? [selectedStatus] : null;
    return TAB_STATUS_MAP[activeTab] || null;
  }, [activeTab, selectedStatus]);

  const queryParams = useMemo(() => {
    const params = {
      role:  user?.role,
      page,
      limit: PAGE_SIZE,
      search: searchQuery.trim() || undefined,
      filters: {
        sortBy:    'CreatedDate',
        sortOrder: 'desc',
        ...(clientId ? { clientId } : {}),
      },
    };
    if (activeTab === 'assigned' && assignedUserId) {
      params.filters.assignedTo = assignedUserId;
    } else if (statusValues && statusValues.length > 0) {
      params.filters.status = statusValues;
    }
    return params;
  }, [user, page, activeTab, assignedUserId, statusValues, clientId, searchQuery]);

  const { data, isLoading, isFetching, refetch } = useGetEnquiriesQuery(queryParams, { skip: !user });
  const [updateEnquiry] = useUpdateEnquiryMutation();
  const [deleteEnquiry] = useDeleteEnquiryMutation();

  // ── Build list — sort on frontend, no status re-filter (API handles it) ──
  useEffect(() => {
    if (!data?.data) return;

    // Only valid items
    let items = data.data.filter(item => item && (item.id || item._id));

    // clientId safety-net (backend may not scope correctly)
    if (clientId) {
      items = items.filter(item => {
        const cid = String(item.clientId || item.ClientId || item._originalData?.ClientId || '').trim();
        return cid === clientId;
      });
    }

    // assignedTo safety-net
    if (activeTab === 'assigned' && assignedUserId) {
      items = items.filter(item => {
        const raw = item._originalData || item;
        let aid = raw.AssignedTo || raw.assignedTo || '';
        if (aid && typeof aid === 'object') aid = aid.id || aid._id || '';
        return String(aid).trim() === assignedUserId;
      });
    }

    // Sort
    const sorted = sortItems(items.map(item => ({
      ...item,
      id: item.id || item._id || item.Id,
      clientName: resolveClient(item),
    })), sortKey);

    setAllItems(prev => {
      if (page === 1) return sorted;
      const seen = new Set(prev.map(i => i.id));
      return [...prev, ...sorted.filter(i => !seen.has(i.id))];
    });
  }, [data, page, activeTab, assignedUserId, clientId, sortKey, resolveClient]);

  // Re-sort when sortKey changes (without re-fetching)
  useEffect(() => {
    setAllItems(prev => sortItems([...prev], sortKey));
  }, [sortKey]);

  // Re-enrich client names
  useEffect(() => {
    if (!clientNameMap.size) return;
    setAllItems(prev => prev.map(item => ({ ...item, clientName: resolveClient(item) })));
  }, [clientNameMap, resolveClient]);

  // ── Refresh ───────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refreshFetchSeen.current = false;
    if (page === 1) refetch(); else setPage(1);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setRefreshing(false), 8000);
  }, [page, refetch]);

  useEffect(() => { if (refreshing && isFetching) refreshFetchSeen.current = true; }, [refreshing, isFetching]);
  useEffect(() => {
    if (refreshing && refreshFetchSeen.current && !isFetching && Array.isArray(data?.data)) {
      refreshFetchSeen.current = false;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      setRefreshing(false);
    }
  }, [refreshing, isFetching, data]);
  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);

  const handleLoadMore = useCallback(() => {
    if (!isFetching && data?.pagination && page < data.pagination.totalPages) setPage(p => p + 1);
  }, [isFetching, data, page]);

  // ── Card handlers ─────────────────────────────────────────────────────────
  const handleUpdate = useCallback(async (id, updates) => {
    try { await updateEnquiry({ id, ...updates }).unwrap(); }
    catch (e) { showAlert('Error', e?.data?.message || 'Update failed', 'error'); }
  }, [updateEnquiry, showAlert]);

  const handleDelete = useCallback(async (enquiryId) => new Promise(resolve => {
    showAlert('Delete Enquiry', 'Are you sure? This cannot be undone.', 'warning', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteEnquiry(enquiryId).unwrap(); setPage(1); setAllItems([]); refetch(); resolve(true); }
        catch (e) { showAlert('Error', e?.data?.message || 'Delete failed', 'error'); resolve(false); }
      }},
    ]);
  }), [deleteEnquiry, showAlert, refetch]);

  const handlePreview   = useCallback(enq => setPreviewEnquiry(enq), []);
  const handleSummary   = useCallback(id  => setSummaryEnquiryId(id), []);
  const handleChecklist = useCallback(id  => setChecklistEnquiryId(id), []);

  // ── Detail queries ────────────────────────────────────────────────────────
  const { data: summaryData,   isLoading: summaryLoading   } = useGetEnquiryByIdQuery(summaryEnquiryId,    { skip: !summaryEnquiryId });
  const { data: checklistData, isLoading: checklistLoading } = useGetEnquiryByIdQuery(checklistEnquiryId, { skip: !checklistEnquiryId });

  // Seed editable checklist whenever fresh data arrives
  useEffect(() => {
    if (!checklistData) return;
    const cl =
      (checklistData?.Checklist && typeof checklistData.Checklist === 'object' && checklistData.Checklist) ||
      (checklistData?._originalData?.Checklist && typeof checklistData._originalData.Checklist === 'object' && checklistData._originalData.Checklist) || null;
    if (cl) {
      const seed = {};
      CL_FIELDS.forEach(f => { seed[f.key] = cl[f.key] != null ? String(cl[f.key]) : ''; });
      setEditableChecklist(seed);
      setChecklistDirty(false);
    }
  }, [checklistData]);

  // Reset editable state when modal closes
  useEffect(() => {
    if (!checklistEnquiryId) {
      setEditableChecklist({});
      setChecklistErrors({});
      setChecklistDirty(false);
      setChecklistSaving(false);
    }
  }, [checklistEnquiryId]);

  const handleChecklistFieldChange = useCallback((key, value) => {
    setEditableChecklist(prev => ({ ...prev, [key]: value }));
    setChecklistDirty(true);
    // Validate on every keystroke so error clears as soon as input becomes valid
    const field = CL_FIELDS.find(f => f.key === key);
    const err = field ? validateClField(field.type, value) : null;
    setChecklistErrors(prev => {
      if (!err) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: err };
    });
  }, []);

  const checklistHasErrors = useMemo(
    () => Object.keys(checklistErrors).length > 0,
    [checklistErrors],
  );

  const handleSaveChecklist = useCallback(async () => {
    if (!checklistEnquiryId || !checklistDirty) return;

    // Full validation pass before submit
    const allErrors = {};
    CL_FIELDS.forEach(f => {
      const err = validateClField(f.type, editableChecklist[f.key]);
      if (err) allErrors[f.key] = err;
    });
    if (Object.keys(allErrors).length > 0) {
      setChecklistErrors(allErrors);
      showAlert('Validation Error', 'Please fix the highlighted fields before saving.', 'warning', [{ text: 'OK' }]);
      return;
    }

    setChecklistSaving(true);
    try {
      // Merge edits back into the existing checklist object (preserve GeneratedAt etc.)
      const existingCl =
        (checklistData?.Checklist && typeof checklistData.Checklist === 'object' && checklistData.Checklist) ||
        (checklistData?._originalData?.Checklist && typeof checklistData._originalData.Checklist === 'object' && checklistData._originalData.Checklist) || {};
      const updatedChecklist = { ...existingCl, ...editableChecklist };
      await updateEnquiry({ id: checklistEnquiryId, Checklist: updatedChecklist }).unwrap();
      setChecklistDirty(false);
      showAlert('Saved', 'Checklist updated successfully.', 'success', [{ text: 'OK' }]);
    } catch (e) {
      showAlert('Error', e?.data?.message || 'Failed to save checklist. Please try again.', 'error');
    } finally {
      setChecklistSaving(false);
    }
  }, [checklistEnquiryId, checklistDirty, editableChecklist, checklistErrors, checklistData, updateEnquiry, showAlert]);

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item }) => (
    <EnquiryCardItem
      enquiry={item}
      navigation={navigation}
      activeTab={activeTab}
      isExpandedAll={isExpandedAll}
      onPreview={handlePreview}
      onSummary={handleSummary}
      onChecklist={handleChecklist}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
    />
  ), [navigation, activeTab, isExpandedAll, handlePreview, handleSummary, handleChecklist, handleUpdate, handleDelete]);

  const keyExtractor = useCallback((item, i) =>
    item?.id ? String(item.id) : item?._id ? String(item._id) : `i-${i}`, []);

  const renderFooter = useCallback(() =>
    (isFetching && page > 1)
      ? <View style={{ paddingVertical: 20, alignItems: 'center' }}><ActivityIndicator size="small" color={colors.primary} /></View>
      : null, [isFetching, page]);

  const renderEmpty = useCallback(() =>
    (isLoading || isFetching) ? null : (
      <View style={styles.emptyWrap}>
        <Icon name="inbox" size={48} color={colors.textSecondary} />
        <Text style={styles.emptyText}>No enquiries found</Text>
        <Text style={styles.emptySub}>Try a different tab or pull to refresh</Text>
      </View>
    ), [isLoading, isFetching]);

  const currentSortLabel = SORT_OPTIONS.find(o => o.key === sortKey)?.label || 'Sort';
  const assignedUserName = useMemo(() => {
    if (!assignedUserId) return null;
    const u = allUsers.find(u => String(u.id || u._id) === assignedUserId);
    return u ? String(u.name || u.Name || '') : null;
  }, [assignedUserId, allUsers]);

  const showLoader = isLoading && page === 1 && !refreshing;

  // ── Search toggle ─────────────────────────────────────────────────────────
  const toggleSearch = useCallback(() => {
    setShowSearch(v => {
      if (v) setSearchQuery('');
      else setTimeout(() => searchRef.current?.focus(), 100);
      return !v;
    });
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        {clientId && (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Icon name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {clientName || 'Enquiries'}
          </Text>
          {clientName && (
            <Text style={styles.headerSubtitle}>{allItems.length} enquir{allItems.length === 1 ? 'y' : 'ies'}</Text>
          )}
        </View>

        {/* Search toggle */}
        <TouchableOpacity style={styles.headerIconBtn} onPress={toggleSearch} activeOpacity={0.7}>
          <Icon name={showSearch ? 'search-off' : 'search'} size={22} color="#fff" />
        </TouchableOpacity>

        {/* Sort */}
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowSortDrop(true)} activeOpacity={0.7}>
          <Icon name="sort" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Expand all */}
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => setIsExpandedAll(v => !v)} activeOpacity={0.7}>
          <Icon name={isExpandedAll ? 'unfold-less' : 'unfold-more'} size={22} color="#fff" />
        </TouchableOpacity>

        {/* New enquiry */}
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)} activeOpacity={0.8}>
          <Icon name="add" size={18} color={colors.primary} />
          <Text style={styles.createBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* ── Search bar ────────────────────────────────────────────────── */}
      {showSearch && (
        <View style={styles.searchBar}>
          <Icon name="search" size={18} color={colors.textSecondary} />
          <TextInput
            ref={searchRef}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search enquiries…"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Tab bar ───────────────────────────────────────────────────── */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => {
                  setActiveTab(tab.key);
                  if (tab.key === 'assigned') setShowUserDrop(true);
                  if (tab.key === 'status')   setShowStatusDrop(true);
                }}
                activeOpacity={0.75}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.key === 'assigned' && assignedUserName
                    ? assignedUserName
                    : tab.key === 'status' && selectedStatus
                      ? selectedStatus
                      : tab.label}
                </Text>
                {tab.hasDropdown && (
                  <Icon
                    name="arrow-drop-down"
                    size={15}
                    color={isActive ? colors.primary : 'rgba(255,255,255,0.7)'}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Sort / count info bar ─────────────────────────────────────── */}
      <View style={styles.infoBar}>
        <Icon name="sort" size={12} color={colors.textSecondary} />
        <Text style={styles.infoBarText}>{currentSortLabel}</Text>
        <Text style={styles.infoBarDot}>·</Text>
        <Text style={styles.infoBarText}>{allItems.length} result{allItems.length !== 1 ? 's' : ''}</Text>
        {(isFetching && !refreshing) && (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 6 }} />
        )}
      </View>

      {/* ── List ──────────────────────────────────────────────────────── */}
      {showLoader ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={allItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          contentContainerStyle={[styles.listContent, allItems.length === 0 && styles.listEmpty]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          onMomentumScrollBegin={() => { onEndMomentum.current = false; }}
          onEndReached={() => {
            if (onEndMomentum.current) return;
            onEndMomentum.current = true;
            handleLoadMore();
          }}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={10}
          updateCellsBatchingPeriod={50}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* ══ Sort picker ═════════════════════════════════════════════════ */}
      <Modal visible={showSortDrop} transparent animationType="slide" onRequestClose={() => setShowSortDrop(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Sort By</Text>
              <TouchableOpacity onPress={() => setShowSortDrop(false)}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            {SORT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sheetRow, sortKey === opt.key && styles.sheetRowActive]}
                onPress={() => { setSortKey(opt.key); setShowSortDrop(false); }}
                activeOpacity={0.7}
              >
                <Icon name={opt.icon} size={20} color={sortKey === opt.key ? colors.primary : colors.textSecondary} />
                <Text style={[styles.sheetRowText, sortKey === opt.key && { color: colors.primary, fontFamily: fonts.bold }]}>{opt.label}</Text>
                {sortKey === opt.key && <Icon name="check" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ══ User picker ═════════════════════════════════════════════════ */}
      <Modal visible={showUserDrop} transparent animationType="slide" onRequestClose={() => setShowUserDrop(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filter by Assigned User</Text>
              <TouchableOpacity onPress={() => setShowUserDrop(false)}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            {/* Clear option */}
            <TouchableOpacity style={[styles.sheetRow, !assignedUserId && styles.sheetRowActive]}
              onPress={() => { setAssignedUserId(null); setShowUserDrop(false); }} activeOpacity={0.7}>
              <Icon name="people" size={20} color={!assignedUserId ? colors.primary : colors.textSecondary} />
              <Text style={[styles.sheetRowText, !assignedUserId && { color: colors.primary, fontFamily: fonts.bold }]}>All Users</Text>
              {!assignedUserId && <Icon name="check" size={18} color={colors.primary} />}
            </TouchableOpacity>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
              {allUsers.map(u => {
                const uid  = String(u.id || u._id || '');
                const name = String(u.name || u.Name || 'Unknown');
                const role = String(u.role || u.Role || '');
                const sel  = assignedUserId === uid;
                return (
                  <TouchableOpacity key={uid} style={[styles.sheetRow, sel && styles.sheetRowActive]}
                    onPress={() => { setAssignedUserId(uid); setShowUserDrop(false); }} activeOpacity={0.7}>
                    <View style={styles.sheetAvatar}>
                      <Text style={styles.sheetAvatarTxt}>{name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetRowText, sel && { color: colors.primary, fontFamily: fonts.bold }]}>{name}</Text>
                      {!!role && <Text style={styles.sheetRowSub}>{role}</Text>}
                    </View>
                    {sel && <Icon name="check" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══ Status picker ═══════════════════════════════════════════════ */}
      <Modal visible={showStatusDrop} transparent animationType="slide" onRequestClose={() => setShowStatusDrop(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filter by Status</Text>
              <TouchableOpacity onPress={() => setShowStatusDrop(false)}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.sheetRow, !selectedStatus && styles.sheetRowActive]}
              onPress={() => { setSelectedStatus(null); setShowStatusDrop(false); }} activeOpacity={0.7}>
              <Text style={[styles.sheetRowText, !selectedStatus && { color: colors.primary, fontFamily: fonts.bold }]}>All Statuses</Text>
              {!selectedStatus && <Icon name="check" size={18} color={colors.primary} />}
            </TouchableOpacity>
            {STATUS_OPTIONS.map(opt => (
              <TouchableOpacity key={opt} style={[styles.sheetRow, selectedStatus === opt && styles.sheetRowActive]}
                onPress={() => { setSelectedStatus(opt); setShowStatusDrop(false); }} activeOpacity={0.7}>
                <Text style={[styles.sheetRowText, selectedStatus === opt && { color: colors.primary, fontFamily: fonts.bold }]}>{opt}</Text>
                {selectedStatus === opt && <Icon name="check" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ══ Preview modal ════════════════════════════════════════════════ */}
      <Modal visible={!!previewEnquiry} transparent animationType="slide" onRequestClose={() => setPreviewEnquiry(null)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { paddingHorizontal: 16, paddingBottom: 24 }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>{previewEnquiry?.title || previewEnquiry?.Name || 'Preview'}</Text>
              <TouchableOpacity onPress={() => setPreviewEnquiry(null)}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              {[
                ['Client',   previewEnquiry?.clientName],
                ['Status',   previewEnquiry?.status || previewEnquiry?.CurrentStatus],
                ['Priority', previewEnquiry?.priority || previewEnquiry?.Priority],
                ['Category', previewEnquiry?.category || previewEnquiry?.Category],
                ['Metal',    previewEnquiry?.metalType],
                ['Stone',    previewEnquiry?.stoneType || previewEnquiry?.StoneType],
                ['Budget',   previewEnquiry?.budget || previewEnquiry?.Budget],
                ['Quantity', previewEnquiry?.Quantity],
                ['Remarks',  previewEnquiry?.description || previewEnquiry?.Remarks],
                ['Shipping', previewEnquiry?.deadline || previewEnquiry?.ShippingDate],
              ].filter(([, v]) => v != null && v !== '' && v !== 'N/A').map(([lbl, val]) => (
                <View key={lbl} style={styles.pvRow}>
                  <Text style={styles.pvKey}>{lbl}</Text>
                  <Text style={styles.pvVal}>{String(val)}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.primaryBtn}
              onPress={() => { setPreviewEnquiry(null); navigation.navigate('SingleEnquiry', { enquiryId: previewEnquiry?.id, enquiry: previewEnquiry }); }}
              activeOpacity={0.85}>
              <Text style={styles.primaryBtnTxt}>Open Full Detail</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══ Summary modal ════════════════════════════════════════════════ */}
      <Modal visible={!!summaryEnquiryId} transparent animationType="slide" onRequestClose={() => setSummaryEnquiryId(null)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { paddingHorizontal: 16, paddingBottom: 24 }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Summary</Text>
              <TouchableOpacity onPress={() => setSummaryEnquiryId(null)}><Icon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            {summaryLoading
              ? <View style={styles.sheetLoader}><ActivityIndicator size="large" color={colors.primary} /></View>
              : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                  {(() => {
                    const sm =
                      (typeof summaryData?.Summary === 'string' && summaryData.Summary.trim() && summaryData.Summary) ||
                      (typeof summaryData?._originalData?.Summary === 'string' && summaryData._originalData.Summary.trim() && summaryData._originalData.Summary) || null;
                    return renderMdSummary(sm, styles) || <View style={styles.emptyWrap}><Text style={styles.emptyText}>No summary available</Text></View>;
                  })()}
                </ScrollView>
              )}
          </View>
        </View>
      </Modal>

      {/* ══ Checklist modal (editable) ═══════════════════════════════════ */}
      <Modal
        visible={!!checklistEnquiryId}
        transparent
        animationType="slide"
        onRequestClose={() => setChecklistEnquiryId(null)}
      >
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { paddingHorizontal: 16, paddingBottom: 24 }]}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Checklist</Text>
                {checklistDirty && (
                  <Text style={styles.clUnsavedBadge}>● Unsaved changes</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setChecklistEnquiryId(null)}>
                <Icon name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {checklistLoading ? (
              <View style={styles.sheetLoader}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : Object.keys(editableChecklist).length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No checklist available</Text>
              </View>
            ) : (
              <>
                {/* GeneratedAt read-only banner */}
                {(() => {
                  const cl =
                    (checklistData?.Checklist && typeof checklistData.Checklist === 'object' && checklistData.Checklist) ||
                    (checklistData?._originalData?.Checklist && typeof checklistData._originalData.Checklist === 'object' && checklistData._originalData.Checklist) || {};
                  return cl.GeneratedAt ? (
                    <Text style={styles.clGeneratedAt}>
                      Generated: {new Date(cl.GeneratedAt).toLocaleString()}
                    </Text>
                  ) : null;
                })()}

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 12 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {CL_FIELDS.map(f => {
                    const hasErr = !!checklistErrors[f.key];
                    return (
                      <View key={f.key} style={styles.clEditRow}>
                        {/* Label row — shows type badge for numeric/date fields */}
                        <View style={styles.clEditLabelRow}>
                          <Text style={styles.clEditLabel}>{f.label}</Text>
                          {f.type === 'numeric' && (
                            <View style={styles.clTypeBadge}>
                              <Text style={styles.clTypeBadgeText}>Numeric</Text>
                            </View>
                          )}
                          {f.type === 'date' && (
                            <View style={[styles.clTypeBadge, styles.clTypeBadgeDate]}>
                              <Text style={styles.clTypeBadgeText}>Date</Text>
                            </View>
                          )}
                        </View>

                        <TextInput
                          style={[
                            styles.clEditInput,
                            f.multiline    && styles.clEditInputMulti,
                            hasErr         && styles.clEditInputError,
                          ]}
                          value={editableChecklist[f.key] ?? ''}
                          onChangeText={v => handleChecklistFieldChange(f.key, v)}
                          placeholder={f.placeholder}
                          placeholderTextColor={colors.textSecondary}
                          keyboardType={f.keyboardType}
                          multiline={f.multiline}
                          numberOfLines={f.multiline ? 3 : 1}
                          textAlignVertical={f.multiline ? 'top' : 'center'}
                          returnKeyType={f.multiline ? 'default' : 'next'}
                          autoCorrect={false}
                          autoCapitalize={f.type === 'text' ? 'sentences' : 'none'}
                        />

                        {/* Inline error */}
                        {hasErr && (
                          <View style={styles.clErrorRow}>
                            <Icon name="error-outline" size={13} color={colors.error || '#EF4444'} />
                            <Text style={styles.clErrorText}>{checklistErrors[f.key]}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>

                {/* Save button */}
                {/* Error summary */}
                {checklistHasErrors && (
                  <View style={styles.clErrorBanner}>
                    <Icon name="warning" size={15} color={colors.error || '#EF4444'} />
                    <Text style={styles.clErrorBannerText}>
                      Fix {Object.keys(checklistErrors).length} validation error{Object.keys(checklistErrors).length > 1 ? 's' : ''} before saving
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.clSaveBtn,
                    (!checklistDirty || checklistSaving || checklistHasErrors) && styles.clSaveBtnDisabled,
                  ]}
                  onPress={handleSaveChecklist}
                  disabled={!checklistDirty || checklistSaving || checklistHasErrors}
                  activeOpacity={0.85}
                >
                  {checklistSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="save" size={17} color="#fff" />
                      <Text style={styles.clSaveBtnText}>
                        {checklistHasErrors ? 'Fix Errors to Save' : checklistDirty ? 'Save Changes' : 'Saved'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ══ Create Enquiry ═══════════════════════════════════════════════ */}
      <CreateEnquiryModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onEnquiryCreated={() => { setShowCreateModal(false); handleRefresh(); }}
        route={clientId ? { params: { clientId, clientName } } : undefined}
      />

      <BrandedAlert
        visible={alertCfg.visible} title={alertCfg.title} message={alertCfg.message}
        type={alertCfg.type} buttons={alertCfg.buttons} onClose={hideAlert}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  // Header — primary background
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    gap: 4,
  },
  backBtn:         { padding: 6 },
  headerTitleWrap: { flex: 1, paddingHorizontal: 4 },
  headerTitle:     { fontFamily: fonts.bold, fontSize: fonts.lg || 17, color: '#fff' },
  headerSubtitle:  { fontFamily: fonts.regular, fontSize: fonts.xs || 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  headerIconBtn:   { padding: 6 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#fff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20,
  },
  createBtnText: { fontFamily: fonts.bold, fontSize: fonts.xs || 12, color: colors.primary },

  // Search bar
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: colors.background,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight || '#EFEFEF',
  },
  searchInput: {
    flex: 1, fontFamily: fonts.regular, fontSize: fonts.sm || 13,
    color: colors.textPrimary, paddingVertical: 4,
  },

  // Tab bar — primary background, white active pill
  tabBar: {
    backgroundColor: colors.primary,
    borderBottomWidth: 0,
  },
  tabBarContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 13, paddingVertical: 6,
    borderRadius: 20,
  },
  tabActive: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontFamily: fonts.medium, fontSize: fonts.sm || 13,
    color: 'rgba(255,255,255,0.8)',
  },
  tabTextActive: {
    color: colors.primary, fontFamily: fonts.bold,
  },

  // Info bar
  infoBar: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: colors.background,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight || '#F0F0F0',
  },
  infoBarText: { fontFamily: fonts.regular, fontSize: fonts.xs || 11, color: colors.textSecondary },
  infoBarDot:  { fontFamily: fonts.regular, fontSize: fonts.xs || 11, color: colors.textSecondary },

  // List
  listContent: { paddingBottom: 24 },
  listEmpty:   { flexGrow: 1 },
  loaderWrap:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Card + action bar (matches NewCard: borderRadius 10, marginHorizontal 10, marginBottom 8)
  cardWrapper: { marginBottom: 4 },
  actionBar: {
    marginHorizontal: 10, marginTop: -8, marginBottom: 10,
    backgroundColor: colors.cardBackground || colors.background,
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 3,
    overflow: 'hidden',
  },
  actionDivider: { height: 1, backgroundColor: colors.borderLight || '#E8E8E8', marginHorizontal: 12 },
  actionRow:     { flexDirection: 'row', alignItems: 'center' },
  actionBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10 },
  actionSep:     { width: 1, height: 18, backgroundColor: colors.borderLight || '#E0E0E0' },
  actionBtnText: { fontSize: 12, fontFamily: fonts.medium, color: colors.primary },

  // Empty
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyText:  { fontFamily: fonts.medium, fontSize: fonts.base || 14, color: colors.textSecondary },
  emptySub:   { fontFamily: fonts.regular, fontSize: fonts.sm || 12, color: colors.textSecondary },

  // Bottom sheet (picker + modals)
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '80%', paddingBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight || '#EFEFEF',
  },
  sheetTitle:      { fontFamily: fonts.bold, fontSize: fonts.base || 15, color: colors.textPrimary },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight || '#F0F0F0',
  },
  sheetRowActive:  { backgroundColor: (colors.primaryExtraLight) || colors.primary + '12' },
  sheetRowText:    { flex: 1, fontFamily: fonts.medium, fontSize: fonts.sm || 13, color: colors.textPrimary },
  sheetRowSub:     { fontFamily: fonts.regular, fontSize: fonts.xs || 11, color: colors.textSecondary, marginTop: 1 },
  sheetAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary + '22',
    justifyContent: 'center', alignItems: 'center',
  },
  sheetAvatarTxt:  { fontFamily: fonts.bold, fontSize: fonts.base, color: colors.primary },
  sheetLoader:     { paddingVertical: 48, alignItems: 'center' },

  // Preview rows
  pvRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.borderLight || '#F0F0F0' },
  pvKey:   { fontFamily: fonts.medium, fontSize: fonts.sm || 13, color: colors.textSecondary, flex: 1 },
  pvVal:   { fontFamily: fonts.regular, fontSize: fonts.sm || 13, color: colors.textPrimary, flex: 1.5, textAlign: 'right' },

  // Primary button
  primaryBtn:    { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  primaryBtnTxt: { fontFamily: fonts.bold, fontSize: fonts.sm || 13, color: '#fff' },

  // Markdown renderer
  mdContainer: { paddingBottom: 8 },
  mdHeading:   { fontFamily: fonts.bold, fontSize: fonts.sm || 13, color: colors.primary, marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  mdHeadingLg: { fontSize: fonts.base || 14 },
  mdRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.borderLight || '#F0F0F0' },
  mdKey:       { flex: 1, fontFamily: fonts.medium, fontSize: fonts.sm || 13, color: colors.textSecondary, paddingRight: 8 },
  mdVal:       { flex: 1.5, fontFamily: fonts.regular, fontSize: fonts.sm || 13, color: colors.textPrimary, textAlign: 'right' },
  mdBullet:    { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 3, paddingLeft: 4 },
  mdDot:       { fontFamily: fonts.regular, fontSize: fonts.base || 14, color: colors.primary, marginRight: 8, lineHeight: 20 },
  mdBulletTxt: { flex: 1, fontFamily: fonts.regular, fontSize: fonts.sm || 13, color: colors.textPrimary, lineHeight: 20 },
  mdPara:      { fontFamily: fonts.regular, fontSize: fonts.sm || 13, color: colors.textPrimary, lineHeight: 20, marginVertical: 4 },

  // Editable checklist
  clUnsavedBadge: {
    fontFamily: fonts.medium, fontSize: fonts.xs || 11,
    color: colors.warning || '#F59E0B', marginTop: 2,
  },
  clGeneratedAt: {
    fontFamily: fonts.regular, fontSize: fonts.xs || 11,
    color: colors.textSecondary, marginBottom: 10, textAlign: 'right',
  },
  clEditRow: {
    marginBottom: 14,
  },
  clEditLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4,
  },
  clEditLabel: {
    fontFamily: fonts.medium, fontSize: fonts.sm || 13,
    color: colors.textSecondary, flex: 1,
  },
  clTypeBadge: {
    backgroundColor: (colors.primaryExtraLight) || '#EEF2FF',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
  },
  clTypeBadgeDate: {
    backgroundColor: '#FEF3C7',
  },
  clTypeBadgeText: {
    fontFamily: fonts.medium, fontSize: 10,
    color: colors.primary,
  },
  clEditInput: {
    borderWidth: 1, borderColor: colors.borderLight || '#E0E0E0',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    fontFamily: fonts.regular, fontSize: fonts.sm || 13,
    color: colors.textPrimary, backgroundColor: colors.background,
    minHeight: 40,
  },
  clEditInputMulti: {
    minHeight: 76, paddingTop: 10,
  },
  clEditInputError: {
    borderColor: colors.error || '#EF4444',
    borderWidth: 1.5,
    backgroundColor: '#FFF5F5',
  },
  clErrorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3,
  },
  clErrorText: {
    fontFamily: fonts.regular, fontSize: fonts.xs || 11,
    color: colors.error || '#EF4444', flex: 1,
  },
  clErrorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEE2E2', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
  },
  clErrorBannerText: {
    flex: 1, fontFamily: fonts.medium, fontSize: fonts.xs || 12,
    color: colors.error || '#EF4444',
  },
  clSaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: colors.primary,
    paddingVertical: 13, borderRadius: 12, marginTop: 4,
  },
  clSaveBtnDisabled: { opacity: 0.45 },
  clSaveBtnText: {
    fontFamily: fonts.bold, fontSize: fonts.sm || 13, color: '#fff',
  },
});

export default ClientHandlerEnquiryScreen;

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Text,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandedAlert from '../../components/common/BrandedAlert';
import { useRoute } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useClients } from '../../features/clients/clientsHooks';
import { useStatusOptions } from '../../features/statuses/statusesHooks';
import { useUpdateEnquiryMutation, useDeleteEnquiryMutation, useGetStatusesQuery, useGetStatusStatisticsQuery, useGetEnquiryByIdQuery } from '../../store/api';
import {
  setFilters,
  setSearchQuery,
  setSorting,
  setSelectedStatus,
  setSelectedStatuses,
  toggleStatus,
  setSelectedClient,
  clearFilters,
} from '../../features/enquiries/enquiriesSlice';
import { EnquiryCard, CompactEnquiryCard, CompactEnquiryCardMemo, Card } from '../../components/cards/Cards';
import NewCard from '../../components/cards/NewCard';
import { Button, SearchInput } from '../../components/common';
import PdfViewer from '../../components/common/PdfViewer';
import { AnimatedLogoLoader } from '../../components/common';
import TopNavbar from '../../components/common/TopNavbar';
import Icon from '../../components/common/Icon';
import EnquiryFiltersModal from '../../components/filters/EnquiryFiltersModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { API_BASE_URL } from '../../config/apiConfig';
import useDeviceLayout from '../../hooks/useDeviceLayout';
// Import PDF generator module
import * as pdfGeneratorModule from '../../utils/pdfGenerator';
import StatusTabs from '../EnquiryStatusDashboard/Tabs';
import CreateEnquiryModal from '../EditEnquiry/createEnquiryModal';
import QuotationModal from '../../components/modals/QuotationModal';
import FinalLookModal from '../../components/modals/FinalLookModal';


const { width } = Dimensions.get('window');
/** Items per API request (first load and each “Load more”). Not tied to screen size / grid columns. */
const PAGE_SIZE = 20;

/**
 * Collapse status strings so master-list labels match row CurrentStatus values.
 * (e.g. chip "Enquiry Created" vs API "Pending" — see store/api normalisation.)
 */
const canonicalStatusForFilter = (raw) => {
  const n = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[\s_\-]+/g, '');

  if (!n) return '';

  if (n.includes('designapproval') || (n.includes('approval') && n.includes('pending'))) {
    return 'design_approval_pending';
  }
  if (n.includes('approved') && n.includes('cad')) {
    return 'approved_cad';
  }
  if (n.includes('orderplacement')) {
    return 'order_placement';
  }
  if (n.includes('production')) {
    return 'production';
  }
  if (n.includes('shipped')) {
    return 'shipped';
  }
  if (n.includes('completed')) {
    return 'completed';
  }
  if (n.includes('rejected')) {
    return 'rejected';
  }
  if (n === 'pending' || (n.includes('enquiry') && n.includes('created'))) {
    return 'enquiry_created';
  }
  if (n === 'coral') {
    return 'coral';
  }
  if (n.includes('quotation')) {
    return 'quotation';
  }
  if (n.includes('cad') && !n.includes('approved')) {
    return 'cad';
  }

  return n;
};

/** Extra `status` query values (same param as RTK getEnquiries) for legacy DB labels. */
const expandStatusesForSearchApi = (status) => {
  const original = String(status || '').trim();
  if (!original) {
    return [];
  }
  if (canonicalStatusForFilter(original) === 'enquiry_created') {
    return [...new Set([
      original,
      'Enquiry Created',
      'ENQUIRY CREATED',
      'Pending',
      'pending',
    ])];
  }
  return [original];
};

// ─── Summary / Markdown Renderer ─────────────────────────────────────────────
// Handles both HTML (tables, h1-h6, li, p) AND pure-markdown responses.
// Markdown patterns matched:
//   **text**  on its own line  → heading
//   ## text                    → heading
//   *   text  / -   text       → bullet
//   **Key:** Value             → key/value row
//   plain lines                → paragraph

// Decode HTML entities
const decode = (s = '') =>
  s.replace(/&amp;/g, '&')
   .replace(/&lt;/g, '<')
   .replace(/&gt;/g, '>')
   .replace(/&nbsp;/g, ' ')
   .replace(/&quot;/g, '"')
   .replace(/&#39;/g, "'")
   .replace(/&apos;/g, "'");

// Strip all HTML tags and inline markdown marks from a snippet, return plain text
const stripInline = (s = '') => {
  let t = String(s).replace(/<[^>]*>/g, '');
  t = decode(t);
  t = t.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
  t = t.replace(/\*\*(.+?)\*\*/g, '$1');
  t = t.replace(/\*(.+?)\*/g, '$1');
  t = t.replace(/___(.+?)___/g, '$1');
  t = t.replace(/__(.+?)__/g, '$1');
  t = t.replace(/_(.+?)_/g, '$1');
  t = t.replace(/~~(.+?)~~/g, '$1');
  t = t.replace(/`(.+?)`/g, '$1');
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  return t.trim();
};

const renderHtmlSummary = (input, styles) => {
  if (!input) return null;
  const raw = typeof input === 'string' ? input : String(input);
  // Normalise literal "\n" sequences that some backends double-escape
  const text = raw.replace(/\\n/g, '\n');

  const sections = [];

  // ── 1. HTML tables → key/value rows ──────────────────────────────────────
  const tableMatches = [...text.matchAll(/<table[\s\S]*?<\/table>/gi)];
  tableMatches.forEach((tbl, ti) => {
    const rows = [...tbl[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    rows.forEach((row, ri) => {
      const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
      if (cells.length >= 2) {
        const label = stripInline(cells[0][1]);
        const val   = stripInline(cells.slice(1).map(c => c[1]).join(' '));
        if (label || val) sections.push({ type: 'row', label, val, key: `t${ti}r${ri}` });
      } else if (cells.length === 1) {
        const t2 = stripInline(cells[0][1]);
        if (t2) sections.push({ type: 'text', text: t2, key: `t${ti}r${ri}` });
      }
    });
  });

  // ── 2. HTML list items ────────────────────────────────────────────────────
  const liMatches = [...text.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
  liMatches.forEach((m, i) => {
    const t2 = stripInline(m[1]);
    if (t2) sections.push({ type: 'bullet', text: t2, key: `li${i}` });
  });

  // ── 3. HTML headings ──────────────────────────────────────────────────────
  const htmlHeadMatches = [...text.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)];
  htmlHeadMatches.forEach((m, i) => {
    const t2 = stripInline(m[2]);
    if (t2) sections.push({ type: 'heading', level: parseInt(m[1], 10), text: t2, key: `h${i}` });
  });

  // ── 4. HTML paragraphs ────────────────────────────────────────────────────
  const strippedForP = text
    .replace(/<table[\s\S]*?<\/table>/gi, '')
    .replace(/<[uo]l[\s\S]*?<\/[uo]l>/gi, '');
  const paraMatches = [...strippedForP.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  paraMatches.forEach((m, i) => {
    const t2 = stripInline(m[1]);
    if (t2) sections.push({ type: 'text', text: t2, key: `p${i}` });
  });

  // ── 5. Pure-markdown line-by-line parsing ────────────────────────────────
  if (sections.length === 0) {
    // Remove any leftover HTML before markdown parsing
    const md = text.replace(/<[^>]*>/g, '').replace(/\|/g, ' ');

    md.split(/\n/).forEach((rawLine, i) => {
      const line = rawLine.trimEnd();
      if (!line.trim()) return; // blank line → skip

      // ## Heading
      const mdHeading = line.match(/^(#{1,6})\s+(.+)$/);
      if (mdHeading) {
        const t2 = stripInline(mdHeading[2]);
        if (t2) sections.push({ type: 'heading', level: mdHeading[1].length, text: t2, key: `mdh${i}` });
        return;
      }

      // **Standalone bold line** = section heading (e.g. "**Key Specs**")
      const boldHeading = line.match(/^\*\*([^*]+)\*\*\s*[:：]?\s*$/);
      if (boldHeading) {
        const t2 = stripInline(boldHeading[1]);
        if (t2) sections.push({ type: 'heading', level: 2, text: t2, key: `bh${i}` });
        return;
      }

      // *   text  /  -   text  /  •  text  bullet list
      const bullet = line.match(/^[\*\-\+•]\s{1,4}(.+)$/);
      if (bullet) {
        // Check if the bullet content is a key: value pair  →  **Key:** Value
        const kvInBullet = bullet[1].match(/^\*\*([^*]+):\*\*\s*(.*)$/);
        if (kvInBullet) {
          const label = stripInline(kvInBullet[1]);
          const val   = stripInline(kvInBullet[2]);
          if (label) sections.push({ type: 'row', label, val: val || '—', key: `bkv${i}` });
        } else {
          const t2 = stripInline(bullet[1]);
          if (t2) sections.push({ type: 'bullet', text: t2, key: `bl${i}` });
        }
        return;
      }

      // Standalone **Key:** Value line (not inside a bullet)
      const kvLine = line.match(/^\*\*([^*]+):\*\*\s*(.+)$/);
      if (kvLine) {
        const label = stripInline(kvLine[1]);
        const val   = stripInline(kvLine[2]);
        if (label) sections.push({ type: 'row', label, val, key: `kv${i}` });
        return;
      }

      // Plain paragraph
      const t2 = stripInline(line);
      if (t2) sections.push({ type: 'text', text: t2, key: `pl${i}` });
    });
  }

  if (sections.length === 0) return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.summaryContainer}>
      {sections.map(s => {
        switch (s.type) {
          case 'heading':
            return (
              <Text key={s.key} style={[styles.summaryHeading, s.level <= 2 && styles.summaryHeadingLarge]}>
                {s.text}
              </Text>
            );
          case 'row':
            return (
              <View key={s.key} style={styles.summaryRow}>
                <Text style={styles.summaryKey} numberOfLines={2}>{s.label}</Text>
                <Text style={styles.summaryVal}>{s.val}</Text>
              </View>
            );
          case 'bullet':
            return (
              <View key={s.key} style={styles.summaryBulletRow}>
                <Text style={styles.summaryBulletDot}>•</Text>
                <Text style={styles.summaryBulletText}>{s.text}</Text>
              </View>
            );
          case 'text':
          default:
            return <Text key={s.key} style={styles.summaryPara}>{s.text}</Text>;
        }
      })}
    </View>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

const EnquiryListScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const route = useRoute();
  const { isTablet, width } = useDeviceLayout();

  // RTK Query mutations
  const [updateEnquiry] = useUpdateEnquiryMutation();
  const [deleteEnquiry] = useDeleteEnquiryMutation();
  
  const { data: statusesData } = useGetStatusesQuery();
  
  // Fetch aggregate status statistics
  const { data: statusStatsData, refetch: refetchStatusStats } = useGetStatusStatisticsQuery();
  
  // Status counts state
  const [statusCounts, setStatusCounts] = useState({
    coral: 0,
    cad: 0,
    approvedCad: 0,
    approval: 0,
    order: 0,
    production: 0,
    shipped: 0,
    newEnquiry: 0,
    quotation: 0,
  });
  
  // Update status counts when data changes
  useEffect(() => {
    if (statusStatsData?.statusStats?.length) {
      const counts = {
        coral: 0,
        cad: 0,
        approvedCad: 0,
        approval: 0,
        order: 0,
        production: 0,
        shipped: 0,
        newEnquiry: 0,
        quotation: 0,
      };
      
      statusStatsData.statusStats.forEach(item => {
        const name = (item.name || item.status || item.Status || item._id || item.group || '').toLowerCase().trim();
        const val = Number(item.count) || 0;
        if (name === 'coral' || name === 'coral pending') counts.coral += val;
        else if (name === 'cad' || name === 'cad pending') counts.cad += val;
        else if (name === 'approved cad') counts.approvedCad += val;
        else if (name === 'design approval pending') counts.approval += val;
        else if (name === 'order placement') counts.order += val;
        else if (name === 'production') counts.production += val;
        else if (name === 'shipped') counts.shipped += val;
        else if (name === 'enquiry created') counts.newEnquiry += val;
        else if (name === 'quotation') counts.quotation += val;
      });
      
      setStatusCounts(counts);
      
    }
  }, [statusStatsData]);

  // Check if user is a designer (coral or cad)
  const isDesigner = user?.role === 'coral' || user?.role === 'cad';
  const roleLower = user?.role?.toLowerCase();
  const isAdmin =
    roleLower === 'admin' ||
    roleLower === 'ad' ||
    user?.roleId === 1 ||
    user?.roleNumber === 1;
  const isClient =
    roleLower === 'client' ||
    roleLower === 'cl' ||
    user?.roleId === 4 ||
    user?.roleNumber === 4;
  const isClientHandler = roleLower === 'client_handler';

  // Persist whether this screen was opened from client_handler dashboard (params get cleared after processing)
  const isClientHandlerViewRef = useRef(route.params?.filterSource === 'client_handler');

  // Check if this screen is being used as a separate client enquiries view (stack screen)
  const isClientView = route.name === 'ClientEnquiries' || isClientHandlerViewRef.current;

  // Get status options from API (cached) - already includes role-based filtering
  const statusOptions = useStatusOptions();

  // Convert status options to status list (array of status names/values)
  const statusList = useMemo(() => {
    return statusOptions.map(opt => opt.value === 'all' ? 'All' : opt.value);
  }, [statusOptions]);

  // Redux state
  const filters = useSelector(state => state.enquiries.filters);
  const searchQuery = useSelector(state => state.enquiries.searchQuery);
  const sortBy = useSelector(state => state.enquiries.sortBy);
  const sortOrder = useSelector(state => state.enquiries.sortOrder);
  const selectedStatus = useSelector(state => state.enquiries.selectedStatus);
  const selectedStatuses = useSelector(state => state.enquiries.selectedStatuses || []);
  const selectedClient = useSelector(state => state.enquiries.selectedClient);

  // Get current user ID for filtering assigned enquiries
  // This is used to filter enquiries by assigned user for non-admin roles
  const currentUserId = user?.id || user?._id || user?.userId;

  // For Client users (role 4), use ClientId from token instead of userId
  const clientUserId = (isClient && user?.clientId) ? user.clientId : currentUserId;

  const [enquiries, setEnquiries] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pagination, setPaginationState] = useState({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    totalPages: 1,
  });
  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const fetchEnquiriesRef = useRef(null);
  const lastAppendPageRequestedRef = useRef(null);
  const onEndReachedDuringMomentumRef = useRef(false);
  const [clientNameOverrides, setClientNameOverrides] = useState({});
  const fetchingClientIdsRef = useRef(new Set());
  const flatListRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const scrollPositionKey = 'enquiryListScrollPosition';

  const [isPdfModalVisible, setIsPdfModalVisible] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState(null);
  const [showQuotationModal,  setShowQuotationModal]  = useState(false);
  const [quotationEnquiryId,  setQuotationEnquiryId]  = useState(null);
  const [showFinalLookModal,  setShowFinalLookModal]  = useState(false);
  const [finalLookEnquiryId,  setFinalLookEnquiryId]  = useState(null);
  const [finalLookClientName, setFinalLookClientName] = useState('');

  // Local search input value — updates immediately for responsive UI
  // Actual Redux dispatch (which triggers API refetch) is debounced by 2 seconds
  const [localSearchValue, setLocalSearchValue] = useState(searchQuery);
  const searchDebounceRef = useRef(null);

  const handleSearchChange = useCallback((text) => {
    setLocalSearchValue(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      dispatch(setSearchQuery(text));
    }, 2000);
  }, [dispatch]);

  const handleSearchClear = useCallback(() => {
    setLocalSearchValue('');
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    dispatch(setSearchQuery(''));
  }, [dispatch]);

  // Sync local value if Redux searchQuery changes externally (e.g. filter clear)
  useEffect(() => {
    setLocalSearchValue(searchQuery);
  }, [searchQuery]);

  const resolvedFilters = useMemo(() => {
    const normalizedFilters = {
      status: filters.status,
      priority: filters.priority,
      category: filters.category,
      clientId: filters.clientId,
      assignedTo: filters.assignedTo,
      stoneType: filters.stoneType,
      metalColor: filters.metalColor,
      metalQuality: filters.metalQuality,
      shippingDateFrom: filters.shippingDateFrom,
      shippingDateTo: filters.shippingDateTo,
      assignedDateFrom: filters.assignedDateFrom,
      assignedDateTo: filters.assignedDateTo,
      createdDateFrom: filters.createdDateFrom,
      createdDateTo: filters.createdDateTo,
    };

    // For Client users (role 4), use ClientId from token
    if ((!normalizedFilters.clientId || normalizedFilters.clientId === 'all') && isClient && clientUserId) {
      normalizedFilters.clientId = clientUserId;
    } else if (isClient && !clientUserId) {
      // no-op
    }

    // For Client Handler (role 5) — backend scopes automatically via userScope.service
    // No extra filter needed here; backend uses the handler's clientsHandled array

    if ((!normalizedFilters.assignedTo || normalizedFilters.assignedTo === 'all') && !isAdmin && !isClient && currentUserId) {
      // Don't auto-assign for coral/cad/client_handler users
      const role = user?.role?.toLowerCase();
      if (role !== 'coral' && role !== 'cad' && role !== 'client_handler') {
        normalizedFilters.assignedTo = currentUserId;
      }
    }
    
    // Auto-filter by status for coral/cad users if no status filter is set
    const role = user?.role?.toLowerCase();
    if (role === 'coral' && (!normalizedFilters.status || normalizedFilters.status === 'all')) {
      normalizedFilters.status = ['Coral'];
    } else if (role === 'cad' && (!normalizedFilters.status || normalizedFilters.status === 'all')) {
      normalizedFilters.status = ['CAD'];
    }

    return normalizedFilters;
  }, [filters, isClient, isAdmin, clientUserId, user?.role]);

  const buildQueryString = useCallback((pageToLoad = 1) => {
    const params = new URLSearchParams();
    params.append('page', String(pageToLoad));
    params.append('limit', String(PAGE_SIZE));

    if (searchQuery && searchQuery.trim()) {
      params.append('search', searchQuery.trim());
    }

    Object.entries(resolvedFilters).forEach(([key, value]) => {
      // Skip empty values, 'all', or empty arrays
      if (!value || value === 'all' || value === 'All' || (Array.isArray(value) && value.length === 0)) {
        return;
      }
      // Handle array values (for multi-select status)
      if (Array.isArray(value)) {
        // Multiple `status` params — same pattern as store/api.js getEnquiries (OR filter).
        if (key === 'status') {
          const validStatuses = value
            .filter(item => item && item !== 'all' && item !== 'All')
            .map(item => String(item).trim())
            .filter(item => item);

          if (validStatuses.length > 0) {
            const expanded = [
              ...new Set(validStatuses.flatMap(s => expandStatusesForSearchApi(s))),
            ];
            // Backend /api/enquiries/search expects `status=`, not CurrentStatus= (see store/api.js getEnquiries).
            expanded.forEach(v => {
              params.append('status', v);
            });
          }
        } else {
          // For other array filters, use multiple parameters
          value.forEach(item => {
            if (item && item !== 'all' && item !== 'All') {
              params.append(key, String(item).trim());
              if (key === 'assignedTo') params.append('AssignedTo', String(item).trim());
            }
          });
        }
      } else {
        if (key === 'status') {
          expandStatusesForSearchApi(String(value)).forEach(v => {
            params.append('status', v);
          });
        } else {
          params.append(key, String(value));
          if (key === 'assignedTo') params.append('AssignedTo', String(value));
        }
      }
    });

    // Map frontend sort field names to backend API field names
    const sortFieldMap = {
      'AssignedDate': 'AssignedDate',
      'CreatedDate': 'CreatedDate',
      'CurrentStatus': 'CurrentStatus',
      'AssignedTo': 'AssignedTo',
      'Name': 'Name',
      'Category': 'Category',
      'ClientId': 'ClientId',
      'Priority': 'Priority',
      'Metal': 'Metal',
      'StoneType': 'StoneType',
      'ShippingDate': 'ShippingDate',
      // Legacy mappings for backward compatibility
      'createdAt': 'CreatedDate',
      'assignedDate': 'AssignedDate',
      'status': 'CurrentStatus',
      'title': 'Name',
      'clientName': 'ClientId',
    };

    const backendSortField = sortFieldMap[sortBy] || sortBy || 'CreatedDate';
    const sortDirection = sortOrder || 'desc';
    params.append('sortBy', backendSortField);
    params.append('sortOrder', sortDirection);

    return params;
  }, [resolvedFilters, searchQuery, sortBy, sortOrder]);

  const fetchEnquiries = useCallback(async ({
    pageToLoad = 1,
    append = false,
    suppressInlineLoader = false,
    showFooterLoader = append, // for append calls, default to showing footer loader
  } = {}) => {
    const requestId = ++requestIdRef.current;
    let shouldStopLoading = true;

    if (append) {
      if (showFooterLoader) {
        setIsLoadingMore(true);
      }
    } else {
      if (!hasLoadedOnceRef.current) {
        setIsInitialLoading(true);
      } else if (!suppressInlineLoader) {
        setIsFetching(true);
      }
    }

    try {
      const params = buildQueryString(pageToLoad);
      const token = await AsyncStorage.getItem('token');
      const apiUrl = `${API_BASE_URL}/api/enquiries/search?${params.toString()}`;


      const response = await fetch(apiUrl, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load enquiries (${response.status})`);
      }

      const payload = await response.json();
      if (requestId !== requestIdRef.current) {
        shouldStopLoading = false;
        return;
      }


      const data = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.enquiries)
            ? payload.enquiries
            : [];

      const normalized = data
        .map(item => ({
          ...item,
          id: item?.id || item?._id || item?.Id || item?.EnquiryId || item?.enquiryId,
        }))
        .filter(item => item && item.id);

      // Frontend filtering workaround: If backend doesn't filter by multiple statuses correctly,
      // filter the results on the frontend
      let filteredData = normalized;
      const statusFilterList =
        !filters.status || filters.status === 'all' || filters.status === 'All'
          ? []
          : Array.isArray(filters.status)
            ? filters.status.filter(Boolean)
            : [filters.status];

      if (statusFilterList.length > 0) {
        const selectedCanonical = [
          ...new Set(statusFilterList.map(s => canonicalStatusForFilter(s)).filter(Boolean)),
        ];

        filteredData = filteredData.filter(item => {
          const itemStatusRaw = (
            item?.CurrentStatus ||
            item?.Status ||
            item?.status ||
            item?.CurrentStatusName ||
            ''
          );
          const itemCanon = canonicalStatusForFilter(itemStatusRaw);
          if (!itemCanon) {
            return false;
          }
          return selectedCanonical.some(sel => sel === itemCanon);
        });

        }

      // Frontend filtering workaround for assignedTo
      if (resolvedFilters.assignedTo && resolvedFilters.assignedTo !== 'all' && resolvedFilters.assignedTo !== 'All') {
        const assignedToFilters = Array.isArray(resolvedFilters.assignedTo) 
          ? resolvedFilters.assignedTo.map(a => String(a).trim().toLowerCase()) 
          : [String(resolvedFilters.assignedTo).trim().toLowerCase()];
          
        filteredData = filteredData.filter(item => {
          const itemAssignedTo = String(item?.AssignedTo || item?.assignedTo || '').trim().toLowerCase();
          return assignedToFilters.includes(itemAssignedTo);
        });
      }

      setEnquiries(prev => {
        if (append && prev && prev.length > 0) {
          const existingIds = new Map(prev.map(enquiry => [enquiry.id, enquiry]));
          const merged = [...prev];

          filteredData.forEach(item => {
            if (!existingIds.has(item.id)) {
              merged.push(item);
              existingIds.set(item.id, item);
            } else {
              const existingIndex = merged.findIndex(enquiry => enquiry.id === item.id);
              if (existingIndex !== -1) {
                merged[existingIndex] = item;
              }
            }
          });

          return merged;
        }

        return filteredData;
      });

      const responseLimit = payload?.limit ?? payload?.Limit ?? PAGE_SIZE;
      const totalFromServer = Number(payload?.total ?? payload?.Total ?? 0);
      const calculatedTotalPages = totalFromServer > 0
        ? Math.max(1, Math.ceil(totalFromServer / responseLimit))
        : 1;
      const currentPageSafe = pageToLoad;
      const paginationSnapshot = {
        total: totalFromServer || normalized.length,
        page: currentPageSafe,
        limit: responseLimit,
        totalPages: calculatedTotalPages,
      };

      setPaginationState(paginationSnapshot);
      const hasReliableTotal = totalFromServer > 0;
      const inferredHasMore = normalized.length === responseLimit;
      const computedHasMore = hasReliableTotal
        ? currentPageSafe * responseLimit < totalFromServer
        : inferredHasMore;
      setHasMore(computedHasMore);
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to fetch enquiries:', error);
      }
      if (!append) {
        setEnquiries([]);
      }
      throw error;
    } finally {
      if (shouldStopLoading) {
        if (append) {
          setIsLoadingMore(false);
        } else if (!hasLoadedOnceRef.current) {
          setIsInitialLoading(false);
          hasLoadedOnceRef.current = true;
        } else if (!suppressInlineLoader) {
          setIsFetching(false);
        }
      }
    }
  }, [buildQueryString, filters]);

  fetchEnquiriesRef.current = fetchEnquiries;

  useEffect(() => {
    if (!user) {
      return;
    }

    fetchEnquiriesRef.current?.({ pageToLoad: 1, append: false }).catch(() => { });
    // Also refetch status statistics on mount
    if (refetchStatusStats) {
      refetchStatusStats();
    }
  }, [user]);

  // Refetch status statistics when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user && refetchStatusStats) {
        refetchStatusStats();
      }
    }, [user])
  );

  // Convert status filter to a stable string for dependency comparison
  const statusFilterKey = useMemo(() => {
    if (Array.isArray(filters.status)) {
      return [...filters.status].sort().join(',');
    }
    return filters.status || 'all';
  }, [filters.status]);

  // Watch for filter changes and trigger fetch
  useEffect(() => {
    if (!user || !hasLoadedOnceRef.current) {
      return; // Don't fetch on initial mount, let the above useEffect handle it
    }

    // Trigger fetch when filters change
    fetchEnquiriesRef.current?.({ pageToLoad: 1, append: false }).catch(() => { });
  }, [
    statusFilterKey,
    filters.priority,
    filters.clientId,
    searchQuery,
    sortBy,
    sortOrder,
    user,
  ]);

  // Track previous filter values to detect changes
  const prevFiltersRef = useRef({ status: null, priority: null, clientId: null, searchQuery: null });
  const lastDashboardFilterRef = useRef(null);
  const processedRouteParamsRef = useRef(new Set()); // Track processed route params to prevent loops

  // Clear scroll position when filters change (so user starts from top with new filters)
  useEffect(() => {
    const currentFilters = {
      status: filters.status,
      priority: filters.priority,
      clientId: filters.clientId,
      searchQuery: searchQuery,
    };

    // Check if filters actually changed (not on initial mount)
    const filtersChanged =
      prevFiltersRef.current.status !== currentFilters.status ||
      prevFiltersRef.current.priority !== currentFilters.priority ||
      prevFiltersRef.current.clientId !== currentFilters.clientId ||
      prevFiltersRef.current.searchQuery !== currentFilters.searchQuery;

    if (filtersChanged && prevFiltersRef.current.status !== null && flatListRef.current) {
      // Scroll to top when filters change
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      scrollPositionRef.current = 0;
      AsyncStorage.removeItem(scrollPositionKey).catch(() => { });
      hasRestoredScrollRef.current = false; // Allow restore after filter change
    }

    // Update previous filters
    prevFiltersRef.current = currentFilters;
  }, [filters.status, filters.priority, filters.clientId, searchQuery]);

  // Save scroll position to AsyncStorage
  const saveScrollPosition = useCallback(async (offsetY) => {
    try {
      scrollPositionRef.current = offsetY;
      await AsyncStorage.setItem(scrollPositionKey, String(offsetY));
    } catch (error) {
      if (__DEV__) {
        console.warn('Failed to save scroll position:', error);
      }
    }
  }, []);

  // Restore scroll position from AsyncStorage
  const restoreScrollPosition = useCallback(async () => {
    try {
      const savedPosition = await AsyncStorage.getItem(scrollPositionKey);
      if (savedPosition && flatListRef.current) {
        const offsetY = parseFloat(savedPosition);
        if (!isNaN(offsetY) && offsetY > 0) {
          scrollPositionRef.current = offsetY;
          // Use setTimeout to ensure FlatList is fully rendered
          setTimeout(() => {
            if (flatListRef.current) {
              flatListRef.current.scrollToOffset({ offset: offsetY, animated: false });
            }
          }, 200);
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('Failed to restore scroll position:', error);
      }
    }
  }, []);

  // Handle scroll events to track position
  const handleScroll = useCallback((event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollPositionRef.current = offsetY;
  }, []);

  // Restore scroll position when data is loaded (only once on mount)
  const hasRestoredScrollRef = useRef(false);
  useEffect(() => {
    if (!isInitialLoading && displayEnquiries && Array.isArray(displayEnquiries) && displayEnquiries.length > 0 && !hasRestoredScrollRef.current) {
      hasRestoredScrollRef.current = true;
      restoreScrollPosition();
    }
  }, [isInitialLoading, displayEnquiries, restoreScrollPosition]);

  // Clear all filters when component unmounts (user navigates away)
  useEffect(() => {
    return () => {
      // Save final scroll position before unmounting
      if (scrollPositionRef.current > 0) {
        saveScrollPosition(scrollPositionRef.current);
      }
      // Reset restore flag so scroll can be restored when returning
      hasRestoredScrollRef.current = false;
      // Cancel any pending search debounce
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      // Cleanup function runs when component unmounts
      dispatch(clearFilters());
      dispatch(setSearchQuery(''));
      dispatch(setSelectedStatus('All'));
      dispatch(setSelectedStatuses([]));
      dispatch(setSelectedClient('All'));
    };
  }, [dispatch, saveScrollPosition]);

  useEffect(() => {
    const missingClientIds = new Set();

    enquiries.forEach(enquiry => {
      const rawId = enquiry?.clientId || enquiry?.ClientId;
      if (!rawId) {
        return;
      }
      const normalizedId = String(rawId).trim();
      if (!normalizedId) {
        return;
      }

      if (
        clientNameOverrides[normalizedId] ||
        clientNameMap.get(normalizedId) ||
        fetchingClientIdsRef.current.has(normalizedId)
      ) {
        return;
      }

      missingClientIds.add(normalizedId);
    });

    if (missingClientIds.size === 0) {
      return;
    }

    let cancelled = false;
    const newFetchingIds = Array.from(missingClientIds);
    newFetchingIds.forEach(id => fetchingClientIdsRef.current.add(id));

    const fetchClientNames = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          return;
        }

        const updates = {};

        await Promise.all(
          newFetchingIds.map(async clientId => {
            try {
              const response = await fetch(`${API_BASE_URL}/api/clients/${clientId}`, {
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
              });

              if (!response.ok) {
                return;
              }

              const data = await response.json();
              const name =
                data?.name ||
                data?.Name ||
                data?.clientName ||
                data?.ClientName ||
                data?.fullName ||
                data?.FullName;

              if (name && !cancelled) {
                updates[clientId] = name;
              }
            } catch (error) {
              if (__DEV__) {
                console.warn('Failed to fetch client name for', clientId, error);
              }
            } finally {
              fetchingClientIdsRef.current.delete(clientId);
            }
          })
        );

        if (!cancelled && Object.keys(updates).length > 0) {
          setClientNameOverrides(prev => ({ ...prev, ...updates }));
        }
      } finally {
        newFetchingIds.forEach(id => fetchingClientIdsRef.current.delete(id));
      }
    };

    fetchClientNames();

    return () => {
      cancelled = true;
    };
  }, [enquiries, clientNameMap, clientNameOverrides]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isInitialLoading || isFetching || isLoadingMore) {
      return;
    }

    const nextPage = (pagination?.page || 1) + 1;
    if (lastAppendPageRequestedRef.current === nextPage) {
      return;
    }
    lastAppendPageRequestedRef.current = nextPage;
    fetchEnquiries({ pageToLoad: nextPage, append: true, showFooterLoader: true })
      .catch(() => { })
      .finally(() => {
        // allow retries if needed after request settles
        if (lastAppendPageRequestedRef.current === nextPage) {
          lastAppendPageRequestedRef.current = null;
        }
      });
  }, [fetchEnquiries, hasMore, isLoadingMore, isInitialLoading, isFetching, pagination?.page]);

  const currentPage = pagination.page;
  const totalPages = pagination.totalPages;
  const total = pagination.total;

  // Fetch clients to enrich client names (using cached hook)
  const { clients: clientsData = [], isLoading: clientsLoading, error: clientsError } = useClients({
    skip: !user,
  });

  const clients = Array.isArray(clientsData) ? clientsData : [];

  // Debug clients API response (in useEffect to avoid hook order issues)

  // Local UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewEnquiry, setPreviewEnquiry] = useState(null);
  const [summaryEnquiryId, setSummaryEnquiryId] = useState(null);
  const { data: summaryEnquiry, isLoading: summaryLoading } = useGetEnquiryByIdQuery(summaryEnquiryId, { skip: !summaryEnquiryId });
  const [checklistEnquiryId, setChecklistEnquiryId] = useState(null);
  const { data: checklistEnquiry, isLoading: checklistLoading } = useGetEnquiryByIdQuery(checklistEnquiryId, { skip: !checklistEnquiryId });
  const [refreshing, setRefreshing] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));
  
  // Initialize activeTab based on user role
  const getInitialTab = () => {
    const role = user?.role?.toLowerCase();
    if (role === 'admin' || role === 'client_handler') return 'all';
    return 'AssignedToYou';
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab());

  // Create a client ID to name lookup map
  // Handle both string and object ID comparisons
  const clientNameMap = useMemo(() => {
    const map = new Map();
    if (!clients || clients.length === 0) {
      return map;
    }

    clients.forEach(client => {
      if (client && client.id && client.name) {
        // Store both string and normalized versions for lookup
        const idStr = String(client.id).trim();
        map.set(idStr, client.name);
        // Handle MongoDB ObjectId - remove ObjectId wrapper if present
        const cleanId = idStr.replace(/^ObjectId\(/, '').replace(/\)$/, '');
        if (cleanId !== idStr) {
          map.set(cleanId, client.name);
        }
        // Also try without any ObjectId formatting
        map.set(cleanId.trim(), client.name);
      }
    });

    return map;
  }, [clients]);

  // Enrich enquiries with client names from the clients API
  // Use useMemo to prevent unnecessary recomputation
  const enrichedEnquiries = useMemo(() => {
    try {
      if (!enquiries || !Array.isArray(enquiries) || enquiries.length === 0) {
        return [];
      }

      return enquiries
        .filter(enquiry => enquiry && typeof enquiry === 'object') // Filter out invalid entries
        .map(enquiry => {
          try {
            const clientIdRaw = enquiry.clientId || enquiry.ClientId;
            const clientIdStr = clientIdRaw ? String(clientIdRaw).trim() : '';
            let finalClientName = enquiry.clientName || enquiry.ClientName || enquiry.client || 'Unknown Client';

            if ((!finalClientName || finalClientName === 'Unknown Client') && clientIdStr) {
              let clientName = clientNameOverrides[clientIdStr] || clientNameMap.get(clientIdStr);

              if (!clientName) {
                const cleanId = clientIdStr.replace(/^ObjectId\(/, '').replace(/\)$/, '').trim();
                clientName = clientNameOverrides[cleanId] || clientNameMap.get(cleanId);
              }

              if (clientName) {
                finalClientName = clientName;
              }
            }

            return {
              ...enquiry,
              clientId: clientIdStr || enquiry.clientId,
              clientName: finalClientName,
            };
          } catch (error) {
            if (__DEV__) {
              console.warn('Error enriching enquiry:', error, enquiry);
            }
            // Return enquiry with default client name on error
            return {
              ...enquiry,
              clientName: enquiry.clientName || enquiry.ClientName || enquiry.client || 'Unknown Client',
            };
          }
        });
    } catch (error) {
      if (__DEV__) {
        console.error('Error in enrichedEnquiries useMemo:', error);
      }
      // Return empty array on critical error to prevent crash
      return [];
    }
  }, [enquiries, clientNameMap, clientNameOverrides]);
  // Backend handles sorting, so we just return enriched enquiries as-is
  const displayEnquiries = useMemo(() => {
    try {
      if (!enrichedEnquiries || enrichedEnquiries.length === 0) {
        return [];
      }
      // Backend API returns data already sorted, no need for client-side sorting
      return enrichedEnquiries;
    } catch (error) {
      if (__DEV__) {
        console.error('Error building display enquiries:', error);
      }
      return [];
    }
  }, [enrichedEnquiries]);

  // Get all clients from API (not just from current enquiries)
  // Store both name and ID to prevent duplicates and enable proper key generation
  const clientList = useMemo(() => {
    // Use clients from API instead of deriving from enquiries
    // This ensures all clients are shown, not just those with enquiries in current list
    if (!clients || clients.length === 0) {
      return [];
    }

    // Create a map to deduplicate by ID (in case of duplicate names)
    const clientMap = new Map();
    clients.forEach(client => {
      const clientId = client.id || client._id;
      const clientName = client.name || client.Name;

      if (clientId && clientName && clientName.trim() !== '' && clientName !== 'Unknown Client') {
        // Use ID as key to prevent duplicates
        if (!clientMap.has(clientId)) {
          clientMap.set(clientId, { id: clientId, name: clientName });
        }
      }
    });

    // Convert to array and sort by name
    const clientList = Array.from(clientMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    return clientList;
  }, [clients]);

  // Update filter when route params change
  useEffect(() => {
    const rawFilter = route.params?.filter;
    const filterType = route.params?.filterType;
    const filterSource = route.params?.filterSource;
    const filterAppliedAt = route.params?.filterAppliedAt;
    const dashboardToken = rawFilter
      ? `${filterType || 'status'}:${rawFilter}:${filterAppliedAt || 'na'}`
      : null;

    // Create a unique key for this route params combination
    const routeParamsKey = JSON.stringify({
      filter: rawFilter,
      filterType,
      filterSource,
      filterAppliedAt,
      clientId: route.params?.clientId,
      statuses: route.params?.statuses,
      selectedStatuses: route.params?.selectedStatuses,
    });

    // Skip if we've already processed these exact route params
    if (processedRouteParamsRef.current.has(routeParamsKey)) {
      return;
    }

    let routeFilterHandled = false;

    // When navigating from dashboard or client_handler, clear all existing filters so only the clicked filter applies
    if ((filterSource === 'dashboard' || filterSource === 'client_handler') && rawFilter) {
      if (lastDashboardFilterRef.current !== dashboardToken) {
        dispatch(clearFilters());
        lastDashboardFilterRef.current = dashboardToken;
      }
      routeFilterHandled = true;
    }

    if (rawFilter === 'assigned' || rawFilter === 'all') {
      if (isStatusFilterActive()) {
        dispatch(setFilters({ status: 'all' }));
        dispatch(setSelectedStatus('All'));
        dispatch(setSelectedStatuses([]));
      }
      routeFilterHandled = routeFilterHandled || Boolean(rawFilter);
    } else if (rawFilter && (filterType === undefined || filterType === null || filterType === 'status')) {
      // Handle status filters from dashboard (filterType is undefined/null) or explicit status filters
      // Map status filter values from Dashboard to filter format
      // Handle various status name formats from aggregate API
      // This matches the filter values sent from DashboardScreen:
      // - 'coral' -> 'Coral' (for "Pending Designs" card)
      // - 'design approval pending' -> 'Design Approval Pending' (for "Approval Pending" card)
      // - 'completed' -> 'Completed' (for "Completed Designs" card)
      const statusFilter = rawFilter.toLowerCase().trim();
      const isDesigner = user?.role === 'coral' || user?.role === 'cad';
      let mappedStatus = 'all';

      // Map common status filter values from DashboardScreen
      // Priority order matches DashboardScreen navigation calls
      if (statusFilter === 'coral') {
        // "Pending Designs" card navigates with filter: 'coral'
        mappedStatus = 'Coral';
      } else if (statusFilter === 'design approval pending' || statusFilter === 'designapprovalpending') {
        // "Approval Pending" card navigates with filter: 'design approval pending'
        mappedStatus = 'Design Approval Pending';
      } else if (statusFilter === 'completed') {
        // "Completed Designs" card navigates with filter: 'completed'
        mappedStatus = 'Completed';
      } else if (statusFilter === 'pending') {
        mappedStatus = isDesigner ? 'Design Approval Pending' : 'Enquiry Created';
      } else if (statusFilter === 'enquiry created' ||
        (statusFilter.includes('pending') && !statusFilter.includes('approval') && !statusFilter.includes('cam'))) {
        mappedStatus = 'Enquiry Created';
      } else if (statusFilter === 'approval_pending' ||
        (statusFilter.includes('approval') && statusFilter.includes('pending'))) {
        mappedStatus = 'Design Approval Pending';
      } else if (statusFilter === 'approved cad' || statusFilter === 'approvedcad' || statusFilter === 'approved_cad') {
        mappedStatus = 'Approved Cad';
      } else if (statusFilter === 'order placement' || statusFilter === 'orderplacement') {
        mappedStatus = 'Order Placement';
      } else if (statusFilter === 'cam pending' || statusFilter === 'campending') {
        mappedStatus = 'CAM Pending';
      } else if (statusFilter === 'production') {
        mappedStatus = 'Production';
      } else if (statusFilter.includes('approved') || statusFilter.includes('completed')) {
        mappedStatus = 'Completed';
      } else if (statusFilter === 'rejected') {
        mappedStatus = 'Rejected';
      } else if (statusFilter === 'cad') {
        mappedStatus = 'CAD';
      } else if (statusFilter === 'all') {
        mappedStatus = 'all';
      } else {
        // For other statuses, try to match exactly or use title case
        // Try to match against status options from API
        const knownStatuses = statusOptions
          .filter(opt => opt.value !== 'all')
          .map(opt => opt.value);
        const matchedStatus = knownStatuses.find(s =>
          s.toLowerCase() === statusFilter ||
          s.toLowerCase().replace(/\s+/g, '') === statusFilter.replace(/\s+/g, '')
        );
        mappedStatus = matchedStatus || (rawFilter.charAt(0).toUpperCase() + rawFilter.slice(1).toLowerCase());
      }

      // Only dispatch if status is actually different (prevent unnecessary updates)
      const currentStatus = Array.isArray(filters.status) ? filters.status[0] : filters.status;
      if (mappedStatus !== currentStatus && mappedStatus !== filters.status) {
        if (mappedStatus === 'all') {
          dispatch(setFilters({ status: 'all' }));
          dispatch(setSelectedStatus('All'));
          dispatch(setSelectedStatuses([]));
        } else {
          dispatch(setFilters({ status: [mappedStatus] }));
          dispatch(setSelectedStatus(mappedStatus));
          dispatch(setSelectedStatuses([mappedStatus]));
        }
      }
      routeFilterHandled = true;
    }

    // Handle client filter from route params (skip in Enquiries tab to keep it showing all)
    if (filterType === 'client' && rawFilter && route.name !== 'Enquiries') {
      const clientName = rawFilter;
      const clientId = route.params?.clientId;
      const preSelectedStatuses = route.params?.statuses || route.params?.selectedStatuses || [];

      // Normalize status names to match API format (case-insensitive matching)
      const normalizeStatusName = (statusName) => {
        if (!statusName) return statusName;

        const statusLower = String(statusName).toLowerCase().trim();

        // Common status name mappings (handles variations and typos)
        const statusMappings = {
          'cad': 'CAD',
          'coral': 'Coral',
          'enquiry created': 'Enquiry Created',
          'approved cad': 'Approved Cad',
          'quotation': 'Quotation',
          'quatation': 'Quotation', // Handle typo
          'design approval pending': 'Design Approval Pending',
          'order placement': 'Order Placement',
          'cam pending': 'CAM Pending',
          'production': 'Production',
          'completed': 'Completed',
        };

        // Check mappings first (handles common variations)
        if (statusMappings[statusLower]) {
          return statusMappings[statusLower];
        }

        // Get known statuses from API options
        const knownStatuses = statusOptions
          .filter(opt => opt.value !== 'all')
          .map(opt => opt.value);

        if (knownStatuses.length > 0) {
          // Try to find exact match (case-insensitive)
          const normalized = knownStatuses.find(s => {
            const sLower = String(s).toLowerCase().trim();
            return sLower === statusLower ||
              sLower.replace(/\s+/g, '') === statusLower.replace(/\s+/g, '');
          });

          if (normalized) {
            return normalized;
          }
        }

        // If no match found, return original (will be handled by frontend filter)
        return statusName;
      };

      // Normalize all pre-selected statuses
      // Always normalize (even if statusOptions not ready, use mappings)
      const normalizedStatuses = preSelectedStatuses.length > 0
        ? preSelectedStatuses.map(normalizeStatusName).filter(s => s) // Filter out any null/undefined
        : [];

      // Set both client filter and clientId
      if (clientId) {
        dispatch(setFilters({
          client: clientName,
          clientId: clientId,
          status: normalizedStatuses.length > 0 ? normalizedStatuses : 'all' // Use normalized pre-selected statuses
        }));
      } else {
        // Try to find client by name if clientId not provided
        const client = clients.find(c => c.name === clientName);
        if (client) {
          dispatch(setFilters({
            client: clientName,
            clientId: client.id || client._id,
            status: normalizedStatuses.length > 0 ? normalizedStatuses : 'all' // Use normalized pre-selected statuses
          }));
        } else {
          dispatch(setFilters({
            client: clientName,
            status: normalizedStatuses.length > 0 ? normalizedStatuses : 'all' // Use normalized pre-selected statuses
          }));
        }
      }
      dispatch(setSelectedClient(clientName));

      // Set pre-selected statuses if provided, otherwise clear
      if (normalizedStatuses.length > 0) {
        dispatch(setSelectedStatuses(normalizedStatuses));
      } else {
        dispatch(setSelectedStatus('All'));
        dispatch(setSelectedStatuses([]));
      }
      routeFilterHandled = true;
    }

    if (routeFilterHandled) {
      // Mark these route params as processed
      processedRouteParamsRef.current.add(routeParamsKey);

      // Clean up old entries (keep only last 10 to prevent memory leak)
      if (processedRouteParamsRef.current.size > 10) {
        const firstKey = processedRouteParamsRef.current.values().next().value;
        processedRouteParamsRef.current.delete(firstKey);
      }

      const clearParams = () => {
        navigation.setParams({
          filter: undefined,
          filterType: undefined,
          filterSource: undefined,
          filterAppliedAt: undefined,
          clientId: undefined,
          statuses: undefined,
          selectedStatuses: undefined,
        });
      };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(clearParams);
      } else {
        setTimeout(clearParams, 0);
      }
    }
  }, [
    route.params?.filterType,
    route.params?.filter,
    route.params?.filterSource,
    route.params?.filterAppliedAt,
    route.params?.statuses,
    route.params?.selectedStatuses,
    route.params?.clientId,
    clients,
    // Removed filters.status from dependencies to prevent infinite loop
    statusOptions, // Add statusOptions to ensure normalization happens when options are available
    dispatch,
    user?.role,
    navigation,
  ]);

  // Re-normalize statuses when statusOptions become available (if we have preselected statuses)
  useEffect(() => {
    // Only re-normalize if:
    // 1. statusOptions are now available
    // 2. We have preselected statuses from route params
    // 3. We haven't already processed these route params
    if (statusOptions.length > 0 &&
      route.params?.statuses &&
      route.params?.statuses.length > 0 &&
      route.params?.filterType === 'client') {

      const preSelectedStatuses = route.params?.statuses || route.params?.selectedStatuses || [];

      // Normalize status names to match API format
      const normalizeStatusName = (statusName) => {
        if (!statusName) return statusName;

        const statusLower = String(statusName).toLowerCase().trim();

        // Common status name mappings
        const statusMappings = {
          'cad': 'CAD',
          'coral': 'Coral',
          'enquiry created': 'Enquiry Created',
          'approved cad': 'Approved Cad',
          'quotation': 'Quotation',
          'quatation': 'Quotation',
          'design approval pending': 'Design Approval Pending',
          'order placement': 'Order Placement',
          'cam pending': 'CAM Pending',
          'production': 'Production',
          'completed': 'Completed',
        };

        if (statusMappings[statusLower]) {
          return statusMappings[statusLower];
        }

        const knownStatuses = statusOptions
          .filter(opt => opt.value !== 'all')
          .map(opt => opt.value);

        if (knownStatuses.length > 0) {
          const normalized = knownStatuses.find(s => {
            const sLower = String(s).toLowerCase().trim();
            return sLower === statusLower ||
              sLower.replace(/\s+/g, '') === statusLower.replace(/\s+/g, '');
          });

          if (normalized) {
            return normalized;
          }
        }

        return statusName;
      };

      const normalizedStatuses = preSelectedStatuses.map(normalizeStatusName).filter(s => s);

      // Only update if normalized statuses are different from current filters
      const currentStatuses = Array.isArray(filters.status) ? filters.status :
        (filters.status !== 'all' ? [filters.status] : []);

      const currentNormalized = currentStatuses.map(s => String(s).toLowerCase().trim()).sort().join(',');
      const newNormalized = normalizedStatuses.map(s => String(s).toLowerCase().trim()).sort().join(',');

      if (currentNormalized !== newNormalized && normalizedStatuses.length > 0) {
        if (__DEV__) {
          console.log('🔄 [ENQUIRY LIST] Re-normalizing statuses after statusOptions loaded:', {
            original: preSelectedStatuses,
            normalized: normalizedStatuses,
            current: currentStatuses,
          });
        }

        dispatch(setFilters({ status: normalizedStatuses }));
        dispatch(setSelectedStatuses(normalizedStatuses));
      }
    }
  }, [statusOptions, route.params?.statuses, route.params?.filterType, filters.status, dispatch]);



  // Handle refresh request from other screens (e.g. after deletion)
  useEffect(() => {
    if (route.params?.refreshTimestamp) {
      if (__DEV__) {
        console.log('🔄 [ENQUIRY LIST] Refresh triggered via params:', route.params.refreshTimestamp);
      }

      // Clear the param to prevent infinite loops
      navigation.setParams({ refreshTimestamp: undefined });

      // Set refreshing true IMMEDIATELY to trigger loader
      setRefreshing(true);

      // Trigger refresh
      onRefresh();
    }
  }, [route.params?.refreshTimestamp]);
  // Removed excessive logging - uncomment if needed for debugging
  // useEffect(() => {
  //   if (__DEV__ && (isInitialLoading || isFetching || isLoadingMore)) {
  //     const displayEnquiriesLength = displayEnquiries && Array.isArray(displayEnquiries) ? displayEnquiries.length : 0;
  //     console.log('📊 Loading States:', {
  //       isLoadingMore,
  //       isInitialLoading,
  //       isFetching,
  //       hasMore,
  //       currentPage,
  //       totalPages,
  //       enrichedCount: displayEnquiriesLength,
  //     });
  //   }
  // }, [isLoadingMore, isInitialLoading, isFetching, hasMore, currentPage, totalPages, displayEnquiries]);

  // Render enquiry card item for FlatList
  const handleViewQuotation = useCallback((enquiry) => {
    if (enquiry && typeof enquiry === 'object') {
      const id = enquiry?._id || enquiry?.id || enquiry?.Id;
      setQuotationEnquiryId(id);
      setShowQuotationModal(true);
    } else {
      // Legacy: URL string fallback
      const urlToShow = enquiry || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
      setSelectedPdfUrl(urlToShow);
      setIsPdfModalVisible(true);
    }
  }, []);

  const handleFinalLook = useCallback((enquiry) => {
    const id = enquiry?._id || enquiry?.id || enquiry?.Id;
    const name = enquiry?.clientName || enquiry?.ClientName || '';
    setFinalLookEnquiryId(id);
    setFinalLookClientName(name);
    setShowFinalLookModal(true);
  }, []);

  const handleApproveWithoutDesigner = useCallback(async (enquiryId) => {
    const prodStatus = statusesData?.find(s => s.name?.toLowerCase() === 'production');
    const statusName = prodStatus?.name || 'Production';
    await updateEnquiry({ id: enquiryId, Status: statusName, ApprovedDate: new Date().toISOString() }).unwrap();
  }, [updateEnquiry, statusesData]);

  const handleClosePdfModal = useCallback(() => {
    setIsPdfModalVisible(false);
    setSelectedPdfUrl(null);
  }, []);

  const handleUpdateEnquiry = useCallback(async (updateData) => {
    const { skipConfirm, ...data } = updateData;

    const doUpdate = async () => {
      const payload = { id: data.id };
      const status = data.Status || data.status;
      const assignedTo = data.AssignedTo || data.assignedTo;
      if (status) {
        payload.Status = status;
        payload.CurrentStatus = status;
      }
      if (assignedTo) {
        payload.AssignedTo = assignedTo;
      }
      Object.keys(data).forEach(key => {
        if (key !== 'id' && key !== 'Status' && key !== 'status' && key !== 'AssignedTo' && key !== 'assignedTo' && !payload[key]) {
          payload[key] = data[key];
        }
      });
      await updateEnquiry(payload).unwrap();
      if (refetchStatusStats) await refetchStatusStats();
      await fetchEnquiries({ pageToLoad: 1, append: false, suppressInlineLoader: false });
    };

    if (skipConfirm) {
      try {
        await doUpdate();
        return true;
      } catch (err) {
        console.error('updateEnquiry silent fail:', err?.data || err?.message || err);
        return false;
      }
    }

    return new Promise((resolve) => {
      const status = data.Status || data.status;
      const assignedTo = data.AssignedTo || data.assignedTo;
      let actionName = 'Update Enquiry';
      let actionMessage = 'Are you sure you want to update this enquiry?';
      if (assignedTo && status) {
        actionName = 'Assign Enquiry';
        actionMessage = 'Are you sure you want to assign this enquiry to the selected user?';
      } else if (status) {
        actionName = 'Update Status';
        actionMessage = `Are you sure you want to change the status to "${status}"?`;
      } else if (assignedTo) {
        actionName = 'Reassign Enquiry';
        actionMessage = 'Are you sure you want to reassign this enquiry?';
      }

      showAlert(actionName, actionMessage, 'warning', [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await doUpdate();
              resolve(true);
            } catch {
              resolve(false);
            }
          },
        },
      ]);
    });
  }, [updateEnquiry, fetchEnquiries, refetchStatusStats]);

  const handleDeleteEnquiry = useCallback(async (enquiryId) => {
    return new Promise((resolve) => {
      showAlert(
        'Delete Enquiry',
        'Are you sure you want to delete this enquiry? This action cannot be undone.',
        'warning',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                console.log('🗑️ Deleting enquiry:', enquiryId);
                
                // Call RTK mutation
                await deleteEnquiry(enquiryId).unwrap();
                
                // Refetch aggregate counts
                if (refetchStatusStats) {
                  await refetchStatusStats();
                }
                
                // Trigger refresh after delete
                await fetchEnquiries({ pageToLoad: 1, append: false, suppressInlineLoader: false });
                
                resolve(true);
              } catch (error) {
                console.error('❌ Failed to delete:', error);
                resolve(false);
              }
            },
          },
        ]
      );
    });
  }, [deleteEnquiry, fetchEnquiries, refetchStatusStats]);

  const renderEnquiryItem = useCallback(({ item: enquiry, currentTab, isExpandedAll }) => {
    if (!enquiry || !enquiry.id) {
      if (__DEV__) {
        console.warn('Skipping invalid enquiry item:', enquiry);
      }
      return null;
    }

    try {
      return (
        <View style={styles.cardWrapper}>
          <NewCard
            item={enquiry}
            navigation={navigation}
            onViewQuotation={handleViewQuotation}
            currentTab={currentTab || activeTab}
            onUpdateEnquiry={handleUpdateEnquiry}
            onDeleteEnquiry={handleDeleteEnquiry}
            isExpandedAll={!!isExpandedAll}
            onFinalLook={handleFinalLook}
            onPress={() => navigation.navigate('SingleEnquiry', {
              enquiryId: enquiry.id || enquiry._id,
              enquiry: enquiry,
            })}
          />
          <View style={styles.enquiryActionBar}>
            <View style={styles.enquiryActionDivider} />
            <View style={styles.enquiryActions}>
              <TouchableOpacity
                style={styles.enquiryActionBtn}
                onPress={() => setPreviewEnquiry(enquiry)}
                activeOpacity={0.7}
              >
                <Icon name="remove-red-eye" size={15} color={colors.primary} />
                <Text style={styles.enquiryActionText}>Preview</Text>
              </TouchableOpacity>

              <View style={styles.enquiryActionSep} />

              <TouchableOpacity
                style={styles.enquiryActionBtn}
                onPress={() => setSummaryEnquiryId(enquiry.id || enquiry._id)}
                activeOpacity={0.7}
              >
                <Icon name="assessment" size={15} color={colors.primary} />
                <Text style={styles.enquiryActionText}>Summary</Text>
              </TouchableOpacity>

              <View style={styles.enquiryActionSep} />

              <TouchableOpacity
                style={styles.enquiryActionBtn}
                onPress={() => setChecklistEnquiryId(enquiry.id || enquiry._id)}
                activeOpacity={0.7}
              >
                <Icon name="fact-check" size={15} color={colors.primary} />
                <Text style={styles.enquiryActionText}>Checklist</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    } catch (error) {
      if (__DEV__) {
        console.error('Error rendering enquiry item:', error, enquiry);
      }
      return null;
    }
  }, [navigation, handleViewQuotation, activeTab, handleUpdateEnquiry, handleDeleteEnquiry, handleFinalLook]);

  // Render list header - no longer needed as chips are moved outside FlatList
  const renderListHeader = () => {
    return null;
  };

  // Render loading footer for infinite scroll
  const renderListFooter = () => {
    // Check if we have more data available
    const hasMoreData = hasMore;

    const displayEnquiriesLength = displayEnquiries && Array.isArray(displayEnquiries) ? displayEnquiries.length : 0;
    // Only treat explicit "load more" / append requests as "loading more"
    // Filter changes and initial refetches use isFetching/isInitialLoading and should not
    // toggle the footer between "Loading more..." and "Load more enquiries"
    const isCurrentlyLoading = isLoadingMore;

    // Don't show anything if no data at all
    if (!displayEnquiries || !Array.isArray(displayEnquiries) || displayEnquiriesLength === 0) {
      return null;
    }

    // Show "No more data" message if we've loaded all pages
    if (!hasMoreData && !isCurrentlyLoading) {
      return (
        <View style={styles.endOfListContainer}>
          <View style={styles.endOfListDivider} />
          <Text style={styles.endOfListText}>You've reached the end</Text>
        </View>
      );
    }

    if (isCurrentlyLoading) {
      return (
        <View style={styles.loadingMoreContainer}>
          <View style={styles.loadingMoreContent}>
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.loadingSpinner}
            />
            {/* {isCurrentlyLoading && (
              <Text style={styles.loadingMoreText}>Loading more...</Text>
            )} */}
          </View>
        </View>
      );
    }

    if (hasMoreData) {
      return (
        <View style={styles.loadMoreButtonContainer}>
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={handleLoadMore}
            disabled={isLoadingMore || isFetching}
          >
            <Text style={styles.loadMoreButtonText}>
              {isLoadingMore ? 'Loading…' : 'Load more enquiries'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  // Helper function to check if status filter is active (handles both array and string)
  const isStatusFilterActive = () => {
    if (!filters.status || filters.status === 'all') return false;
    if (Array.isArray(filters.status)) {
      return filters.status.length > 0;
    }
    return typeof filters.status === 'string' && filters.status !== 'all';
  };

  // Render empty state
  const renderEmpty = () => {
    // Show loader if we are currently refreshing or fetching
    if (refreshing || isFetching || isInitialLoading) {
      return (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <AnimatedLogoLoader size={60} />
          <Text style={{ marginTop: 16, color: colors.textSecondary, fontSize: fonts.sm }}>
            Updating list...
          </Text>
        </View>
      );
    }

    const hasActiveFilters = isStatusFilterActive() ||
      (filters.priority && filters.priority !== 'all') ||
      (filters.clientId && filters.clientId !== 'all') ||
      searchQuery;

    return (
      <Card style={styles.emptyCard}>
        <Icon name="description" size={40} color={colors.textLight} />
        <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: 13 }]}>
          {hasActiveFilters ? 'No enquiries match your filters' : 'No enquiries found'}
        </Text>
        <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
          {hasActiveFilters
            ? 'Try adjusting your filters or search query'
            : 'Try adjusting your search or filters'}
        </Text>
        {hasActiveFilters && (
          <TouchableOpacity
            style={styles.clearFiltersButton}
            onPress={() => {
              dispatch(clearFilters());
              dispatch(setSearchQuery(''));
              dispatch(setSelectedStatus('All'));
              dispatch(setSelectedStatuses([]));
              dispatch(setSelectedClient('All'));
            }}
          >
            <Text style={styles.clearFiltersButtonText}>Clear All Filters</Text>
          </TouchableOpacity>
        )}
      </Card>
    );
  };



  // Handler for downloading all enquiries as PDF
  const handleDownloadAllPDF = async () => {
    try {
      // Use backend PDF download endpoint for better performance with large datasets
      const downloadFn = pdfGeneratorModule?.downloadEnquiriesPDFFromBackend;

      if (!downloadFn || typeof downloadFn !== 'function') {
        if (__DEV__) {
          console.error('downloadEnquiriesPDFFromBackend not available:', {
            module: pdfGeneratorModule,
            moduleType: typeof pdfGeneratorModule,
            moduleKeys: pdfGeneratorModule ? Object.keys(pdfGeneratorModule) : 'no module',
            functionType: typeof downloadFn,
          });
        }
        showAlert(
          'Error',
          'PDF export function is not available. Please contact support if this issue persists.',
          'error'
        );
        return;
      }

      // Build filters object from current filters, search query, and sorting
      // This matches what the backend expects for the export-pdf endpoint
      const exportFilters = {};

      // Add search query if present
      if (searchQuery && searchQuery.trim()) {
        exportFilters.search = searchQuery.trim();
      }

      // Add all active filters
      Object.entries(resolvedFilters).forEach(([key, value]) => {
        if (value && value !== 'all' && value !== 'All') {
          exportFilters[key] = value;
        }
      });

      // Add sorting parameters
      const sortFieldMap = {
        'AssignedDate': 'AssignedDate',
        'CreatedDate': 'CreatedDate',
        'CurrentStatus': 'CurrentStatus',
        'AssignedTo': 'AssignedTo',
        'Name': 'Name',
        'Category': 'Category',
        'ClientId': 'ClientId',
        'Priority': 'Priority',
        'Metal': 'Metal',
        'StoneType': 'StoneType',
        'ShippingDate': 'ShippingDate',
        'createdAt': 'CreatedDate',
        'assignedDate': 'AssignedDate',
        'status': 'CurrentStatus',
        'title': 'Name',
        'clientName': 'ClientId',
      };

      const backendSortField = sortFieldMap[sortBy] || sortBy || 'CreatedDate';
      const sortDirection = sortOrder || 'desc';
      exportFilters.sortBy = backendSortField;
      exportFilters.sortOrder = sortDirection;

      // Some backend implementations reuse the search pipeline and may expect paging flags.
      // We force "noPaging" and set a high limit as a safeguard.
      exportFilters.noPaging = true;
      exportFilters.page = 1;
      exportFilters.limit = 10000;

      // Debug: Log what we're exporting
      if (__DEV__) {
        console.log('========== EXPORTING ENQUIRIES TO PDF (BACKEND) ==========');
        console.log('Filters:', exportFilters);
        console.log('Total enquiries in current view:', enquiries.length);
        console.log('===========================================================');
      }

      // Show loading alert
      showAlert(
        'Downloading PDF',
        'Downloading PDF from server... This may take a moment for large datasets.',
        'info',
        []
      );

      // Download PDF from backend with progress callback
      const result = await downloadFn(exportFilters, {
        onProgress: (progress) => {
          if (__DEV__) {
            console.log('PDF Download Progress:', progress.status, progress.message);
          }
        },
      });

      if (result.cancelled) {
        // User cancelled, no need to show alert
        return;
      }

      if (result.success) {
        showAlert(
          'Success',
          'PDF downloaded successfully! Check your share/download options.',
          'success',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error downloading PDF:', error);
      }
      const errorMessage = error?.message || 'Unknown error occurred';
      showAlert(
        'Error',
        `Failed to download PDF: ${errorMessage}. Please try again.`,
        'error',
        [{ text: 'OK' }]
      );
    }
  };

  // Safety check - don't render if user is not loaded
  if (!user) {
    return <AnimatedLogoLoader size={60} />;
  }

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      // Scroll to top on refresh
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
      scrollPositionRef.current = 0;
      await AsyncStorage.removeItem(scrollPositionKey);
      
      // Refetch aggregate counts
      if (refetchStatusStats) {
        await refetchStatusStats();
      }
      
      await fetchEnquiries({ pageToLoad: 1, append: false, suppressInlineLoader: true });
    } catch (error) {
      if (__DEV__) {
        console.error('Error refreshing enquiries:', error);
      }
      showAlert('Error', 'Failed to refresh enquiries. Please try again.', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleFilterChange = (filterType, value) => {
    dispatch(setFilters({ [filterType]: value }));
  };

  const handleClearFilters = () => {
    dispatch(clearFilters());
  };

  const handleApplyFilters = (newFilters) => {
    dispatch(setFilters(newFilters));
    onRefresh()
  };

  const getStatusOptions = () => {
    const baseOptions = [
      { label: 'All Status', value: 'all' },
      { label: 'Pending', value: 'pending' },
      { label: 'Completed', value: 'completed' },
    ];

    if (user?.role === 'admin') {
      baseOptions.push({ label: 'Rejected', value: 'rejected' });
    }

    return baseOptions;
  };

  const getPriorityOptions = () => [
    { label: 'All Priority', value: 'all' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' },
  ];

  const getClientOptions = () => {
    // Use the same clientList logic to ensure consistency
    // clientList now contains objects with {id, name}
    return [
      { label: 'All Clients', value: 'all' },
      ...clientList.map(client => ({ label: client.name, value: client.id })),
    ];
  };

  // Helper functions for status and priority styling
  const getStatusColor = (status) => {
    if (!status) return colors.textSecondary;

    const statusLower = String(status).toLowerCase();

    // Handle actual status values from the system
    if (statusLower.includes('enquiry created') || statusLower === 'enquiry created') {
      return colors.info || '#2196F3';
    }
    if (statusLower.includes('design approval pending') || statusLower.includes('approval pending')) {
      return colors.warning || '#FF9800';
    }
    if (statusLower.includes('coral')) {
      return colors.primary || '#1976D2';
    }
    if (statusLower.includes('cad') && !statusLower.includes('approved')) {
      return colors.info || '#2196F3';
    }
    if (statusLower.includes('approved cad')) {
      return colors.success || '#4CAF50';
    }
    if (statusLower.includes('order placement')) {
      return colors.accent || '#9C27B0';
    }
    if (statusLower.includes('cam pending')) {
      return colors.secondary || '#7B1FA2';
    }
    if (statusLower.includes('production')) {
      return colors.error || '#F44336';
    }
    if (statusLower.includes('completed')) {
      return colors.success || '#4CAF50';
    }
    if (statusLower.includes('rejected')) {
      return colors.error || '#F44336';
    }

    // Legacy support
    if (statusLower === 'pending') return colors.warning || '#FF9800';
    if (statusLower === 'completed') return colors.success || '#4CAF50';
    if (statusLower === 'rejected') return colors.error || '#F44336';

    return colors.textSecondary;
  };

  const getStatusIcon = (status) => {
    if (!status) return 'help';

    const statusLower = String(status).toLowerCase();

    if (statusLower.includes('enquiry created')) return 'add-circle';
    if (statusLower.includes('approval pending')) return 'pending-actions';
    if (statusLower.includes('coral')) return 'palette';
    if (statusLower.includes('cad')) return 'design-services';
    if (statusLower.includes('approved')) return 'check-circle';
    if (statusLower.includes('order')) return 'shopping-cart';
    if (statusLower.includes('production')) return 'build';
    if (statusLower.includes('completed')) return 'check-circle';
    if (statusLower.includes('rejected')) return 'cancel';

    return 'help';
  };

  const getPriorityColor = (priority) => {
    if (!priority) return colors.textSecondary;

    const priorityLower = String(priority).toLowerCase();

    const priorityColors = {
      'normal': colors.success || '#4CAF50',
      'high': colors.warning || '#FF9800',
      'super high': colors.error || '#F44336',
      // Legacy support
      'low': colors.success || '#4CAF50',
      'medium': colors.success || '#4CAF50',
      'urgent': colors.warning || '#FF9800',
      'super urgent': colors.error || '#F44336',
    };

    return priorityColors[priorityLower] || colors.textSecondary;
  };

  const getPriorityIcon = (priority) => {
    if (!priority) return 'help';

    const priorityLower = String(priority).toLowerCase();

    if (priorityLower.includes('super') || priorityLower === 'high') {
      return 'priority-high';
    }
    if (priorityLower === 'normal' || priorityLower === 'medium' || priorityLower === 'low') {
      return 'low-priority';
    }

    return 'help';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) {
      return 'Recently';
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return 'Recently';
    }

    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  // Sort options - matching backend API fields
  const sortOptions = [
    { key: 'AssignedDate', label: 'Assigned Date', icon: 'schedule' },
    { key: 'CreatedDate', label: 'Date Created', icon: 'event' },
    { key: 'Name', label: 'Name', icon: 'title' },
    { key: 'Priority', label: 'Priority', icon: 'priority-high' },
    { key: 'CurrentStatus', label: 'Status', icon: 'flag' },
    { key: 'Category', label: 'Category', icon: 'category' },
    { key: 'ClientId', label: 'Client', icon: 'person' },
    { key: 'StoneType', label: 'Stone Type', icon: 'diamond' },
    { key: 'ShippingDate', label: 'Shipping Date', icon: 'local-shipping' },
  ];

  const getSortLabel = () => {
    const option = sortOptions.find(opt => opt.key === sortBy);
    return option ? option.label : 'Sort by';
  };

  const handleSortChange = (newSortBy) => {
    if (newSortBy === sortBy) {
      // Toggle order if same field
      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      dispatch(setSorting({ sortBy, sortOrder: newOrder }));
      if (__DEV__) {
        console.log('Sort order toggled:', newOrder);
      }
    } else {
      // Default sort order based on field type
      // Date fields default to 'desc' (newest first), others default to 'asc'
      const dateFields = ['AssignedDate', 'CreatedDate', 'ShippingDate'];
      const defaultOrder = dateFields.includes(newSortBy) ? 'desc' : 'asc';
      dispatch(setSorting({ sortBy: newSortBy, sortOrder: defaultOrder }));
      if (__DEV__) {
        console.log('Sort changed to:', newSortBy, defaultOrder);
      }
    }
    setShowSortModal(false);
  };

  const renderStatusChips = () => {
    if (statusList.length <= 1) return null;

    // Filter out 'All' from status list for multi-select
    const availableStatuses = statusList.filter(status => status !== 'All');

    return (
      <View style={[styles.compactFilterRow, isTablet && styles.compactFilterRowTablet]}>
        <Text style={styles.compactFilterLabel}>Status:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.compactChipsScroll}
          contentContainerStyle={styles.compactChipsContent}
        >
          {/* Show all selected statuses with X button */}
          {selectedStatuses.map(status => (
            <View key={status} style={styles.compactSelectedChip}>
              <Text style={styles.compactSelectedChipText}>{status}</Text>
              <TouchableOpacity
                style={styles.compactChipClose}
                onPress={() => {
                  dispatch(toggleStatus(status));
                }}
              >
                <Icon name="close" size={12} color={colors.textWhite} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Show available status options (excluding selected ones) */}
          {availableStatuses
            .filter(status => !selectedStatuses.includes(status))
            .map(status => (
              <TouchableOpacity
                key={status}
                style={styles.compactChip}
                onPress={() => {
                  if (__DEV__) {
                    console.log('🔍 Status chip clicked:', status);
                  }
                  dispatch(toggleStatus(status));
                }}
              >
                <Text style={styles.compactChipText}>{status}</Text>
              </TouchableOpacity>
            ))}

          {/* Clear all button if any statuses are selected */}
          {selectedStatuses.length > 0 && (
            <TouchableOpacity
              style={[styles.compactChip, { backgroundColor: colors.error + '20' }]}
              onPress={() => {
                dispatch(setSelectedStatuses([]));
                dispatch(setFilters({ status: 'all' }));
              }}
            >
              <Text style={[styles.compactChipText, { color: colors.error }]}>Clear All</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderClientChips = () => {
    // Show client chips even if no enquiries (clients might not have enquiries yet)
    if (!clientList || clientList.length === 0) {
      return null;
    }

    // Always include "All" in the list, and filter out only non-"All" selected clients
    const allClients = [{ id: 'all', name: 'All' }, ...clientList];
    const availableClients = allClients.filter(client => {
      // Always show "All" option
      if (client.id === 'all') return true;
      // Filter out the selected client only if it's not "All"
      return client.name !== selectedClient;
    });

    return (
      <View style={[styles.compactFilterRow, isTablet && styles.compactFilterRowTablet]}>
        <Text style={styles.compactFilterLabel}>Client:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.compactChipsScroll}
          contentContainerStyle={styles.compactChipsContent}
        >
          {/* Show selected client first with X button (only if not "All") */}
          {selectedClient && selectedClient !== 'All' && (
            <View style={styles.compactSelectedChip}>
              <Text style={styles.compactSelectedChipText}>{selectedClient}</Text>
              <TouchableOpacity
                style={styles.compactChipClose}
                onPress={() => {
                  dispatch(setSelectedClient('All'));
                  dispatch(setFilters({ clientId: 'all', client: 'all' }));
                }}
              >
                <Icon name="close" size={12} color={colors.textWhite} />
              </TouchableOpacity>
            </View>
          )}

          {/* Show available client options (including "All" always) */}
          {availableClients.map((client, index) => {
            // Use client ID + index for guaranteed unique key
            const uniqueKey = `client-${client.id}-${index}`;
            const clientName = client.name;

            return (
              <TouchableOpacity
                key={uniqueKey}
                style={[
                  styles.compactChip,
                  selectedClient === clientName && styles.compactSelectedChip
                ]}
                onPress={() => {
                  dispatch(setSelectedClient(clientName));

                  if (client.id === 'all') {
                    dispatch(setFilters({ clientId: 'all', client: 'all' }));
                  } else {
                    dispatch(setFilters({
                      clientId: String(client.id).trim(),
                      client: clientName
                    }));
                  }
                }}
              >
                <Text style={[
                  styles.compactChipText,
                  selectedClient === clientName && styles.compactSelectedChipText
                ]}>
                  {clientName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderFilterModal = () => (
    <EnquiryFiltersModal
      visible={showFilters}
      onClose={() => setShowFilters(false)}
      filters={filters}
      onApplyFilters={handleApplyFilters}
      onClearFilters={handleClearFilters}
      user={user}
    />
  );

  const renderSortModal = () => (
    <Modal
      visible={showSortModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowSortModal(false)}>
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowSortModal(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={styles.sortModalContent}>
          <View style={styles.sortModalHeader}>
            <Text style={styles.sortModalTitle}>Sort by</Text>
            <TouchableOpacity
              style={styles.sortModalClose}
              onPress={() => setShowSortModal(false)}>
              <Icon name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sortOptionsList}>
            {sortOptions.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.sortOption,
                  sortBy === option.key && styles.sortOptionActive
                ]}
                onPress={() => handleSortChange(option.key)}>
                <View style={styles.sortOptionContent}>
                  <Icon
                    name={option.icon}
                    size={20}
                    color={sortBy === option.key ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[
                    styles.sortOptionText,
                    sortBy === option.key && styles.sortOptionTextActive
                  ]}>
                    {option.label}
                  </Text>
                </View>
                {sortBy === option.key && (
                  <View style={styles.sortOrderIndicator}>
                    <Icon
                      name={sortOrder === 'asc' ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  // Show full screen loader only on initial load (when no data yet)
  const displayEnquiriesLength = displayEnquiries && Array.isArray(displayEnquiries) ? displayEnquiries.length : 0;
  const shouldShowScreenApiLoader =
    !isInitialLoading &&
    !isLoadingMore &&
    (isFetching || refreshing);

  if (isInitialLoading && displayEnquiriesLength === 0) {
    return <AnimatedLogoLoader size={80} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopNavbar navigation={navigation} />

      {/* Client-specific header for ClientEnquiries stack screen */}
      {isClientView && (
        <View style={styles.clientHeader}>
          <TouchableOpacity
            style={styles.clientHeaderBack}
            onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.clientHeaderInfo}>
            <Text style={styles.clientHeaderLabel}>Client Enquiries</Text>
            <Text style={styles.clientHeaderName} numberOfLines={1}>
              {route.params?.filter || (selectedClient && selectedClient !== 'All' ? selectedClient : null) || 'Selected Client'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addEnquiryBtn}
            onPress={() => {
              console.log('EnquiryListScreen route params:', JSON.stringify(route.params));
              setShowCreateModal(true);
            }}>
            <Icon name="add" size={22} color={colors.textWhite} />
          </TouchableOpacity>
        </View>
      )}

      {/* Status Tabs */}
      <StatusTabs 
        activeTab={isClientView ? 'all' : activeTab} 
        onTabChange={isClientView ? () => {} : setActiveTab}
        displayEnquiries={displayEnquiries}
        flatListRef={flatListRef}
        renderEnquiryItem={renderEnquiryItem}
        renderListFooter={renderListFooter}
        renderEmpty={renderEmpty}
        isTablet={isTablet}
        refreshing={refreshing}
        onRefresh={onRefresh}
        handleScroll={handleScroll}
        saveScrollPosition={saveScrollPosition}
        onEndReachedDuringMomentumRef={onEndReachedDuringMomentumRef}
        handleLoadMore={handleLoadMore}
        styles={styles}
        searchQuery={localSearchValue}
        onSearchChange={handleSearchChange}
        onSearchClear={handleSearchClear}
        onSortPress={() => setShowSortModal(true)}
        onFilterPress={() => setShowFilters(true)}
        onDownloadPress={handleDownloadAllPDF}
        statusList={statusList}
        selectedStatuses={selectedStatuses}
        onToggleStatus={(status) => dispatch(toggleStatus(status))}
        onClearStatuses={() => {
          dispatch(setSelectedStatuses([]));
          dispatch(setFilters({ status: 'all' }));
        }}
        clientList={clientList}
        selectedClient={selectedClient}
        onSelectClient={(client) => {
          dispatch(setSelectedClient(client.name));
          if (client.id === 'all') {
            dispatch(setFilters({ clientId: 'all', client: 'all' }));
          } else {
            dispatch(setFilters({
              clientId: String(client.id).trim(),
              client: client.name
            }));
          }
        }}
        onClearClient={() => {
          dispatch(setSelectedClient('All'));
          dispatch(setFilters({ clientId: 'all', client: 'all' }));
        }}
        isAdmin={isAdmin}
        statusCounts={statusCounts}
        onUpdateEnquiry={handleUpdateEnquiry}
        resolvedFilters={resolvedFilters}
        sortBy={sortBy}
        sortOrder={sortOrder}
        hideHeader={isClientView}
      />

      {shouldShowScreenApiLoader && (
        <View style={styles.screenLoaderOverlay}>
          <View style={styles.screenLoaderCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.screenLoaderText}>
              {refreshing ? 'Refreshing enquiries...' : 'Loading enquiries...'}
            </Text>
          </View>
        </View>
      )}

      {renderFilterModal()}
      {renderSortModal()}

      <Modal
        animationType="fade"
        transparent={true}
        visible={isPdfModalVisible}
        onRequestClose={handleClosePdfModal}
      >
        <View style={styles.pdfModalContainer}>
          <View style={styles.pdfModalContent}>
            <PdfViewer url={selectedPdfUrl} style={styles.pdfViewer} />
            <TouchableOpacity style={styles.pdfModalCloseButton} onPress={handleClosePdfModal}>
              <Icon name="close" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* ══ Quotation Modal ══════════════════════════════════════════════ */}
      <QuotationModal
        visible={showQuotationModal}
        enquiryId={quotationEnquiryId}
        onClose={() => { setShowQuotationModal(false); setQuotationEnquiryId(null); }}
      />

      <FinalLookModal
        visible={showFinalLookModal}
        enquiryId={finalLookEnquiryId}
        clientName={finalLookClientName}
        onApprove={handleApproveWithoutDesigner}
        onClose={() => { setShowFinalLookModal(false); setFinalLookEnquiryId(null); setFinalLookClientName(''); }}
      />

      <BrandedAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
      />
      <CreateEnquiryModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        route={route}
      />
      <Modal visible={!!previewEnquiry} transparent animationType="slide" onRequestClose={() => setPreviewEnquiry(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox2}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enquiry Preview</Text>
              <TouchableOpacity onPress={() => setPreviewEnquiry(null)}>
                <Icon name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {previewEnquiry && (
              <ScrollView>
                <View style={styles.detailCard}>
                  <Text style={styles.detailCardTitle}>General</Text>
                  <View style={styles.detailRow}><Text style={styles.detailLabel}>Name</Text><Text style={styles.detailValue}>{previewEnquiry.Name || previewEnquiry.title || 'N/A'}</Text></View>
                  <View style={styles.detailRow}><Text style={styles.detailLabel}>Client</Text><Text style={styles.detailValue}>{previewEnquiry.clientName || 'N/A'}</Text></View>
                  <View style={styles.detailRow}><Text style={styles.detailLabel}>Status</Text><Text style={styles.detailValue}>{previewEnquiry.CurrentStatus || previewEnquiry.Status || 'N/A'}</Text></View>
                  <View style={styles.detailRow}><Text style={styles.detailLabel}>Priority</Text><Text style={styles.detailValue}>{previewEnquiry.Priority || 'N/A'}</Text></View>
                  <View style={styles.detailRow}><Text style={styles.detailLabel}>Category</Text><Text style={styles.detailValue}>{previewEnquiry.Category || 'N/A'}</Text></View>
                </View>
                <View style={styles.detailCard}>
                  <Text style={styles.detailCardTitle}>Materials</Text>
                  <View style={styles.detailRow}><Text style={styles.detailLabel}>Metal</Text><Text style={styles.detailValue}>{previewEnquiry.Metal?.Quality || ''} {previewEnquiry.Metal?.Color || ''}</Text></View>
                  <View style={styles.detailRow}><Text style={styles.detailLabel}>Stone Type</Text><Text style={styles.detailValue}>{previewEnquiry.StoneType || 'N/A'}</Text></View>
                  {previewEnquiry.Stamping && <View style={styles.detailRow}><Text style={styles.detailLabel}>Stamping</Text><Text style={styles.detailValue}>{previewEnquiry.Stamping}</Text></View>}
                </View>
                {previewEnquiry.Remarks && (
                  <View style={styles.detailCard}>
                    <Text style={styles.detailCardTitle}>Remarks</Text>
                    <Text style={styles.detailRemarks}>{previewEnquiry.Remarks}</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
      <Modal visible={!!summaryEnquiryId} transparent animationType="slide" onRequestClose={() => setSummaryEnquiryId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox2}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enquiry Summary</Text>
              <TouchableOpacity onPress={() => setSummaryEnquiryId(null)}>
                <Icon name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {summaryLoading ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                {(() => {
                  if (!summaryEnquiry) {
                    return (
                      <View style={styles.detailCard}>
                        <Text style={styles.detailValue}>Could not load summary. Please try again.</Text>
                      </View>
                    );
                  }
                  const sm =
                    (typeof summaryEnquiry.Summary === 'string' && summaryEnquiry.Summary.trim() && summaryEnquiry.Summary) ||
                    (summaryEnquiry._originalData?.Summary && typeof summaryEnquiry._originalData.Summary === 'string' && summaryEnquiry._originalData.Summary.trim() && summaryEnquiry._originalData.Summary) ||
                    null;
                  if (__DEV__) {
                    console.log('📄 [Summary modal] Summary value:', sm ? sm.slice(0, 120) : 'NULL');
                  }
                  const rendered = sm ? renderHtmlSummary(sm, styles) : null;
                  return rendered || (
                    <View style={styles.detailCard}>
                      <Text style={styles.detailValue}>No summary available for this enquiry.</Text>
                    </View>
                  );
                })()}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={!!checklistEnquiryId} transparent animationType="slide" onRequestClose={() => setChecklistEnquiryId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox2}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Checklist</Text>
              <TouchableOpacity onPress={() => setChecklistEnquiryId(null)}>
                <Icon name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {checklistLoading ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : checklistEnquiry && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {(() => {
                  // Checklist is a JSON object from the backend, not HTML
                  const cl =
                    (checklistEnquiry.Checklist && typeof checklistEnquiry.Checklist === 'object' && checklistEnquiry.Checklist) ||
                    (checklistEnquiry._originalData?.Checklist && typeof checklistEnquiry._originalData.Checklist === 'object' && checklistEnquiry._originalData.Checklist) ||
                    null;
                  if (__DEV__) {
                    console.log('📋 [Checklist modal] Checklist value:', JSON.stringify(cl));
                  }
                  if (!cl) {
                    return (
                      <View style={styles.detailCard}>
                        <Text style={styles.detailValue}>No checklist found</Text>
                      </View>
                    );
                  }
                  // Field label map
                  const FIELD_LABELS = {
                    Engraving:           'Engraving',
                    SizeLength:          'Size (Length)',
                    SizeRingSize:        'Size (Ring Size)',
                    DimensionsThickness: 'Dimensions (Thickness)',
                    DeliveryDate:        'Delivery Date',
                    EnamelPaintwork:     'Enamel / Paintwork',
                    RhodiumInstructions: 'Rhodium Instructions',
                    Components:          'Components',
                    Findings:            'Findings',
                  };
                  const rows = Object.entries(FIELD_LABELS)
                    .map(([key, label]) => ({ key, label, value: cl[key] }))
                    .filter(r => r.value !== undefined && r.value !== null);
                  if (cl.GeneratedAt) {
                    // append generation date at bottom
                    rows.push({ key: 'GeneratedAt', label: 'Generated At', value: new Date(cl.GeneratedAt).toLocaleString() });
                  }
                  return (
                    <View style={styles.summaryContainer}>
                      {rows.map(r => (
                        <View key={r.key} style={styles.checklistRow}>
                          <Text style={styles.checklistLabel}>{r.label}</Text>
                          <Text style={[
                            styles.checklistValue,
                            String(r.value).toUpperCase() === 'NA' && styles.checklistValueNA,
                          ]}>{String(r.value)}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:"#f9f7f2",
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },

  addButtonContainer: {
    marginTop: 16,
    alignItems: 'flex-end',
  },

  filterChipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  filterChipsContainerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  filterChips: {
    flex: 1,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  screenLoaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  screenLoaderCard: {
    minWidth: 180,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenLoaderText: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  filterChipText: {
    color: colors.textWhite,
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    marginRight: 6,
  },
  filterChipClose: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  clearAllText: {
    color: colors.textSecondary,
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
  },
  scrollView: {
    flex: 1,
  },
  flatList: {
    flex: 1,
  },
  flatListContent: {
    paddingBottom: 20,
    paddingTop: 0,
  },
  flatListContentTablet: {
    paddingBottom: 24,
    paddingTop: 0,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  rowTablet: {
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    gap: 16,
  },
  loadingMoreContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMoreContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  loadingSpinner: {
    marginRight: 0,
  },
  loadingMoreText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  loadMoreButtonContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  loadMoreButtonText: {
    color: colors.textWhite || '#FFFFFF',
    fontFamily: fonts.semibold || fonts.medium,
    fontSize: fonts.sm,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  endOfListContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endOfListDivider: {
    width: 60,
    height: 1,
    backgroundColor: colors.borderLight,
    marginBottom: 12,
  },
  endOfListText: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.textLight,
    letterSpacing: 0.3,
  },
  flatListContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  emptyCard: {
    margin: 16,
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 16,
    marginBottom: 8,
  },
  filterModal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterContent: {
    flex: 1,
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    marginBottom: 12,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    marginRight: 8,
  },
  filterOptionActive: {
    backgroundColor: colors.primary,
  },
  filterFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  applyButton: {
    width: '100%',
  },

  // Sort Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sortModalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    width: '100%',
    shadowColor: colors.textPrimary,
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  sortModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortModalTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  sortModalClose: {
    padding: 4,
  },
  sortOptionsList: {
    padding: 8,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginVertical: 2,
  },
  sortOptionActive: {
    backgroundColor: colors.backgroundSecondary,
  },
  sortOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sortOptionText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginLeft: 12,
  },
  sortOptionTextActive: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  sortOrderIndicator: {
    marginLeft: 8,
  },
  listHeaderContainer: {
    backgroundColor: colors.background,
    marginTop: 0,
    paddingTop: 0,
  },
  // Compact Filter Row Styles

  clearFiltersButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearFiltersButtonText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textWhite,
  },
  pdfModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pdfModalContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    width: '100%',
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  pdfViewer: {
    flex: 1,
    borderRadius: 16,
  },
  pdfModalCloseButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 16,
    padding: 4,
    zIndex: 20,
  },

  // Old chip styles (keeping for backward compatibility if needed)
  chipsGroupRow: {
    marginBottom: 2,
    paddingLeft: 20,    // match Enquiry Cards' left inset
    paddingRight: 20,
  },
  chipGroupLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    marginBottom: 2,
    marginLeft: 8,
  },
  chipsScroll: {
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    backgroundColor: colors.background,
    marginRight: 8,
    marginBottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  chipTextActive: {
    color: colors.textWhite,
  },
  clientsChipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  // Quick Actions Section
  quickActionsSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    marginTop: 8,
  },
  quickActionsCard: {
    marginHorizontal: 0,
    marginVertical: 0,
    padding: 18,
  },
  quickActionsTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    width: '48%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 110,
  },
  actionIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  // Pagination Styles
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.background,
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 0,
  },
  paginationArrow: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
  paginationNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  paginationNumber: {
    minWidth: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    marginHorizontal: 2,
  },
  paginationNumberActive: {
    backgroundColor: colors.primary, // Brand color
  },
  paginationNumberText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  paginationNumberTextActive: {
    color: colors.textWhite,
    fontFamily: fonts.bold,
  },
  paginationEllipsis: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    paddingHorizontal: 4,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  clientHeaderBack: {
    padding: 4,
    marginRight: 12,
  },
  clientHeaderInfo: {
    flex: 1,
  },
  clientHeaderLabel: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.textWhite + 'CC',
  },
  clientHeaderName: {
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textWhite,
    marginTop: 2,
  },
  addEnquiryBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  // ── Client-handler enquiry card wrapper ──────────────────────────────────
  cardWrapper: {
    // NewCard already has marginHorizontal:10 marginBottom:8
    // Pull the action bar up flush against the card bottom
    marginBottom: 4,
  },
  enquiryActionBar: {
    // Sits directly below NewCard — same horizontal inset, no top margin
    marginHorizontal: 10,
    marginBottom: 10,
    backgroundColor: colors.cardBackground || colors.background,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    // Lift slightly above NewCard's elevation so shadow reads as one unit
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    // Pull up to overlap NewCard's marginBottom:8 → seamless join
    marginTop: -8,
    overflow: 'hidden',
  },
  enquiryActionDivider: {
    height: 1,
    backgroundColor: colors.borderLight || colors.border || '#E8E8E8',
    marginHorizontal: 12,
  },
  enquiryActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  enquiryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
  },
  enquiryActionSep: {
    width: 1,
    height: 18,
    backgroundColor: colors.borderLight || colors.border || '#E0E0E0',
  },
  enquiryActionText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalBox2: {
    backgroundColor: colors.background,
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    padding: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  detailCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  detailCardTitle: {
    fontSize: fonts.sm,
    fontFamily: fonts.bold,
    color: colors.primary,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    flex: 1,
  },
  detailValue: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    flex: 1.5,
    textAlign: 'right',
  },
  detailRemarks: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    lineHeight: 20,
  },

  // ── HTML Summary renderer styles ──────────────────────────────────────────
  summaryContainer: {
    paddingBottom: 8,
  },
  summaryHeading: {
    fontSize: fonts.sm,
    fontFamily: fonts.bold,
    color: colors.primary,
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryHeadingLarge: {
    fontSize: fonts.base,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight || colors.border,
  },
  summaryKey: {
    flex: 1,
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    paddingRight: 8,
  },
  summaryVal: {
    flex: 1.5,
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  summaryBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 3,
    paddingLeft: 4,
  },
  summaryBulletDot: {
    fontSize: fonts.base,
    color: colors.primary,
    marginRight: 8,
    lineHeight: 20,
  },
  summaryBulletText: {
    flex: 1,
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  summaryPara: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    lineHeight: 20,
    marginVertical: 4,
  },

  // ── Checklist renderer styles ─────────────────────────────────────────────
  checklistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight || colors.border,
  },
  checklistLabel: {
    flex: 1.2,
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    paddingRight: 8,
  },
  checklistValue: {
    flex: 1,
    fontSize: fonts.sm,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  checklistValueNA: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
  },
});

export default EnquiryListScreen;

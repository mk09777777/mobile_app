import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  FlatList,
  RefreshControl,
  ActivityIndicator,
  View,
} from 'react-native';
import { useGetEnquiriesQuery } from '../../store/api';
import { useAuth } from '../../context/AuthContext';
import { useClients } from '../../features/clients/clientsHooks';
import { colors } from '../../constants/colors';

const PAGE_SIZE = 50;

const canonicalStatusForFilter = (raw) => {
  const n = String(raw || '').toLowerCase().trim().replace(/[\s_\-]+/g, '');
  if (!n) return '';
  if (n.includes('designapproval') || (n.includes('approval') && n.includes('pending'))) return 'design_approval_pending';
  if (n.includes('approved') && n.includes('cad')) return 'approved_cad';
  if (n.includes('orderplacement')) return 'order_placement';
  if (n.includes('production')) return 'production';
  if (n.includes('shipped')) return 'shipped';
  if (n.includes('completed')) return 'completed';
  if (n.includes('rejected')) return 'rejected';
  if (n === 'pending' || (n.includes('enquiry') && n.includes('created'))) return 'enquiry_created';
  if (n === 'coral') return 'coral';
  if (n.includes('cad')) return 'cad';
  if (n.includes('quotation')) return 'quotation';
  return n;
};

export default function AllStatus({
  flatListRef,
  renderEnquiryItem,
  renderEmpty,
  isTablet,
  styles,
  currentTab,
  user: propUser,
  statusValues,
  displayEnquiries: parentDisplayEnquiries,
  searchQuery,
  resolvedFilters,
  sortBy,
  sortOrder,
  onCountChange,
}) {
  const { user: authUser } = useAuth();
  const user = propUser || authUser;

  const [page, setPage] = useState(1);
  const pageRef = useRef(page);
  pageRef.current = page;
  const [allItems, setAllItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const onEndReachedDuringMomentum = useRef(false);
  const scrollPos = useRef(0);

  useEffect(() => {
    setPage(1);
    setAllItems([]);
  }, [currentTab, searchQuery, resolvedFilters, sortBy, sortOrder]);

  const queryParams = useMemo(() => {
    // Base params
    const params = {
      role: user?.role,
      page,
      limit: PAGE_SIZE,
      search: searchQuery && searchQuery.trim() ? searchQuery.trim() : undefined,
    };

    // Build shared filters from resolvedFilters (priority, clientId, dates, etc.)
    // sortBy/sortOrder are appended via the filters object (api.js reads filters.sortBy)
    const baseFilters = {
      ...(resolvedFilters || {}),
      sortBy: sortBy || 'CreatedDate',
      sortOrder: sortOrder || 'desc',
    };

    if (currentTab === 'AssignedToYou') {
      params.assignedTo = user?.id || user?._id;
      const role = user?.role;
      if (role === 'coral') {
        params.filters = { ...baseFilters, status: ['Coral', 'Coral Pending', 'coral', 'coral pending'] };
      } else if (role === 'cad') {
        params.filters = { ...baseFilters, status: ['CAD', 'Cad', 'cad', 'CAD Pending', 'cad pending', 'Approved Cad', 'approved cad', 'APPROVED CAD'] };
      } else {
        const { status: _status, ...filtersWithoutStatus } = baseFilters;
        params.filters = filtersWithoutStatus;
      }
    } else if (statusValues && statusValues.length > 0) {
      // Tab-specific status filter — send common case variants
      const expanded = [...new Set(
        statusValues.flatMap(s => [
          s,
          s.toLowerCase(),
          s.toUpperCase(),
          s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
        ]),
      )];
      params.filters = { ...baseFilters, status: expanded };
    } else {
      // "All" tab or no status filter — still apply base filters + sort
      params.filters = baseFilters;
    }

    return params;
  }, [user, page, currentTab, statusValues, searchQuery, resolvedFilters, sortBy, sortOrder]);

  const { data, isLoading, isFetching, refetch } = useGetEnquiriesQuery(
    queryParams,
    { skip: !user },
  );

  // Fetch clients for name resolution (uses RTK Query cache — no extra network calls)
  const { clients: clientsData = [] } = useClients({ skip: !user });
  const clients = Array.isArray(clientsData) ? clientsData : [];

  const clientNameMap = useMemo(() => {
    const map = new Map();
    clients.forEach(client => {
      const clientId = client.id || client._id || client.Id;
      const clientName = client.name || client.Name;
      if (clientId && clientName && clientName !== 'Unknown Client') {
        const idStr = String(clientId).trim();
        map.set(idStr, clientName);
        map.set(idStr.toLowerCase(), clientName);
      }
    });
    return map;
  }, [clients]);

  const resolveClientName = useCallback((enquiry) => {
    const existing = enquiry.clientName || enquiry.ClientName;
    if (existing && existing !== 'Unknown Client') return existing;
    const rawId = enquiry.clientId || enquiry.ClientId;
    if (!rawId) return 'Unknown Client';
    const idStr = String(rawId).trim();
    return clientNameMap.get(idStr) || clientNameMap.get(idStr.toLowerCase()) || 'Unknown Client';
  }, [clientNameMap]);

  // Frontend filtering fallback (backend may not filter by multi-word statuses or assignedTo correctly)
  useEffect(() => {
    if (currentTab === 'AssignedToYou' && (!data?.data || data.data.length === 0) && parentDisplayEnquiries && parentDisplayEnquiries.length > 0) {
      const userId = String(user?.id || user?._id || '').trim();
      const roleAllowedStatuses = (() => {
        const role = user?.role;
        if (role === 'coral') return ['coral', 'coral pending'];
        if (role === 'cad') return ['cad', 'cad pending', 'approved cad'];
        return null;
      })();
      const filtered = parentDisplayEnquiries.filter(item => {
        const raw = item._originalData || item;
        let assignedId = raw.AssignedTo || raw.assignedTo || raw.assigned_to || raw.Assigned_To;
        if (assignedId && typeof assignedId === 'object') {
          assignedId = assignedId.id || assignedId._id || '';
        }
        if (String(assignedId || '').trim() !== userId) return false;
        if (roleAllowedStatuses) {
          const itemStatus = (item.CurrentStatus || item.Status || item.status || '').toLowerCase();
          return roleAllowedStatuses.includes(itemStatus);
        }
        return true;
      });
      const fallbackItems = filtered.map(item => ({
        ...item,
        id: item.id || item._id || item.Id || item.EnquiryId || item.enquiryId,
        clientName: resolveClientName(item),
      }));
      setAllItems(fallbackItems);
      return;
    }

    if (!data?.data) return;

    let filtered = data.data.filter(item => item && (item.id || item._id || item.Id));

    if (statusValues && Array.isArray(statusValues) && statusValues.length > 0) {
      const canonicalFilters = [
        ...new Set(statusValues.map(s => canonicalStatusForFilter(s)).filter(Boolean)),
      ];
      if (canonicalFilters.length > 0) {
        filtered = filtered.filter(item => {
          const itemStatus = item.CurrentStatus || item.Status || item.status || '';
          return canonicalFilters.includes(canonicalStatusForFilter(itemStatus));
        });
      }
    }

    if (currentTab === 'AssignedToYou') {
      const userId = String(user?.id || user?._id || '').trim();
      const role = user?.role;
      const roleAllowedStatuses = role === 'coral' ? ['coral', 'coral pending']
        : role === 'cad' ? ['cad', 'cad pending', 'approved cad']
        : null;
      if (userId) {
        filtered = filtered.filter(item => {
          const raw = item._originalData || item;
          let assignedId = raw.AssignedTo || raw.assignedTo || raw.assigned_to || raw.Assigned_To;
          if (assignedId && typeof assignedId === 'object') {
            assignedId = assignedId.id || assignedId.Id || assignedId._id || '';
          }
          if (String(assignedId || '').trim() !== userId) return false;
          if (roleAllowedStatuses) {
            const itemStatus = (item.CurrentStatus || item.Status || item.status || '').toLowerCase();
            return roleAllowedStatuses.includes(itemStatus);
          }
          return true;
        });
      }
    }

    // Normalize item ids and enrich client names
    const normalized = filtered.map(item => ({
      ...item,
      id: item.id || item._id || item.Id || item.EnquiryId || item.enquiryId,
      clientName: resolveClientName(item),
    }));

    setAllItems(prev => {
      if (page === 1) return normalized;
      const existingIds = new Set(prev.map(item => item.id));
      return [...prev, ...normalized.filter(item => !existingIds.has(item.id))];
    });
  }, [data, page, statusValues, currentTab, user, parentDisplayEnquiries, resolveClientName]);

  // Report count to parent when AssignedToYou tab list changes
  useEffect(() => {
    if (currentTab === 'AssignedToYou' && onCountChange) {
      onCountChange(allItems.length);
    }
  }, [allItems, currentTab, onCountChange]);

  // Re-enrich client names when the client map loads after enquiries
  useEffect(() => {
    if (clientNameMap.size === 0) return;
    setAllItems(prev =>
      prev.map(item => ({
        ...item,
        clientName: resolveClientName(item),
      })),
    );
  }, [clientNameMap, resolveClientName]);

  const refreshFetchSeenRef = useRef(false);
  const refreshTimerRef = useRef(null);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refreshFetchSeenRef.current = false;
    if (pageRef.current === 1) {
      refetch();
    }
    setPage(1);
    // Safety: force spinner off after 8 seconds to prevent permanent loader
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      setRefreshing(false);
      refreshFetchSeenRef.current = false;
    }, 8000);
  }, [refetch]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  // Track when a fetch actually starts after a refresh request
  useEffect(() => {
    if (refreshing && isFetching) {
      refreshFetchSeenRef.current = true;
    }
  }, [refreshing, isFetching]);

  // Stop refreshing only after a fetch started AND completed with data
  useEffect(() => {
    if (refreshing && refreshFetchSeenRef.current && !isFetching && Array.isArray(data?.data)) {
      refreshFetchSeenRef.current = false;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      setRefreshing(false);
    }
  }, [refreshing, isFetching, data]);

  const handleLoadMore = useCallback(() => {
    if (
      !isFetching &&
      data?.pagination &&
      page < data.pagination.totalPages
    ) {
      setPage(prev => prev + 1);
    }
  }, [isFetching, data, page]);

  const renderFooter = useCallback(() => {
    if (isFetching && page > 1) {
      return (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }
    return null;
  }, [isFetching, page]);

  const showLoader = (isLoading && page === 1) || (refreshing && isFetching);
  if (showLoader) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={allItems.filter(enquiry => enquiry && enquiry.id)}
      renderItem={props => renderEnquiryItem({ ...props, currentTab })}
      keyExtractor={(item, index) => {
        if (item?.id) return String(item.id);
        if (item?._id) return String(item._id);
        return `enquiry-${index}`;
      }}
      ListHeaderComponent={null}
      ListFooterComponent={renderFooter}
      ListEmptyComponent={renderEmpty}
      contentContainerStyle={[
        styles.flatListContent,
        isTablet && styles.flatListContentTablet,
        (!allItems || allItems.length === 0) &&
          styles.flatListContentEmpty,
      ]}
      style={styles.flatList}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
      onScroll={event => {
        scrollPos.current = event.nativeEvent.contentOffset.y;
      }}
      onMomentumScrollBegin={() => {
        onEndReachedDuringMomentum.current = false;
      }}
      scrollEventThrottle={16}
      onEndReached={() => {
        if (onEndReachedDuringMomentum.current) return;
        onEndReachedDuringMomentum.current = true;
        handleLoadMore();
      }}
      onEndReachedThreshold={0.25}
      numColumns={1}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
      maxToRenderPerBatch={isTablet ? 15 : 10}
      windowSize={isTablet ? 15 : 10}
      initialNumToRender={isTablet ? 15 : 10}
      updateCellsBatchingPeriod={50}
      getItemLayout={(_, index) => {
        const cardHeight = isTablet ? 260 : 280;
        return { length: cardHeight, offset: cardHeight * index, index };
      }}
    />
  );
}

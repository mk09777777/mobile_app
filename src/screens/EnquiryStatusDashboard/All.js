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
      params.AssignedTo = user?.id || user?._id;
      params.filters = { ...baseFilters, assignedTo: user?.id || user?._id };
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
    console.log('🔍 [Data Effect] Running with:', {
      hasData: !!data?.data,
      dataLength: data?.data?.length || 0,
      hasParentData: !!parentDisplayEnquiries,
      parentDataLength: parentDisplayEnquiries?.length || 0,
      currentTab,
      statusValues,
      page,
    });
    
    // For AssignedToYou tab, use parent data if API returns no data
    if (currentTab === 'AssignedToYou' && (!data?.data || data.data.length === 0) && parentDisplayEnquiries && parentDisplayEnquiries.length > 0) {
      console.log('⚠️ [Data Effect] API returned no data for AssignedToYou, using parent displayEnquiries');
      
      const userId = String(user?.id || user?._id || '').trim();
      console.log('🔍 [Data Effect] Filtering parent data for userId:', userId);
      
      const filtered = parentDisplayEnquiries.filter((item, index) => {
        const raw = item._originalData || item;
        let assignedId = raw.AssignedTo || raw.assignedTo || raw.assigned_to || raw.Assigned_To;
        
        if (index < 3) {
          console.log(`🔍 [Data Effect] Parent item ${index}:`, {
            id: item.id || item._id,
            name: item.Name || item.name,
            assignedTo: assignedId,
          });
        }
        
        if (assignedId && typeof assignedId === 'object') {
          assignedId = assignedId.id || assignedId._id || '';
        }
        
        const assignedIdStr = String(assignedId || '').trim();
        const matches = assignedIdStr === userId;
        
        if (index < 3) {
          console.log(`🔍 [Data Effect] Parent item ${index} matches:`, matches);
        }
        
        return matches;
      });
      
      console.log('🔍 [Data Effect] Filtered parent data count:', filtered.length);
      
      const normalized = filtered.map(item => ({
        ...item,
        id: item.id || item._id || item.Id || item.EnquiryId || item.enquiryId,
        clientName: resolveClientName(item),
      }));

      setAllItems(normalized);
      return;
    }
    
    if (!data?.data) {
      console.log('⚠️ [Data Effect] No data received from API');
      return;
    }

    console.log('🔍 [Data Effect] Raw API data (first 3 items):', data.data.slice(0, 3).map(item => ({
      id: item.id || item._id || item.Id,
      name: item.Name || item.name,
      status: item.CurrentStatus || item.Status || item.status,
      assignedTo: item.AssignedTo || item.assignedTo,
    })));

    let filtered = data.data.filter(item => item && (item.id || item._id || item.Id));
    console.log('🔍 [Data Effect] After basic filter:', filtered.length);

    // Apply status filter on frontend as safety net
    if (statusValues && Array.isArray(statusValues) && statusValues.length > 0) {
      const canonicalFilters = [
        ...new Set(statusValues.map(s => canonicalStatusForFilter(s)).filter(Boolean)),
      ];
      if (canonicalFilters.length > 0) {
        filtered = filtered.filter(item => {
          const itemStatus = item.CurrentStatus || item.Status || item.status || '';
          return canonicalFilters.includes(canonicalStatusForFilter(itemStatus));
        });
        console.log('🔍 [Data Effect] After status filter:', filtered.length);
      }
    }

    // Apply assignedTo filter on frontend (API ignores assignedTo for admin users)
    if (currentTab === 'AssignedToYou') {
      const userId = String(user?.id || user?._id || '').trim();
      console.log('🔍 [AssignedToYou Filter] Current User ID:', userId);
      console.log('🔍 [AssignedToYou Filter] Total items before filter:', filtered.length);
      
      if (userId) {
        filtered = filtered.filter((item, index) => {
          const raw = item._originalData || item;
          let assignedId = raw.AssignedTo || raw.assignedTo || raw.assigned_to || raw.Assigned_To;
          
          // Log first 5 items for debugging
          if (index < 5) {
            console.log(`🔍 [AssignedToYou Filter] Item ${index}:`, {
              enquiryId: item.id || item._id || item.Id,
              enquiryName: item.Name || item.name,
              assignedToRaw: assignedId,
              assignedToType: typeof assignedId,
            });
          }
          
          if (assignedId && typeof assignedId === 'object') {
            assignedId = assignedId.id || assignedId.Id || assignedId._id || '';
          }

          const assignedIdStr = String(assignedId || '').trim();
          const matches = assignedIdStr === userId;
          
          // Log first 5 comparisons
          if (index < 5) {
            console.log(`🔍 [AssignedToYou Filter] Item ${index} comparison:`, {
              assignedIdStr,
              userId,
              matches,
            });
          }
          
          return matches;
        });
        
        console.log('🔍 [AssignedToYou Filter] Total items after filter:', filtered.length);
        console.log('🔍 [AssignedToYou Filter] Filtered items:', filtered.map(item => ({
          id: item.id || item._id || item.Id,
          name: item.Name || item.name,
          assignedTo: item.AssignedTo || item.assignedTo,
        })));
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
      const newItems = normalized.filter(item => !existingIds.has(item.id));
      return [...prev, ...newItems];
    });
  }, [data, page, statusValues, currentTab, user, parentDisplayEnquiries, resolveClientName]);

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
      getItemLayout={(data, index) => {
        const numCols = isTablet ? 3 : 2;
        const cardHeight = isTablet ? 260 : 280;
        return {
          length: cardHeight,
          offset: cardHeight * Math.floor(index / numCols),
          index,
        };
      }}
    />
  );
}

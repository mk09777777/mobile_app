import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  FlatList,
  RefreshControl,
  ActivityIndicator,
  View,
} from 'react-native';
import { useGetEnquiriesQuery } from '../../store/api';
import { useAuth } from '../../context/AuthContext';
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
}) {
  const { user: authUser } = useAuth();
  const user = propUser || authUser;

  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const onEndReachedDuringMomentum = useRef(false);
  const scrollPos = useRef(0);

  useEffect(() => {
    setPage(1);
    setAllItems([]);
  }, [currentTab]);

  const queryParams = useMemo(() => {
    const params = { role: user?.role, page, limit: PAGE_SIZE };

    if (!currentTab || currentTab === 'all') return params;

    if (currentTab === 'AssignedToYou') {
      params.assignedTo = user?.id || user?._id;
      params.AssignedTo = user?.id || user?._id;
      params.filters = { assignedTo: user?.id || user?._id };
    } else if (statusValues) {
      // Send common case variants so backend matches regardless of DB casing
      const expanded = [...new Set(
        statusValues.flatMap(s => [
          s,
          s.toLowerCase(),
          s.toUpperCase(),
          s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
        ]),
      )];
      params.filters = { status: expanded };
    }

    return params;
  }, [user, page, currentTab, statusValues]);

  const { data, isLoading, isFetching, refetch } = useGetEnquiriesQuery(
    queryParams,
    { skip: !user },
  );

  // Frontend filtering fallback (backend may not filter by multi-word statuses or assignedTo correctly)
  useEffect(() => {
    if (!data?.data) return;

    let filtered = data.data.filter(item => item && (item.id || item._id || item.Id));

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
      }
    }

    // Apply assignedTo filter on frontend (API ignores assignedTo for admin users)
    if (currentTab === 'AssignedToYou') {
      const userId = String(user?.id || user?._id || '').trim().toLowerCase();
      if (userId) {
        filtered = filtered.filter(item => {
          const raw = item._originalData || item;
          const assignedId = raw.AssignedTo || raw.assignedTo || raw.assigned_to || raw.Assigned_To;
          if (assignedId && typeof assignedId === 'object') {
            return String(assignedId.id || assignedId._id || '').trim().toLowerCase() === userId;
          }
          return String(assignedId || '').trim().toLowerCase() === userId;
        });
      }
    }

    // Normalize item ids
    const normalized = filtered.map(item => ({
      ...item,
      id: item.id || item._id || item.Id || item.EnquiryId || item.enquiryId,
    }));

    setAllItems(prev => {
      if (page === 1) return normalized;
      const existingIds = new Set(prev.map(item => item.id));
      const newItems = normalized.filter(item => !existingIds.has(item.id));
      return [...prev, ...newItems];
    });
  }, [data, page, statusValues, currentTab, user]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    setAllItems([]);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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

  if (isLoading && page === 1) {
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

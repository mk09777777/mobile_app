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

export default function AllStatus({
  flatListRef,
  renderEnquiryItem,
  renderEmpty,
  isTablet,
  styles,
  currentTab,
  user: propUser,
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

    const statusMap = {
      NewEnquiry: 'enquiry created',
      CoralPending: 'coral',
      CadPending: 'cad',
      Quotation: 'quotation',
      ApprovalPending: 'design approval pending',
      OrderPlaced: 'order placement',
      Production: 'production',
      Shipped: 'shipped',
    };

    if (currentTab === 'AssignedToYou') {
      params.filters = { assignedTo: user?.id || user?._id };
    } else if (statusMap[currentTab]) {
      params.filters = { status: statusMap[currentTab] };
    }

    return params;
  }, [user, page, currentTab]);

  const { data, isLoading, isFetching, refetch } = useGetEnquiriesQuery(
    queryParams,
    { skip: !user },
  );

  useEffect(() => {
    if (data?.data) {
      setAllItems(prev => {
        if (page === 1) return data.data;
        const existingIds = new Set(prev.map(item => item.id));
        const newItems = data.data.filter(
          item => !existingIds.has(item.id),
        );
        return [...prev, ...newItems];
      });
    }
  }, [data, page]);

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

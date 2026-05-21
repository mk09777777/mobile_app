import React from 'react';
import { FlatList, RefreshControl } from 'react-native';

export default function Shipped({
  displayEnquiries,
  flatListRef,
  renderEnquiryItem,
  renderListFooter,
  renderEmpty,
  isTablet,
  refreshing,
  onRefresh,
  handleScroll,
  saveScrollPosition,
  onEndReachedDuringMomentumRef,
  handleLoadMore,
  styles,
  currentTab,
}) {
  return (
    <FlatList
      ref={flatListRef}
      data={(displayEnquiries && Array.isArray(displayEnquiries)
        ? displayEnquiries
        : []
      ).filter(enquiry => enquiry && enquiry.id)}
      renderItem={(props) => renderEnquiryItem({ ...props, currentTab })}
      keyExtractor={(item, index) => {
        if (item?.id) return String(item.id);
        if (item?._id) return String(item._id);
        if (__DEV__) {
          console.warn('Enquiry item missing ID, using index:', index, item);
        }
        return `enquiry-${index}`;
      }}
      ListHeaderComponent={null}
      ListFooterComponent={renderListFooter}
      ListEmptyComponent={renderEmpty}
      contentContainerStyle={[
        styles.flatListContent,
        isTablet && styles.flatListContentTablet,
        (!displayEnquiries ||
          !Array.isArray(displayEnquiries) ||
          displayEnquiries.length === 0) &&
          styles.flatListContentEmpty,
      ]}
      style={styles.flatList}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      onScroll={handleScroll}
      onMomentumScrollBegin={() => {
        onEndReachedDuringMomentumRef.current = false;
      }}
      onScrollEndDrag={event => {
        const offsetY = event.nativeEvent.contentOffset.y;
        saveScrollPosition(offsetY);
      }}
      onMomentumScrollEnd={event => {
        const offsetY = event.nativeEvent.contentOffset.y;
        saveScrollPosition(offsetY);
      }}
      scrollEventThrottle={16}
      onEndReached={() => {
        if (onEndReachedDuringMomentumRef.current) {
          return;
        }
        onEndReachedDuringMomentumRef.current = true;
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

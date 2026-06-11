import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  FlatList,
  View,
  Modal,
} from 'react-native';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { SearchInput } from '../../components/common';
import Icon from '../../components/common/Icon';
import AllStatus from './All';
import { useAuth } from '../../context/AuthContext';
import { useGetStatusesQuery } from '../../store/api';

export default function StatusTabs({
  activeTab,
  onTabChange,
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
  styles: parentStyles,
  searchQuery,
  onSearchChange,
  onSearchClear,
  onSortPress,
  onFilterPress,
  onDownloadPress,
  statusList,
  selectedStatuses,
  onToggleStatus,
  onClearStatuses,
  clientList,
  selectedClient,
  onSelectClient,
  onClearClient,
  isAdmin,
  statusCounts,
  onUpdateEnquiry,
  resolvedFilters,
  sortBy,
  sortOrder,
  hideHeader,
}) {
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase();

  const [isExpandedAll, setIsExpandedAll] = React.useState(false);

  const { data: statusesFromApi = [] } = useGetStatusesQuery();

  const tabStatusValues = React.useMemo(() => {
    // Explicit expected status names for each tab — matches DB values
    const STATUS_MAP = {
      NewEnquiry: ['Enquiry Created'],
      CoralPending: ['Coral'],
      CadPending: ['CAD'],
      ApprovedCad: ['Approved Cad'],
      Quotation: ['Quotation', 'Design Approval Pending'],
      OrderPlaced: ['Order Placement'],
      Production: ['Production'],
      Shipped: ['Shipped'],
    };

    if (!statusesFromApi.length) return STATUS_MAP;

    // Try to find matching status names from the API (preserves exact casing from DB)
    // A tab may have multiple expected names (e.g. Quotation has both 'Quotation' and 'Design Approval Pending')
    const map = {};
    for (const [tabKey, expectedNames] of Object.entries(STATUS_MAP)) {
      const matched = expectedNames.map(expected => {
        const apiMatch = statusesFromApi.find(
          s => (s.name || '').toLowerCase().trim() === expected.toLowerCase()
        );
        return apiMatch ? apiMatch.name : expected;
      });
      map[tabKey] = matched;
    }
    return map;
  }, [statusesFromApi]);

  const tabs = React.useMemo(() => {
    if (userRole === 'admin') {
      return [
        { key: 'all', label: 'All' },
        { key: 'NewEnquiry', label: 'New Enquiries' },
        { key: 'CoralPending', label: 'Coral Pending' },
        { key: 'CadPending', label: 'CAD Pending' },
        { key: 'ApprovedCad', label: 'Approved CAD' },
        { key: 'Quotation', label: 'Quotation' },
        { key: 'OrderPlaced', label: 'Order Placement' },
        { key: 'Production', label: 'Production' },
        { key: 'Shipped', label: 'Shipped' },
      ];
    } else if (userRole === 'coral') {
      return [
        { key: 'AssignedToYou', label: 'Assigned to You' },
        { key: 'CoralPending', label: 'Coral Pending' }
      ];
    } else if (userRole === 'cad') {
      return [
        { key: 'AssignedToYou', label: 'Assigned to You' },
        { key: 'CadPending', label: 'CAD Pending' },
        { key: 'ApprovedCad', label: 'Approved CAD' },
      ];
    } else if (userRole === 'client_handler') {
      return [
        { key: 'all', label: 'All' },
        { key: 'NewEnquiry', label: 'New Enquiries' },
        { key: 'CoralPending', label: 'Coral Pending' },
        { key: 'CadPending', label: 'CAD Pending' },
        { key: 'ApprovedCad', label: 'Approved CAD' },
        { key: 'Quotation', label: 'Quotation' },
        { key: 'OrderPlaced', label: 'Order Placement' },
        { key: 'Production', label: 'Production' },
        { key: 'Shipped', label: 'Shipped' },
      ];
    }
    return [
      { key: 'AssignedToYou', label: 'Assigned to You' },
      { key: 'all', label: 'All' }
    ];
  }, [userRole]);

  React.useEffect(() => {
    if (tabs.length === 1 && activeTab !== tabs[0].key) {
      onTabChange(tabs[0].key);
    }
  }, [tabs, activeTab, onTabChange]);

  const [assignedToYouCount, setAssignedToYouCount] = React.useState(0);
  const getCountForTab = React.useCallback((tabKey) => {
    switch (tabKey) {
      case 'all': return displayEnquiries.length;
      case 'NewEnquiry': return statusCounts?.newEnquiry || 0;
      case 'CoralPending': return statusCounts?.coral || 0;
      case 'CadPending': return statusCounts?.cad || 0;
      case 'ApprovedCad': return statusCounts?.approvedCad || 0;
      case 'Quotation': return (statusCounts?.quotation || 0) + (statusCounts?.approval || 0);
      case 'OrderPlaced': return statusCounts?.order || 0;
      case 'Production': return statusCounts?.production || 0;
      case 'Shipped': return statusCounts?.shipped || 0;
      case 'AssignedToYou': return assignedToYouCount;
      default: return 0;
    }
  }, [displayEnquiries.length, statusCounts, assignedToYouCount]);

  const renderTab = ({ item }) => {
    const count = getCountForTab(item.key);
    return (
      <TouchableOpacity
        style={[styles.tab, activeTab === item.key && styles.tabActive]}
        onPress={() => onTabChange(item.key)}
      >
        <Text
          style={[styles.tabText, activeTab === item.key && styles.tabTextActive]}
        >
          {item.label}
        </Text>

        <View
          style={[
            styles.countInactiveContainer,
            activeTab === item.key && styles.countActiveContainer,
          ]}
        >
          <Text
            style={[
              styles.countInactiveText,
              activeTab === item.key && styles.countActiveText,
            ]}
          >
            {count}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderItemWithActions = (props) => {
    return renderEnquiryItem({ ...props, isExpandedAll });
  };

  return (
    <View style={{ flex: 1 }}>
      {!hideHeader && (
        <FlatList
          data={tabs}
          renderItem={renderTab}
          keyExtractor={item => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
          style={styles.flatListStyle}
        />
      )}

      {activeTab === 'AssignedToYou' && (
        <>
          <View style={[styles.header, isTablet && styles.headerTablet]}>
            <View style={styles.searchRow}>
              <View style={styles.searchContainer}>
                <SearchInput
                  placeholder="Search enquiries..."
                  value={searchQuery}
                  onChangeText={onSearchChange}
                  onClear={onSearchClear}
                />
              </View>

              <TouchableOpacity style={styles.sortButton} onPress={onSortPress}>
                <Icon name="sort" size={20} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterButton}
                onPress={onFilterPress}
              >
                <Icon name="tune" size={20} color={colors.primary} />
              </TouchableOpacity>

              <View style={styles.expandToggleWrapper}>
                <Text style={styles.expandToggleLabel}>
                  {isExpandedAll ? 'Collapse' : 'Expand'}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsExpandedAll(v => !v)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.expandToggleTrack, isExpandedAll && styles.expandToggleTrackOn]}>
                    <View style={[styles.expandToggleThumb, isExpandedAll && styles.expandToggleThumbOn]} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
            searchQuery={searchQuery}
            resolvedFilters={resolvedFilters}
            sortBy={sortBy}
            sortOrder={sortOrder}
            isTablet={isTablet}
            styles={parentStyles}
            currentTab="AssignedToYou"
            user={user}
            statusValues={tabStatusValues[activeTab]}
            displayEnquiries={displayEnquiries}
            onCountChange={setAssignedToYouCount}
          />
        </>
      )}

      {/* Render All tab content */}
      {activeTab === 'all' && (
        <>
          <View style={[styles.header, isTablet && styles.headerTablet]}>
            <View style={styles.searchRow}>
              <View style={styles.searchContainer}>
                <SearchInput
                  placeholder="Search enquiries..."
                  value={searchQuery}
                  onChangeText={onSearchChange}
                  onClear={onSearchClear}
                />
              </View>

              <TouchableOpacity style={styles.sortButton} onPress={onSortPress}>
                <Icon name="sort" size={20} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterButton}
                onPress={onFilterPress}
              >
                <Icon name="tune" size={20} color={colors.primary} />
              </TouchableOpacity>

              <View style={styles.expandToggleWrapper}>
                <Text style={styles.expandToggleLabel}>
                  {isExpandedAll ? 'Collapse' : 'Expand'}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsExpandedAll(v => !v)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.expandToggleTrack, isExpandedAll && styles.expandToggleTrackOn]}>
                    <View style={[styles.expandToggleThumb, isExpandedAll && styles.expandToggleThumbOn]} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
            searchQuery={searchQuery}
            resolvedFilters={resolvedFilters}
            sortBy={sortBy}
            sortOrder={sortOrder}
            isTablet={isTablet}
            styles={parentStyles}
            currentTab="all"
            user={user}
            statusValues={tabStatusValues[activeTab]}
          />
        </>
      )}

      {activeTab === 'NewEnquiry' && (
        <>
          <View style={[styles.header, isTablet && styles.headerTablet]}>
            <View style={styles.searchRow}>
              <View style={styles.searchContainer}>
                <SearchInput
                  placeholder="Search enquiries..."
                  value={searchQuery}
                  onChangeText={onSearchChange}
                  onClear={onSearchClear}
                />
              </View>

              <TouchableOpacity style={styles.sortButton} onPress={onSortPress}>
                <Icon name="sort" size={20} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterButton}
                onPress={onFilterPress}
              >
                <Icon name="tune" size={20} color={colors.primary} />
              </TouchableOpacity>

              <View style={styles.expandToggleWrapper}>
                <Text style={styles.expandToggleLabel}>
                  {isExpandedAll ? 'Collapse' : 'Expand'}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsExpandedAll(v => !v)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.expandToggleTrack, isExpandedAll && styles.expandToggleTrackOn]}>
                    <View style={[styles.expandToggleThumb, isExpandedAll && styles.expandToggleThumbOn]} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
            searchQuery={searchQuery}
            resolvedFilters={resolvedFilters}
            sortBy={sortBy}
            sortOrder={sortOrder}
            isTablet={isTablet}
            styles={parentStyles}
            currentTab="NewEnquiry"
            user={user}
            statusValues={tabStatusValues[activeTab]}
          />
        </>
      )}

      {activeTab === 'CoralPending' && (
        <>
          <View style={[styles.header, isTablet && styles.headerTablet]}>
            <View style={styles.searchRow}>
              <View style={styles.searchContainer}>
                <SearchInput
                  placeholder="Search enquiries..."
                  value={searchQuery}
                  onChangeText={onSearchChange}
                  onClear={onSearchClear}
                />
              </View>

              <TouchableOpacity style={styles.sortButton} onPress={onSortPress}>
                <Icon name="sort" size={20} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterButton}
                onPress={onFilterPress}
              >
                <Icon name="tune" size={20} color={colors.primary} />
              </TouchableOpacity>

              <View style={styles.expandToggleWrapper}>
                <Text style={styles.expandToggleLabel}>
                  {isExpandedAll ? 'Collapse' : 'Expand'}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsExpandedAll(v => !v)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.expandToggleTrack, isExpandedAll && styles.expandToggleTrackOn]}>
                    <View style={[styles.expandToggleThumb, isExpandedAll && styles.expandToggleThumbOn]} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
            searchQuery={searchQuery}
            resolvedFilters={resolvedFilters}
            sortBy={sortBy}
            sortOrder={sortOrder}
            isTablet={isTablet}
            styles={parentStyles}
            currentTab="CoralPending"
            user={user}
            statusValues={tabStatusValues[activeTab]}
          />
        </>
      )}

      {activeTab === 'CadPending' && (
        <>
          <View style={[styles.header, isTablet && styles.headerTablet]}>
            <View style={styles.searchRow}>
              <View style={styles.searchContainer}>
                <SearchInput
                  placeholder="Search enquiries..."
                  value={searchQuery}
                  onChangeText={onSearchChange}
                  onClear={onSearchClear}
                />
              </View>

              <TouchableOpacity style={styles.sortButton} onPress={onSortPress}>
                <Icon name="sort" size={20} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterButton}
                onPress={onFilterPress}
              >
                <Icon name="tune" size={20} color={colors.primary} />
              </TouchableOpacity>

              <View style={styles.expandToggleWrapper}>
                <Text style={styles.expandToggleLabel}>
                  {isExpandedAll ? 'Collapse' : 'Expand'}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsExpandedAll(v => !v)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.expandToggleTrack, isExpandedAll && styles.expandToggleTrackOn]}>
                    <View style={[styles.expandToggleThumb, isExpandedAll && styles.expandToggleThumbOn]} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
            searchQuery={searchQuery}
            resolvedFilters={resolvedFilters}
            sortBy={sortBy}
            sortOrder={sortOrder}
            isTablet={isTablet}
            styles={parentStyles}
            currentTab="CadPending"
            user={user}
            statusValues={tabStatusValues[activeTab]}
          />
        </>
      )}

      {activeTab === 'ApprovedCad' && (
        <>
          <View style={[styles.header, isTablet && styles.headerTablet]}>
            <View style={styles.searchRow}>
              <View style={styles.searchContainer}>
                <SearchInput
                  placeholder="Search enquiries..."
                  value={searchQuery}
                  onChangeText={onSearchChange}
                  onClear={onSearchClear}
                />
              </View>

              <TouchableOpacity style={styles.sortButton} onPress={onSortPress}>
                <Icon name="sort" size={20} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterButton}
                onPress={onFilterPress}
              >
                <Icon name="tune" size={20} color={colors.primary} />
              </TouchableOpacity>

              <View style={styles.expandToggleWrapper}>
                <Text style={styles.expandToggleLabel}>
                  {isExpandedAll ? 'Collapse' : 'Expand'}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsExpandedAll(v => !v)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.expandToggleTrack, isExpandedAll && styles.expandToggleTrackOn]}>
                    <View style={[styles.expandToggleThumb, isExpandedAll && styles.expandToggleThumbOn]} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
            searchQuery={searchQuery}
            resolvedFilters={resolvedFilters}
            sortBy={sortBy}
            sortOrder={sortOrder}
            isTablet={isTablet}
            styles={parentStyles}
            currentTab="ApprovedCad"
            user={user}
            statusValues={tabStatusValues[activeTab]}
          />
        </>
      )}

      {activeTab === 'Quotation' && (
        <>
          <View style={[styles.header, isTablet && styles.headerTablet]}>
            <View style={styles.searchRow}>
              <View style={styles.searchContainer}>
                <SearchInput
                  placeholder="Search enquiries..."
                  value={searchQuery}
                  onChangeText={onSearchChange}
                  onClear={onSearchClear}
                />
              </View>

              <TouchableOpacity style={styles.sortButton} onPress={onSortPress}>
                <Icon name="sort" size={20} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterButton}
                onPress={onFilterPress}
              >
                <Icon name="tune" size={20} color={colors.primary} />
              </TouchableOpacity>

              <View style={styles.expandToggleWrapper}>
                <Text style={styles.expandToggleLabel}>
                  {isExpandedAll ? 'Collapse' : 'Expand'}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsExpandedAll(v => !v)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.expandToggleTrack, isExpandedAll && styles.expandToggleTrackOn]}>
                    <View style={[styles.expandToggleThumb, isExpandedAll && styles.expandToggleThumbOn]} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
            searchQuery={searchQuery}
            resolvedFilters={resolvedFilters}
            sortBy={sortBy}
            sortOrder={sortOrder}
            isTablet={isTablet}
            styles={parentStyles}
            currentTab="Quotation"
            user={user}
            statusValues={tabStatusValues[activeTab]}
          />
        </>
      )}

      {activeTab === 'OrderPlaced' && (
        <>
          <View style={[styles.header, isTablet && styles.headerTablet]}>
            <View style={styles.searchRow}>
              <View style={styles.searchContainer}>
                <SearchInput
                  placeholder="Search enquiries..."
                  value={searchQuery}
                  onChangeText={onSearchChange}
                  onClear={onSearchClear}
                />
              </View>

              <TouchableOpacity style={styles.sortButton} onPress={onSortPress}>
                <Icon name="sort" size={20} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterButton}
                onPress={onFilterPress}
              >
                <Icon name="tune" size={20} color={colors.primary} />
              </TouchableOpacity>

              <View style={styles.expandToggleWrapper}>
                <Text style={styles.expandToggleLabel}>
                  {isExpandedAll ? 'Collapse' : 'Expand'}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsExpandedAll(v => !v)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.expandToggleTrack, isExpandedAll && styles.expandToggleTrackOn]}>
                    <View style={[styles.expandToggleThumb, isExpandedAll && styles.expandToggleThumbOn]} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
            searchQuery={searchQuery}
            resolvedFilters={resolvedFilters}
            sortBy={sortBy}
            sortOrder={sortOrder}
            isTablet={isTablet}
            styles={parentStyles}
            currentTab="OrderPlaced"
            user={user}
            statusValues={tabStatusValues[activeTab]}
          />
        </>
      )}

      {activeTab === 'Production' && (
        <>
          <View style={[styles.header, isTablet && styles.headerTablet]}>
            <View style={styles.searchRow}>
              <View style={styles.searchContainer}>
                <SearchInput
                  placeholder="Search enquiries..."
                  value={searchQuery}
                  onChangeText={onSearchChange}
                  onClear={onSearchClear}
                />
              </View>

              <TouchableOpacity style={styles.sortButton} onPress={onSortPress}>
                <Icon name="sort" size={20} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterButton}
                onPress={onFilterPress}
              >
                <Icon name="tune" size={20} color={colors.primary} />
              </TouchableOpacity>

              <View style={styles.expandToggleWrapper}>
                <Text style={styles.expandToggleLabel}>
                  {isExpandedAll ? 'Collapse' : 'Expand'}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsExpandedAll(v => !v)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.expandToggleTrack, isExpandedAll && styles.expandToggleTrackOn]}>
                    <View style={[styles.expandToggleThumb, isExpandedAll && styles.expandToggleThumbOn]} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
            searchQuery={searchQuery}
            resolvedFilters={resolvedFilters}
            sortBy={sortBy}
            sortOrder={sortOrder}
            isTablet={isTablet}
            styles={parentStyles}
            currentTab="Production"
            user={user}
            statusValues={tabStatusValues[activeTab]}
          />
        </>
      )}
      {activeTab === 'Shipped' && (
        <>
          <View style={[styles.header, isTablet && styles.headerTablet]}>
            <View style={styles.searchRow}>
              <View style={styles.searchContainer}>
                <SearchInput
                  placeholder="Search enquiries..."
                  value={searchQuery}
                  onChangeText={onSearchChange}
                  onClear={onSearchClear}
                />
              </View>

              <TouchableOpacity style={styles.sortButton} onPress={onSortPress}>
                <Icon name="sort" size={20} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterButton}
                onPress={onFilterPress}
              >
                <Icon name="tune" size={20} color={colors.primary} />
              </TouchableOpacity>

              <View style={styles.expandToggleWrapper}>
                <Text style={styles.expandToggleLabel}>
                  {isExpandedAll ? 'Collapse' : 'Expand'}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsExpandedAll(v => !v)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.expandToggleTrack, isExpandedAll && styles.expandToggleTrackOn]}>
                    <View style={[styles.expandToggleThumb, isExpandedAll && styles.expandToggleThumbOn]} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
            searchQuery={searchQuery}
            resolvedFilters={resolvedFilters}
            sortBy={sortBy}
            sortOrder={sortOrder}
            isTablet={isTablet}
            styles={parentStyles}
            currentTab="Shipped"
            user={user}
            statusValues={tabStatusValues[activeTab]}
          />
        </>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  flatListStyle: {
    flexGrow: 0,
    backgroundColor: colors.primary,
    borderBottomWidth: 0,
    borderBottomColor: colors.background,
  },
  tabsContainer: {
    paddingHorizontal: 16,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    marginTop: 5,
  },
  tabText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textWhite,
  },
  tabTextActive: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 0,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 0,
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    maxWidth: '100%',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    minWidth: 0,
  },
  sortButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexShrink: 0,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexShrink: 0,
  },
  expandToggleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    height: 48,
    flexShrink: 0,
  },
  expandToggleLabel: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  expandToggleTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  expandToggleTrackOn: {
    backgroundColor: colors.primary,
  },
  expandToggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    elevation: 2,
    alignSelf: 'flex-start',
  },
  expandToggleThumbOn: {
    alignSelf: 'flex-end',
  },
  compactFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    marginTop: 0,
  },
  compactFilterRowTablet: {
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  compactFilterLabel: {
    fontSize: fonts.sm,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    marginRight: 8,
    minWidth: 60,
  },
  compactChipsScroll: {
    flex: 1,
  },
  compactChipsContent: {
    alignItems: 'center',
    paddingRight: 8,
  },
  compactSelectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
  },
  compactSelectedChipText: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    color: colors.textWhite,
    marginRight: 4,
  },
  compactChipClose: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginRight: 6,
  },
  compactChipText: {
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },

  // new count styles
  countActiveContainer: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  countActiveText: {
    color: colors.textWhite,
    fontSize: fonts.xs,
    fontFamily: fonts.bold,
  },
  countInactiveContainer: {
    backgroundColor: colors.background,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  countInactiveText: {
    color: colors.primary,
    fontSize: fonts.xs,
    fontFamily: fonts.medium,
  },
  QuickButtonContainerWrapper: {
    paddingHorizontal: 16,
    marginTop: -8,
    marginBottom: 12,
  },
  QuickButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: colors.cardBackground || colors.background,
    padding: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.borderLight,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ActionButton: {
    flex: 1,
    backgroundColor: colors.primaryDark || colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  ActionButtonText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textWhite,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModalContent: {
    backgroundColor: colors.cardBackground || colors.background,
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  dropdownModalTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 15,
    textAlign: 'center',
  },
  dropdownModalItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 5,
    backgroundColor: colors.background,
    marginBottom: 10,
    borderBottomColor: colors.borderLight || colors.border,
    borderBottomWidth: 1,
  },
  dropdownModalItemText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});

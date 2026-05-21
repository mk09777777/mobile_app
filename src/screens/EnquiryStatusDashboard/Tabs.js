import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  FlatList,
  View,
  ScrollView,
} from 'react-native';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { SearchInput } from '../../components/common';
import Icon from '../../components/common/Icon';
import AllStatus from './All';
import CoralPending from './CoralPending';
import ApprovalPending from './ApprovalPending';
import CADPending from './CadPending';
import Quotation from './Quotation';
import OrderPlaced from './OrderPlaced';
import Shipped from './Shipped';
import { useAuth } from '../../context/AuthContext';
import { useGetStatusStatisticsQuery } from '../../store/api';

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
}) {
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase();
  const { data } = useGetStatusStatisticsQuery();
  console.log('📊 Status statistics:', data);

  const [selectedStatus, setSelectedStatus] = React.useState(null);
  const [selectedAssignTo, setSelectedAssignTo] = React.useState(null);
  const [coralCounts, setCoralCounts] = React.useState(0);
  const [approvalCounts, setApprovalCounts] = React.useState(0);
  const [orderCounts, setOrderCounts] = React.useState(0);
  const [productionCounts, setProductionCounts] = React.useState(0);
  const [shippedCounts, setShippedCounts] = React.useState(0);
  const [newEnquiryCounts, setNewEnquiryCounts] = React.useState(0);
  const [quotationCounts, setQuotationCounts] = React.useState(0);


  React.useEffect(() => {
    setSelectedAssignTo(null);
  }, [selectedStatus]);

  React.useEffect(() => {
    if (data?.statusStats?.length) {
      data.statusStats.forEach(item => {
        if (item.name === 'Coral') setCoralCounts(item.count);
        else if (item.name === 'Design Approval Pending')
          setApprovalCounts(item.count);
        else if (item.name === 'Order Placement') setOrderCounts(item.count);
        else if (item.name === 'Production') setProductionCounts(item.count);
        else if (item.name === 'Shipped') setShippedCounts(item.count);
        else if (item.name === 'Enquiry Created') setNewEnquiryCounts(item.count);
        else if (item.name === 'Quotation') setQuotationCounts(item.count);
      });
    }
  }, [data]);

  const tabs = React.useMemo(() => {
    if (userRole === 'admin') {
      return [
        { key: 'all', label: 'All' },
        { key: 'NewEnquiry', label: 'New Enquiries' },
        { key: 'CoralPending', label: 'Coral Pending' },
        // { key: 'CadPending', label: 'CAD Pending' },
        { key: 'Quotation', label: 'Quotation' },
        { key: 'ApprovalPending', label: 'Approval Pending' },
        { key: 'OrderPlaced', label: 'Order Placement' },
        { key: 'Production', label: 'Production' },
        { key: 'Shipped', label: 'Shipped' },
      ];
    } else if (userRole === 'coral') {
      return [{ key: 'CoralPending', label: 'Coral Pending' }];
    } else if (userRole === 'cad') {
      return [{ key: 'CadPending', label: 'CAD Pending' }];
    }
    return [];
  }, [userRole]);

  React.useEffect(() => {
    if (tabs.length === 1 && activeTab !== tabs[0].key) {
      onTabChange(tabs[0].key);
    }
  }, [tabs, activeTab, onTabChange]);

  const NewEnquiryData = React.useMemo(
    () => displayEnquiries.filter(
      enquiry => enquiry.CurrentStatus === 'Enquiry Created',
    ),
    [displayEnquiries],
  );



  const getCountForTab = React.useCallback((tabKey) => {
    switch (tabKey) {
      case 'all': return displayEnquiries.length;
      case 'NewEnquiry': return newEnquiryCounts;
      case 'CoralPending': return coralCounts;
      case 'Quotation': return quotationCounts;
      case 'ApprovalPending': return approvalCounts;
      case 'OrderPlaced': return orderCounts;
      case 'Production': return productionCounts;
      case 'Shipped': return shippedCounts;
      default: return 0;
    }
  }, [displayEnquiries.length, newEnquiryCounts, coralCounts, quotationCounts, approvalCounts, orderCounts, productionCounts, shippedCounts]);

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

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={tabs}
        renderItem={renderTab}
        keyExtractor={item => item.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
        style={styles.flatListStyle}
      />

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

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownloadPress}
              >
                <Icon name="download" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <AllStatus
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
            styles={parentStyles}
            currentTab="all"
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

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownloadPress}
              >
                <Icon name="download" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <AllStatus
            displayEnquiries={NewEnquiryData}
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
            styles={parentStyles}
            currentTab="NewEnquiry"
          />
        </>
      )}

      {activeTab === 'ApprovalPending' && (
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

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownloadPress}
              >
                <Icon name="download" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <ApprovalPending
            displayEnquiries={displayEnquiries.filter(e => e.CurrentStatus === 'Design Approval Pending')}
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
            styles={parentStyles}
            currentTab="ApprovalPending"
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

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownloadPress}
              >
                <Icon name="download" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <CoralPending
            displayEnquiries={displayEnquiries.filter(e => e.CurrentStatus === 'Coral')}
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
            styles={parentStyles}
            currentTab="CoralPending"
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

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownloadPress}
              >
                <Icon name="download" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <CADPending
            displayEnquiries={displayEnquiries.filter(e => e.CurrentStatus === 'CAD')}
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
            styles={parentStyles}
            currentTab="CadPending"
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

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownloadPress}
              >
                <Icon name="download" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <Quotation
            displayEnquiries={displayEnquiries.filter(e => e.CurrentStatus === 'Quotation')}
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
            styles={parentStyles}
            currentTab="Quotation"
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

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownloadPress}
              >
                <Icon name="download" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <OrderPlaced
            displayEnquiries={displayEnquiries.filter(e => e.CurrentStatus === 'Order Placement')}
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
            styles={parentStyles}
            currentTab="OrderPlaced"
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

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownloadPress}
              >
                <Icon name="download" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <AllStatus
            displayEnquiries={displayEnquiries.filter(e => e.CurrentStatus === 'Production')}
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
            styles={parentStyles}
            currentTab="Production"
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

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownloadPress}
              >
                <Icon name="download" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <Shipped
            displayEnquiries={displayEnquiries.filter(e => e.CurrentStatus === 'Shipped')}
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
            styles={parentStyles}
            currentTab="Shipped"
          />
        </>
      )}

      {/* Other tabs placeholder - removed as all tabs are now implemented */}
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
    gap: 12,
  },
  searchContainer: {
    flex: 1,
  },
  sortButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  downloadButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
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
});

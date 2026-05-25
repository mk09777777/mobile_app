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
import { useGetUsersQuery, useGetStatusesQuery } from '../../store/api';

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
}) {
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase();

  const [selectedStatus, setSelectedStatus] = React.useState(null);
  const [selectedAssignTo, setSelectedAssignTo] = React.useState(null);


  React.useEffect(() => {
    setSelectedAssignTo(null);
  }, [selectedStatus]);


  const { data: users } = useGetUsersQuery(undefined, { skip: !isAdmin });
  const { data: statusesFromApi = [] } = useGetStatusesQuery();

  const tabStatusValues = React.useMemo(() => {
    // Explicit expected status names for each tab — matches DB values
    const STATUS_MAP = {
      NewEnquiry: ['Enquiry Created'],
      CoralPending: ['Coral'],
      CadPending: ['CAD'],
      Quotation: ['Quotation'],
      ApprovalPending: ['Design Approval Pending'],
      OrderPlaced: ['Order Placement'],
      Production: ['Production'],
      Shipped: ['Shipped'],
    };

    if (!statusesFromApi.length) return STATUS_MAP;

    // Try to find matching status names from the API (preserves exact casing from DB)
    const map = {};
    for (const [tabKey, expectedNames] of Object.entries(STATUS_MAP)) {
      const found = statusesFromApi.find(s => {
        const name = (s.name || '').toLowerCase().trim();
        return expectedNames.some(e => e.toLowerCase() === name);
      });
      map[tabKey] = found ? [found.name] : expectedNames;
    }
    return map;
  }, [statusesFromApi]);

  const [activeEnquiryId, setActiveEnquiryId] = React.useState(null);
  const [showAssignDropdown, setShowAssignDropdown] = React.useState(false);
  const [assignDropDownUsers, setAssignDropDownUsers] = React.useState([]);
  const [activeEnquiryStatus, setActiveEnquiryStatus] = React.useState(null);

  const updateEnquiryStatusWrapper = async (updateData) => {
    if (!onUpdateEnquiry) {
      console.log('⚠️ onUpdateEnquiry is not available');
      return false;
    }
    
    const payload = {
      id: activeEnquiryId,
      ...updateData,
    };
    
    console.log('📦 Calling onUpdateEnquiry with payload:', payload);
    
    try {
      const result = await onUpdateEnquiry(payload);
      console.log('✅ onUpdateEnquiry result:', result);
      return result;
    } catch (error) {
      console.error('❌ onUpdateEnquiry error:', error);
      return false;
    }
  };

  const tabs = React.useMemo(() => {
    if (userRole === 'admin') {
      return [
        { key: 'all', label: 'All' },
        { key: 'NewEnquiry', label: 'New Enquiries' },
        { key: 'CoralPending', label: 'Coral Pending' },
        { key: 'CadPending', label: 'CAD Pending' },
        { key: 'Quotation', label: 'Quotation' },
        { key: 'ApprovalPending', label: 'Approval Pending' },
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
        { key: 'CadPending', label: 'CAD Pending' }
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

  const assignedToYouCount = React.useMemo(() => {
    const userId = String(user?.id || user?._id).trim();
    console.log('🔢 [Count] Calculating assignedToYouCount for userId:', userId);
    console.log('🔢 [Count] Total displayEnquiries:', displayEnquiries.length);
    
    const filtered = displayEnquiries.filter((enquiry, index) => {
      let assignedToId = enquiry.AssignedTo || enquiry.assignedTo || enquiry._originalData?.AssignedTo || enquiry._originalData?.assignedTo;
      
      // Log first 5 items
      if (index < 5) {
        console.log(`🔢 [Count] Enquiry ${index}:`, {
          id: enquiry.id || enquiry._id || enquiry.Id,
          name: enquiry.Name || enquiry.name,
          assignedToRaw: assignedToId,
          assignedToType: typeof assignedToId,
        });
      }
      
      if (assignedToId && typeof assignedToId === 'object') {
        assignedToId = assignedToId.id || assignedToId._id || assignedToId.toString();
      }
      
      const assignedToIdStr = String(assignedToId).trim();
      const matches = assignedToIdStr === userId;
      
      // Log first 5 comparisons
      if (index < 5) {
        console.log(`🔢 [Count] Enquiry ${index} comparison:`, {
          assignedToIdStr,
          userId,
          matches,
        });
      }
      
      return matches;
    });
    
    console.log('🔢 [Count] Filtered count:', filtered.length);
    console.log('🔢 [Count] Filtered enquiries:', filtered.map(e => ({
      id: e.id || e._id || e.Id,
      name: e.Name || e.name,
      assignedTo: e.AssignedTo || e.assignedTo,
    })));
    
    return filtered.length;
  }, [displayEnquiries, user]);
  const getCountForTab = React.useCallback((tabKey) => {
    switch (tabKey) {
      case 'all': return displayEnquiries.length;
      case 'NewEnquiry': return statusCounts?.newEnquiry || 0;
      case 'CoralPending': return statusCounts?.coral || 0;
      case 'CadPending': return statusCounts?.cad || 0;
      case 'Quotation': return statusCounts?.quotation || 0;
      case 'ApprovalPending': return statusCounts?.approval || 0;
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
    const { item, currentTab } = props;
    
    // Check all possible field variations for assigned user
    const raw = item._originalData || item;
    let assigned = item.AssignedTo || item.assignedTo || item.assigned_to || item.Assigned_To
      || raw.AssignedTo || raw.assignedTo || raw.assigned_to || raw.Assigned_To;
    
    // If assigned is an object, try to extract the ID
    if (assigned && typeof assigned === 'object') {
      assigned = assigned.id || assigned._id || assigned.userId || null;
    }
    
    // Convert to string and trim if it exists
    const assignedStr = assigned ? String(assigned).trim() : '';
    
    // More comprehensive check for unassigned status
    // Consider it unassigned if:
    // 1. No assigned value exists
    // 2. Assigned value is explicitly '-' or empty string
    // 3. Assigned string is empty after trimming
    // 4. Assigned value is 'null' or 'undefined' as string
    // 5. Assigned is a valid-looking ObjectId (24 hex chars) — treat as assigned
    const isUnassignedCheck = 
      !assignedStr || 
      assignedStr === '-' || 
      assignedStr === '' || 
      assignedStr === 'null' || 
      assignedStr === 'undefined';
    
    // Only show "Assign To" button in specific tabs where assignment is relevant
    const tabsWithAssignButton = ['all', 'NewEnquiry', 'CoralPending', 'CadPending'];
    const shouldShowAssignButton = isAdmin && isUnassignedCheck && tabsWithAssignButton.includes(currentTab);
    
    // Debug log to help identify issues
    if (__DEV__ && isAdmin && tabsWithAssignButton.includes(currentTab)) {
      console.log('🔍 Assignment check:', {
        id: item.Id || item._id || item.id,
        name: item.Name || item.name,
        assignedToRaw: item.AssignedTo || item.assignedTo,
        assignedToType: typeof (item.AssignedTo || item.assignedTo),
        assignedStr: assignedStr,
        isUnassigned: isUnassignedCheck,
        currentTab: currentTab,
        shouldShowButton: shouldShowAssignButton,
      });
    }
    
    return (
      <View style={{ paddingBottom: shouldShowAssignButton ? 10 : 0 }}>
        {renderEnquiryItem(props)}
        {shouldShowAssignButton && (
          <View style={styles.QuickButtonContainerWrapper}>
            <View style={styles.QuickButtonContainer}>
              <TouchableOpacity
                style={styles.ActionButton}
                onPress={() => {
                  const statusStr = item.CurrentStatus || item.Status || item.status || '';
                  const statusLower = statusStr.toLowerCase();
                  
                  let targetRoleId = null;
                  if (statusLower.includes('coral')) targetRoleId = 2;
                  else if (statusLower.includes('cad')) targetRoleId = 3;
                  
                  let usersToList = [];
                  if (targetRoleId && users && users.length > 0) {
                    usersToList = users.filter(u => u.role === targetRoleId);
                  } else if (users && users.length > 0) {
                    usersToList = users;
                  }
                  
                  if (usersToList.length > 0) {
                    setAssignDropDownUsers(usersToList.map(u => ({
                      id: u.id,
                      name: u.name || u.Name || u.username || u.email,
                    })));
                    setActiveEnquiryId(item.Id || item._id || item.id);
                    setActiveEnquiryStatus(statusStr);
                    setShowAssignDropdown(true);
                  } else {
                    console.log('No users available for assignment');
                  }
                }}
              >
                <Icon name="person-add" size={16} color={colors.textWhite} />
                <Text style={styles.ActionButtonText}>Assign To</Text>
                <Icon name="arrow-drop-down" size={16} color={colors.textWhite} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
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

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownloadPress}
              >
                <Icon name="download" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
            isTablet={isTablet}
            styles={parentStyles}
            currentTab="AssignedToYou"
            user={user}
            statusValues={tabStatusValues[activeTab]}
            displayEnquiries={displayEnquiries}
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

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownloadPress}
              >
                <Icon name="download" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
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

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownloadPress}
              >
                <Icon name="download" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
            isTablet={isTablet}
            styles={parentStyles}
            currentTab="NewEnquiry"
            user={user}
            statusValues={tabStatusValues[activeTab]}
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

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
            isTablet={isTablet}
            styles={parentStyles}
            currentTab="ApprovalPending"
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

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownloadPress}
              >
                <Icon name="download" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
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

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownloadPress}
              >
                <Icon name="download" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
            isTablet={isTablet}
            styles={parentStyles}
            currentTab="CadPending"
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

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownloadPress}
              >
                <Icon name="download" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
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

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownloadPress}
              >
                <Icon name="download" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
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

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownloadPress}
              >
                <Icon name="download" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
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

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownloadPress}
              >
                <Icon name="download" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <AllStatus
            flatListRef={flatListRef}
            renderEnquiryItem={renderItemWithActions}
            renderEmpty={renderEmpty}
            isTablet={isTablet}
            styles={parentStyles}
            currentTab="Shipped"
            user={user}
            statusValues={tabStatusValues[activeTab]}
          />
        </>
      )}

      <Modal
        visible={showAssignDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAssignDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAssignDropdown(false)}
        >
          <View style={styles.dropdownModalContent}>
            <Text style={styles.dropdownModalTitle}>Assign To</Text>
            {(assignDropDownUsers || []).map(u => (
              <TouchableOpacity
                key={u.id || u.name}
                style={styles.dropdownModalItem}
                onPress={async () => {
                  try {
                    if (u.id && activeEnquiryId) {
                      console.log('🔄 Assigning enquiry:', {
                        enquiryId: activeEnquiryId,
                        userId: u.id,
                        userName: u.name,
                        status: activeEnquiryStatus,
                      });

                      const success = await updateEnquiryStatusWrapper({
                        assignedTo: u.id,
                        status: activeEnquiryStatus,
                      });

                      if (success) {
                        console.log('✅ Enquiry assigned successfully');
                        setShowAssignDropdown(false);
                        setActiveEnquiryId(null);
                        setActiveEnquiryStatus(null);
                        setAssignDropDownUsers([]);
                        
                        // Trigger refresh to update the list
                        if (onRefresh) {
                          onRefresh();
                        }
                      } else {
                        console.log('❌ Failed to assign enquiry');
                      }
                    } else {
                      console.log('⚠️ Missing required data for assignment');
                      setShowAssignDropdown(false);
                    }
                  } catch (error) {
                    console.error('❌ Error assigning enquiry:', error);
                    setShowAssignDropdown(false);
                  }
                }}
              >
                <Text style={styles.dropdownModalItemText}>{u.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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

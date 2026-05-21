import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Text,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import {
  useGetDashboardDataQuery,
  useGetEnquiriesQuery,
  useGetStatusStatisticsQuery,
  useGetNotificationsQuery,
} from '../../store/api';
import { useClients } from '../../features/clients/clientsHooks';
import { useStatuses } from '../../features/statuses/statusesHooks';
import {
  StatusCard,
  Card,
  EnquiryStatusCard,
} from '../../components/cards/Cards';
import { Button, SearchInput, OptimizedImage } from '../../components/common';
import { AnimatedLogoLoader } from '../../components/common';
import TopNavbar from '../../components/common/TopNavbar';
import Icon from '../../components/common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import {
  formatCurrency,
  getRoleDisplayName,
  spacing,
  responsivePadding,
  imageSizes,
} from '../../utils';
import useDeviceLayout from '../../hooks/useDeviceLayout';
import { FILE_BASE_URL } from '../../config/apiConfig';
import { navigateFromNotification } from '../../utils/notificationNavigation';

// Client Card Component with Image Support
const ClientCardWithImage = ({ client, imageUrl, onPress }) => {
  const [imageError, setImageError] = useState(false);
  const [actualImageUrl, setActualImageUrl] = useState(null);
  const [imageHeaders, setImageHeaders] = useState({});
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  // Load auth token for image headers
  useEffect(() => {
    const loadAuthToken = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          setImageHeaders({
            Authorization: `Bearer ${token}`,
          });
        }
      } catch (error) {}
    };
    loadAuthToken();
  }, []);

  // Extract actual image URL from Google redirect URLs
  useEffect(() => {
    if (!imageUrl) {
      setActualImageUrl(null);
      setIsLoadingImage(false);
      setImageError(false);
      return;
    }

    // Reset error state when URL changes
    setImageError(false);
    setIsLoadingImage(true);

    const processImageUrl = async () => {
      try {
        let urlToUse = imageUrl;

        // Check if it's a Google redirect URL
        if (imageUrl.includes('google.com/url') && imageUrl.includes('url=')) {
          const urlMatch = imageUrl.match(/url=([^&]+)/);
          if (urlMatch) {
            urlToUse = decodeURIComponent(urlMatch[1]);
          }
        }

        // Check if the URL is actually an image (has image extension)
        const isImageUrl =
          /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(urlToUse) ||
          urlToUse.includes('amazonaws.com') ||
          urlToUse.includes('s3.') ||
          urlToUse.includes('cloudinary.com') ||
          urlToUse.includes('imgur.com');

        // Check if URL is an HTML page (not an image)
        const isHtmlPage =
          /\.(html|htm)(\?|$)/i.test(urlToUse) ||
          urlToUse.includes('.html') ||
          urlToUse.includes('.htm');

        // If it's an HTML page, don't try to load it as an image
        if (isHtmlPage && !isImageUrl) {
          setActualImageUrl(null);
          setIsLoadingImage(false);
          return;
        }

        // Check if URL is an API endpoint (needs auth)
        const isApiEndpoint =
          urlToUse.includes(FILE_BASE_URL) || urlToUse.includes('/api/');

        if (isApiEndpoint) {
          // Try to fetch and check if it returns JSON with image URL
          try {
            const token = await AsyncStorage.getItem('token');
            const response = await fetch(urlToUse, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            if (response.ok) {
              const contentType = response.headers.get('content-type') || '';

              // Check if response is JSON (API returns a URL object)
              if (contentType.includes('application/json')) {
                const jsonData = await response.json();
                const imageUrlFromJson =
                  jsonData.url ||
                  jsonData.imageUrl ||
                  jsonData.src ||
                  jsonData.location;
                if (imageUrlFromJson) {
                  setActualImageUrl(imageUrlFromJson);
                  setIsLoadingImage(false);
                  return;
                }
              } else if (contentType.startsWith('image/')) {
                // Direct image response from API
                setActualImageUrl(urlToUse);
                setIsLoadingImage(false);
                return;
              } else if (contentType.includes('text/html')) {
                // API returned HTML, not an image

                setActualImageUrl(null);
                setIsLoadingImage(false);
                return;
              }
            }
          } catch (fetchError) {}
        }

        // Use URL directly only if it looks like an image URL
        if (isImageUrl || isApiEndpoint) {
          setActualImageUrl(urlToUse);
        } else {
          // Not a recognized image URL, show placeholder

          setActualImageUrl(null);
        }
        setIsLoadingImage(false);
      } catch (error) {
        setActualImageUrl(null);
        setIsLoadingImage(false);
      }
    };

    processImageUrl();
  }, [imageUrl]);

  return (
    <TouchableOpacity style={styles.clientCard} onPress={onPress}>
      {actualImageUrl && !imageError ? (
        <OptimizedImage
          source={{
            uri: actualImageUrl,
            headers: imageHeaders,
          }}
          style={styles.clientImage}
          resizeMode="contain"
          showLoader={false}
          cacheEnabled={true}
          onError={error => {
            if (__DEV__) {
              console.error('❌ Client image failed to load:', {
                url: actualImageUrl,
                error: error.nativeEvent?.error || error,
              });
            }
            setImageError(true);
          }}
          onLoad={() => {
            setIsLoadingImage(false);
          }}
        />
      ) : (
        <View style={styles.clientImagePlaceholder}>
          {isLoadingImage ? (
            <AnimatedLogoLoader size={20} />
          ) : (
            <Text style={styles.clientNamePlaceholder} numberOfLines={2}>
              {client.name || 'Client'}
            </Text>
          )}
        </View>
      )}
      <Text style={styles.clientCount}>{client.enquiryCount || 0}</Text>
    </TouchableOpacity>
  );
};

const DashboardScreen = ({ navigation }) => {
  // TEMPORARY TEST - Remove after testing Error Boundary
  // Uncomment the line below to test Error Boundary:
  // throw new Error('Testing Error Boundary - This is intentional!');

  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Redux hooks for data fetching
  // Pass role, userId, and clientId (for role 4 users) to get user-specific counts
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    refetch: refetchDashboard,
  } = useGetDashboardDataQuery(
    {
      role: user?.role || 'client',
      userId: user?.id || user?._id || user?.userId,
      clientId: user?.clientId, // Pass ClientId from token for role 4 users
      roleNumber: user?.roleNumber || user?.roleId, // Pass role number to identify role 4
    },
    {
      skip: !user,
    },
  );

  const {
    clients: clientsData = [],
    isLoading: clientsLoading,
    refetch: refetchClients,
  } = useClients({
    skip: !user || user?.role !== 'admin',
  });

  const { data: enquiriesResponse, isLoading: enquiriesLoading } =
    useGetEnquiriesQuery(user?.role || 'admin', {
      skip: !user || user?.role !== 'admin',
    });

  // Fetch status statistics for all status cards
  const {
    data: statusStatisticsData,
    isLoading: statusStatisticsLoading,
    refetch: refetchStatusStatistics,
  } = useGetStatusStatisticsQuery(undefined, {
    skip: !user || user?.role !== 'admin',
  });

  // Fetch recent notifications (top 5)
  const {
    data: notificationsData = [],
    isLoading: notificationsLoading,
    refetch: refetchNotifications,
  } = useGetNotificationsQuery(
    { limit: 5 },
    {
      skip: !user,
      refetchOnFocus: true,
    },
  );

  // Extract enquiries array from response (new API returns { data, pagination })
  const enquiriesData = enquiriesResponse?.data || [];

  // Extract status statistics array from aggregate endpoint
  const statusStatsRaw = statusStatisticsData?.statusStats || [];

  // Get statuses from API to map counts
  const { statuses } = useStatuses();

  // Map aggregate counts to status list from API
  // Create a map of status name (lowercase) to count from aggregate endpoint
  const statusCountMap = useMemo(() => {
    const map = new Map();
    statusStatsRaw.forEach(item => {
      const statusName = (
        item.name ||
        item.status ||
        item.Status ||
        ''
      ).toLowerCase();
      const count = item.count || item.Count || item.value || 0;
      if (statusName) {
        map.set(statusName, count);
      }
    });
    return map;
  }, [statusStatsRaw]);

  // Map counts to status list from API
  const statusStats = useMemo(() => {
    if (!statuses || statuses.length === 0) {
      // If statuses not loaded yet, return raw stats
      return statusStatsRaw;
    }

    // Create a map for quick lookup of status names (case-insensitive)
    const statusNameMap = new Map();
    statuses.forEach(status => {
      const name = (status.name || status.Name || '').toLowerCase();
      if (name) {
        statusNameMap.set(name, status);
      }
    });

    // Map each status from API to its count from aggregate endpoint
    return statuses
      .map(status => {
        const statusName = (status.name || status.Name || '').toLowerCase();
        const count = statusCountMap.get(statusName) || 0;

        return {
          name: status.name || status.Name,
          count: count,
        };
      })
      .filter(item => item.name); // Filter out any items without a name
  }, [statuses, statusCountMap, statusStatsRaw]);

  // Compute clients with enquiry counts using aggregate data
  const clients = useMemo(() => {
    if (user?.role !== 'admin' || !clientsData || clientsData.length === 0) {
      return [];
    }

    // Use client aggregate data from dashboard if available (more accurate)
    const clientAggregateData = dashboardData?.clientAggregateData;

    // Create a map of client ID to enquiry count from aggregate data
    const clientCountMap = new Map();
    if (Array.isArray(clientAggregateData)) {
      clientAggregateData.forEach(item => {
        // Aggregate API returns client ID in 'name' field
        const clientId = item.name || item.id || item._id;
        const count = item.count || 0;
        if (clientId) {
          // Store with multiple key formats for matching
          clientCountMap.set(String(clientId), count);
          clientCountMap.set(clientId, count);
        }
      });
    }

    // Map clients with their enquiry counts
    return clientsData.map(client => {
      // Try to find count from aggregate data first (most accurate)
      const clientId = client.id || client._id;
      let enquiryCount = 0;

      if (clientCountMap.size > 0 && clientId) {
        // Try multiple ID formats to match client ID from aggregate
        enquiryCount =
          clientCountMap.get(String(clientId)) ||
          clientCountMap.get(clientId) ||
          clientCountMap.get(String(client._id)) ||
          clientCountMap.get(client._id) ||
          0;

        if (__DEV__ && enquiryCount === 0) {
          console.log(
            '⚠️ [DASHBOARD] No count found for client:',
            client.name,
            'ID:',
            clientId,
            'Available IDs in map:',
            Array.from(clientCountMap.keys()).slice(0, 5),
          );
        }
      } else {
        // Fallback to counting from enquiries data if aggregate not available
        if (
          enquiriesData &&
          Array.isArray(enquiriesData) &&
          enquiriesData.length > 0
        ) {
          enquiryCount = enquiriesData.filter(enquiry => {
            const enquiryClientId = enquiry.clientId || enquiry.ClientId;
            return (
              enquiryClientId === clientId ||
              enquiryClientId === client._id ||
              enquiry.clientName === client.name
            );
          }).length;
        }
      }

      return {
        ...client,
        enquiryCount: enquiryCount,
      };
    });
  }, [
    clientsData,
    dashboardData?.clientAggregateData,
    enquiriesData,
    user?.role,
  ]);

  const loading =
    dashboardLoading ||
    clientsLoading ||
    enquiriesLoading ||
    statusStatisticsLoading ||
    notificationsLoading;
  const { isTablet, width } = useDeviceLayout();

  // Calculate dynamic max width for tablets (use 94% of screen width with reasonable padding)
  const tabletMaxWidth = isTablet ? Math.min(width * 0.94, width - 48) : null;

  const statsGridStyle = isTablet
    ? [
        styles.statsGrid,
        styles.statsGridTablet,
        tabletMaxWidth && { maxWidth: tabletMaxWidth },
      ]
    : styles.statsGrid;
  const tabletStatusCardStyle = isTablet ? styles.statusCardTablet : null;
  const quickActionsCardStyle = isTablet
    ? [
        styles.quickActionsCard,
        styles.quickActionsCardTablet,
        tabletMaxWidth && { maxWidth: tabletMaxWidth },
      ]
    : styles.quickActionsCard;
  const actionsGridStyle = isTablet
    ? [styles.actionsGrid, styles.actionsGridTablet]
    : styles.actionsGrid;
  const actionButtonStyle = isTablet
    ? [styles.actionButton, styles.actionButtonTablet]
    : styles.actionButton;
  const actionIconSize = isTablet ? 18 : 22;
  const actionTextStyle = isTablet
    ? [styles.actionText, styles.actionTextTablet]
    : styles.actionText;
  const statusCardIconSize = isTablet ? 16 : 20;

  const navigateWithDashboardFilter = useCallback(
    (params = {}) => {
      navigation.navigate('Enquiries', {
        ...params,
        filterSource: 'dashboard',
        filterAppliedAt: Date.now(),
      });
    },
    [navigation],
  );

  // Safety check - don't render if user is not loaded (must be after all hooks)
  if (!user) {
    return <AnimatedLogoLoader size={60} />;
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchDashboard(),
      user?.role === 'admin' && refetchClients(),
      user?.role === 'admin' && refetchStatusStatistics(),
      refetchNotifications(),
    ]);
    setRefreshing(false);
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  };

  const renderAdminDashboard = () => (
    <View style={styles.dashboardContent}>
      <View style={styles.NewEnquiryPricingButtonContainer}>
        <TouchableOpacity
          style={styles.NewEnquiryButton}
          onPress={() => navigation.navigate('AddEnquiryStep1')}
        >
          <Icon name="add-circle" size={20} color={colors.textWhite} />
          <Text style={styles.NewEnquiryText}>Create New Enquiry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.NewEnquiryButton}
          onPress={() => navigation.navigate('PricingCalci')}
        >
          <Icon name="attach-money" size={20} color={colors.textWhite} />
          <Text style={styles.NewEnquiryText}>Pricing Calculator</Text>
        </TouchableOpacity>
      </View>
      {/* Enquiries By Status Section */}
      {/* <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Status </Text>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.statusScroll}
          contentContainerStyle={styles.statusScrollContent}
        >
           {statusStats.length > 0 ? (
            statusStats
              .filter((item) => {
                const statusName = (item.name || item.status || item.Status || '').toLowerCase();
                // Filter out statuses containing "progress" or "in_progress"
                return !statusName.includes('progress') && !statusName.includes('in_progress');
              })
              .map((item) => {
              const statusName = item.name || item.status || item.Status || '';
              const count = item.count || item.Count || item.value || 0;
              
              // Get status color based on status name
              const getStatusColor = (name) => {
                const upperName = name.toUpperCase();
                if (upperName.includes('CORAL')) return colors.primary;
                if (upperName.includes('CAD')) return colors.info || '#3B82F6';
                if (upperName.includes('APPROVAL') && !upperName.includes('APPROVED')) return '#EF4444';
                if (upperName.includes('APPROVED') || upperName.includes('COMPLETED')) return '#14B8A6';
                if (upperName.includes('ORDER') || upperName.includes('PLACEMENT')) return colors.accent || '#8B5CF6';
                if (upperName.includes('CAM')) return colors.secondary || '#6B7280';
                if (upperName.includes('PRODUCTION')) return colors.error || '#EF4444';
                if (upperName.includes('PENDING') || upperName.includes('CREATED')) return '#F97316';
                return '#D4A574';
              };
              
              // Get status display name
              const getStatusDisplayName = (name) => {
                const statusMap = {
                  'ENQUIRY CREATED': 'Enquiry Created',
                  'CORAL': 'Coral',
                  'CAD': 'CAD',
                  'DESIGN APPROVAL PENDING': 'Design Approval Pending',
                  'APPROVED CAD': 'Approved Cad',
                  'ORDER PLACEMENT': 'Order Placement',
                  'CAM PENDING': 'CAM Pending',
                  'PRODUCTION': 'Production',
                  'COMPLETED': 'Completed',
                  'REJECTED': 'Rejected',
                };
                const upperName = name.toUpperCase();
                return statusMap[upperName] || name;
              };
              
              const statusColor = getStatusColor(statusName);
              const displayName = getStatusDisplayName(statusName);
              
              return (
                <EnquiryStatusCard
                  key={statusName}
                  status={displayName}
                  value={count}
                  color={statusColor}
                  borderColor={statusColor}
                  style={styles.enquiryStatusItem}
                  onPress={() => navigateWithDashboardFilter({ filter: statusName.toLowerCase() })}
                />
              );
            })
          ) : (
            // Fallback to main status cards if status stats not available
            <>
          <EnquiryStatusCard
            status="All"
            value={dashboardData?.totalEnquiries || dashboardData?.categorizedCounts?.['All'] || '0'}
            color="#D4A574"
            borderColor="#D4A574"
            style={styles.enquiryStatusItem}
            onPress={() => navigation.navigate('Enquiries')}
          />
          <EnquiryStatusCard
            status="Pending"
            value={dashboardData?.pendingEnquiries || dashboardData?.categorizedCounts?.['Pending'] || '0'}
            color="#F97316"
            borderColor="#F97316"
            style={styles.enquiryStatusItem}
            onPress={() => navigateWithDashboardFilter({ filter: 'pending' })}
          />
          <EnquiryStatusCard
            status="Approval Pending"
            value={dashboardData?.approvalPendingEnquiries || dashboardData?.categorizedCounts?.['Approval Pending'] || '0'}
            color="#EF4444"
            borderColor="#EF4444"
            style={styles.enquiryStatusItem}
            onPress={() => navigateWithDashboardFilter({ filter: 'approval_pending' })}
          />
          <EnquiryStatusCard
            status="Completed"
            value={dashboardData?.completedEnquiries || dashboardData?.categorizedCounts?.['Completed'] || '0'}
            color="#14B8A6"
            borderColor="#14B8A6"
            style={styles.enquiryStatusItem}
            onPress={() => navigateWithDashboardFilter({ filter: 'completed' })}
          />
            </>
          )} 
        </ScrollView>
      </View> */}

      {/* Clients Section */}
      {/* {clients.length > 0 && (
        <View style={styles.clientsSection}>
          <View style={styles.clientsHeaderContainer}>
            <Text style={styles.clientsHeader}>Clients</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ClientsList')}>
              <Text style={styles.viewAllText}>View all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.clientsScroll}
            contentContainerStyle={styles.clientsScrollContent}
          >
            {clients.map(client => {
              // Construct image URL
              const getClientImageUrl = () => {
                if (!client.imageUrl) return null;
                
                // If it's already a full URL, use it directly
                if (client.imageUrl.startsWith('http://') || client.imageUrl.startsWith('https://')) {
                  // Check if it's a Google redirect URL - ClientCardWithImage will handle it
                  return client.imageUrl;
                }
                
                // If it starts with /, it's a path - construct full URL
                if (client.imageUrl.startsWith('/')) {
                  return `${FILE_BASE_URL}${client.imageUrl}`;
                }
                
                // Otherwise, treat as file key and construct URL
                return `${FILE_BASE_URL}/api/clients/files/${encodeURIComponent(client.imageUrl)}`;
              };
              
              const imageUrl = getClientImageUrl();
              
              return (
                <ClientCardWithImage
                  key={client.id}
                  client={client}
                  imageUrl={imageUrl}
                  onPress={() => {
                    // Pre-select these 5 statuses when client card is pressed
                    // Use exact status names as they appear in the API
                    const preSelectedStatuses = [
                      'Enquiry Created',
                      'Coral',
                      'CAD',
                      'Approved Cad',
                      'Quotation'
                    ];
                    
                    navigateWithDashboardFilter({ 
                      filterType: 'client', 
                      filter: client.name,
                      clientId: client.id || client._id,
                      statuses: preSelectedStatuses, // Pass pre-selected statuses array
                      selectedStatuses: preSelectedStatuses, // Alternative format for compatibility
                    });
                  }}
                />
              );
            })}
          </ScrollView>
        </View>
      )} */}

      {/* Overview Section - Only show on mobile, hidden on tablets */}
      {!isTablet && (
        <>
          <View style={styles.overviewSection}>
            <Text style={styles.overviewTitle}> Overview</Text>
          </View>

          {/* Other Stats */}
          <View style={statsGridStyle}>
            <StatusCard
              title="Total Enquiries"
              value={dashboardData?.totalEnquiries || '0'}
              icon={
                <Icon
                  name="assignment"
                  size={statusCardIconSize}
                  color={colors.textWhite}
                />
              }
              color={colors.primary}
              onPress={() => navigation.navigate('Enquiries')}
              style={tabletStatusCardStyle}
            />
            <StatusCard
              title="Total Clients"
              value={dashboardData?.totalClients || '0'}
              icon={
                <Icon
                  name="people"
                  size={statusCardIconSize}
                  color={colors.textWhite}
                />
              }
              color={colors.primary}
              onPress={() => navigation.navigate('ClientsList')}
              style={tabletStatusCardStyle}
            />
          </View>
        </>
      )}
    </View>
  );

  const renderClientDashboard = () => (
    <View style={statsGridStyle}>
      <StatusCard
        title="My Enquiries"
        value={
          dashboardData?.myEnquiries ??
          dashboardData?.categorizedCounts?.['All'] ??
          0
        }
        icon={
          <Icon
            name="assignment"
            size={statusCardIconSize}
            color={colors.textWhite}
          />
        }
        color={colors.primary}
        valueColor={colors.primary}
        onPress={() => navigation.navigate('Enquiries')}
        style={tabletStatusCardStyle}
      />
      <StatusCard
        title="In-progress"
        value={
          dashboardData?.pendingApprovals ??
          dashboardData?.categorizedCounts?.['Pending'] ??
          0
        }
        icon={
          <Icon
            name="schedule"
            size={statusCardIconSize}
            color={colors.textWhite}
          />
        }
        color={colors.primary}
        valueColor={colors.primary}
        onPress={() => navigateWithDashboardFilter({ filter: 'pending' })}
        style={tabletStatusCardStyle}
      />
      <StatusCard
        title="Approval Pending"
        value={
          dashboardData?.approvalPending ??
          dashboardData?.categorizedCounts?.['Approval Pending'] ??
          0
        }
        icon={
          <Icon
            name="pending-actions"
            size={statusCardIconSize}
            color={colors.textWhite}
          />
        }
        color={colors.primary}
        valueColor={colors.primary}
        onPress={() =>
          navigateWithDashboardFilter({ filter: 'approval_pending' })
        }
        style={tabletStatusCardStyle}
      />
      <StatusCard
        title="Completed Orders"
        value={
          dashboardData?.completedOrders ??
          dashboardData?.categorizedCounts?.['Completed'] ??
          0
        }
        icon={
          <Icon
            name="check-circle"
            size={statusCardIconSize}
            color={colors.textWhite}
          />
        }
        color={colors.primary}
        valueColor={colors.primary}
        onPress={() => navigateWithDashboardFilter({ filter: 'completed' })}
        style={tabletStatusCardStyle}
      />
    </View>
  );

  const renderDesignerDashboard = role => {
    // For CAD role, show specific 4 cards
    if (role === 'cad') {
      // Get counts from dashboard data or specific status counts
      const totalCount =
        dashboardData?.assignedEnquiries ||
        dashboardData?.categorizedCounts?.['All'] ||
        dashboardData?.specificStatusCounts?.['All'] ||
        '0';

      // Get CAD count - check multiple sources
      // The API returns pendingDesigns for CAD role, which contains the CAD status count
      const cadFromStatusStats =
        statusStats.find(s => {
          const name = (s.name || s.status || s.Status || '').toLowerCase();
          return name === 'cad';
        })?.count || 0;

      // Check all case variations: CAD, Cad, cad
      // Also check pendingDesigns which is set by API for CAD role
      const cadFromPendingDesigns = dashboardData?.pendingDesigns;
      const cadFromSpecific =
        dashboardData?.specificStatusCounts?.['CAD'] ||
        dashboardData?.specificStatusCounts?.['Cad'] ||
        dashboardData?.specificStatusCounts?.['cad'] ||
        dashboardData?.statusCounts?.['cad'] ||
        dashboardData?.statusCounts?.['CAD'];

      const cadFromCategorized =
        dashboardData?.categorizedCounts?.['CAD'] ||
        dashboardData?.categorizedCounts?.['Cad'] ||
        dashboardData?.categorizedCounts?.['cad'];

      // Priority: pendingDesigns (from API) > specificStatusCounts > categorizedCounts > statusStats
      const cadCount =
        cadFromPendingDesigns ||
        cadFromSpecific ||
        cadFromCategorized ||
        cadFromStatusStats ||
        '0';

      if (__DEV__) {
        console.log('🔍 [CAD CARD DEBUG] CAD Count Calculation:', {
          cadFromPendingDesigns,
          cadFromSpecific,
          cadFromCategorized,
          cadFromStatusStats,
          finalCadCount: cadCount,
          pendingDesigns: dashboardData?.pendingDesigns,
          specificStatusCounts: dashboardData?.specificStatusCounts,
          categorizedCounts: dashboardData?.categorizedCounts,
          statusStatsLength: statusStats?.length,
        });
      }

      // Get Approved Cad count - check statusStats array as fallback
      const approvedCadFromStatusStats =
        statusStats.find(s => {
          const name = (s.name || s.status || s.Status || '').toLowerCase();
          return name === 'approved cad' || name === 'approvedcad';
        })?.count || 0;
      const approvedCadCount =
        dashboardData?.specificStatusCounts?.['Approved Cad'] ||
        dashboardData?.specificStatusCounts?.['ApprovedCad'] ||
        dashboardData?.categorizedCounts?.['Approved Cad'] ||
        dashboardData?.categorizedCounts?.['ApprovedCad'] ||
        approvedCadFromStatusStats ||
        '0';

      // Get Design Approval Pending count - check statusStats array as fallback
      const designApprovalPendingFromStatusStats =
        statusStats.find(s => {
          const name = (s.name || s.status || s.Status || '').toLowerCase();
          return name === 'design approval pending';
        })?.count || 0;
      const designApprovalPendingCount =
        dashboardData?.approvalPendingDesigns ||
        dashboardData?.specificStatusCounts?.['Design Approval Pending'] ||
        dashboardData?.categorizedCounts?.['Approval Pending'] ||
        dashboardData?.categorizedCounts?.['Design Approval Pending'] ||
        designApprovalPendingFromStatusStats ||
        '0';

      return (
        <View style={statsGridStyle}>
          <StatusCard
            title="Total"
            value={totalCount}
            icon={
              <Icon
                name="work"
                size={statusCardIconSize}
                color={colors.textWhite}
              />
            }
            color={colors.primary}
            onPress={() => navigation.navigate('Enquiries')}
            style={tabletStatusCardStyle}
          />
          <StatusCard
            title="Cad"
            value={cadCount}
            icon={
              <Icon
                name="pending"
                size={statusCardIconSize}
                color={colors.textWhite}
              />
            }
            color={colors.primaryDark}
            onPress={() => navigateWithDashboardFilter({ filter: 'cad' })}
            style={tabletStatusCardStyle}
          />
          <StatusCard
            title="Approved Cad"
            value={approvedCadCount}
            icon={
              <Icon
                name="check-circle"
                size={statusCardIconSize}
                color={colors.textWhite}
              />
            }
            color={colors.primaryLight}
            onPress={() =>
              navigateWithDashboardFilter({ filter: 'approved cad' })
            }
            style={tabletStatusCardStyle}
          />
          <StatusCard
            title="Design Approval Pending"
            value={designApprovalPendingCount}
            icon={
              <Icon
                name="pending-actions"
                size={statusCardIconSize}
                color={colors.textWhite}
              />
            }
            color={colors.primary}
            onPress={() =>
              navigateWithDashboardFilter({ filter: 'design approval pending' })
            }
            style={tabletStatusCardStyle}
          />
        </View>
      );
    }

    // For Coral role, keep existing cards
    // Get counts with statusStats fallback
    const coralFromStatusStats =
      statusStats.find(s => {
        const name = (s.name || s.status || s.Status || '').toLowerCase();
        return name === 'coral';
      })?.count || 0;
    const pendingDesignsFromStatusStats =
      statusStats.find(s => {
        const name = (s.name || s.status || s.Status || '').toLowerCase();
        return name === 'coral';
      })?.count || 0;
    const approvalPendingFromStatusStats =
      statusStats.find(s => {
        const name = (s.name || s.status || s.Status || '').toLowerCase();
        return name === 'design approval pending';
      })?.count || 0;

    // ========== PENDING DESIGNS COUNT LOGGING ==========
    const pendingDesignsValue1 = dashboardData?.pendingDesigns;
    const pendingDesignsValue2 = dashboardData?.categorizedCounts?.['Pending'];
    const pendingDesignsValue3 = pendingDesignsFromStatusStats;
    // For Coral role: "Pending Designs" = Coral count ONLY (not "Pending" category)
    // Priority: dashboardData.pendingDesigns (from API, role-specific) > statusStats > default 0
    const finalPendingDesignsValue =
      pendingDesignsValue1 || pendingDesignsValue3 || 0;

    console.log(
      '📊 [DASHBOARD] ========== CORAL PENDING DESIGNS COUNT ==========',
    );
    console.log('📊 [DASHBOARD] User Role: coral');
    console.log(
      '📊 [DASHBOARD] dashboardData?.pendingDesigns (Coral count from API):',
      pendingDesignsValue1,
    );
    console.log(
      '📊 [DASHBOARD] pendingDesignsFromStatusStats (Coral fallback):',
      pendingDesignsFromStatusStats,
    );
    console.log(
      '📊 [DASHBOARD] Final Coral count displayed:',
      finalPendingDesignsValue,
    );
    console.log(
      '📊 [DASHBOARD] ===================================================',
    );

    return (
      <View style={statsGridStyle}>
        <StatusCard
          title="Assigned Enquiries"
          value={
            dashboardData?.assignedEnquiries ||
            dashboardData?.categorizedCounts?.['All'] ||
            '0'
          }
          icon={
            <Icon
              name="work"
              size={statusCardIconSize}
              color={colors.textWhite}
            />
          }
          color={colors.primary}
          onPress={() => navigation.navigate('Enquiries')}
          style={tabletStatusCardStyle}
        />
        <StatusCard
          title="Pending Designs"
          value={finalPendingDesignsValue}
          icon={
            <Icon
              name="pending"
              size={statusCardIconSize}
              color={colors.textWhite}
            />
          }
          color={colors.primaryDark}
          onPress={() => {
            console.log(
              '🎯 [DASHBOARD] "Pending Designs" tile pressed (Coral role)',
            );
            console.log(
              '🎯 [DASHBOARD] Coral count displayed:',
              finalPendingDesignsValue,
            );
            console.log(
              '🎯 [DASHBOARD] Filter being applied: "coral" → shows Coral status enquiries',
            );
            navigateWithDashboardFilter({ filter: 'coral' });
          }}
          style={tabletStatusCardStyle}
        />
        <StatusCard
          title="Approval Pending"
          value={
            dashboardData?.approvalPendingDesigns ||
            dashboardData?.categorizedCounts?.['Approval Pending'] ||
            dashboardData?.categorizedCounts?.['Design Approval Pending'] ||
            approvalPendingFromStatusStats ||
            '0'
          }
          icon={
            <Icon
              name="pending-actions"
              size={statusCardIconSize}
              color={colors.textWhite}
            />
          }
          color={colors.primaryLight}
          onPress={() =>
            navigateWithDashboardFilter({ filter: 'design approval pending' })
          }
          style={tabletStatusCardStyle}
        />
        <StatusCard
          title="Completed Designs"
          value={
            dashboardData?.completedDesigns ||
            dashboardData?.categorizedCounts?.['Completed'] ||
            '0'
          }
          icon={
            <Icon
              name="palette"
              size={statusCardIconSize}
              color={colors.textWhite}
            />
          }
          color={colors.primary}
          onPress={() => navigateWithDashboardFilter({ filter: 'completed' })}
          style={tabletStatusCardStyle}
        />
      </View>
    );
  };

  const getQuickActionsList = () => {
    const actions = [];
    if (user?.role === 'admin') {
      actions.push(
        {
          title: 'Metal Prices',
          icon: 'trending-up',
          onPress: () => navigation.navigate('MetalPrices'),
        },
        {
          title: 'Clients List',
          icon: 'people',
          onPress: () => navigation.navigate('ClientsList'),
        },
        {
          title: 'Users List',
          icon: 'account',
          onPress: () => navigation.navigate('UsersList'),
        },
      );
    }
    if (user?.role === 'client') {
      actions.push({
        title: 'Add New Enquiry',
        icon: 'add-circle',
        onPress: () => navigation.navigate('AddEnquiryStep1'),
      });
    }
    if (user?.role === 'coral' || user?.role === 'cad') {
      actions.push(
        {
          title: 'My Assignments',
          icon: 'work',
          onPress: () => navigation.navigate('EnquiryList'),
        },
        {
          title: 'Upload Design',
          icon: 'file-upload',
          onPress: () => navigation.navigate('UploadDesign'),
        },
      );
    }
    return actions;
  };

  const renderCombinedOverviewAndQuickActions = () => {
    const actions = getQuickActionsList();

    return (
      <View style={styles.combinedSectionTablet}>
        <View style={styles.combinedSectionLeft}>
          <Text style={styles.combinedSectionTitle}>Overview</Text>
          <View style={styles.combinedStatsGrid}>
            <StatusCard
              title="Total Enquiries"
              value={dashboardData?.totalEnquiries || '0'}
              icon={
                <Icon
                  name="assignment"
                  size={statusCardIconSize}
                  color={colors.textWhite}
                />
              }
              color={colors.primary}
              onPress={() => navigation.navigate('Enquiries')}
              style={styles.combinedStatusCard}
            />
            <StatusCard
              title="Total Clients"
              value={dashboardData?.totalClients || '0'}
              icon={
                <Icon
                  name="people"
                  size={statusCardIconSize}
                  color={colors.textWhite}
                />
              }
              color={colors.primary}
              onPress={() => navigation.navigate('ClientsList')}
              style={styles.combinedStatusCard}
            />
          </View>
        </View>
        <View style={styles.combinedSectionRight}>
          <Text style={styles.combinedSectionTitle}>Quick Actions</Text>
          <View style={styles.combinedActionsGrid}>
            {actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.actionButton, styles.combinedActionButton]}
                onPress={action.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.actionIcon}>
                  <Icon
                    name={action.icon}
                    size={actionIconSize}
                    color={colors.primary}
                  />
                </View>
                <Text style={actionTextStyle}>{action.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderQuickActions = () => {
    const actions = getQuickActionsList();

    // TEST BUTTON - Commented out for production
    // To re-enable: Uncomment the test screens in StackNavigator.js first, then uncomment this
    // if (__DEV__) {
    //   actions.push({
    //     title: 'Test Notifications',
    //     icon: 'notifications',
    //     onPress: () => navigation.navigate('NotificationTest'),
    //   });
    // }

    return (
      <Card style={quickActionsCardStyle}>
        <Text style={styles.quickActionsTitle}>Quick Actions</Text>
        {/* DEV MODE BADGE - Commented out for production
        {__DEV__ && (
          <View style={styles.devBadge}>
            <Text style={styles.devBadgeText}>DEV MODE</Text>
          </View>
        )}
        */}
        <View style={actionsGridStyle}>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={actionButtonStyle}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.actionIcon}>
                <Icon
                  name={action.icon}
                  size={actionIconSize}
                  color={colors.primary}
                />
              </View>
              <Text style={actionTextStyle}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>
    );
  };

  // Helper function to format time ago
  const formatTimeAgo = timestamp => {
    if (!timestamp) return '';

    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';

      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffSeconds = Math.floor(diffTime / 1000);
      const diffMinutes = Math.floor(diffTime / (1000 * 60));
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffSeconds < 60) return 'Just now';
      if (diffMinutes < 60)
        return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
      if (diffHours < 24)
        return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
      if (diffDays < 7)
        return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;

      // For older notifications, show date
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear();
      const currentYear = now.getFullYear();

      if (year === currentYear) {
        return `${month}/${day}`;
      } else {
        return `${month}/${day}/${year}`;
      }
    } catch (error) {
      return '';
    }
  };

  // Get icon name based on notification type
  const getNotificationIcon = type => {
    const typeLower = (type || '').toLowerCase();
    if (typeLower.includes('enquiry') || typeLower.includes('new'))
      return 'assignment';
    if (typeLower.includes('approv') || typeLower.includes('approved'))
      return 'check-circle';
    if (typeLower.includes('reject') || typeLower.includes('rejected'))
      return 'cancel';
    if (
      typeLower.includes('design') ||
      typeLower.includes('cad') ||
      typeLower.includes('coral')
    )
      return 'palette';
    if (typeLower.includes('payment') || typeLower.includes('order'))
      return 'payment';
    if (typeLower.includes('message') || typeLower.includes('chat'))
      return 'message';
    if (typeLower.includes('status') || typeLower.includes('update'))
      return 'update';
    return 'notifications';
  };

  // Get icon background color based on notification type
  const getNotificationIconColor = type => {
    const typeLower = (type || '').toLowerCase();
    if (typeLower.includes('approv') || typeLower.includes('approved'))
      return 'rgba(76, 175, 80, 0.1)';
    if (typeLower.includes('reject') || typeLower.includes('rejected'))
      return 'rgba(239, 68, 68, 0.1)';
    if (typeLower.includes('payment') || typeLower.includes('order'))
      return 'rgba(139, 69, 19, 0.1)';
    return 'rgba(33, 150, 243, 0.1)';
  };

  const renderRecentActivity = () => {
    const notifications = Array.isArray(notificationsData)
      ? notificationsData.slice(0, 5)
      : [];

    return (
      <Card style={styles.recentActivityCard}>
        <Text style={styles.recentActivityTitle}>Recent Activity</Text>

        {notifications.length > 0 ? (
          notifications.map(notification => {
            const iconName = getNotificationIcon(notification.type);
            const iconBgColor = getNotificationIconColor(notification.type);
            const timeAgo = formatTimeAgo(
              notification.timestamp || notification.createdAt,
            );

            return (
              <TouchableOpacity
                key={notification.id || notification._id}
                style={styles.activityItem}
                onPress={() => {
                  // Use the same navigation utility as NotificationsScreen
                  // This handles all notification types: enquiry, chat, design, pricing, etc.
                  const rawNotification = notification.raw || notification;
                  navigateFromNotification(rawNotification);
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.activityIcon,
                    { backgroundColor: iconBgColor },
                  ]}
                >
                  <Icon name={iconName} size={16} color={colors.primary} />
                </View>
                <View style={styles.activityTextContainer}>
                  <Text style={styles.activityText} numberOfLines={2}>
                    {notification.title ||
                      notification.message ||
                      'Notification'}
                  </Text>
                  {notification.message && notification.title && (
                    <Text style={styles.activitySubtext} numberOfLines={1}>
                      {notification.message}
                    </Text>
                  )}
                  <Text style={styles.activityTime}>{timeAgo}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <Icon
                name="notifications-none"
                size={16}
                color={colors.textLight}
              />
            </View>
            <View style={styles.activityTextContainer}>
              <Text style={[styles.activityText, { color: colors.textLight }]}>
                No recent activity
              </Text>
            </View>
          </View>
        )}
      </Card>
    );
  };

  if (loading) {
    return <AnimatedLogoLoader size={80} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopNavbar navigation={navigation} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Enhanced Welcome Header */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeContent}>
              <View style={styles.welcomeText}>
                <Text style={styles.welcomeGreeting}>
                  Hii{' '}
                  <Text style={styles.userNameHighlight}>
                    {user?.name || 'User'}
                  </Text>
                  ,
                </Text>
                <Text style={styles.welcomeSubtitle}>
                  Welcome to Chandra Jewels
                </Text>
              </View>
              <View style={styles.welcomeIconContainer}>
                <View style={styles.welcomeIcon}>
                  <Icon name="diamond" size={22} color={colors.textWhite} />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Role-based Dashboard Content */}
        {user?.role === 'admin' && renderAdminDashboard()}
        {user?.role === 'client' && renderClientDashboard()}
        {(user?.role === 'coral' || user?.role === 'cad') &&
          renderDesignerDashboard(user.role)}

        {/* Combined Overview and Quick Actions - Only on tablets for admin role */}
        {isTablet && user?.role === 'admin' && (
          <View style={styles.combinedSectionContainer}>
            {renderCombinedOverviewAndQuickActions()}
          </View>
        )}

        {/* Quick Actions - Only show on mobile, hidden on tablets for admin (shown in combined section) */}
        {!isTablet &&
          user?.role !== 'coral' &&
          user?.role !== 'cad' &&
          user?.role !== 'client' &&
          user?.roleNumber !== 4 &&
          user?.roleId !== 4 && (
            <View style={styles.quickActionsSection}>
              {renderQuickActions()}
            </View>
          )}

        {/* Recent Activity */}
        <View style={styles.recentActivitySection}>
          {renderRecentActivity()}
        </View>
      </ScrollView>

      {/* Floating Action Button - Add New Enquiry */}
      {(user?.role === 'admin' || user?.role === 'client') && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('AddEnquiryStep1')}
          activeOpacity={0.8}
        >
          <Icon name="add-circle" size={24} color={colors.textWhite} />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Welcome Section - Premium Design
  welcomeSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  welcomeCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  welcomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcomeText: {
    flex: 1,
  },
  welcomeGreeting: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textWhite,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  userNameHighlight: {
    fontFamily: fonts.bold,
    fontStyle: 'italic',
  },
  welcomeSubtitle: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textWhite,
    opacity: 0.9,
    letterSpacing: 0.3,
  },
  welcomeIconContainer: {
    marginLeft: 10,
  },
  welcomeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Dashboard Content
  dashboardContent: {
    paddingTop: 4,
  },

  // Section Container
  sectionContainer: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.primary,
    letterSpacing: 0.2,
  },

  // Overview Section
  overviewSection: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
  },
  overviewTitle: {
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },

  // Enquiry Status Grid - Now using horizontal scroll
  statusScroll: {
    flexGrow: 0,
  },
  statusScrollContent: {
    paddingRight: 16,
    gap: 6,
  },
  enquiryStatusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 6,
  },
  enquiryStatusItem: {
    width: 85,
    marginBottom: 12,
    marginRight: 6,
    minWidth: 85,
  },
  simpleIcon: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  statsGridTablet: {
    alignSelf: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  statusCardTablet: {
    width: 200,
    maxWidth: 200,
    minWidth: 200,
    marginHorizontal: 8,
    aspectRatio: 1.1,
    minHeight: 150,
    maxHeight: 200,
  },

  // Clients Section
  clientsSection: {
    marginBottom: 16,
    paddingLeft: 16,
  },
  clientsHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingRight: 16,
  },
  clientsHeader: {
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  clientsScroll: {
    flexGrow: 0,
  },
  clientsScrollContent: {
    paddingRight: 16,
  },
  clientCard: {
    width: 85,
    height: 85,
    backgroundColor: colors.background,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  clientImage: {
    width: '100%',
    height: 50,
    marginBottom: 3,
    borderRadius: 6,
  },
  clientImagePlaceholder: {
    width: '100%',
    height: 50,
    marginBottom: 3,
    borderRadius: 6,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  clientNamePlaceholder: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 12,
  },
  clientName: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 14,
  },
  clientCount: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.primary,
    letterSpacing: 0.3,
  },

  // Quick Actions Section
  quickActionsSection: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  quickActionsCard: {
    marginHorizontal: 0,
    marginVertical: 0,
    padding: 16,
  },
  quickActionsCardTablet: {
    alignSelf: 'center',
    padding: 16,
    paddingHorizontal: 32,
  },
  quickActionsTitle: {
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionsGridTablet: {
    justifyContent: 'flex-start',
    gap: 16,
  },
  actionButton: {
    width: '48%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 100,
    marginBottom: 10,
  },
  actionButtonTablet: {
    width: 180,
    maxWidth: 180,
    minWidth: 180,
    marginRight: 16,
    marginBottom: 12,
    padding: 14,
    minHeight: 130,
  },
  actionIcon: {
    // width: 48,
    // height: 48,
    // borderRadius: 24,
    // backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionText: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  actionTextTablet: {
    fontSize: fonts.xs,
    lineHeight: 16,
  },
  devBadge: {
    backgroundColor: colors.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  devBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.warning,
    letterSpacing: 0.5,
  },

  // Combined Overview and Quick Actions Section (Tablet only)
  combinedSectionContainer: {
    paddingHorizontal: 32,
    paddingTop: 8,
    paddingBottom: 12,
  },
  combinedSectionTablet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 24,
  },
  combinedSectionLeft: {
    flex: 1,
    marginRight: 12,
  },
  combinedSectionRight: {
    flex: 1,
    marginLeft: 12,
  },
  combinedSectionTitle: {
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  combinedStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    gap: 12,
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  combinedStatusCard: {
    flex: 1,
    width: '48%',
    minWidth: 0,
    maxWidth: '48%',
    marginHorizontal: 0,
    marginVertical: 0,
    aspectRatio: 1.1,
    minHeight: 140,
  },
  combinedActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  combinedActionButton: {
    flex: 1,
    width: '48%',
    minWidth: 0,
    maxWidth: '48%',
    marginRight: 0,
    marginBottom: 0,
    minHeight: 120,
  },

  // Recent Activity Section
  recentActivitySection: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
  },
  recentActivityCard: {
    marginHorizontal: 0,
    marginVertical: 0,
    padding: 16,
  },
  recentActivityTitle: {
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary,
  },
  activityIcon: {
    // width: 38,
    // height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityTextContainer: {
    flex: 1,
    paddingTop: 2,
  },
  activityText: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
    letterSpacing: 0.1,
  },
  activityTime: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textLight,
    lineHeight: 16,
    letterSpacing: 0.1,
    marginTop: 2,
  },
  activitySubtext: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
    marginBottom: 2,
  },
  // Floating Action Button
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 10, // Position above bottom tab bar
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  // new button styles
  NewEnquiryPricingButtonContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    flex: 1,
    padding: 10,
  },

  NewEnquiryButton: {
    backgroundColor: colors.primaryDark,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 10,
    flexDirection: 'row',
  },

  NewEnquiryText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textWhite,
    marginLeft: 10,
  },
});

export default DashboardScreen;

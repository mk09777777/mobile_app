import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Text,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandedAlert from '../../components/common/BrandedAlert';
import { useClients } from '../../features/clients/clientsHooks';
import { Card } from '../../components/cards/Cards';
import { Button, SearchInput } from '../../components/common';
import { AnimatedLogoLoader } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { FILE_BASE_URL } from '../../config/apiConfig';
import { useAuth } from '../../context/AuthContext';

const ClientsListScreen = ({ navigation }) => {
  const { user } = useAuth();
  // Check admin role in multiple ways for compatibility
  const isAdmin = user?.role === 'admin' || 
                  user?.role === 'AD' || 
                  user?.roleNumber === 1 || 
                  user?.roleId === 1;
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  // Redux hook with caching
  const { clients: clientsData = [], isLoading: loading, refetch } = useClients();
  const clients = clientsData || [];

  // Filter clients based on search query using useMemo for performance
  const filteredClients = useMemo(() => {
    if (!searchQuery) {
      return clients;
    }

    const query = searchQuery.toLowerCase();
    return clients.filter(client =>
      (client.name && client.name.toLowerCase().includes(query)) ||
      (client.email && client.email.toLowerCase().includes(query)) ||
      (client.phone && client.phone.includes(searchQuery))
    );
  }, [clients, searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleClientPress = (client) => {
    const clientId = client.id || client._id;
    if (clientId) {
      navigation.navigate('ClientPricing', {
        clientId,
        clientName: client.name,
      });
    } else {
      showAlert('Error', 'Client ID not found', 'error');
    }
  };

  const handleAddClient = () => {
    
    
    if (!isAdmin) {
      showAlert('Access Denied', 'Only administrators can create clients.', 'warning');
      return;
    }
    
    try {
      navigation.navigate('CreateClient');
    } catch (error) {
      showAlert('Error', `Failed to navigate: ${error.message}`, 'error');
    }
  };

  const renderClientItem = (client) => {
    // Construct image URL
    const getClientImageUrl = () => {
      if (!client.imageUrl) return null;
      
      let urlToUse = client.imageUrl;
      
      // If it's already a full URL, use it directly
      if (client.imageUrl.startsWith('http://') || client.imageUrl.startsWith('https://')) {
        // Check if it's a Google redirect URL
        if (client.imageUrl.includes('google.com/url') && client.imageUrl.includes('url=')) {
          try {
            // Extract the actual URL from Google redirect
            const urlMatch = client.imageUrl.match(/url=([^&]+)/);
            if (urlMatch) {
              urlToUse = decodeURIComponent(urlMatch[1]);
            }
          } catch (error) {
            return null;
          }
        }
      } else {
        // If it starts with /, it's a path - construct full URL
        if (client.imageUrl.startsWith('/')) {
          urlToUse = `${FILE_BASE_URL}${client.imageUrl}`;
        } else {
          // Otherwise, treat as file key and construct URL
          urlToUse = `${FILE_BASE_URL}/api/clients/files/${encodeURIComponent(client.imageUrl)}`;
        }
      }
      
      // Check if the URL is actually an image (has image extension)
      const isImageUrl = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(urlToUse) || 
                        urlToUse.includes('amazonaws.com') || 
                        urlToUse.includes('s3.') ||
                        urlToUse.includes('cloudinary.com') ||
                        urlToUse.includes('imgur.com');
      
      // Check if URL is an HTML page (not an image)
      const isHtmlPage = /\.(html|htm)(\?|$)/i.test(urlToUse) || 
                        urlToUse.includes('.html') ||
                        urlToUse.includes('.htm');
      
      // If it's an HTML page, don't return it
      if (isHtmlPage && !isImageUrl) {
        
        return null;
      }
      
      // Return URL if it looks like an image or is an API endpoint
      const isApiEndpoint = urlToUse.includes(FILE_BASE_URL) || urlToUse.includes('/api/');
      if (isImageUrl || isApiEndpoint) {
        return urlToUse;
      }
      
      // Not a recognized image URL
      
      return null;
    };
    
    const imageUrl = getClientImageUrl();
    
    return (
      <TouchableOpacity
        key={client.id}
        style={styles.clientItem}
        onPress={() => handleClientPress(client)}>
        
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.clientAvatar}
            resizeMode="cover"
            onError={(error) => {
              if (__DEV__) {
                console.error('❌ Client image failed to load in list:', {
                  url: imageUrl,
                  error: error.nativeEvent?.error || error,
                });
              }
            }}
            onLoad={() => {
              
            }}
          />
        ) : (
          <View style={styles.clientAvatar}>
            <Icon name="account" size={20} color={colors.textWhite} />
          </View>
        )}

      <View style={styles.clientContent}>
        <View style={styles.clientHeader}>
          <View style={styles.clientNameContainer}>
            <Text style={styles.clientName}>
              {client.name || 'Unknown Client'}
            </Text>
            {client.lastOrder && (
              <Text style={styles.clientDate}>
                {formatDate(client.lastOrder)}
              </Text>
            )}
          </View>
        </View>

        {client.email !== 'N/A' || client.phone !== 'N/A' ? (
          <View style={styles.clientDetails}>
            {client.email && client.email !== 'N/A' && (
              <View style={styles.clientRow}>
                <Icon name="email" size={14} color={colors.textSecondary} />
                <Text style={styles.clientDetailText} numberOfLines={1}>
                  {client.email}
                </Text>
              </View>
            )}

            {client.phone && client.phone !== 'N/A' && (
              <View style={styles.clientRow}>
                <Icon name="phone" size={14} color={colors.textSecondary} />
                <Text style={styles.clientDetailText}>
                  {client.phone}
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </View>

      <TouchableOpacity style={styles.moreButton}>
        <Text style={{ fontSize: 16, color: colors.textSecondary }}>⋮</Text>
      </TouchableOpacity>
    </TouchableOpacity>
    );
  };

  const renderStatsCards = () => (
    <View style={styles.statsContainer}>
      <Card style={styles.statCard}>
        <View style={styles.statContent}>
          <Icon name="account" size={24} color={colors.primary} />
          <View style={styles.statText}>
            <Text style={styles.statCardValue}>{clients.length}</Text>
            <Text style={styles.statCardLabel}>Total Clients</Text>
          </View>
        </View>
      </Card>
    </View>
  );

  if (loading) {
    return <AnimatedLogoLoader size={80} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['left','right','bottom']}>
      <View style={styles.header}>
        <SearchInput
          placeholder="Search clients..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery('')}
        />
        
        {isAdmin && (
          <TouchableOpacity style={styles.addButton} onPress={handleAddClient}>
            <Icon name="add" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        
        {renderStatsCards()}

        <Card style={styles.clientsHeader}>
          <View style={styles.clientsHeaderContent}>
            <View>
              <Text style={styles.allClientsTitle}>All Clients</Text>
              <Text style={styles.allClientsSubtitle}>{filteredClients.length} clients found</Text>
            </View>
            {isAdmin && (
              <TouchableOpacity 
                style={[styles.adminActionButton, styles.adminActionButtonPrimary]} 
                onPress={handleAddClient}
                activeOpacity={0.85}
              >
                <Icon name="add" size={18} color={colors.textWhite} />
                <Text style={styles.adminActionText}>Create Client</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {filteredClients.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Icon name="account" size={40} color={colors.textLight} />
            <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fonts.base }]}>
              {searchQuery ? 'No clients found' : 'No clients available'}
            </Text>
            <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
              {searchQuery ? 'Try adjusting your search' : 'Add your first client'}
            </Text>
          </Card>
        ) : (
          <View style={styles.clientsList}>
            {filteredClients.map(renderClientItem)}
          </View>
        )}
      </ScrollView>
      <BrandedAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  addButton: {
    marginLeft: 12,
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  statCard: {
    width: '100%',
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 16,
    flex: 1,
  },
  clientsHeader: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 8,
  },
  clientsHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createClientButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.cardShadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  createClientButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createClientButtonText: {
    color: colors.textWhite,
    fontSize: fonts.sm,
    fontFamily: fonts.semiBold,
  },
  clientsList: {
    paddingHorizontal: 16,
  },
  clientItem: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: colors.cardShadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clientContent: {
    flex: 1,
    justifyContent: 'center',
  },
  clientHeader: {
    marginBottom: 6,
  },
  clientNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clientName: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  clientDate: {
    color: colors.textLight,
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  clientDetails: {
    marginTop: 4,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  clientText: {
    marginLeft: 8,
  },
  clientDetailText: {
    marginLeft: 8,
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  clientStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: fonts.bold,
    marginTop: 2,
  },
  statCardValue: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statCardLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  allClientsTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  allClientsSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  moreButton: {
    padding: 8,
    alignSelf: 'flex-start',
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
  adminActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 120,
  },
  adminActionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  adminActionText: {
    color: colors.textWhite,
    fontFamily: fonts.medium,
    fontSize: 14,
    marginLeft: 8,
  },
});

export default ClientsListScreen;

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Text,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useGetClientsQuery } from '../../store/api';
import { AnimatedLogoLoader } from '../../components/common';
import Icon from '../../components/common/Icon';
import TopNavbar from '../../components/common/TopNavbar';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';

const ClientHandlerDashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data: allClients = [], isLoading, refetch } = useGetClientsQuery();

  // Only show clients assigned to this handler
  const assignedIds = user?.clientsHandled || [];
  const clients = allClients.filter(c => assignedIds.includes(c.id || c._id));

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) return <AnimatedLogoLoader size={80} />;

  const renderItem = ({ item: client }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => {
        navigation.navigate('ClientHandlerEnquiries', {
          client: {
            id:    client.id || client._id,
            name:  client.name  || 'Unknown Client',
            email: client.email || '',
          },
        });
      }}>
      <View style={styles.avatar}>
        {/* <Icon name="account" size={20} color={colors.textWhite} /> */}
        <Text style={{ color: colors.textWhite, fontSize: fonts.base, fontFamily: fonts.bold }}>
          {client.name ? client.name.substring(0, 2).toUpperCase() : '?'}
        </Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {client.name || 'Unknown Client'}
        </Text>
        {client.email && client.email !== 'N/A' && (
          <Text style={styles.email} numberOfLines={1}>
            {client.email}
          </Text>
        )}
      </View>
     
      <Icon name="chevron-right" size={22} color={colors.textLight} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <TopNavbar navigation={navigation} />
      <View style={styles.headerSection}>
        <Text style={styles.title}>My Clients</Text>
        <Text style={styles.subtitle}>{clients.length} client{clients.length !== 1 ? 's' : ''} assigned</Text>
      </View>

      {clients.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="account" size={48} color={colors.textLight} />
          <Text style={styles.emptyText}>No clients assigned yet</Text>
          <Text style={styles.emptySubtext}>Contact your admin to get clients assigned</Text>
        </View>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={c => String(c.id || c._id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9f7f2" },
  headerSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: fonts.xl, fontFamily: fonts.bold, color: colors.textPrimary },
  subtitle: { fontSize: fonts.sm, color: colors.textSecondary, fontFamily: fonts.regular, marginTop: 2 },
  list: { paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 14,
    margin:5,
    borderRadius: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
    
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: { flex: 1 },
  name: { fontSize: fonts.base, fontFamily: fonts.bold, color: colors.textPrimary },
  email: { fontSize: fonts.sm, color: colors.textSecondary, fontFamily: fonts.regular, marginTop: 2 },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 68 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: fonts.lg, fontFamily: fonts.bold, color: colors.textSecondary, marginTop: 16 },
  emptySubtext: { fontSize: fonts.sm, color: colors.textLight, fontFamily: fonts.regular, marginTop: 8, textAlign: 'center' },
  addEnquiryBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryDark || 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
});

export default ClientHandlerDashboardScreen;

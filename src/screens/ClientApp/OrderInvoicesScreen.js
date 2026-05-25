import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../constants/colors';

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const OrderInvoicesScreen = ({ route, navigation }) => {
  const order = route?.params?.order;
  const invoices = Array.isArray(order?.invoices) ? order.invoices : [];
  const [openingId, setOpeningId] = useState(null);

  const handleDownload = async (inv) => {
    if (!inv?.url) return;
    setOpeningId(inv._id);
    try {
      const supported = await Linking.canOpenURL(inv.url);
      if (supported) {
        await Linking.openURL(inv.url);
      } else {
        Alert.alert('Error', 'Unable to open this invoice.');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong while opening the invoice.');
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.iconButton} onPress={navigation.goBack} activeOpacity={0.8}>
          <MaterialIcons name="chevron-left" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invoices</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.subHeader}>
        <Text style={styles.orderNumber}>{order?.orderNumber || 'Order'}</Text>
        <Text style={styles.invoiceCount}>
          {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {invoices.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="description" size={48} color="#C5CDD4" />
            <Text style={styles.emptyTitle}>No invoices yet</Text>
            <Text style={styles.emptyText}>
              Invoices will appear here once they are uploaded by the team.
            </Text>
          </View>
        ) : (
          invoices.map((inv, index) => (
            <View key={inv._id || index} style={styles.invoiceCard}>
              <View style={styles.invoiceLeft}>
                <View style={styles.pdfIcon}>
                  <MaterialIcons name="picture-as-pdf" size={24} color="#C05252" />
                </View>
                <View style={styles.invoiceInfo}>
                  <Text style={styles.invoiceFilename} numberOfLines={2}>
                    {inv.filename || `Invoice ${index + 1}`}
                  </Text>
                  {inv.uploadedAt ? (
                    <Text style={styles.invoiceDate}>{formatDate(inv.uploadedAt)}</Text>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity
                style={[styles.downloadBtn, openingId === inv._id && styles.downloadBtnDisabled]}
                activeOpacity={0.8}
                disabled={openingId === inv._id}
                onPress={() => handleDownload(inv)}
              >
                {openingId === inv._id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="download" size={16} color="#FFFFFF" />
                    <Text style={styles.downloadBtnText}>Download</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EFF1F3' },
  headerRow: {
    height: 52,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, color: '#1A1A1A', fontWeight: '500' },
  subHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DCE2E8',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: { fontSize: 13, color: '#4B5A65', fontWeight: '500' },
  invoiceCount: { fontSize: 12, color: '#8A979F' },
  content: { padding: 14, gap: 10, paddingBottom: 32 },
  emptyState: {
    marginTop: 48,
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#3A4A54', marginTop: 6 },
  emptyText: { fontSize: 13, color: '#7A8792', textAlign: 'center', lineHeight: 20 },
  invoiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  invoiceLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pdfIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceInfo: { flex: 1 },
  invoiceFilename: { fontSize: 14, fontWeight: '500', color: '#1D2A34', lineHeight: 20 },
  invoiceDate: { marginTop: 3, fontSize: 12, color: '#8A979F' },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#135A62',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 96,
    justifyContent: 'center',
  },
  downloadBtnDisabled: { backgroundColor: '#8AA8AC' },
  downloadBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});

export default OrderInvoicesScreen;

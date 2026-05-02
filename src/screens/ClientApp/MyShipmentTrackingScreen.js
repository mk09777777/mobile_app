import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Clipboard from '@react-native-clipboard/clipboard';

import { colors } from '../../constants/colors';

const MyShipmentTrackingScreen = ({ route, navigation }) => {
  const [copied, setCopied] = useState(false);
  const shipment = route?.params?.shipmentTracking || {};
  const sourceCity = shipment.sourceCity || 'Source';
  const destinationCity = shipment.destinationCity || 'Destination';
  const logisticsName = shipment.logisticsName || 'Logistics';
  const logisticsId = shipment.logisticsId || 'N/A';
  const awbNo = shipment.awbNo || 'N/A';
  const noOfPcs = Number(shipment.noOfPcs || 0);

  const onCopyAwb = async () => {
    if (!awbNo || awbNo === 'N/A') return;
    await Clipboard.setString(String(awbNo));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.iconButton} onPress={navigation.goBack} activeOpacity={0.8}>
          <MaterialIcons name="chevron-left" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shipment Tracking</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.card}>
        <View style={styles.topStrip}>
          <View style={styles.topStripHeader}>
            <Text style={styles.topTitle}>IN TRANSIT TO YOUR SHOP</Text>
            <Text style={styles.topEta}>Arrives soon</Text>
          </View>
          <View style={styles.routeTrack}>
            <View style={styles.startDot} />
            <View style={styles.trackLine} />
            <View style={styles.endDot} />
          </View>
          <View style={styles.routeCities}>
            <Text style={styles.cityText}>{sourceCity}</Text>
            <Text style={[styles.cityText, styles.cityTextEnd]}>{destinationCity}</Text>
          </View>
        </View>

        <View style={styles.bottomSection}>
          <Text style={styles.logisticsTitle}>
            {logisticsName} — {logisticsId}
          </Text>
          <Text style={styles.logisticsSub}>
            AWB {awbNo} · Insured for {Number.isFinite(noOfPcs) ? noOfPcs : 0} pcs
          </Text>
          <TouchableOpacity style={styles.copyAwbButton} activeOpacity={0.85} onPress={onCopyAwb}>
            <MaterialIcons name={copied ? 'check' : 'content-copy'} size={14} color="#0E5B62" />
            <Text style={styles.copyAwbText}>{copied ? 'Copied' : 'Copy AWB No.'}</Text>
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Text style={styles.infoLine}>From: {sourceCity}</Text>
            <Text style={styles.infoLine}>To: {destinationCity}</Text>
            <Text style={styles.infoLineStrong}>Pieces in shipment: {Number.isFinite(noOfPcs) ? noOfPcs : 0}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF1F3',
    padding: 12,
  },
  headerRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  card: {
    borderWidth: 1,
    borderColor: '#D6DDE4',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  topStrip: {
    backgroundColor: '#DDE8EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  topStripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topTitle: {
    color: '#0D676F',
    fontSize: 14,
    fontWeight: '700',
  },
  topEta: {
    color: '#0D676F',
    fontSize: 13,
    fontWeight: '600',
  },
  routeTrack: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  startDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0C6A70',
  },
  trackLine: {
    flex: 1,
    height: 3,
    backgroundColor: '#CDAA56',
    marginHorizontal: 8,
  },
  endDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#CDAA56',
  },
  routeCities: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cityText: {
    color: '#1C5D65',
    fontSize: 13,
  },
  cityTextEnd: {
    color: '#C19D49',
    fontWeight: '500',
  },
  bottomSection: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  logisticsTitle: {
    color: '#0E555E',
    fontSize: 18,
    fontWeight: '700',
  },
  logisticsSub: {
    marginTop: 6,
    color: '#5A656E',
    fontSize: 14,
  },
  copyAwbButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#CDE0E3',
    backgroundColor: '#EAF3F4',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  copyAwbText: {
    color: '#0E5B62',
    fontSize: 12,
    fontWeight: '600',
  },
  infoBox: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#F2F3F4',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  infoLine: {
    color: '#283842',
    fontSize: 14,
  },
  infoLineStrong: {
    marginTop: 2,
    color: '#0F6168',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default MyShipmentTrackingScreen;

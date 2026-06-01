import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../constants/colors';
import { fonts } from '../../../constants/fonts';
import Icon from '../../../components/common/Icon';
import BrandedAlert from '../../../components/common/BrandedAlert';
import { getColumnMap } from '../../../services/productionApi';

// ─── WIP Row ──────────────────────────────────────────────────────────────────

const WipRow = ({ col, alt }) => (
  <View style={[styles.tableRow, alt && styles.tableRowAlt]}>
    <Text style={[styles.td, styles.wipStageCol]} numberOfLines={1}>
      {col.stageCode || '—'}
    </Text>
    <Text style={[styles.td, styles.wipAutoCol]} numberOfLines={1}>
      {col.rawColumn}
    </Text>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

const ColumnMapsScreen = () => {
  const [fileType, setFileType] = useState('orders');
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [wipCols, setWipCols]   = useState([]);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getColumnMap(fileType);
      const map = res?.columnMap || res;
      if (__DEV__) {
        console.log('[ColumnMaps] fileType:', fileType,
          '| wipCols:', (map?.wipColumns || []).length,
          '| orderCols:', (map?.orderColumns || []).length);
      }
      setData(map);
      setWipCols(map?.wipColumns || []);
    } catch (e) {
      if (__DEV__) console.error('[ColumnMaps] load error:', e.message);
      showAlert('Error', e.message || 'Failed to load column map.', 'error');
    } finally {
      setLoading(false);
    }
  }, [fileType]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>

      {/* Tab row */}
      <View style={styles.tabRow}>
        {['orders', 'wip'].map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, fileType === t && styles.tabActive]}
            onPress={() => setFileType(t)}
          >
            <Text style={[styles.tabText, fileType === t && styles.tabTextActive]}>
              {t === 'orders' ? 'Order Columns' : 'WIP Columns'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>

          {/* ── Row-Type Aliases ─────────────────────────────────────────── */}
          {data?.aliases && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Row Type Aliases</Text>
              {Object.entries(data.aliases).map(([type, aliases]) => (
                <View key={type} style={styles.aliasRow}>
                  <Text style={styles.aliasType}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                  <Text style={styles.aliasValues}>{aliases?.join(', ') || '—'}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── WIP Columns ──────────────────────────────────────────────── */}
          {fileType === 'wip' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                WIP Column Mappings ({wipCols.length})
              </Text>

              {wipCols.length === 0 ? (
                <View style={styles.emptyWip}>
                  <Icon name="upload-file" size={36} color={colors.textSecondary} />
                  <Text style={styles.emptyWipTitle}>No columns discovered yet</Text>
                  <Text style={styles.emptyWipSub}>
                    Upload a WIP Excel file first. Stage columns will appear here.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Table header */}
                  <View style={styles.tableHeader}>
                    <Text style={[styles.th, styles.wipStageCol]}>Stage Code</Text>
                    <Text style={[styles.th, styles.wipAutoCol]}>Cell</Text>
                  </View>

                  {wipCols.map((col, i) => (
                    <WipRow key={col.rawColumn + i} col={col} alt={i % 2 === 1} />
                  ))}
                </>
              )}
            </View>
          )}

          {/* ── Order Columns ─────────────────────────────────────────────── */}
          {fileType === 'orders' && data?.orderColumns && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Order Column Mappings ({data.orderColumns.length})
              </Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 1.5 }]}>Raw Column</Text>
                <Text style={[styles.th, { flex: 1.5 }]}>Field Path</Text>
                <Text style={[styles.th, { width: 44 }]}>Req.</Text>
              </View>
              {data.orderColumns.map((col, i) => (
                <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                  <Text style={[styles.td, { flex: 1.5, fontFamily: fonts.bold }]} numberOfLines={1}>
                    {col.rawColumn}
                  </Text>
                  <Text style={[styles.td, { flex: 1.5 }]} numberOfLines={1}>
                    {col.fieldPath || '—'}
                  </Text>
                  <View style={{ width: 44, alignItems: 'center' }}>
                    {col.required
                      ? <Icon name="check" size={14} color={colors.success} />
                      : <Text style={[styles.td, { color: colors.textSecondary }]}>—</Text>
                    }
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Info card */}
          <View style={styles.infoCard}>
            <Icon name="info" size={16} color={colors.info} />
            <Text style={styles.infoText}>
              {fileType === 'wip'
                ? 'Showing stage code and cell (column name) from uploaded WIP file.'
                : 'Order column mappings are managed via the backend.'}
            </Text>
          </View>
        </ScrollView>
      )}

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

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: colors.background },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center' },

  tabRow:          { flexDirection: 'row', backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:             { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive:       { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText:         { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.textSecondary },
  tabTextActive:   { color: colors.primary, fontFamily: fonts.bold },

  content:         { padding: 12, gap: 12, paddingBottom: 40 },

  section:         { backgroundColor: colors.background, borderRadius: 12, padding: 16, elevation: 1 },
  sectionTitle:    { fontFamily: fonts.bold, fontSize: fonts.base, color: colors.textPrimary, marginBottom: 12 },

  aliasRow:        { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  aliasType:       { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.primary, width: 80 },
  aliasValues:     { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textPrimary, flex: 1 },

  tableHeader:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
                     borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4 },
  th:              { fontFamily: fonts.bold, fontSize: fonts.xs, color: colors.textSecondary },

  tableRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
                     borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  tableRowAlt:     { backgroundColor: colors.backgroundSecondary },
  td:              { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textPrimary },

  wipStageCol:     { flex: 1 },
  wipAutoCol:      { flex: 1 },

  emptyWip:        { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyWipTitle:   { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary },
  emptyWipSub:     { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary,
                     textAlign: 'center', lineHeight: 20 },

  infoCard:        { flexDirection: 'row', gap: 10, backgroundColor: colors.info + '15',
                     borderRadius: 10, padding: 12 },
  infoText:        { flex: 1, fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.info },
});

export default ColumnMapsScreen;

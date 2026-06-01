import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../constants/colors';
import { fonts } from '../../../constants/fonts';
import Icon from '../../../components/common/Icon';
import BrandedAlert from '../../../components/common/BrandedAlert';
import { getImportRuns, getImportRun, deleteImportRun } from '../../../services/productionApi';

const STATUS_COLORS = { complete: colors.success, processing: colors.warning, failed: colors.error };

const RunRow = ({ run, onPress, onDelete }) => {
  const statusColor = STATUS_COLORS[run.status] || colors.textSecondary;
  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(run)} activeOpacity={0.8}>
      <View style={[styles.rowIcon, { backgroundColor: statusColor + '20' }]}>
        <Icon name={run.fileType === 'orders' ? 'assignment' : 'update'} size={20} color={statusColor} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{run.fileName || 'Unknown file'}</Text>
        <Text style={styles.rowSub}>
          {run.fileType?.toUpperCase()} · {new Date(run.uploadedAt).toLocaleString()}
        </Text>
        <View style={styles.rowStats}>
          <Text style={styles.statText}>✓ {run.inserted ?? 0}</Text>
          <Text style={styles.statText}>↺ {run.updated ?? 0}</Text>
          {run.errored > 0 && <Text style={[styles.statText, { color: colors.error }]}>✗ {run.errored}</Text>}
        </View>
      </View>
      <View style={styles.rowRight}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{run.status}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={(e) => { e.stopPropagation?.(); onDelete(run); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="delete" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const ImportHistoryScreen = ({ route, navigation }) => {
  const openRunId = route?.params?.runId;
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const load = useCallback(async () => {
    try {
      const data = await getImportRuns({ limit: 50 });
      if (__DEV__) {
        console.log('[ImportHistory] response keys:', Object.keys(data || {}));
        console.log('[ImportHistory] count:', data?.items?.length ?? 0, '| total:', data?.total, '| raw:', JSON.stringify(data)?.slice(0, 500));
        if (data?.items?.[0]) console.log('[ImportHistory] item[0] keys:', Object.keys(data.items[0]));
      }
      // Backend returns { items, total }
      setRuns(data?.items || data?.runs || []);
    } catch (e) {
      if (__DEV__) console.error('[ImportHistory] load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (openRunId) loadDetail(openRunId);
  }, [openRunId]);

  const loadDetail = async (id) => {
    setDetailLoading(true);
    try {
      const res = await getImportRun(id);
      if (__DEV__) console.log('[ImportHistory] detail run:', JSON.stringify(res)?.slice(0, 300));
      // Backend returns { run: {...} }
      setDetail(res?.run || res);
    } catch (e) {
      if (__DEV__) console.error('[ImportHistory] detail error:', e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = (run) => {
    showAlert(
      'Delete Run',
      `Remove "${run.fileName || 'this import'}" from history? This cannot be undone.`,
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteImportRun(run._id);
              load();
            } catch (e) {
              showAlert('Error', e.message, 'error');
            }
          },
        },
      ],
    );
  };

  if (detail) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setDetail(null)}>
            <Icon name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.detailTitle}>Import Detail</Text>
        </View>
        <FlatList
          data={detail.rowErrors || []}
          keyExtractor={(_, i) => String(i)}
          ListHeaderComponent={() => (
            <View style={styles.detailMeta}>
              <Text style={styles.metaFile}>{detail.fileName}</Text>
              <Text style={styles.metaSub}>Rows: {detail.rowCount} · Inserted: {detail.inserted} · Updated: {detail.updated} · Errors: {detail.errored}</Text>
              {detail.unmappedColumns?.length > 0 && (
                <View style={styles.unmapBox}>
                  <Text style={styles.unmapTitle}>Unmapped columns: {detail.unmappedColumns.join(', ')}</Text>
                </View>
              )}
              {(detail.rowErrors?.length ?? 0) > 0 && (
                <Text style={styles.errorHeader}>Row Errors ({detail.rowErrors.length})</Text>
              )}
            </View>
          )}
          renderItem={({ item, index }) => (
            <View style={styles.errorRow}>
              <Text style={styles.errorIdx}>#{index + 1}</Text>
              <View style={styles.errorBody}>
                <Text style={styles.errorKey}>{item.key || item.rowKey || item.gatiPieceCode || '—'}</Text>
                <Text style={styles.errorMsg}>{item.reason || item.message || JSON.stringify(item)}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No row errors — clean import ✓</Text>}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
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
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={runs}
        keyExtractor={(r) => r._id}
        renderItem={({ item }) => (
          <RunRow run={item} onPress={(r) => loadDetail(r._id)} onDelete={handleDelete} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="history" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No import runs yet</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ImportOrders')}>
              <Text style={styles.emptyLink}>Upload your first order file</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={{ paddingVertical: 8 }}
      />
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
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
    marginHorizontal: 12, marginVertical: 4, borderRadius: 12, padding: 14,
    elevation: 1,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowBody: { flex: 1 },
  rowTitle: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.textPrimary },
  rowSub: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  rowStats: { flexDirection: 'row', gap: 10, marginTop: 4 },
  statText: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary },
  rowRight: { alignItems: 'flex-end', gap: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontFamily: fonts.bold, fontSize: 10 },
  deleteBtn: { padding: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyText: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, textAlign: 'center' },
  emptyLink: { color: colors.primary, fontFamily: fonts.medium, fontSize: fonts.sm },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.background, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  detailTitle: { fontFamily: fonts.bold, fontSize: fonts.lg, color: colors.textPrimary },
  detailMeta: { padding: 16 },
  metaFile: { fontFamily: fonts.bold, fontSize: fonts.base, color: colors.textPrimary, marginBottom: 4 },
  metaSub: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, marginBottom: 12 },
  unmapBox: { backgroundColor: colors.warning + '20', borderRadius: 8, padding: 10, marginBottom: 12 },
  unmapTitle: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.warning },
  errorHeader: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.error, marginTop: 8, marginBottom: 8 },
  errorRow: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.background,
    marginHorizontal: 12, marginVertical: 3, borderRadius: 8, padding: 12,
  },
  errorIdx: { fontFamily: fonts.bold, fontSize: fonts.xs, color: colors.textSecondary, width: 28 },
  errorBody: { flex: 1 },
  errorKey: { fontFamily: fonts.medium, fontSize: fonts.sm, color: colors.textPrimary },
  errorMsg: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.error, marginTop: 2 },
});

export default ImportHistoryScreen;

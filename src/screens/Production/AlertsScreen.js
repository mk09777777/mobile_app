import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import BrandedAlert from '../../components/common/BrandedAlert';
import {
  getAlerts, acknowledgeAlert, resolveAlert, runAlerts,
  deleteAlert, deleteAllAlerts,
} from '../../services/productionApi';

const SEVERITY_COLORS = { critical: colors.error, warning: colors.warning, info: colors.info };
const SEVERITY_ICONS  = { critical: 'error', warning: 'warning', info: 'info' };

const AlertRow = ({ alert, onAck, onResolve, onDelete }) => {
  const sColor = SEVERITY_COLORS[alert.severity] || colors.textSecondary;
  const isOpen = !alert.acknowledgedAt && !alert.resolvedAt;
  return (
    <View style={[styles.row, { borderLeftColor: sColor }]}>
      <View style={styles.rowHeader}>
        <Icon name={SEVERITY_ICONS[alert.severity] || 'info'} size={18} color={sColor} />
        <View style={styles.rowHeaderText}>
          <Text style={styles.alertType}>{alert.type?.replace(/_/g, ' ')}</Text>
          <Text style={styles.alertTime}>{new Date(alert.raisedAt).toLocaleString()}</Text>
        </View>
        <View style={[styles.severityBadge, { backgroundColor: sColor + '22' }]}>
          <Text style={[styles.severityText, { color: sColor }]}>{alert.severity?.toUpperCase()}</Text>
        </View>
        {/* Single alert delete */}
        <TouchableOpacity style={styles.rowDeleteBtn} onPress={() => onDelete(alert)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="delete" size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
      <Text style={styles.alertMsg}>{alert.message}</Text>
      {isOpen && (
        <View style={styles.rowActions}>
          <TouchableOpacity style={styles.ackBtn} onPress={() => onAck(alert)}>
            <Text style={styles.ackBtnText}>Acknowledge</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resolveBtn} onPress={() => onResolve(alert)}>
            <Text style={styles.resolveBtnText}>Resolve</Text>
          </TouchableOpacity>
        </View>
      )}
      {alert.acknowledgedAt && !alert.resolvedAt && (
        <Text style={styles.ackStatus}>Acknowledged · {new Date(alert.acknowledgedAt).toLocaleDateString()}</Text>
      )}
    </View>
  );
};

const FILTERS    = ['open', 'acknowledged', 'resolved'];
const SEVERITIES = ['all', 'critical', 'warning', 'info'];

const AlertsScreen = () => {
  const [alerts, setAlerts]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [statusFilter, setStatusFilter] = useState('open');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [scanning, setScanning]         = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [alertConfig, setAlertConfig]   = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });

  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const load = useCallback(async () => {
    try {
      const params = { status: statusFilter, limit: 50 };
      if (severityFilter !== 'all') params.severity = severityFilter;
      const data = await getAlerts(params);
      setAlerts(data?.items || data?.alerts || []);
    } catch (e) {
      if (__DEV__) console.error('[Alerts] load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, severityFilter]);

  useEffect(() => { setLoading(true); load(); }, [statusFilter, severityFilter]);

  const handleAck = async (alert) => {
    try { await acknowledgeAlert(alert._id); load(); }
    catch (e) { showAlert('Error', e.message, 'error'); }
  };

  const handleResolve = async (alert) => {
    try { await resolveAlert(alert._id); load(); }
    catch (e) { showAlert('Error', e.message, 'error'); }
  };

  const handleScan = async () => {
    setScanning(true);
    try { await runAlerts(); load(); }
    catch (e) { showAlert('Error', e.message, 'error'); }
    finally { setScanning(false); }
  };

  // ── Single delete ─────────────────────────────────────────────────────────

  const handleDelete = (alert) => {
    showAlert(
      'Delete Alert',
      `Delete this ${alert.severity} alert?`,
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await deleteAlert(alert._id);
              setAlerts(prev => prev.filter(a => a._id !== alert._id));
            } catch (e) {
              showAlert('Error', e.message, 'error');
            }
          },
        },
      ],
    );
  };

  // ── Delete all ────────────────────────────────────────────────────────────

  const handleDeleteAll = () => {
    const filterLabel = severityFilter !== 'all'
      ? `all ${severityFilter} ${statusFilter}`
      : `all ${statusFilter}`;
    showAlert(
      'Delete All Alerts',
      `This will permanently delete ${filterLabel} alerts. Continue?`,
      'error',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All', style: 'destructive', onPress: async () => {
            setDeleting(true);
            try {
              const params = { status: statusFilter };
              if (severityFilter !== 'all') params.severity = severityFilter;
              const res = await deleteAllAlerts(params);
              showAlert('Deleted', `${res?.deleted ?? 0} alert(s) removed.`, 'success');
              setAlerts([]);
            } catch (e) {
              showAlert('Error', e.message, 'error');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <View style={styles.controls}>
        {/* Status filter + Delete All */}
        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, statusFilter === f && styles.filterTabActive]}
              onPress={() => setStatusFilter(f)}
            >
              <Text style={[styles.filterText, statusFilter === f && styles.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Delete All button */}
          <TouchableOpacity
            style={styles.deleteAllBtn}
            onPress={handleDeleteAll}
            disabled={deleting || alerts.length === 0}
          >
            {deleting
              ? <ActivityIndicator size="small" color={colors.error} />
              : <Icon name="delete-sweep" size={18} color={alerts.length === 0 ? colors.textSecondary : colors.error} />
            }
          </TouchableOpacity>
        </View>

        {/* Severity filter + Scan */}
        <View style={styles.filterRow}>
          {SEVERITIES.map(s => (
            <TouchableOpacity
              key={s}
              style={[
                styles.severityTab,
                severityFilter === s && styles.severityTabActive,
                s !== 'all' && { borderColor: (SEVERITY_COLORS[s] || colors.border) + '66' },
              ]}
              onPress={() => setSeverityFilter(s)}
            >
              <Text style={[styles.severityTabText, severityFilter === s && { color: SEVERITY_COLORS[s] || colors.primary }]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.scanBtn} onPress={handleScan} disabled={scanning}>
            {scanning
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Icon name="refresh" size={16} color={colors.primary} />
            }
          </TouchableOpacity>
        </View>
      </View>

      {loading && alerts.length === 0
        ? <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        : (
          <FlatList
            data={alerts}
            keyExtractor={a => a._id || String(Math.random())}
            renderItem={({ item }) => (
              <AlertRow
                alert={item}
                onAck={handleAck}
                onResolve={handleResolve}
                onDelete={handleDelete}
              />
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />
            }
            contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 32 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Icon name="check-circle" size={48} color={colors.success} />
                <Text style={styles.emptyText}>No {statusFilter} alerts</Text>
              </View>
            }
          />
        )
      }

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
  safe:    { flex: 1, backgroundColor: colors.background },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  controls: { backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center' },

  filterTab:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.backgroundSecondary },
  filterTabActive: { backgroundColor: colors.primary },
  filterText:      { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textSecondary },
  filterTextActive:{ color: '#fff' },

  severityTab:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border },
  severityTabActive:{ backgroundColor: colors.primaryExtraLight },
  severityTabText:  { fontFamily: fonts.medium, fontSize: fonts.xs, color: colors.textSecondary },

  scanBtn:      { marginLeft: 'auto', width: 34, height: 34, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.backgroundSecondary, borderRadius: 8 },
  deleteAllBtn: { marginLeft: 'auto', width: 34, height: 34, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.error + '15', borderRadius: 8 },

  row: {
    backgroundColor: colors.background, borderRadius: 12, padding: 14,
    elevation: 1, borderLeftWidth: 4,
  },
  rowHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  rowHeaderText: { flex: 1 },
  rowDeleteBtn:  { padding: 4 },

  alertType:    { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary, textTransform: 'capitalize' },
  alertTime:    { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, marginTop: 2 },
  severityBadge:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  severityText: { fontFamily: fonts.bold, fontSize: 10 },
  alertMsg:     { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textPrimary, marginBottom: 10 },

  rowActions:   { flexDirection: 'row', gap: 10 },
  ackBtn:       { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.info + '20', alignItems: 'center' },
  ackBtnText:   { fontFamily: fonts.bold, fontSize: fonts.xs, color: colors.info },
  resolveBtn:   { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.success + '20', alignItems: 'center' },
  resolveBtnText:{ fontFamily: fonts.bold, fontSize: fonts.xs, color: colors.success },
  ackStatus:    { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, fontStyle: 'italic' },

  empty:     { flex: 1, alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary },
});

export default AlertsScreen;

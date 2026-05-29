import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DocumentPicker from 'react-native-document-picker';
import { colors } from '../../../constants/colors';
import { fonts } from '../../../constants/fonts';
import Icon from '../../../components/common/Icon';
import BrandedAlert from '../../../components/common/BrandedAlert';
import { uploadWipFile } from '../../../services/productionApi';

const ImportWipScreen = ({ navigation }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [testDelay, setTestDelay] = useState(false); // DEV only
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.pickSingle({ type: [DocumentPicker.types.allFiles] });
      if (!res.name?.endsWith('.xlsx') && !res.name?.endsWith('.xls')) {
        showAlert('Invalid File', 'Please select an Excel (.xlsx) WIP file from GatiSOFT.', 'warning');
        return;
      }
      setFile(res);
      setResult(null);
    } catch (e) {
      if (!DocumentPicker.isCancel(e)) showAlert('Error', e.message, 'error');
    }
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        name: file.name,
      });
      const res = await uploadWipFile(formData, testDelay);
      if (__DEV__) {
        console.log('[WIP Import] upload response keys:', Object.keys(res || {}));
        // Expect: { run: { _id, updated, skipped, errored, unmappedColumns[], rowErrors[], status } }
        console.log('[WIP Import] raw:', JSON.stringify(res)?.slice(0, 500));
        const run = res?.run || res;
        if (run) console.log('[WIP Import] run keys:', Object.keys(run));
      }
      // Backend returns { run: { updated, skipped, errored, unmappedColumns } }
      const run = res?.run || res;

      // If every row errored with "JobCard not found" the orders haven't been
      // uploaded yet — show a friendly prompt instead of a wall of row errors.
      const allJobCardsMissing =
        run?.updated === 0 &&
        run?.skipped === 0 &&
        run?.rowErrors?.length > 0 &&
        run.rowErrors.every(e => e.reason?.includes('upload the Order Excel first'));

      if (allJobCardsMissing) {
        showAlert(
          'Orders Not Uploaded Yet',
          'No job cards were found. Please upload the Orders Excel file first, then come back to upload the WIP file.',
          'warning',
          [
            {
              text: 'Go to Orders Import',
              onPress: () => {
                hideAlert();
                navigation?.navigate('ImportOrders');
              },
            },
            { text: 'Cancel', onPress: hideAlert },
          ],
        );
        return;
      }

      setResult(run);
    } catch (e) {
      showAlert('Upload Failed', e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Icon name="update" size={48} color={colors.primary} />
          <Text style={styles.cardTitle}>Upload WIP File</Text>
          <Text style={styles.cardSub}>
            Upload the "What Is Where" Excel from GatiSOFT to update stage locations for all job cards.
          </Text>

          <TouchableOpacity style={styles.dropZone} onPress={pickFile} activeOpacity={0.8}>
            <Icon name={file ? 'check-circle' : 'cloud-upload'} size={32} color={file ? colors.success : colors.primary} />
            <Text style={[styles.dropText, file && { color: colors.success }]}>
              {file ? file.name : 'Tap to select .xlsx WIP file'}
            </Text>
            {file && <Text style={styles.dropSub}>{(file.size / 1024).toFixed(1)} KB</Text>}
          </TouchableOpacity>

          {/* DEV ONLY — test delay toggle */}
          {__DEV__ && file && !result && (
            <TouchableOpacity
              style={[styles.devToggle, testDelay && styles.devToggleActive]}
              onPress={() => setTestDelay(v => !v)}
              activeOpacity={0.8}
            >
              <Icon name={testDelay ? 'bug-report' : 'bug-report'} size={16} color={testDelay ? colors.warning : colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.devToggleLabel, testDelay && { color: colors.warning }]}>
                  {testDelay ? '⚠️ Test Delay Mode ON' : 'Test Delay Mode (dev)'}
                </Text>
                <Text style={styles.devToggleSub}>
                  Needs ENABLE_WIP_TEST_DELAY=true on server · each stage 1.5× overdue
                </Text>
              </View>
              <View style={[styles.devToggleDot, { backgroundColor: testDelay ? colors.warning : colors.borderLight }]} />
            </TouchableOpacity>
          )}

          {file && !result && (
            <TouchableOpacity
              style={[styles.btn, uploading && styles.btnDisabled, testDelay && styles.btnWarning]}
              onPress={upload}
              disabled={uploading}
              activeOpacity={0.85}
            >
              {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Icon name="upload" size={18} color="#fff" />}
              <Text style={styles.btnText}>
                {uploading ? 'Processing…' : testDelay ? 'Upload (Test Delay)' : 'Upload & Update Stages'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {result && (
          <View style={styles.resultCard}>

            {/* ── Failed run: column header not recognized ── */}
            {result.status === 'failed' ? (
              <>
                <View style={styles.failedHeader}>
                  <Icon name="error" size={24} color={colors.error} />
                  <Text style={styles.failedTitle}>Import Failed</Text>
                </View>
                <Text style={styles.failedMsg}>{result.errorMessage || 'An unknown error occurred.'}</Text>
              </>
            ) : (
              <>
                <Text style={styles.resultTitle}>
                  {result.updated > 0 ? 'WIP Import Complete ✓' : 'WIP Processed — No Changes'}
                </Text>
                <View style={styles.statsRow}>
                  {[
                    { label: 'Updated', value: result.updated ?? 0, color: colors.success },
                    { label: 'Skipped', value: result.skipped ?? 0, color: colors.textSecondary },
                    { label: 'Errors',  value: result.errored ?? 0, color: result.errored > 0 ? colors.error : colors.success },
                  ].map(({ label, value, color }) => (
                    <View key={label} style={[styles.pill, { borderColor: color + '44', backgroundColor: color + '15' }]}>
                      <Text style={[styles.pillValue, { color }]}>{value}</Text>
                      <Text style={styles.pillLabel}>{label}</Text>
                    </View>
                  ))}
                </View>

                {/* Zero-update hint */}
                {result.updated === 0 && result.errored === 0 && result.unmappedColumns?.length === 0 && (
                  <View style={styles.hintBox}>
                    <Icon name="info" size={14} color={colors.info} />
                    <Text style={styles.hintText}>
                      No job cards were updated. Either no orders have been imported yet, or
                      all WIP quantities match the previous snapshot.
                    </Text>
                  </View>
                )}

                {/* Unmapped columns → detect stages + fill column maps */}
                

                {/* Row errors */}
                {result.rowErrors?.length > 0 && (
                  <View style={styles.errorsBox}>
                    <Text style={styles.errorsTitle}>Row Errors ({result.rowErrors.length})</Text>
                    {result.rowErrors.slice(0, 5).map((e, i) => (
                      <Text key={i} style={styles.errorRow}>Row {e.row}: {e.reason}</Text>
                    ))}
                    {result.rowErrors.length > 5 && (
                      <Text style={styles.errorRow}>…and {result.rowErrors.length - 5} more</Text>
                    )}
                  </View>
                )}
              </>
            )}

            {/* View Dashboard button — shown after a successful upload */}
            {result.status !== 'failed' && (
              <TouchableOpacity
                style={styles.dashBtn}
                onPress={() => navigation?.navigate('CapacityDashboard')}
              >
                <Icon name="dashboard" size={18} color="#fff" />
                <Text style={styles.dashBtnText}>View Capacity Dashboard</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.newUploadBtn} onPress={() => { setFile(null); setResult(null); }}>
              <Text style={styles.newUploadText}>Upload another file</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>How WIP Import Works</Text>
          <Text style={styles.tipText}>• Each WIP file is a <Text style={styles.tipBold}>snapshot</Text> — it shows where every piece is right now</Text>
          <Text style={styles.tipText}>• The system <Text style={styles.tipBold}>diffs</Text> the new file vs. the previous one to detect movements</Text>
          <Text style={styles.tipText}>• If a piece is still at the same stage → timer resets to this upload time</Text>
          <Text style={styles.tipText}>• If a piece moved (e.g. CAD→CAM) → movement is recorded and ETA updated</Text>
          <Text style={styles.tipText}>• If a stage column has <Text style={styles.tipBold}>0</Text> for a piece → that piece left that stage</Text>
          <Text style={styles.tipText}>• Alerts, baselines and capacity dashboard refresh automatically after upload</Text>
          <Text style={styles.tipText}>• Upload orders first — WIP requires existing job cards</Text>
        </View>
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
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  card: {
    backgroundColor: colors.background, borderRadius: 14, padding: 24,
    alignItems: 'center', gap: 10, elevation: 2,
  },
  cardTitle: { fontFamily: fonts.bold, fontSize: fonts.xl, color: colors.textPrimary },
  cardSub: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, textAlign: 'center' },
  dropZone: {
    width: '100%', borderWidth: 2, borderColor: colors.primary + '55', borderStyle: 'dashed',
    borderRadius: 12, paddingVertical: 32, alignItems: 'center', gap: 8,
    backgroundColor: colors.primaryExtraLight,
  },
  dropText: { fontFamily: fonts.medium, fontSize: fonts.base, color: colors.primary },
  dropSub: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary,
    paddingVertical: 14, paddingHorizontal: 32, borderRadius: 10, marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnWarning: { backgroundColor: colors.warning },
  btnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fonts.base },
  devToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%',
    borderWidth: 1, borderColor: colors.borderLight, borderRadius: 10,
    padding: 12, marginTop: 8, backgroundColor: colors.backgroundSecondary,
  },
  devToggleActive: { borderColor: colors.warning + '80', backgroundColor: colors.warning + '10' },
  devToggleLabel: { fontFamily: fonts.bold, fontSize: fonts.xs, color: colors.textSecondary },
  devToggleSub: { fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  devToggleDot: { width: 12, height: 12, borderRadius: 6 },
  resultCard: { backgroundColor: colors.background, borderRadius: 14, padding: 20, elevation: 2 },
  resultTitle: { fontFamily: fonts.bold, fontSize: fonts.lg, color: colors.textPrimary, marginBottom: 16, textAlign: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', gap: 8 },
  pill: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 10, alignItems: 'center' },
  pillValue: { fontFamily: fonts.bold, fontSize: fonts.xl },
  pillLabel: { fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  failedHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  failedTitle:   { fontFamily: fonts.bold, fontSize: fonts.lg, color: colors.error },
  failedMsg:     { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textPrimary, lineHeight: 20 },
  hintBox:       { flexDirection: 'row', gap: 8, backgroundColor: colors.info + '15', borderRadius: 8, padding: 10, marginTop: 12 },
  hintText:      { flex: 1, fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.info, lineHeight: 18 },
  unmappedBox: {
    marginTop: 16, backgroundColor: colors.warning + '15', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: colors.warning + '44', gap: 6,
  },
  unmappedHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unmappedTitle: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.warning },
  unmappedText:  { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textPrimary },
  unmappedSub:   { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary, lineHeight: 18 },
  detectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6,
    backgroundColor: colors.primary, borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  detectBtnText: { flex: 1, color: '#fff', fontFamily: fonts.bold, fontSize: fonts.sm },
  fixLinkRow:    { alignItems: 'flex-start', marginTop: 2 },
  fixLink:       { color: colors.primary, fontFamily: fonts.medium, fontSize: fonts.xs },
  errorsBox:     { marginTop: 12, backgroundColor: colors.error + '10', borderRadius: 8, padding: 10 },
  errorsTitle:   { fontFamily: fonts.bold, fontSize: fonts.xs, color: colors.error, marginBottom: 6 },
  errorRow:      { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textPrimary, marginBottom: 3 },
  dashBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.primary, borderRadius: 10,
    paddingVertical: 13, marginTop: 16,
  },
  dashBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fonts.base },
  newUploadBtn:  { marginTop: 10, alignItems: 'center', padding: 10 },
  newUploadText: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: fonts.sm },
  tipCard: { backgroundColor: colors.background, borderRadius: 14, padding: 16, elevation: 1 },
  tipTitle: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary, marginBottom: 8 },
  tipText: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, marginBottom: 4, lineHeight: 20 },
  tipBold: { fontFamily: fonts.bold, color: colors.textPrimary },
});

export default ImportWipScreen;

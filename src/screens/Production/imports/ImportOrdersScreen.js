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
import { uploadOrdersFile } from '../../../services/productionApi';

const ImportOrdersScreen = ({ navigation }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'info', buttons = []) =>
    setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.allFiles],
      });
      if (!res.name?.endsWith('.xlsx') && !res.name?.endsWith('.xls')) {
        showAlert('Invalid File', 'Please select an Excel (.xlsx) file exported from GatiSOFT.', 'warning');
        return;
      }
      setFile(res);
      setResult(null);
    } catch (e) {
      if (!DocumentPicker.isCancel(e)) {
        showAlert('Error', e.message, 'error');
      }
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
      const res = await uploadOrdersFile(formData);
      if (__DEV__) {
        console.log('[Imports] upload response keys:', Object.keys(res || {}));
        // Expect: { run: { _id, inserted, updated, skipped, errored, unmappedColumns[], rowErrors[], status } }
        console.log('[Imports] raw:', JSON.stringify(res)?.slice(0, 500));
        const run = res?.run || res;
        if (run) console.log('[Imports] run keys:', Object.keys(run));
      }
      // Backend returns { run: { inserted, updated, skipped, errored, unmappedColumns, _id } }
      setResult(res?.run || res);
    } catch (e) {
      if (__DEV__) console.error('[Imports] upload error:', e.message);
      showAlert('Upload Failed', e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Icon name="file-upload" size={48} color={colors.primary} style={styles.cardIcon} />
          <Text style={styles.cardTitle}>Upload Order File</Text>
          <Text style={styles.cardSub}>Select a GatiSOFT Order Excel (.xlsx) file to import job cards into the system.</Text>

          <TouchableOpacity style={styles.dropZone} onPress={pickFile} activeOpacity={0.8}>
            <Icon name={file ? 'check-circle' : 'cloud-upload'} size={32} color={file ? colors.success : colors.primary} />
            <Text style={[styles.dropText, file && { color: colors.success }]}>
              {file ? file.name : 'Tap to select .xlsx file'}
            </Text>
            {file && <Text style={styles.dropSub}>{(file.size / 1024).toFixed(1)} KB</Text>}
          </TouchableOpacity>

          {file && !result && (
            <TouchableOpacity
              style={[styles.btn, uploading && styles.btnDisabled]}
              onPress={upload}
              disabled={uploading}
              activeOpacity={0.85}
            >
              {uploading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Icon name="upload" size={18} color="#fff" />}
              <Text style={styles.btnText}>{uploading ? 'Uploading…' : 'Upload & Process'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Import Complete</Text>
            <View style={styles.statsRow}>
              <StatPill label="Inserted" value={result.inserted ?? 0} color={colors.success} />
              <StatPill label="Updated" value={result.updated ?? 0} color={colors.info} />
              <StatPill label="Skipped" value={result.skipped ?? 0} color={colors.textSecondary} />
              <StatPill label="Errors" value={result.errored ?? 0} color={result.errored > 0 ? colors.error : colors.success} />
            </View>
            {result.errored > 0 && (
              <TouchableOpacity
                style={styles.viewRunBtn}
                onPress={() => navigation.navigate('ImportHistory', { runId: result._id })}
              >
                <Text style={styles.viewRunText}>View error details →</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.newUploadBtn} onPress={() => { setFile(null); setResult(null); }}>
              <Text style={styles.newUploadText}>Upload another file</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Tips</Text>
          <Text style={styles.tipText}>• Export the order file from GatiSOFT as Excel (.xlsx)</Text>
          <Text style={styles.tipText}>• Max file size: 25 MB</Text>
          <Text style={styles.tipText}>• Re-uploading the same file is safe — existing job cards will not be duplicated</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ImportHistory')}>
            <Text style={styles.historyLink}>→ View import history</Text>
          </TouchableOpacity>
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

const StatPill = ({ label, value, color }) => (
  <View style={[styles.pill, { borderColor: color + '44', backgroundColor: color + '15' }]}>
    <Text style={[styles.pillValue, { color }]}>{value}</Text>
    <Text style={styles.pillLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  card: {
    backgroundColor: colors.background, borderRadius: 14, padding: 24,
    alignItems: 'center', elevation: 2,
  },
  cardIcon: { marginBottom: 12 },
  cardTitle: { fontFamily: fonts.bold, fontSize: fonts.xl, color: colors.textPrimary, marginBottom: 8 },
  cardSub: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  dropZone: {
    width: '100%', borderWidth: 2, borderColor: colors.primary + '55', borderStyle: 'dashed',
    borderRadius: 12, paddingVertical: 32, alignItems: 'center', gap: 8,
    backgroundColor: colors.primaryExtraLight,
  },
  dropText: { fontFamily: fonts.medium, fontSize: fonts.base, color: colors.primary },
  dropSub: { fontFamily: fonts.regular, fontSize: fonts.xs, color: colors.textSecondary },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary,
    paddingVertical: 14, paddingHorizontal: 32, borderRadius: 10, marginTop: 20,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fonts.base },
  resultCard: { backgroundColor: colors.background, borderRadius: 14, padding: 20, elevation: 2 },
  resultTitle: { fontFamily: fonts.bold, fontSize: fonts.lg, color: colors.textPrimary, marginBottom: 16, textAlign: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  pill: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 10, alignItems: 'center' },
  pillValue: { fontFamily: fonts.bold, fontSize: fonts.xl },
  pillLabel: { fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  viewRunBtn: { marginTop: 16, alignItems: 'center' },
  viewRunText: { color: colors.primary, fontFamily: fonts.medium, fontSize: fonts.sm },
  newUploadBtn: { marginTop: 12, alignItems: 'center', padding: 10 },
  newUploadText: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: fonts.sm },
  tipCard: { backgroundColor: colors.background, borderRadius: 14, padding: 16, elevation: 1 },
  tipTitle: { fontFamily: fonts.bold, fontSize: fonts.sm, color: colors.textPrimary, marginBottom: 8 },
  tipText: { fontFamily: fonts.regular, fontSize: fonts.sm, color: colors.textSecondary, marginBottom: 4 },
  historyLink: { color: colors.primary, fontFamily: fonts.medium, fontSize: fonts.sm, marginTop: 12 },
});

export default ImportOrdersScreen;

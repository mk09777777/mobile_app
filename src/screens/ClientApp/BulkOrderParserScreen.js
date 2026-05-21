import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import catalogApi from '../../services/catalogApi';
import { CATALOG_API_BASE_URL } from '../../config/catalogApiConfig';
import { colors } from '../../constants/colors';
import { computeUnitPriceFromSource, getPricingContext } from '../../services/clientPricingEngine';
import MicImage from '../../assets/images/mic.png';

const titleCase = (value) =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

const BulkOrderParserScreen = ({ navigation }) => {
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parsedLines, setParsedLines] = useState([]);
  const [result, setResult] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isSpeechReady, setIsSpeechReady] = useState(true);
  const timerRef = useRef(null);
  const recorderRef = useRef(new AudioRecorderPlayer());
  const [recordingPath, setRecordingPath] = useState('');

  const unresolvedItems = useMemo(
    () => (Array.isArray(result?.items) ? result.items.filter((item) => item?.status !== 'matched') : []),
    [result?.items],
  );

  useEffect(() => {
    const recorder = recorderRef.current;
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorder.stopRecorder().catch(() => undefined);
      recorder.removeRecordBackListener();
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    setRecordingSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
    return undefined;
  }, [isRecording]);

  const requestMicPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
    const micGranted = results?.[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
    return !!micGranted;
  };

  const toggleRecording = async () => {
    if (!isSpeechReady) return;
    setError('');
    try {
      if (isRecording) {
        const result = await recorderRef.current.stopRecorder();
        recorderRef.current.removeRecordBackListener();
        setIsRecording(false);
        const path = String(result || recordingPath || '').trim();
        if (!path) {
          setError('Recording path not found.');
          return;
        }
        setRecordingPath(path);
        const fileInfo = await RNFS.stat(path).catch(() => null);
        const fileSize = Number(fileInfo?.size || 0);
        if (!fileSize || fileSize < 2048) {
          setError('No speech detected. Please record for at least 1-2 seconds and try again.');
          return;
        }
        const uploadUri = path.startsWith('file://') ? path : `file://${path}`;
        const fileName = `bulk_order_${Date.now()}.m4a`;
        const mimeType = Platform.OS === 'ios' ? 'audio/m4a' : 'audio/mp4';
        if (__DEV__) {
          console.log('[BulkOrderParserScreen] transcribe upload', {
            apiBase: CATALOG_API_BASE_URL,
            path,
            uploadUri,
            fileSize,
            mimeType,
          });
        }
        const form = new FormData();
        form.append('audio', {
          uri: uploadUri,
          name: fileName,
          type: mimeType,
        });
        const tr = await catalogApi.postForm('/bulk-orders/transcribe', form);
        const transcript = String(tr?.transcript || '').trim();
        if (!transcript) {
          setError('No speech detected. Please speak clearly and try again.');
          return;
        }
        setRawText(transcript);
        return;
      }
      const hasPermission = await requestMicPermissions();
      if (!hasPermission) {
        setError('Microphone permission is required to transcribe your voice note.');
        return;
      }
      const path = Platform.select({
        ios: 'bulk_order_note.m4a',
        android: `${RNFS.CachesDirectoryPath}/bulk_order_note_${Date.now()}.m4a`,
      });
      const uri = await recorderRef.current.startRecorder(path);
      recorderRef.current.addRecordBackListener((e) => {
        const timeInSeconds = Math.floor(Number(e?.currentPosition || 0) / 1000);
        setRecordingSeconds(timeInSeconds);
      });
      setRecordingPath(String(uri || path || ''));
      setRecordingSeconds(0);
      setIsRecording(true);
    } catch (voiceError) {
      setIsRecording(false);
      const message = String(voiceError?.message || 'Could not start voice capture.');
      const status = voiceError?.status ? ` (status ${voiceError.status})` : '';
      if (__DEV__) {
        console.log('[BulkOrderParserScreen] recording/transcribe error', {
          message,
          status: voiceError?.status,
          data: voiceError?.data,
        });
      }
      setError(`${message}${status}`);
    }
  };

  const formatRecordingTime = (seconds) => {
    const safeSeconds = Math.max(0, Number(seconds || 0));
    const mins = Math.floor(safeSeconds / 60)
      .toString()
      .padStart(1, '0');
    const secs = (safeSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const submitForParse = async (payload) => {
    if (__DEV__) {
      console.log('[BulkOrderParserScreen] submitForParse:start', {
        hasRawText: !!payload?.rawText,
        rawTextLength: String(payload?.rawText || '').length,
        parsedLinesCount: Array.isArray(payload?.parsedLines) ? payload.parsedLines.length : 0,
        overridesCount: payload?.overrides ? Object.keys(payload.overrides).length : 0,
      });
    }
    setLoading(true);
    setError('');
    try {
      const response = await catalogApi.post('/bulk-orders/parse', payload);
      if (__DEV__) {
        console.log('[BulkOrderParserScreen] submitForParse:success', {
          requestId: response?.requestId || null,
          itemsParsedCount: Number(response?.itemsParsedCount || 0),
          itemsResolvedCount: Number(response?.itemsResolvedCount || 0),
          allResolved: !!response?.allResolved,
        });
      }
      setResult(response || null);
      if (Array.isArray(response?.parsedLines)) {
        setParsedLines(response.parsedLines);
      }
      return response;
    } catch (err) {
      if (__DEV__) {
        console.log('[BulkOrderParserScreen] submitForParse:error', {
          message: err?.message || 'unknown error',
        });
      }
      setError(err?.message || 'Failed to parse order text');
      return null;
    } finally {
      if (__DEV__) {
        console.log('[BulkOrderParserScreen] submitForParse:complete');
      }
      setLoading(false);
    }
  };

  const onInitialParse = async () => {
    if (isRecording) {
      try {
        await recorderRef.current.stopRecorder();
        recorderRef.current.removeRecordBackListener();
      } catch {
        // no-op: parsing can proceed with the latest transcript text
      }
      setIsRecording(false);
    }
    const text = String(rawText || '').trim();
    if (__DEV__) {
      console.log('[BulkOrderParserScreen] onInitialParse', { textLength: text.length });
    }
    if (!text) {
      setError('Paste or dictate your bulk order first.');
      return;
    }
    setOverrides({});
    await submitForParse({ rawText: text });
  };

  const onResolveMissing = async () => {
    if (__DEV__) {
      console.log('[BulkOrderParserScreen] onResolveMissing', {
        parsedLinesCount: Array.isArray(parsedLines) ? parsedLines.length : 0,
        overrides,
      });
    }
    if (!Array.isArray(parsedLines) || parsedLines.length === 0) return;
    await submitForParse({
      parsedLines,
      overrides,
    });
  };

  const setOverride = (lineRef, field, value) => {
    if (__DEV__) {
      console.log('[BulkOrderParserScreen] setOverride', {
        lineRef,
        field,
        value,
      });
    }
    setOverrides((prev) => ({
      ...prev,
      [lineRef]: {
        ...(prev[lineRef] || {}),
        [field]: value,
      },
    }));
  };

  const goToReview = async () => {
    if (__DEV__) {
      console.log('[BulkOrderParserScreen] goToReview', {
        requestId: result?.requestId || null,
        allResolved: !!result?.allResolved,
        itemsParsedCount: Number(result?.itemsParsedCount || 0),
      });
    }
    if (!result?.allResolved || !result?.orderReviewPayload) return;
    let enrichedLines = Array.isArray(result?.orderReviewPayload?.selectedProductLines)
      ? result.orderReviewPayload.selectedProductLines
      : [];
    try {
      const pricingContext = await getPricingContext();
      enrichedLines = enrichedLines.map((line) => {
        const pricingSource = line?.pricingSource || {};
        const computedUnit =
          (pricingContext
            ? computeUnitPriceFromSource(pricingSource, result?.orderReviewPayload?.selectedFilters || {}, pricingContext)
            : 0) || 0;
        const resolvedDescription = String(
          line?.description ||
            line?.subcategoryDescription ||
            result?.orderReviewPayload?.productDescription ||
            'Description',
        );
        return {
          ...line,
          description: resolvedDescription,
          imageUrl: String(
            line?.imageUrl ||
              line?.subcategoryThumbnailImage ||
              result?.orderReviewPayload?.subcategoryThumbnailImage ||
              result?.orderReviewPayload?.productImageUrl ||
              '',
          ),
          unitPrice: Number(computedUnit || line?.unitPrice || 0),
        };
      });
      if (__DEV__) {
        console.log('[BulkOrderParserScreen] pricing enriched for review', {
          lines: enrichedLines.length,
          pricedLines: enrichedLines.filter((line) => Number(line?.unitPrice || 0) > 0).length,
          productDescription: result?.orderReviewPayload?.productDescription || '',
          firstLineDescription: enrichedLines?.[0]?.description || '',
        });
      }
    } catch (priceError) {
      if (__DEV__) {
        console.log('[BulkOrderParserScreen] pricing enrichment failed', {
          message: priceError?.message || 'unknown',
        });
      }
    }

    navigation.navigate('OrderReview', {
      ...result.orderReviewPayload,
      selectedProductLines: enrichedLines,
      parsedItemsCount: Number(result.itemsParsedCount || 0),
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.8} onPress={navigation.goBack}>
          <MaterialIcons name="chevron-left" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bulk order</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.promptTitle}>Say your order or type it below</Text>
        <Text style={styles.promptSubtitle}>
          We&apos;ll parse shapes, carats, karats, finishes & qty. Use the mic, or paste text from email or notes.
        </Text>

        <TouchableOpacity
          style={[styles.micButton, isRecording && styles.micButtonActive, !isSpeechReady && styles.micButtonDisabled]}
          activeOpacity={0.85}
          onPress={toggleRecording}
          disabled={loading || !isSpeechReady}>
          <Image source={MicImage} style={styles.micImage} resizeMode="contain" />
        </TouchableOpacity>

        <Text style={styles.recordingStatus}>
          {isRecording
            ? `Recording · ${formatRecordingTime(recordingSeconds)}`
            : rawText
              ? 'Order text ready'
              : 'Tap the mic to dictate'}
        </Text>

        <View style={styles.transcriptCard}>
          <Text style={styles.transcriptTitle}>Your order text</Text>
          <TextInput
            style={styles.transcriptInput}
            value={rawText}
            onChangeText={(text) => {
              setRawText(text);
              if (error) setError('');
            }}
            placeholder="Type or paste your order here, or use the mic above…"
            placeholderTextColor="#9CA3AF"
            multiline
            editable={!loading}
            textAlignVertical="top"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={onInitialParse}
          disabled={loading || !String(rawText || '').trim()}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Parse this order</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          activeOpacity={0.8}
          onPress={navigation.goBack}
          disabled={loading}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        {result ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultMeta}>
              Parsed {Number(result?.itemsParsedCount || 0)} item(s) · Resolved {Number(result?.itemsResolvedCount || 0)}
            </Text>
            {Array.isArray(result?.items)
              ? result.items.map((item) => (
                  <View key={item.lineRef} style={styles.itemBlock}>
                    <Text style={styles.itemTitle}>
                      {item.lineRef} · {item.status === 'matched' ? 'Matched' : 'Needs input'}
                    </Text>
                    <Text style={styles.itemText}>
                      {item.category || 'Category?'} / {item.subcategoryProfile || 'Profile?'} / {item.subcategory || 'Subcategory?'}
                    </Text>
                    <Text style={styles.itemText}>
                      W:{item.qtyWhite || 0} Y:{item.qtyYellow || 0} R:{item.qtyRose || 0}
                    </Text>

                    {Array.isArray(item?.missingFields) && item.missingFields.length > 0
                      ? item.missingFields.map((missing) => (
                          <View key={`${item.lineRef}-${missing.field}`} style={styles.missingBlock}>
                            <Text style={styles.missingTitle}>{titleCase(missing.label || missing.field)}</Text>
                            {Array.isArray(missing.options) && missing.options.length > 0 ? (
                              <View style={styles.optionsWrap}>
                                {missing.options.map((opt) => {
                                  const selected = overrides?.[item.lineRef]?.[missing.field] === opt.value;
                                  return (
                                    <TouchableOpacity
                                      key={`${item.lineRef}-${missing.field}-${opt.value}`}
                                      style={[styles.optionChip, selected && styles.optionChipSelected]}
                                      activeOpacity={0.8}
                                      onPress={() => setOverride(item.lineRef, missing.field, opt.value)}>
                                      <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>
                                        {opt.label}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            ) : (
                              <TextInput
                                style={styles.inlineInput}
                                value={String(overrides?.[item.lineRef]?.[missing.field] || '')}
                                onChangeText={(value) => setOverride(item.lineRef, missing.field, value)}
                                placeholder={`Enter ${missing.field}`}
                                placeholderTextColor="#9AA3AD"
                              />
                            )}
                          </View>
                        ))
                      : null}
                  </View>
                ))
              : null}

            {unresolvedItems.length > 0 ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.85}
                onPress={onResolveMissing}
                disabled={loading}>
                <Text style={styles.secondaryButtonText}>Resolve Missing Fields</Text>
              </TouchableOpacity>
            ) : null}

            {result?.allResolved && result?.orderReviewPayload ? (
              <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={goToReview}>
                <Text style={styles.primaryButtonText}>Continue to Review ({Number(result?.itemsParsedCount || 0)})</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  headerRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
    backgroundColor: '#0F5F65',
  },
  headerBackButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1 },
  contentContainer: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 34 },
  promptTitle: { color: '#0F5F65', fontSize: 14, fontWeight: '700', lineHeight: 38 },
  promptSubtitle: { color: '#6B7280', marginTop: 6, fontSize: 14, lineHeight: 28 },
  micButton: {
    marginTop: 24,
    width: 196,
    height: 196,
    borderRadius: 98,
    alignSelf: 'center',
    backgroundColor: '#C8A95A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: '#B88F3D',
  },
  micButtonDisabled: {
    opacity: 0.45,
  },
  micImage: {
    width: 88,
    height: 88,
  },
  recordingStatus: {
    marginTop: 16,
    alignSelf: 'center',
    color: '#C06C75',
    fontSize: 16,
    fontWeight: '500',
  },
  transcriptCard: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    padding: 16,
  },
  transcriptTitle: {
    color: '#0F5F65',
    fontSize: 14,
    fontWeight: '700',
  },
  transcriptInput: {
    marginTop: 10,
    color: '#2B2B2B',
    fontSize: 12,
    lineHeight: 27,
    minHeight: 120,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  errorText: { color: '#B91C1C', marginTop: 8, fontSize: 12 },
  primaryButton: {
    marginTop: 18,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0F5F65',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  cancelButton: {
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24,
  },
  cancelButtonText: { color: '#4B5563', fontSize: 16, fontWeight: '400' },
  secondaryButton: {
    marginTop: 10,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E3F1F3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonText: { color: '#0F5F65', fontSize: 13, fontWeight: '600' },
  resultCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFF',
    padding: 12,
    gap: 8,
  },
  resultMeta: { color: '#0F5F65', fontSize: 13, fontWeight: '600' },
  itemBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
  },
  itemTitle: { color: '#111827', fontSize: 13, fontWeight: '600' },
  itemText: { color: '#4B5563', fontSize: 12, marginTop: 2 },
  missingBlock: { marginTop: 8 },
  missingTitle: { color: '#374151', fontSize: 12, marginBottom: 4 },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionChip: {
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  optionChipSelected: {
    backgroundColor: '#0F5F65',
    borderColor: '#0F5F65',
  },
  optionChipText: { color: '#334155', fontSize: 12 },
  optionChipTextSelected: { color: '#FFF' },
  inlineInput: {
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    color: '#111827',
  },
});

export default BulkOrderParserScreen;

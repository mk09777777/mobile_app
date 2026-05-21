import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';

const PdfViewer = ({ url, style }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Default random PDF if none provided
  const targetUrl = url || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

  // For Android, WebView cannot render PDF directly natively, so we wrap it in the Google Docs Viewer.
  // iOS renders PDFs natively inside WebView without the wrapper.
  const viewerUrl = Platform.OS === 'android'
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(targetUrl)}&embedded=true`
    : targetUrl;

  return (
    <View style={[styles.container, style]}>
      {loading && !error && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors?.primary || '#D4AF37'} />
          <Text style={styles.loadingText}>Loading PDF...</Text>
        </View>
      )}
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load PDF</Text>
          <Text style={styles.errorSubText}>The document might be unavailable or restricted.</Text>
        </View>
      ) : (
        <WebView
          source={{ uri: viewerUrl }}
          style={styles.webview}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          onHttpError={() => {
            setLoading(false);
            setError(true);
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          scalesPageToFit={true}
          originWhitelist={['*']}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 10,
    color: colors?.primary || '#D4AF37',
    fontFamily: fonts?.medium,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    color: colors?.error || '#EF4444',
    fontFamily: fonts?.bold,
    fontSize: 18,
    marginBottom: 8,
  },
  errorSubText: {
    color: colors?.textSecondary || '#666',
    fontFamily: fonts?.regular,
    fontSize: 14,
    textAlign: 'center',
  },
});

export default PdfViewer;
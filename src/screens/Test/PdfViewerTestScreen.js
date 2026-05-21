import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import PdfViewer from '../../components/common/PdfViewer';

const PdfViewerTestScreen = () => {
  // Rendering a random sample PDF (W3C dummy PDF)
  const randomPdfUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

  return (
    <SafeAreaView style={styles.container}>
      <PdfViewer url={randomPdfUrl} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default PdfViewerTestScreen;
import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Image,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import ImageZoom from 'react-native-image-pan-zoom';

const ProductImageViewerScreen = ({ route, navigation }) => {
  const images = Array.isArray(route?.params?.images)
    ? route.params.images.filter(Boolean)
    : [];
  const title = route?.params?.title || '';
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(Math.max(0, route?.params?.initialIndex ?? 0), Math.max(0, images.length - 1)),
  );
  const [imageAreaSize, setImageAreaSize] = useState({ width: 0, height: 0 });

  const onImageAreaLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    setImageAreaSize({ width, height });
  }, []);

  const goTo = (next) => {
    const clamped = Math.max(0, Math.min(images.length - 1, next));
    if (clamped !== currentIndex) setCurrentIndex(clamped);
  };

  if (!images.length) {
    return (
      <View style={styles.emptyContainer}>
        <SafeAreaView>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </SafeAreaView>
        <Text style={styles.emptyText}>No images available</Text>
      </View>
    );
  }

  const uri = images[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === images.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.safeArea}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          {title ? (
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          ) : (
            <View style={styles.headerFlex} />
          )}
          {images.length > 1 ? (
            <View style={styles.counterPill}>
              <Text style={styles.counterText}>{currentIndex + 1} / {images.length}</Text>
            </View>
          ) : (
            <View style={styles.counterPill} />
          )}
        </View>

        {/* Image with zoom */}
        <View style={styles.imageArea} onLayout={onImageAreaLayout}>
          {imageAreaSize.width > 0 && imageAreaSize.height > 0 && (
            <ImageZoom
              key={currentIndex}
              cropWidth={imageAreaSize.width}
              cropHeight={imageAreaSize.height}
              imageWidth={imageAreaSize.width}
              imageHeight={imageAreaSize.height}
              enableSwipeDown={false}
              pinchToZoom
              panToMove
            >
              <Image
                source={{ uri }}
                style={{ width: imageAreaSize.width, height: imageAreaSize.height }}
                resizeMode="contain"
              />
            </ImageZoom>
          )}
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomSection}>
          {images.length > 1 && (
            <View style={styles.dotsRow}>
              {images.map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => goTo(i)}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                  <View style={[styles.dot, i === currentIndex && styles.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {images.length > 1 && (
            <View style={styles.navRow}>
              <TouchableOpacity
                onPress={() => goTo(currentIndex - 1)}
                disabled={isFirst}
                style={[styles.navBtn, isFirst && styles.navBtnDisabled]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.navBtnText, isFirst && styles.navBtnTextDisabled]}>‹</Text>
              </TouchableOpacity>
              <View style={styles.navSpacer} />
              <TouchableOpacity
                onPress={() => goTo(currentIndex + 1)}
                disabled={isLast}
                style={[styles.navBtn, isLast && styles.navBtnDisabled]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.navBtnText, isLast && styles.navBtnTextDisabled]}>›</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '400',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
  },
  headerFlex: {
    flex: 1,
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 12,
    color: '#111827',
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
  },
  counterPill: {
    minWidth: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  counterText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '400',
  },
  imageArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  bottomSection: {
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    width: 20,
    backgroundColor: '#1F5A62',
    borderRadius: 4,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navSpacer: {
    flex: 1,
  },
  navBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1F5A62',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  navBtnText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 34,
    marginTop: -2,
  },
  navBtnTextDisabled: {
    color: '#9CA3AF',
  },
});

export default ProductImageViewerScreen;

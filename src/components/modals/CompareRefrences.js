import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, ActivityIndicator,
  TouchableOpacity, ScrollView, Image, Dimensions,
} from 'react-native';
import ImageZoom from 'react-native-image-pan-zoom';
import Video from 'react-native-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '../common/Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { FILE_BASE_URL } from '../../config/apiConfig';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const THUMB_SIZE = 90;
const PANE_H     = (SCREEN_H - 2) / 2;

const resolveMediaUri = async (imgObj) => {
  const key = imgObj?.Key || imgObj?.key;
  const id  = imgObj?.Id  || imgObj?.id || imgObj?._id;
  if (!key && !id) return null;
  const apiUrl = key
    ? `${FILE_BASE_URL}/api/enquiries/files/${encodeURIComponent(key)}`
    : `${FILE_BASE_URL}/api/enquiries/files/${id}`;
  try {
    const token   = await AsyncStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const resp    = await fetch(apiUrl, { headers });
    if (!resp.ok) return null;
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const j   = await resp.json();
      const url = j.url || j.imageUrl || j.src || j.location;
      return url ? { uri: url } : null;
    }
    return { uri: apiUrl, headers };
  } catch {
    return null;
  }
};

const isVideoMime = (mime) =>
  typeof mime === 'string' && mime.toLowerCase().startsWith('video/');

const CompareView = ({ refItem, designItem, onClose }) => {
  const [refPaused,    setRefPaused]    = useState(true);
  const [designPaused, setDesignPaused] = useState(true);

  const renderHalf = (item, paused, setPaused, height) => {
    if (!item) {
      return (
        <View style={[{ width: SCREEN_W, height }, s.emptyHalf]}>
          <Icon name="image-not-supported" size={28} color="rgba(255,255,255,0.2)" />
          <Text style={s.emptyHalfText}>No image</Text>
        </View>
      );
    }
    if (item.isVideo) {
      return (
        <TouchableOpacity style={{ width: SCREEN_W, height }} onPress={() => setPaused(p => !p)} activeOpacity={1}>
          <Video
            source={item.source}
            style={{ width: SCREEN_W, height }}
            resizeMode="contain"
            paused={paused}
            controls={false}
            repeat={false}
          />
          {paused && (
            <View style={s.playOverlay}>
              <Icon name="play-circle-filled" size={52} color="rgba(255,255,255,0.9)" />
            </View>
          )}
        </TouchableOpacity>
      );
    }
    return (
      <ImageZoom
        cropWidth={SCREEN_W}
        cropHeight={height}
        imageWidth={SCREEN_W}
        imageHeight={height}
        minScale={1}
        maxScale={5}
      >
        <Image source={item.source} style={{ width: SCREEN_W, height }} resizeMode="contain" />
      </ImageZoom>
    );
  };

  return (
    <Modal visible animationType="fade" transparent={false} onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>

        <View style={{ height: PANE_H, backgroundColor: '#0a0a0a' }}>
          <View style={s.compareLabel}>
            <Text style={s.compareLabelText}>Reference</Text>
          </View>
          {renderHalf(refItem, refPaused, setRefPaused, PANE_H)}
        </View>

        <View style={s.compareDivider} />

        <View style={{ height: PANE_H, backgroundColor: '#0a0a0a' }}>
          <View style={[s.compareLabel, { top: 10 }]}>
            <Text style={s.compareLabelText}>Coral / CAD</Text>
          </View>
          {renderHalf(designItem, designPaused, setDesignPaused, PANE_H)}
        </View>

        <TouchableOpacity style={s.compareClose} onPress={onClose} activeOpacity={0.8}>
          <Icon name="close" size={20} color="#fff" />
        </TouchableOpacity>

      </View>
    </Modal>
  );
};

const Thumbnail = ({ item, selected, onPress }) => (
  <TouchableOpacity
    style={[s.thumb, selected && s.thumbSelected]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    {item.isVideo ? (
      <View style={s.thumbInner}>
        <Icon name="play-circle-filled" size={26} color="rgba(255,255,255,0.85)" />
      </View>
    ) : (
      <Image source={item.source} style={s.thumbInner} resizeMode="cover" />
    )}
    {selected && <View style={s.thumbSelectedDot} />}
  </TouchableOpacity>
);

const ThumbRow = ({ label, items, selectedIndex, onSelect }) => (
  <View style={s.row}>
    <View style={s.rowHeader}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowCount}>{items.length} image{items.length !== 1 ? 's' : ''}</Text>
    </View>
    {items.length === 0 ? (
      <View style={s.rowEmpty}>
        <Icon name="image-not-supported" size={22} color="rgba(255,255,255,0.2)" />
        <Text style={s.rowEmptyText}>No images</Text>
      </View>
    ) : (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.rowScroll}
      >
        {items.map((item, i) => (
          <Thumbnail
            key={i}
            item={item}
            selected={selectedIndex === i}
            onPress={() => onSelect(i)}
          />
        ))}
      </ScrollView>
    )}
  </View>
);

export default function CompareRefrences({ visible, onClose, fullEnquiry, isFetchingEnquiry }) {
  const [refItems,    setRefItems]    = useState([]);
  const [designItems, setDesignItems] = useState([]);
  const [isLoading,   setIsLoading]   = useState(false);

  const [selectedRef,    setSelectedRef]    = useState(0);
  const [selectedDesign, setSelectedDesign] = useState(0);
  const [comparing,      setComparing]      = useState(false);

  const load = useCallback(async () => {
    if (!fullEnquiry) return;
    setIsLoading(true);
    setRefItems([]);
    setDesignItems([]);
    setSelectedRef(0);
    setSelectedDesign(0);

    const refImages = Array.isArray(fullEnquiry.ReferenceImages) ? fullEnquiry.ReferenceImages : [];

    const allVersions = [
      ...(Array.isArray(fullEnquiry.Coral) ? fullEnquiry.Coral.map(v => ({ ...v, _stage: 'Coral' })) : []),
      ...(Array.isArray(fullEnquiry.Cad)   ? fullEnquiry.Cad.map(v => ({ ...v, _stage: 'CAD' }))     : []),
    ].sort((a, b) => new Date(a.CreatedDate || 0) - new Date(b.CreatedDate || 0));

    const designRaw = [];
    for (const version of allVersions) {
      for (const img of (Array.isArray(version.Images) ? version.Images : [])) {
        designRaw.push({ imgObj: img, label: `${version._stage} v${version.Version || ''}` });
      }
    }

    const [refResolved, designResolved] = await Promise.all([
      Promise.all(refImages.map(async (img) => {
        const source = await resolveMediaUri(img);
        if (!source) return null;
        return { source, isVideo: isVideoMime(img.MimeType || img.mimeType), label: img.Description || img.description || '' };
      })),
      Promise.all(designRaw.map(async ({ imgObj, label }) => {
        const source = await resolveMediaUri(imgObj);
        if (!source) return null;
        return { source, isVideo: isVideoMime(imgObj.MimeType || imgObj.mimeType), label };
      })),
    ]);

    setRefItems(refResolved.filter(Boolean));
    setDesignItems(designResolved.filter(Boolean));
    setIsLoading(false);
  }, [fullEnquiry]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const openCompare = (side, index) => {
    if (side === 'ref') setSelectedRef(index);
    else setSelectedDesign(index);
    setComparing(true);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>

          <View style={s.header}>
            <Text style={s.headerTitle}>Compare Images</Text>
            {(isFetchingEnquiry || isLoading) && (
              <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 8 }} />
            )}
            <TouchableOpacity style={s.headerClose} onPress={onClose} activeOpacity={0.8}>
              <Icon name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={s.loader}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>

              <ThumbRow
                label="Reference"
                items={refItems}
                selectedIndex={selectedRef}
                onSelect={(i) => openCompare('ref', i)}
              />

              <View style={s.hint}>
                <Icon name="touch-app" size={14} color={colors.textSecondary} />
                <Text style={s.hintText}>Tap any image to open in comparison view</Text>
              </View>

              <View style={s.sectionDivider} />

              <ThumbRow
                label="Coral / CAD"
                items={designItems}
                selectedIndex={selectedDesign}
                onSelect={(i) => openCompare('design', i)}
              />

              {(refItems.length > 0 || designItems.length > 0) && (
                <TouchableOpacity
                  style={s.compareBtn}
                  onPress={() => setComparing(true)}
                  activeOpacity={0.85}
                >
                  <Icon name="compare" size={18} color="#fff" />
                  <Text style={s.compareBtnText}>Compare Selected</Text>
                </TouchableOpacity>
              )}

            </ScrollView>
          )}

        </View>
      </View>

      {comparing && (
        <CompareView
          refItem={refItems[selectedRef] || null}
          designItem={designItems[selectedDesign] || null}
          onClose={() => setComparing(false)}
        />
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '88%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.primary,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#fff',
  },
  headerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  body: {
    paddingVertical: 20,
    paddingBottom: 40,
  },

  row: {
    paddingHorizontal: 16,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rowLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  rowCount: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  rowScroll: {
    gap: 10,
    paddingRight: 4,
  },
  rowEmpty: {
    height: THUMB_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
  },
  rowEmptyText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },

  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.backgroundSecondary,
  },
  thumbSelected: {
    borderColor: colors.primary,
  },
  thumbInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  thumbSelectedDot: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  hintText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },

  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
    marginVertical: 20,
  },

  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  compareBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#fff',
  },

  compareLabel: {
    position: 'absolute',
    top: 44,
    left: 14,
    zIndex: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  compareLabelText: {
    fontFamily: fonts.semiBold || fonts.bold,
    fontSize: 11,
    color: '#fff',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  compareDivider: {
    height: 2,
    backgroundColor: colors.primaryLight,
  },

  compareClose: {
    position: 'absolute',
    top: 44,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  emptyHalf: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyHalfText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },

  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

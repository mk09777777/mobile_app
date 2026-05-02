import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../constants/colors';
import Icon from '../common/Icon';

const CategoryCard = ({ thumbnailUrl, title, subtext, infoText, onPress, style }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const hasInfo = useMemo(() => Boolean(String(infoText || '').trim()), [infoText]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, style]}
      disabled={!onPress}>
      <View style={styles.imageWrap}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}
      </View>

      <View style={styles.titleBlock}>
        <View style={styles.titleRowOuter}>
          <View style={styles.titleRow}>
            <Text numberOfLines={2} style={styles.title}>
              {title}
            </Text>
            {hasInfo ? (
              <View style={styles.infoInlineWrap}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.infoButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => setShowTooltip((prev) => !prev)}>
                  <Icon name="info-outline" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
        {hasInfo && showTooltip ? (
          <View style={styles.tooltip}>
            <Text style={styles.tooltipText}>{String(infoText).trim()}</Text>
          </View>
        ) : null}
        <Text numberOfLines={1} style={styles.subtext}>
          {subtext}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  titleBlock: {
    width: '100%',
    paddingHorizontal: 10,
    paddingTop: 8,
    alignItems: 'center',
  },
  titleRowOuter: {
    width: '100%',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
    gap: 6,
  },
  infoInlineWrap: {
    flexShrink: 0,
  },
  infoButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.borderLight,
  },
  tooltip: {
    marginTop: 6,
    marginBottom: 4,
    width: '100%',
    maxWidth: '100%',
    backgroundColor: '#202124',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tooltipText: {
    color: '#FFF',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1.6,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: colors.borderLight,
  },
  title: {
    flexShrink: 1,
    color: '#1B1B1B',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  subtext: {
    marginTop: 4,
    width: '100%',
    color: '#555',
    fontSize: 10,
    textAlign: 'center',
  },
});

export default CategoryCard;

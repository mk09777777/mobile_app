import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const INPUT_BG = '#F5F5F7';
const BADGE_W = '#E8E8EA';
const BADGE_Y = '#E6D59D';
const BADGE_R = '#F1C4C4';
const STEP_ICON = '#9CA3AF';

const ProductMatrixCard = ({
  pointer,
  price,
  specialNotePlaceholderText,
  quantities = { W: 0, Y: 0, R: 0 },
  onChangeQuantities,
  specialNoteValue = '',
  onChangeSpecialNote,
  onSeeDetails,
}) => {
  const onIncrease = (key) => onChangeQuantities?.(key, 1);
  const onDecrease = (key) => onChangeQuantities?.(key, -1);

  const purityItems = [
    { key: 'W', badgeBg: BADGE_W },
    { key: 'Y', badgeBg: BADGE_Y },
    { key: 'R', badgeBg: BADGE_R },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          {pointer} Pointer : <Text style={styles.priceInline}>{price}</Text>
        </Text>
        {onSeeDetails ? (
          <TouchableOpacity activeOpacity={0.7} onPress={onSeeDetails} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.detailsText}>See details</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.detailsText}>See details</Text>
        )}
      </View>

      <View style={styles.columnsRow}>
        {purityItems.map((item) => {
          const qty = Number(quantities[item.key] ?? 0);
          return (
            <View key={item.key} style={styles.column}>
              <View style={[styles.purityBadge, { backgroundColor: item.badgeBg }]}>
                <Text style={styles.purityLetter}>{item.key}</Text>
              </View>
              <View style={styles.qtyTrack}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={styles.qtyHit}
                  onPress={() => onDecrease(item.key)}
                  hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}>
                  <Text style={styles.qtyIcon}>-</Text>
                </TouchableOpacity>
                <View style={styles.qtyCenter}>
                  {qty === 0 ? (
                    <Text style={styles.qtyPlaceholder}>Qty</Text>
                  ) : (
                    <Text style={styles.qtyNumber}>{String(qty)}</Text>
                  )}
                </View>
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={styles.qtyHit}
                  onPress={() => onIncrease(item.key)}
                  hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}>
                  <Text style={styles.qtyIcon}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.noteRow}>
        <Text style={styles.noteLabel}>Special Note :</Text>
        <TextInput
          style={styles.noteInput}
          value={specialNoteValue}
          onChangeText={onChangeSpecialNote}
          placeholder={specialNotePlaceholderText}
          placeholderTextColor="#B2B7BF"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    paddingRight: 8,
    color: '#000000',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  priceInline: {
    fontWeight: '400',
    color: '#000000',
  },
  detailsText: {
    color: '#B0B0B0',
    fontSize: 13,
    fontWeight: '400',
  },
  columnsRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  column: {
    flex: 1,
    alignItems: 'center',
  },
  purityBadge: {
    width: 28,
    height: 28,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  purityLetter: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '400',
  },
  qtyTrack: {
    width: '100%',
    minHeight: 28,
    borderRadius: 20,
    backgroundColor: INPUT_BG,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  qtyHit: {
    paddingHorizontal: 8,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  qtyIcon: {
    color: STEP_ICON,
    fontSize: 18,
    fontWeight: '400',
  },
  qtyCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyPlaceholder: {
    color: '#B2B7BF',
    fontSize: 14,
    fontWeight: '400',
  },
  qtyNumber: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '400',
  },
  noteRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteLabel: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '400',
  },
  noteInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: INPUT_BG,
    paddingHorizontal: 12,
    color: '#1A1A1A',
    fontSize: 14,
  },
});

export default ProductMatrixCard;

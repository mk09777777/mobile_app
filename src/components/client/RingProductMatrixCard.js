import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';

const colorBadges = {
  W: '#ECEDEF',
  Y: '#EAD89A',
  R: '#F2CDCD',
};

const RingProductMatrixCard = ({
  shapeName,
  shapeImageUrl,
  rows,
  quantitiesByProduct,
  onChangeQuantityValue,
}) => {
  const totalPcs = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const qty = quantitiesByProduct[row.productId] || { W: 0, Y: 0, R: 0 };
        return sum + Number(qty.W || 0) + Number(qty.Y || 0) + Number(qty.R || 0);
      }, 0),
    [quantitiesByProduct, rows],
  );

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          {shapeImageUrl ? (
            <Image source={{ uri: shapeImageUrl }} style={styles.shapeThumb} resizeMode="cover" />
          ) : (
            <View style={styles.shapeThumbPlaceholder} />
          )}
          <Text style={styles.shapeTitle}>{shapeName}</Text>
        </View>
        <Text style={styles.detailsText}>See details</Text>
      </View>

      <View style={styles.columnsHead}>
        {['W', 'Y', 'R'].map((key) => (
          <View key={key} style={[styles.badge, { backgroundColor: colorBadges[key] }]}>
            <Text style={styles.badgeText}>{key}</Text>
          </View>
        ))}
      </View>

      {rows.map((row) => {
        const qty = quantitiesByProduct[row.productId] || { W: 0, Y: 0, R: 0 };
        return (
          <View key={row.productId} style={styles.matrixRow}>
            <View style={styles.leftCol}>
              <Text style={styles.pointerText}>{row.pointerLabel}</Text>
              <Text style={styles.priceText}>{row.priceLabel}</Text>
            </View>
            {['W', 'Y', 'R'].map((colorKey) => (
              <View key={`${row.productId}-${colorKey}`} style={styles.qtyBox}>
                <TextInput
                  style={[styles.qtyInput, Number(qty[colorKey] || 0) === 0 && styles.qtyZero]}
                  value={Number(qty[colorKey] || 0) === 0 ? '' : String(Number(qty[colorKey] || 0))}
                  placeholder="0"
                  placeholderTextColor="#D6DADF"
                  onChangeText={(text) => onChangeQuantityValue(row.productId, colorKey, text)}
                  keyboardType="number-pad"
                  maxLength={3}
                  textAlign="center"
                />
              </View>
            ))}
          </View>
        );
      })}

      <View style={styles.footerRow}>
        <Text style={styles.footerLabel}>Total pcs</Text>
        <View style={styles.totalPill}>
          <Text style={styles.totalValue}>{totalPcs}</Text>
        </View>
        <Text style={styles.footerSuffix}>pcs across</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F5F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shapeThumb: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  shapeThumbPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E7EBEF',
  },
  shapeTitle: {
    fontSize: 14,
    color: '#1E5462',
    fontWeight: '400',
  },
  detailsText: {
    fontSize: 12,
    color: '#9399A3',
    fontWeight: '400',
  },
  columnsHead: {
    marginTop: 14,
    marginLeft: 82,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '400',
  },
  matrixRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 8,
  },
  leftCol: {
    width: 58,
  },
  pointerText: {
    fontSize: 14,
    color: '#3A4964',
    fontWeight: '400',
  },
  priceText: {
    marginTop: 6,
    fontSize: 10,
    color: '#B4B8C0',
    fontWeight: '400',
  },
  qtyBox: {
    width: 60,
    height: 45,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DFE5EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  qtyInput: {
    width: '100%',
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '400',
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  qtyZero: {
    color: '#D6DADF',
  },
  footerRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  footerLabel: {
    fontSize: 14,
    color: '#3A4964',
    fontWeight: '400',
  },
  totalPill: {
    minWidth: 84,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E5462',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  totalValue: {
    fontSize: 18,
    color: '#1E5462',
    fontWeight: '400',
  },
  footerSuffix: {
    fontSize: 12,
    color: '#69758E',
    fontWeight: '400',
  },
});

export default RingProductMatrixCard;


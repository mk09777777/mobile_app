import React, { useMemo } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../constants/colors';
const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatPieces = (count) => `${Number(count || 0)} pieces`;

const statusLabel = (status) => {
  if (status === 'order_delivered') return 'Delivered';
  if (status === 'order_shipped') return 'Shipped';
  if (status === 'order_in_production') return 'In Production';
  if (status === 'order_confirmed') return 'Confirmed';
  if (status === 'order_cancelled') return 'Cancelled';
  return 'Order Received';
};

const statusVerb = (status) => {
  if (status === 'order_delivered') return 'delivered';
  if (status === 'order_shipped') return 'shipped';
  if (status === 'order_in_production') return 'moved to production';
  if (status === 'order_confirmed') return 'confirmed';
  if (status === 'order_cancelled') return 'cancelled';
  return 'received';
};

const statusTitle = (status) => {
  if (status === 'order_delivered') return 'Your order has been delivered!';
  if (status === 'order_shipped') return 'Your order has been shipped!';
  if (status === 'order_in_production') return 'Your order is in production!';
  if (status === 'order_confirmed') return 'Your order is confirmed!';
  if (status === 'order_cancelled') return 'Your order has been cancelled!';
  return 'Your order has been placed!';
};

const timelineLabel = (status) => {
  if (status === 'order_received') return 'Placed';
  if (status === 'order_confirmed') return 'Confirmed';
  if (status === 'order_in_production') return 'In Production';
  if (status === 'order_shipped') return 'Shipped';
  if (status === 'order_delivered') return 'Delivered';
  if (status === 'order_cancelled') return 'Cancelled';
  return status;
};

const ORDER_FLOW = [
  'order_received',
  'order_confirmed',
  'order_in_production',
  'order_shipped',
  'order_delivered',
];

const deliveryTimelineLabel = (status) => {
  if (status === 'order_delivered') return 'Order delivered';
  if (status === 'order_shipped') return 'Order shipped';
  if (status === 'order_in_production') return 'Order in process';
  if (status === 'order_confirmed') return 'Order confirmed';
  if (status === 'order_received') return 'Order received';
  if (status === 'order_cancelled') return 'Order cancelled';
  return status;
};

const formatDeliveryDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const formatDeliveryTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

const toReadableLabel = (value) =>
  String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

const getItemDisplayTitle = (item) => {
  const snapshot = item?.meta?.productSnapshot || {};
  const subcategory = String(snapshot?.subcategoryName || item?.meta?.subcategoryName || item?.subCategory || item?.subcategory || '').trim();
  const category = String(snapshot?.categoryName || item?.meta?.categoryName || item?.category || '').trim();

  if (subcategory && category) return `${subcategory} ${category}`;
  if (subcategory) return subcategory;
  if (category) return category;
  return item?.title || item?.styleNo || 'Ordered Item';
};

const getItemDisplaySubtitle = (item) => {
  const snapshot = item?.meta?.productSnapshot || {};
  return (
    String(snapshot?.subcategoryProfileName || item?.meta?.subcategoryProfileName || item?.profile || '').trim() ||
    'Profile not available'
  );
};

const firstDefined = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

const normalizeSelectedFilters = (filters = {}) => {
  if (!filters || typeof filters !== 'object') return {};
  return Object.entries(filters).reduce((acc, [rawKey, rawValue]) => {
    const key = String(rawKey || '').trim();
    if (!key) return acc;
    acc[key] = rawValue;
    return acc;
  }, {});
};

const toReorderReviewPayload = (order) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  const firstItem = items[0] || {};
  const firstMeta = firstItem?.meta || {};
  const firstSnapshot = firstMeta?.productSnapshot || {};
  const baseSelectedFilters = normalizeSelectedFilters(firstMeta?.selectedFilters || {});

  const selectedProductLines = items.map((item, index) => {
    const meta = item?.meta || {};
    const snapshot = meta?.productSnapshot || {};
    const qty = Number(item?.quantity || 0);
    const whiteQty = Number(meta?.whiteQty || 0);
    const yellowQty = Number(meta?.yellowQty || 0);
    const roseQty = Number(meta?.roseQty || 0);
    const lineTotalQty = Number(meta?.totalQty || qty || whiteQty + yellowQty + roseQty || 0);

    return {
      productId: String(firstDefined(item?.productId, item?._id, item?.styleNo, `reorder-${index}`)),
      styleNo: String(item?.styleNo || ''),
      name: String(item?.title || item?.styleNo || `Item ${index + 1}`),
      title: String(item?.title || ''),
      description: String(firstDefined(item?.title, item?.styleNo, 'Ordered item')),
      imageUrl: String(item?.imageUrl || ''),
      pointer: Number(meta?.pointer || 0),
      totalDiamondWeightCt: Number(meta?.totalDiamondWeightCt || 0),
      shapeName: String(meta?.shapeName || ''),
      categoryName: String(firstDefined(meta?.categoryName, snapshot?.categoryName, item?.category, '') || ''),
      subcategoryName: String(
        firstDefined(meta?.subcategoryName, snapshot?.subcategoryName, item?.subCategory, item?.subcategory, '') || '',
      ),
      subcategoryProfileName: String(
        firstDefined(meta?.subcategoryProfileName, snapshot?.subcategoryProfileName, item?.profile, '') || '',
      ),
      quantities: {
        W: whiteQty,
        Y: yellowQty,
        R: roseQty,
      },
      totalQty: lineTotalQty,
      unitPrice: Number(item?.unitPrice || 0),
      note: String(item?.remarks || ''),
    };
  });

  const totalSelectedQty = selectedProductLines.reduce((sum, line) => sum + Number(line?.totalQty || 0), 0);
  const uniqueCategories = new Set(
    selectedProductLines
      .map((line) => String(line?.categoryName || '').trim().toLowerCase())
      .filter(Boolean),
  );
  const hasMixedCategories = uniqueCategories.size > 1;

  return {
    categoryName: String(firstDefined(firstMeta?.categoryName, firstSnapshot?.categoryName, '') || 'Category'),
    subcategoryProfileName: String(
      firstDefined(firstMeta?.subcategoryProfileName, firstSnapshot?.subcategoryProfileName, '') || 'Profile',
    ),
    subcategoryId: String(firstDefined(firstMeta?.subcategoryId, firstSnapshot?.subcategoryId, '') || ''),
    subcategoryName: String(firstDefined(firstMeta?.subcategoryName, firstSnapshot?.subcategoryName, '') || 'Products'),
    subcategorySubtext: '',
    totalSelectedQty,
    selectedProductLines,
    selectedFilters: baseSelectedFilters,
    specialNotePlaceholderText: 'Length variation',
    productImageUrl: String(firstItem?.imageUrl || ''),
    productDescription: String(firstDefined(firstItem?.title, firstItem?.styleNo, '') || ''),
    subcategoryThumbnailImage: String(firstItem?.imageUrl || ''),
    isReorderFlow: true,
    hasMixedCategories,
  };
};

const isEmptyDetailValue = (value) => {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

const flattenDetails = (value, path = [], output = []) => {
  if (isEmptyDetailValue(value)) return output;

  if (Array.isArray(value)) {
    const allPrimitive = value.every((entry) => entry === null || ['string', 'number', 'boolean'].includes(typeof entry));
    if (allPrimitive) {
      output.push({
        path,
        value: value.map((entry) => (typeof entry === 'boolean' ? (entry ? 'Yes' : 'No') : String(entry))).join(', '),
      });
      return output;
    }
    value.forEach((entry, index) => {
      flattenDetails(entry, [...path, String(index + 1)], output);
    });
    return output;
  }

  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, innerValue]) => {
      flattenDetails(innerValue, [...path, key], output);
    });
    return output;
  }

  output.push({
    path,
    value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value),
  });
  return output;
};

const extractItemDetails = (item) => {
  if (!item || typeof item !== 'object') return [];

  const excludedKeys = new Set(['imageUrl', 'images', 'thumbnail', '__v']);
  const sectionsMap = new Map();

  Object.entries(item).forEach(([rootKey, rootValue]) => {
    if (excludedKeys.has(rootKey) || isEmptyDetailValue(rootValue)) return;
    const sectionName = toReadableLabel(rootKey);
    const sectionRows = flattenDetails(rootValue, [rootKey], [])
      .filter((entry) => entry.path.length > 0)
      .map((entry) => {
        const cleanedPath = entry.path.slice(1).filter(Boolean);
        const leafLabel = cleanedPath.length ? cleanedPath.map((part) => toReadableLabel(part)).join(' / ') : sectionName;
        return {
          key: `${rootKey}-${cleanedPath.join('-') || 'value'}`,
          label: leafLabel,
          value: entry.value,
        };
      });

    if (sectionRows.length) {
      sectionsMap.set(sectionName, sectionRows);
    }
  });

  return Array.from(sectionsMap.entries()).map(([title, rows]) => ({
    title,
    rows,
  }));
};

const MyOrderDetailsScreen = ({ route, navigation }) => {
  const order = route?.params?.order;
  const [deliverySheetVisible, setDeliverySheetVisible] = React.useState(false);
  const [itemDetailsVisible, setItemDetailsVisible] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState(null);
  const items = useMemo(() => (Array.isArray(order?.items) ? order.items : []), [order?.items]);
  const visibleItems = useMemo(() => items.slice(0, 5), [items]);
  const hiddenItemsCount = Math.max(0, items.length - visibleItems.length);
  const totalPieces = useMemo(
    () => items.reduce((sum, item) => sum + Number(item?.quantity || 0), 0),
    [items],
  );
  const deliveredAt =
    order?.timeline?.find((entry) => entry.status === 'order_delivered')?.changedAt ||
    order?.updatedAt;
  const currentStatus = order?.status || '';
  const currentStatusAt =
    order?.timeline?.find((entry) => entry.status === currentStatus)?.changedAt ||
    order?.updatedAt ||
    order?.createdAt;
  const currentStatusLabel = statusLabel(currentStatus);
  const currentStatusVerb = statusVerb(currentStatus);
  const shipmentTracking = order?.orderMeta?.shipmentTracking || null;
  const hasReorderItems = items.length > 0;

  const deliveryTimelineRows = useMemo(() => {
    const timeline = Array.isArray(order?.timeline) ? order.timeline : [];
    const timelineByStatus = new Map();
    timeline.forEach((entry) => {
      if (!entry?.status) return;
      if (!timelineByStatus.has(entry.status)) {
        timelineByStatus.set(entry.status, entry);
      }
    });

    const flowStatus = String(order?.status || 'order_received');
    const currentIndex = ORDER_FLOW.indexOf(flowStatus);
    const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;

    return ORDER_FLOW.map((status, index) => {
      const matchedEntry = timelineByStatus.get(status);
      const isReached = index <= safeCurrentIndex;
      const isCurrent = index === safeCurrentIndex;
      return {
        status,
        changedAt: matchedEntry?.changedAt || null,
        isReached,
        isCurrent,
        isPending: !isReached,
      };
    });
  }, [order?.status, order?.timeline]);
  const selectedItemDetails = extractItemDetails(selectedItem);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.iconButton} onPress={navigation.goBack} activeOpacity={0.8}>
          <MaterialIcons name="chevron-left" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <TouchableOpacity style={styles.iconButton} activeOpacity={0.8}>
          <MaterialIcons name="help-outline" size={22} color="#66727B" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerTitle}>{statusTitle(currentStatus)}</Text>
          <Text style={styles.infoBannerText}>
            All {totalPieces} pieces got {currentStatusVerb} at {formatDateTime(currentStatusAt)}. Tap Reorder below
            to reorder it again.
          </Text>
          <View style={styles.sparkRow}>
            <MaterialIcons name="auto-awesome" size={22} color={colors.primary} />
            <MaterialIcons name="auto-awesome" size={18} color={colors.primary} />
            <MaterialIcons name="auto-awesome" size={14} color={colors.primary} />
          </View>
        </View>

        <View style={styles.block}>
          <View style={styles.addressRow}>
            <View style={styles.flexOne}>
              <Text style={styles.shopName}>{order?.clientName || 'Client'}</Text>
              <Text style={styles.shopAddress}>{order?.clientUsername || 'Unknown'}</Text>
            </View>
            <View style={styles.pinChip}>
              <MaterialIcons name="person" size={16} color="#C05252" />
            </View>
          </View>
        </View>

        <View style={styles.block}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.deliveryRow}
            onPress={() => {
              if (order?.status === 'order_shipped' && shipmentTracking) {
                navigation.navigate('MyShipmentTracking', { shipmentTracking, order });
                return;
              }
              setDeliverySheetVisible(true);
            }}>
            <View style={styles.deliveryLeft}>
              <MaterialIcons name="inventory-2" size={14} color="#67747E" />
              <Text style={styles.deliveryText}>
                {statusLabel(order?.status)} {formatDateTime(deliveredAt)}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={18} color="#67747E" />
          </TouchableOpacity>
        </View>

        <View style={styles.block}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Items in your order</Text>
            <Text style={styles.sectionValue}>{formatPieces(totalPieces)}</Text>
          </View>

          {visibleItems.map((item, index) => (
            <View key={`${item?.productId || item?.styleNo || index}`} style={styles.itemRow}>
              <View style={styles.imageWrap}>
                {item?.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="contain" />
                ) : (
                  <View style={styles.imagePlaceholder} />
                )}
              </View>
              <View style={styles.itemCenter}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {getItemDisplayTitle(item)}
                </Text>
                <Text style={styles.itemSubtitle} numberOfLines={1}>
                  {getItemDisplaySubtitle(item)}
                </Text>
                <Text style={styles.itemPieces}>{formatPieces(item?.quantity)}</Text>
                <TouchableOpacity
                  style={styles.detailChip}
                  activeOpacity={0.85}
                  onPress={() => {
                    setSelectedItem(item);
                    setItemDetailsVisible(true);
                  }}>
                  <Text style={styles.detailChipText}>see details</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.itemPiecesRight}>{formatPieces(item?.quantity)}</Text>
            </View>
          ))}
          {hiddenItemsCount > 0 ? <Text style={styles.moreText}>+ SEE {hiddenItemsCount} MORE ITEMS</Text> : null}

        </View>

        <View style={styles.block}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Order Total</Text>
            <Text style={styles.totalValue}>{formatPieces(totalPieces)}</Text>
          </View>
        </View>

        <View style={styles.block}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Order ID</Text>
            <Text style={styles.metaValue}>{order?.orderNumber || order?._id || 'N/A'}</Text>
          </View>
          {(order?.timeline || []).map((entry, idx) => (
            <View key={`${entry.status}-${entry.changedAt}-${idx}`} style={styles.metaRow}>
              <Text style={styles.metaLabel}>{timelineLabel(entry.status)}</Text>
              <Text style={styles.metaValue}>{formatDateTime(entry.changedAt)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footerButtons}>
        <TouchableOpacity
          style={[styles.reorderBtn, !hasReorderItems && styles.reorderBtnDisabled]}
          activeOpacity={hasReorderItems ? 0.85 : 1}
          disabled={!hasReorderItems}
          onPress={() => {
            if (!hasReorderItems) return;
            const payload = toReorderReviewPayload(order);
            navigation.getParent()?.navigate('Dashboard', {
              screen: 'OrderReview',
              params: payload,
            });
          }}>
          <Text style={styles.reorderBtnText}>Reorder</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.invoiceBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('OrderInvoices', { order })}>
          <Text style={styles.invoiceBtnText}>Invoices</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={itemDetailsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setItemDetailsVisible(false)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setItemDetailsVisible(false)} />
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <TouchableOpacity onPress={() => setItemDetailsVisible(false)} activeOpacity={0.8}>
                <Text style={styles.sheetCloseText}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Item Details</Text>
              <View style={styles.sheetHeaderSpacer} />
            </View>

            <ScrollView contentContainerStyle={styles.itemDetailsWrap}>
              <View style={styles.itemDetailsHead}>
                <Text style={styles.itemDetailsTitle}>{getItemDisplayTitle(selectedItem)}</Text>
                <Text style={styles.itemDetailsSubtitle}>{getItemDisplaySubtitle(selectedItem)}</Text>
              </View>
              {selectedItemDetails.map((section) => (
                <View key={section.title} style={styles.itemDetailSection}>
                  <Text style={styles.itemDetailSectionTitle}>{section.title}</Text>
                  {section.rows.map((detail, detailIndex) => (
                    <View
                      key={detail.key}
                      style={[styles.itemDetailRow, detailIndex !== section.rows.length - 1 && styles.itemDetailRowDivider]}>
                      <Text style={styles.itemDetailLabel}>{detail.label}</Text>
                      <Text style={styles.itemDetailValue}>{detail.value}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deliverySheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDeliverySheetVisible(false)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setDeliverySheetVisible(false)} />
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <TouchableOpacity onPress={() => setDeliverySheetVisible(false)} activeOpacity={0.8}>
                <Text style={styles.sheetCloseText}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Delivery Information</Text>
              <View style={styles.sheetHeaderSpacer} />
            </View>

            <View style={styles.sheetOrderIdRow}>
              <Text style={styles.sheetOrderIdLabel}>Order ID</Text>
              <Text style={styles.sheetOrderIdValue}>{order?.orderNumber || order?._id || 'N/A'}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.sheetTimelineWrap}>
              {deliveryTimelineRows.map((entry, idx) => {
                return (
                  <View key={`${entry.status}-${idx}`} style={styles.sheetTimelineRow}>
                    <View style={styles.sheetDateWrap}>
                      <Text style={[styles.sheetDateText, entry.isPending && styles.sheetDatePending]}>
                        {entry.changedAt ? formatDeliveryDate(entry.changedAt) : '--'}
                      </Text>
                      <Text style={[styles.sheetTimeText, entry.isPending && styles.sheetDatePending]}>
                        {entry.changedAt ? formatDeliveryTime(entry.changedAt) : '--'}
                      </Text>
                    </View>
                    <View style={styles.sheetDotRail}>
                      <View
                        style={[
                          styles.sheetDot,
                          entry.isReached ? styles.sheetDotActive : styles.sheetDotPending,
                          entry.isCurrent && styles.sheetDotCurrent,
                        ]}
                      />
                      {idx !== deliveryTimelineRows.length - 1 ? (
                        <View style={[styles.sheetLine, entry.isReached ? styles.sheetLineActive : styles.sheetLinePending]} />
                      ) : null}
                    </View>
                    <View style={styles.sheetStatusPill}>
                      <Text style={[styles.sheetStatusPillText, entry.isPending && styles.sheetStatusPillPendingText]}>
                        {deliveryTimelineLabel(entry.status)}
                        {entry.isPending ? ' (yet to come)' : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EFF1F3' },
  headerRow: {
    height: 52,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, color: '#1A1A1A', fontWeight: '500' },
  content: { padding: 12, gap: 10, paddingBottom: 90 },
  infoBanner: {
    borderRadius: 14,
    backgroundColor: '#DFEAED',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  infoBannerTitle: { fontSize: 33 / 2, fontWeight: '700', color: '#18414A' },
  infoBannerText: { marginTop: 6, fontSize: 23 / 2, color: '#39545D' },
  sparkRow: { marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end', gap: 14 },
  block: { borderRadius: 14, backgroundColor: '#FFFFFF', padding: 14 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flexOne: { flex: 1 },
  shopName: { fontSize: 16, fontWeight: '500', color: '#1D2A34' },
  shopAddress: { marginTop: 5, fontSize: 15 / 1.2, color: '#6D7780' },
  pinChip: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F2EEE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deliveryLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deliveryText: { fontSize: 16 / 1.1, color: '#2B414D' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 17 / 1.1, fontWeight: '500', color: '#1A2A35' },
  sectionValue: { fontSize: 15 / 1.1, color: '#67737C' },
  itemRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E6EA',
  },
  imageWrap: {
    width: 68,
    height: 68,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E7EAF0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFB',
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { width: 36, height: 16, borderRadius: 8, backgroundColor: '#E0E5EA' },
  itemCenter: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '500', color: '#1C303D' },
  itemSubtitle: { marginTop: 4, fontSize: 13, color: '#5F6E79' },
  itemPieces: { marginTop: 4, fontSize: 13, color: '#7A8792' },
  detailChip: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderRadius: 20,
    backgroundColor: '#DAEAEE',
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  detailChipText: { fontSize: 12, color: '#2D6472', fontWeight: '500' },
  itemPiecesRight: { fontSize: 15, color: '#233A47' },
  moreRow: { marginTop: 12, alignSelf: 'flex-start' },
  moreText: { color: '#235A66', fontSize: 15 / 1.1, fontWeight: '500' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 17, color: '#1D2B35' },
  totalValue: { fontSize: 28 / 2, color: '#1A2E3A', fontWeight: '500' },
  metaRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E8ED',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: { fontSize: 17 / 1.2, color: '#495963' },
  metaValue: { fontSize: 17 / 1.2, color: '#1D2F3A', fontWeight: '500' },
  footerButtons: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DCE2E8',
    flexDirection: 'row',
    gap: 10,
  },
  reorderBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#135A62',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBtnDisabled: {
    backgroundColor: '#8AA8AC',
  },
  reorderBtnText: { color: '#FFFFFF', fontSize: 29 / 2, fontWeight: '600' },
  invoiceBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D5DBE2',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceBtnText: { color: '#252E34', fontSize: 29 / 2, fontWeight: '500' },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sheetContainer: {
    maxHeight: '72%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  sheetHandle: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 6,
    width: 72,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
  },
  sheetHeaderRow: {
    paddingHorizontal: 14,
    height: 46,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D8DEE5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetCloseText: {
    color: '#3D5A67',
    fontSize: 14,
  },
  sheetTitle: {
    color: '#203743',
    fontSize: 29 / 2,
    fontWeight: '500',
  },
  sheetHeaderSpacer: {
    width: 40,
  },
  sheetOrderIdRow: {
    height: 52,
    paddingHorizontal: 18,
    backgroundColor: '#FBFCFD',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E6EC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetOrderIdLabel: {
    fontSize: 28 / 2,
    color: '#223846',
  },
  sheetOrderIdValue: {
    fontSize: 28 / 2,
    color: '#233F4D',
    fontWeight: '500',
  },
  sheetTimelineWrap: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  sheetTimelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  sheetDateWrap: {
    width: 52,
    alignItems: 'flex-end',
    paddingTop: 2,
  },
  sheetDateText: {
    fontSize: 14,
    color: '#233A46',
  },
  sheetDatePending: {
    color: '#9AA6B0',
  },
  sheetTimeText: {
    marginTop: 3,
    fontSize: 12,
    color: '#7B8994',
  },
  sheetDotRail: {
    width: 20,
    alignItems: 'center',
  },
  sheetDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  sheetDotPending: {
    backgroundColor: '#C9CED4',
  },
  sheetDotActive: {
    backgroundColor: '#1E6A74',
  },
  sheetDotCurrent: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  sheetLine: {
    marginTop: 4,
    width: 2,
    flex: 1,
    minHeight: 34,
  },
  sheetLineActive: {
    backgroundColor: '#1E6A74',
  },
  sheetLinePending: {
    backgroundColor: '#D2D8DE',
  },
  sheetStatusPill: {
    flex: 1,
    minHeight: 42,
    borderRadius: 6,
    backgroundColor: '#F2F4F6',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  sheetStatusPillText: {
    color: '#2A3E4A',
    fontSize: 14,
  },
  sheetStatusPillPendingText: {
    color: '#6B7782',
  },
  itemDetailsWrap: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 22,
  },
  itemDetailsHead: {
    borderRadius: 10,
    backgroundColor: '#F3F8F9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  itemDetailsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F3A46',
  },
  itemDetailsSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#55707D',
  },
  itemDetailSection: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E9EE',
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  itemDetailSectionTitle: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    fontSize: 12,
    color: '#355260',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  itemDetailRow: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  itemDetailRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E3E9EE',
  },
  itemDetailLabel: {
    fontSize: 12,
    color: '#6B7A85',
  },
  itemDetailValue: {
    marginTop: 4,
    fontSize: 14,
    color: '#203742',
    fontWeight: '500',
  },
});

export default MyOrderDetailsScreen;

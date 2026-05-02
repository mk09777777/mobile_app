import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@chandra_jewels_cart_v1';

const emptyCart = () => ({ version: 1, entries: [] });

const makeEntryId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export async function getCart() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyCart();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries)) return emptyCart();
    return { version: 1, entries: parsed.entries };
  } catch {
    return emptyCart();
  }
}

export async function setCart(cart) {
  const next = cart && Array.isArray(cart.entries) ? { version: 1, entries: cart.entries } : emptyCart();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function clearCart() {
  await AsyncStorage.removeItem(STORAGE_KEY);
  return emptyCart();
}

export function countCartLines(cart) {
  if (!cart?.entries?.length) return 0;
  return cart.entries.reduce((sum, e) => sum + (Array.isArray(e?.lines) ? e.lines.length : 0), 0);
}

/**
 * Append a new cart group (one "Add to cart" from review).
 * @param {object} payload
 * @param {string} [payload.subcategoryId]
 * @param {string} payload.categoryName
 * @param {string} payload.subcategoryName
 * @param {string} [payload.subcategoryProfileName]
 * @param {string} [payload.subcategoryThumbnailImage]
 * @param {object} payload.selectedFilters
 * @param {Array} payload.lines — line items from order review
 */
export async function appendCartEntry(payload) {
  const cart = await getCart();
  const entry = {
    id: makeEntryId(),
    subcategoryId: payload.subcategoryId || '',
    categoryName: String(payload.categoryName || '').trim(),
    subcategoryName: String(payload.subcategoryName || '').trim(),
    subcategoryProfileName: String(payload.subcategoryProfileName || '').trim(),
    subcategoryThumbnailImage: String(payload.subcategoryThumbnailImage || '').trim(),
    selectedFilters:
      payload.selectedFilters && typeof payload.selectedFilters === 'object' ? payload.selectedFilters : {},
    lines: Array.isArray(payload.lines) ? payload.lines : [],
    addedAt: Date.now(),
  };
  if (entry.lines.length === 0) return cart;
  cart.entries.push(entry);
  await setCart(cart);
  return cart;
}

/**
 * Remove one product line from the cart (by entry id + product id).
 */
export async function removeCartLine(entryId, productId) {
  const cart = await getCart();
  const eid = String(entryId || '');
  const pid = String(productId || '');
  cart.entries = cart.entries
    .map((entry) => {
      if (String(entry.id) !== eid) return entry;
      return {
        ...entry,
        lines: (entry.lines || []).filter((line) => String(line.productId) !== pid),
      };
    })
    .filter((entry) => (entry.lines || []).length > 0);
  await setCart(cart);
  return cart;
}

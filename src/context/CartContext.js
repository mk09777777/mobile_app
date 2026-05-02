import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { countCartLines, getCart } from '../services/cartStorage';

const CartContext = createContext({
  lineCount: 0,
  refreshCartCount: async () => {},
});

export function CartProvider({ children }) {
  const [lineCount, setLineCount] = useState(0);

  const refreshCartCount = useCallback(async () => {
    try {
      const cart = await getCart();
      setLineCount(countCartLines(cart));
    } catch {
      setLineCount(0);
    }
  }, []);

  useEffect(() => {
    refreshCartCount();
  }, [refreshCartCount]);

  const value = useMemo(
    () => ({ lineCount, refreshCartCount }),
    [lineCount, refreshCartCount],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}

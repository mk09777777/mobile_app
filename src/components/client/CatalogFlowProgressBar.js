import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigationState } from '@react-navigation/native';
import { colors } from '../../constants/colors';

const TOTAL_STEPS = 4;

const DASHBOARD_STEP = {
  ProductList: 1,
  ProductMatrix: 2,
  OrderReview: 3,
};

/**
 * Derives shopping-flow progress from App2 stack state: CatalogMain → tabs →
 * Dashboard stack or Cart stack. Returns null when the user is not in the browse-to-cart path.
 */
function getShoppingProgressFraction(state) {
  if (!state?.routes?.length) return null;
  const active = state.routes[state.index];
  if (active.name !== 'CatalogMain' || !active.state?.routes?.length) return null;

  const tabState = active.state;
  const tabRoute = tabState.routes[tabState.index];

  if (tabRoute.name === 'Enquiries' || tabRoute.name === 'Chats') {
    return null;
  }

  if (tabRoute.name === 'Dashboard') {
    const inner = tabRoute.state;
    if (!inner?.routes?.length) {
      return null;
    }
    const screen = inner.routes[inner.index];
    if (screen.name === 'HomeScreen') {
      return null;
    }
    const step = DASHBOARD_STEP[screen.name];
    if (!step) {
      return null;
    }
    return step / TOTAL_STEPS;
  }

  if (tabRoute.name === 'Cart') {
    const inner = tabRoute.state;
    const screen = inner?.routes?.[inner?.index];
    if (screen?.name === 'OrderPlaced') {
      return null;
    }
    return 4 / TOTAL_STEPS;
  }

  return null;
}

const CatalogFlowProgressBar = () => {
  const fraction = useNavigationState((state) => getShoppingProgressFraction(state));

  if (fraction == null || fraction <= 0) {
    return null;
  }

  const widthPercent = Math.min(100, Math.max(0, fraction * 100));

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityValue={{ now: widthPercent, min: 0, max: 100 }}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${widthPercent}%` }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: colors.backgroundSecondary,
  },
  track: {
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
});

export default CatalogFlowProgressBar;

import React from 'react';
import { TouchableOpacity, Text, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigationRef } from '../../navigation/navigationRef';

const CUSTOM_ICON = require('../../assets/images/SketchOutlined.png');
const REORDER_ICON = require('../../assets/images/list-restart.png');

const SwitchAppFAB = ({ currentApp, insideSafeArea = false }) => {
  const insets = useSafeAreaInsets();

  const isCustom = currentApp === 'custom';
  const targetApp = isCustom ? 'CatalogApp' : 'CustomApp';
  const icon = isCustom ? REORDER_ICON : CUSTOM_ICON;
  const label = isCustom ? 'Reorder' : 'Custom';

  const tabBarHeight = 60;
  // When inside SafeAreaView, the container adds paddingBottom=insets.bottom AND
  // CustomTabBar also adds its own safe-area height — both layers must be cleared.
  const bottom = insideSafeArea
    ? tabBarHeight + insets.bottom + Math.max(0, insets.bottom - 4) + 8
    : tabBarHeight + Math.max(0, insets.bottom - 4) + 12;

  const handlePress = () => {
    if (navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: targetApp }] });
    }
  };

  return (
    <TouchableOpacity
      style={[styles.pill, { bottom }]}
      onPress={handlePress}
      activeOpacity={0.8}>
      <Image source={icon} style={styles.icon} resizeMode="contain" />
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#143F45',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  icon: {
    width: 16,
    height: 16,
    tintColor: '#ffffff',
  },
  label: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default SwitchAppFAB;

import React from 'react';
import { View, TouchableOpacity, Text, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import Icon from './Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { useCart } from '../../context/CartContext';
import { navigationRef } from '../../navigation/navigationRef';
const CUSTOM_ICON = require('../../assets/images/SketchOutlined.png');

const CustomTabBar = ({ state, descriptors, navigation, currentApp }) => {
  const insets = useSafeAreaInsets();
  const { lineCount } = useCart();

  const handleQuickSwitch = () => {
    if (navigationRef.isReady()) {
      // CommonActions.navigate traverses up the entire navigator tree to find
      // 'AppSelection' regardless of current history. This is necessary because
      // AppSelectionScreen uses navigation.replace() when picking an app, which
      // removes it from rootState.routes — a direct routes check always fails.
      // For coral/cad roles that don't register AppSelection, this silently no-ops.
      navigationRef.dispatch(CommonActions.navigate({ name: 'AppSelection' }));
    }
  };

  const renderTab = (route, routeIndex) => {
    const { options } = descriptors[route.key];
    const label =
      options.tabBarLabel !== undefined
        ? options.tabBarLabel
        : options.title !== undefined
        ? options.title
        : route.name;

    const isFocused = state.index === routeIndex;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    const onLongPress = () => {
      navigation.emit({ type: 'tabLongPress', target: route.key });
    };

    if (route.name === 'Switch') {
      return (
        <TouchableOpacity
          key={route.key}
          accessibilityRole="button"
          accessibilityState={isFocused ? { selected: true } : {}}
          accessibilityLabel={options.tabBarAccessibilityLabel}
          testID={options.tabBarTestID}
          onPress={onPress}
          onLongPress={onLongPress}
          style={styles.tabButton}
          activeOpacity={0.7}>
          <View style={[styles.switchIconContainer, isFocused && styles.switchIconContainerActive]}>
            <Image
              source={CUSTOM_ICON}
              style={[
                styles.switchTabIcon,
                { tintColor: isFocused ? colors.accent : colors.textLight },
              ]}
              resizeMode="contain"
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              {
                color: isFocused ? colors.primary : colors.textLight,
                fontFamily: isFocused ? fonts.medium : fonts.regular,
              },
            ]}>
            {label}
          </Text>
        </TouchableOpacity>
      );
    }

    let iconName;
    if (route.name === 'Dashboard') iconName = 'homeIcon';
    else if (route.name === 'Cart') iconName = 'cartIcon';
    else if (route.name === 'MyOrders') iconName = 'ordersIcon';
    else if (route.name === 'Tracking') iconName = 'track-changes';
    else if (route.name === 'Imports') iconName = 'file-upload';
    else if (route.name === 'Planning') iconName = 'bar-chart';
    else if (route.name === 'Inventory') iconName = 'diamond';
    else if (route.name === 'Chats') iconName = 'chatIcon';
    else if (route.name === 'Enquiries') iconName = 'assignment';

    return (
      <TouchableOpacity
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        testID={options.tabBarTestID}
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.tabButton}
        activeOpacity={0.7}>
        <View style={[styles.iconContainer, isFocused && styles.iconContainerActive]}>
          <Icon
            name={iconName}
            size={isFocused ? 30 : 24}
            color={isFocused ? colors.primary : colors.textLight}
          />
          {route.name === 'Cart' && lineCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{lineCount > 99 ? '99+' : lineCount}</Text>
            </View>
          ) : null}
        </View>
        <Text
          style={[
            styles.tabLabel,
            {
              color: isFocused ? colors.primary : colors.textLight,
              fontFamily: isFocused ? fonts.medium : fonts.regular,
            },
          ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const before = state.routes;
  const after = [];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.tabBar,
          {
            paddingBottom: Math.max(4, insets.bottom),
            height: 60 + Math.max(0, insets.bottom - 4),
            minHeight: 60 + Math.max(0, insets.bottom - 4),
          },
        ]}>
        {before.map((route, i) => renderTab(route, i))}

        {currentApp ? (
          <TouchableOpacity
            onPress={handleQuickSwitch}
            style={styles.quickSwitchButton}
            activeOpacity={0.8}>
            <View style={styles.quickSwitchCircle}>
              <Icon
                name="list"
                size={24}
                color={colors.accent}
              />
            </View>
            <Text style={styles.quickSwitchLabel}>Switch</Text>
          </TouchableOpacity>
        ) : null}

        {after.map((route, i) => renderTab(route, splitAt + i))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.textWhite,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.textWhite,
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 60,
    minHeight: 60,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    height: '100%',
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: 30,
    marginBottom: 2,
    width: 30,
  },
  iconContainerActive: {
    transform: [{ scale: 1.05 }],
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.textWhite,
    fontSize: 10,
    fontWeight: '700',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.2,
    textTransform: 'capitalize',
  },
  quickSwitchButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    height: '100%',
  },
  quickSwitchCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 7,
  },
  quickSwitchIcon: {
    width: 22,
    height: 22,
    tintColor: colors.accent,
  },
  quickSwitchLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  switchIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  switchIconContainerActive: {
    backgroundColor: colors.primary,
    transform: [{ scale: 1.05 }],
  },
  switchTabIcon: {
    width: 18,
    height: 18,
  },
});

export default CustomTabBar;

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { useCart } from '../../context/CartContext';

const CustomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const { lineCount } = useCart();

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View
        style={[
          styles.tabBar,
          {
            paddingBottom: Math.max(4, insets.bottom),
            height: 60 + Math.max(0, insets.bottom - 4),
            minHeight: 60 + Math.max(0, insets.bottom - 4),
          },
        ]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

          const isFocused = state.index === index;

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
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          // Get icon name based on route
          let iconName;
          if (route.name === 'Dashboard') {
            iconName = 'homeIcon';
          } else if (route.name === 'Cart') {
            iconName = 'cartIcon';
          } else if (route.name === 'MyOrders') {
            iconName = 'ordersIcon';
          } else if (route.name === 'Chats') {
            iconName = 'chatIcon';
          }

          // Instagram-style: All tabs are consistent
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
              <View style={[
                styles.iconContainer,
                isFocused && styles.iconContainerActive
              ]}>
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
                  }
                ]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
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
    // Makes active icon appear thicker/more prominent
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
});

export default CustomTabBar;

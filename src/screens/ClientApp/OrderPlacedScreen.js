import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../constants/colors';
import { useCart } from '../../context/CartContext';
import { clearCart } from '../../services/cartStorage';

const OrderPlacedScreen = ({ navigation }) => {
  const { refreshCartCount } = useCart();

  useEffect(() => {
    let active = true;
    (async () => {
      await clearCart();
      if (active) {
        await refreshCartCount();
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshCartCount]);

  const onBackHome = async () => {
    await clearCart();
    await refreshCartCount();

    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'OrderCart' }],
      }),
    );
    navigation.getParent()?.navigate('Dashboard', { screen: 'HomeScreen' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.successCircle}>
        <MaterialIcons name="check" size={58} color="#FFFFFF" />
      </View>

      <Text style={styles.heading}>Order Placed</Text>

      <TouchableOpacity activeOpacity={0.85} style={styles.backHomeButton} onPress={onBackHome}>
        <Text style={styles.backHomeText}>Back to home</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  successCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    marginTop: 24,
    color: '#121212',
    fontSize: 28 / 1.1,
    fontWeight: '700',
  },
  backHomeButton: {
    marginTop: 28,
    minHeight: 48,
    minWidth: 180,
    borderRadius: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backHomeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'none',
  },
});

export default OrderPlacedScreen;

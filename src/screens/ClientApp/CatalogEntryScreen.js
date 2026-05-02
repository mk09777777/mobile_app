import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

const DARK_BG = '#0F2E30';
const GOLD = '#C8A265';

const CatalogEntryScreen = ({ navigation }) => {
  const logoAnim = useRef(new Animated.Value(0)).current;
  const textAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(textAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(350),
    ]).start(() => {
      navigation.replace('CatalogMain');
    });
  }, [logoAnim, textAnim, navigation]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoWrap,
          {
            opacity: logoAnim,
            transform: [
              {
                scale: logoAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.85, 1],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.centralSquare} />
        <View style={[styles.petal, styles.petalTop]} />
        <View style={[styles.petal, styles.petalRight]} />
        <View style={[styles.petal, styles.petalBottom]} />
        <View style={[styles.petal, styles.petalLeft]} />
      </Animated.View>

      <Animated.Text style={[styles.title, { opacity: textAnim }]}>
        CATALOG
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrap: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  centralSquare: {
    width: 14,
    height: 14,
    borderWidth: 2,
    borderColor: GOLD,
    position: 'absolute',
    zIndex: 10,
  },
  petal: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: GOLD,
    borderRadius: 34,
  },
  petalTop: {
    width: 54,
    height: 27,
    borderBottomWidth: 0,
    top: -14,
  },
  petalRight: {
    width: 27,
    height: 54,
    borderLeftWidth: 0,
    right: -14,
  },
  petalBottom: {
    width: 54,
    height: 27,
    borderTopWidth: 0,
    bottom: -14,
  },
  petalLeft: {
    width: 27,
    height: 54,
    borderRightWidth: 0,
    left: -14,
  },
  title: {
    color: GOLD,
    fontSize: 18,
    fontFamily: 'AvenirLTStd-Heavy',
    letterSpacing: 2,
  },
});

export default CatalogEntryScreen;

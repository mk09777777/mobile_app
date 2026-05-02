import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

const GOLD = '#C8A265';
const DARK_BG = '#0F2E30';

const CatalogIntroScreen = ({ navigation }) => {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      navigation.replace('CatalogMainTabs');
    }, 1100);

    return () => clearTimeout(timer);
  }, [navigation, logoOpacity, logoScale, textOpacity]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoMark,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <View style={styles.centralSquare} />
        <View style={[styles.petal, styles.petalTop]} />
        <View style={[styles.petal, styles.petalRight]} />
        <View style={[styles.petal, styles.petalBottom]} />
        <View style={[styles.petal, styles.petalLeft]} />
      </Animated.View>
      <Animated.Text style={[styles.title, { opacity: textOpacity }]}>
        CHANDRA JEWELS
      </Animated.Text>
      <Animated.Text style={[styles.subtitle, { opacity: textOpacity }]}>
        Catalog Experience
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
    paddingHorizontal: 20,
  },
  logoMark: {
    width: 76,
    height: 76,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
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
    borderRadius: 36,
  },
  petalTop: {
    width: 58,
    height: 29,
    borderBottomWidth: 0,
    top: -14,
  },
  petalRight: {
    width: 29,
    height: 58,
    borderLeftWidth: 0,
    right: -14,
  },
  petalBottom: {
    width: 58,
    height: 29,
    borderTopWidth: 0,
    bottom: -14,
  },
  petalLeft: {
    width: 29,
    height: 58,
    borderRightWidth: 0,
    left: -14,
  },
  title: {
    fontSize: 22,
    fontFamily: 'AvenirLTStd-Black',
    color: GOLD,
    letterSpacing: 2.5,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: 'AvenirLTStd-Roman',
    color: '#FFFFFF88',
    letterSpacing: 1.1,
    textAlign: 'center',
  },
});

export default CatalogIntroScreen;

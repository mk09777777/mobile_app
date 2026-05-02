import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const AnimatedLogoLoader = ({ size = 30, color = '#C8A265' }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Breathing animation - slow and gentle like breathing
    const breathingAnimation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.05, // Even gentler scale for small loader
            duration: 2000, // Slightly faster for small loader
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 2000, // Much slower - 2.5 seconds
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 2000, // Slightly faster for small loader
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.8, // Less dramatic opacity change
            duration: 2000, // Slightly faster for small loader
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    // Remove pop-out animation - keep only gentle breathing

    // Fade-in animation - gentle fade in and out
    const fadeAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1500, // Faster fade for small loader
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.4,
          duration: 1500, // Faster fade for small loader
          useNativeDriver: true,
        }),
      ])
    );

    // Start animations
    breathingAnimation.start();
    fadeAnimation.start();

    return () => {
      breathingAnimation.stop();
      fadeAnimation.stop();
    };
  }, [scaleAnim, opacityAnim, fadeAnim]);


  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [
              { scale: scaleAnim },
            ],
            opacity: fadeAnim, // Use fade animation instead of breathing opacity
          },
        ]}
      >
        <Image
          source={require('../assets/images/logo.png')}
          style={[
            styles.logo,
            {
              width: size,
              height: size,
            },
          ]}
          resizeMode="contain"
        />
      </Animated.View>
    
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent', // No background for small loader
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  logo: {
    tintColor: '#C8A265', // Optional: apply brand color to logo
  },
});

export default AnimatedLogoLoader;

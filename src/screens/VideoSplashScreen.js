import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Video from 'react-native-video';

const { width, height } = Dimensions.get('window');

const VideoSplashScreen = ({ onAnimationFinish }) => {
  const videoRef = useRef(null);
  const [videoError, setVideoError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  
  // Animation values
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Start animations after a short delay
    const animationTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 3,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 800,
          delay: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }, 500);

    // Fallback timer - finish after 3 seconds regardless
    const fallbackTimer = setTimeout(() => {
      finishSplashScreen();
    }, 3000);

    return () => {
      clearTimeout(animationTimer);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const finishSplashScreen = () => {
    if (!isFinished) {
      setIsFinished(true);
      if (onAnimationFinish) {
        onAnimationFinish();
      }
    }
  };

  const onVideoEnd = () => {
    finishSplashScreen();
  };

  const onVideoError = (error) => {
    setVideoError(true);
    // Continue with splash screen even if video fails
  };

  const onVideoLoad = () => {
    setVideoLoaded(true);
  };

  const onVideoLoadStart = () => {
  };

  // Video source configuration
  const getVideoSource = () => {
    return require('../assets/videos/Splash.mp4');
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#113535" barStyle="light-content" />
      
      {/* Video Background - only show if no error */}
      {!videoError && (
        <Video
          ref={videoRef}
          source={getVideoSource()}
          style={styles.video}
          resizeMode="cover"
          repeat={false}
          onEnd={onVideoEnd}
          onError={onVideoError}
          onLoad={onVideoLoad}
          onLoadStart={onVideoLoadStart}
          muted={true}
          paused={false}
          playInBackground={false}
          playWhenInactive={false}
          ignoreSilentSwitch="ignore"
          mixWithOthers="mix"
        />
      )}
      
      {/* Static background fallback */}
      {videoError && <View style={styles.staticBackground} />}
      
      {/* Overlay with Logo and Text */}
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          {/* <View style={styles.content}> */}
            {/* Animated Logo */}
            {/* <Animated.View
              style={[
                styles.logoContainer,
                {
                  opacity: logoOpacity,
                  transform: [{ scale: logoScale }],
                },
              ]}
            >
              <View style={styles.logo}>
                <View style={styles.centralSquare} />
                <View style={styles.petal1} />
                <View style={styles.petal2} />
                <View style={styles.petal3} />
                <View style={styles.petal4} />
              </View>
            </Animated.View> */}
            
            {/* Animated Text */}
            {/* <Animated.View style={{ opacity: textOpacity }}> */}
              {/* <Text style={styles.chandraText}>CHANDRA</Text>
              <Text style={styles.jewelsText}>JEWELS</Text> */}
            {/* </Animated.View> */}
          {/* </View> */}
        </SafeAreaView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: '#113535',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: width,
    height: height,
  },
  staticBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    backgroundColor: '#113535',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 53, 53, 0.6)', // Semi-transparent overlay
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: height * 0.05,
  },
  logo: {
    width: width * 0.4,
    height: width * 0.4,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  centralSquare: {
    width: 20,
    height: 20,
    borderWidth: 3,
    borderColor: '#C8A265',
    position: 'absolute',
    zIndex: 10,
  },
  petal1: {
    position: 'absolute',
    width: 80,
    height: 40,
    borderWidth: 3,
    borderColor: '#C8A265',
    borderRadius: 40,
    borderBottomWidth: 0,
    top: -20,
  },
  petal2: {
    position: 'absolute',
    width: 40,
    height: 80,
    borderWidth: 3,
    borderColor: '#C8A265',
    borderRadius: 40,
    borderLeftWidth: 0,
    right: -20,
  },
  petal3: {
    position: 'absolute',
    width: 80,
    height: 40,
    borderWidth: 3,
    borderColor: '#C8A265',
    borderRadius: 40,
    borderTopWidth: 0,
    bottom: -20,
  },
  petal4: {
    position: 'absolute',
    width: 40,
    height: 80,
    borderWidth: 3,
    borderColor: '#C8A265',
    borderRadius: 40,
    borderRightWidth: 0,
    left: -20,
  },
  chandraText: {
    fontSize: Math.max(width * 0.08, 32),
    fontWeight: 'bold',
    color: '#C8A265',
    letterSpacing: Math.max(width * 0.02, 4),
    marginBottom: height * 0.015,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  jewelsText: {
    fontSize: Math.max(width * 0.05, 20),
    fontWeight: '600',
    color: '#C8A265',
    letterSpacing: Math.max(width * 0.01, 2),
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default VideoSplashScreen;
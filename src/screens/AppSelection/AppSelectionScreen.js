import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
const BG = '#F3F4F8';
const CARD_BORDER = '#ECEEF2';
const TITLE_COLOR = '#141D24';
const SUBTITLE_COLOR = '#111111';
const ICON_COLOR = '#1B6570';

const AppCard = ({ iconSource, title, subtitle, onPress, animValue, delay = 0, fullWidth = false }) => {
  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [28 + delay, 0],
  });

  return (
    <Animated.View style={[styles.cardWrapper, fullWidth && styles.cardWrapperFull, { opacity: animValue, transform: [{ translateY }] }]}>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.82}
      >
        <Image source={iconSource} style={styles.cardIcon} resizeMode="contain" />
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const AppSelectionScreen = ({ navigation }) => {
  const headerAnim = useRef(new Animated.Value(0)).current;
  const card1Anim = useRef(new Animated.Value(0)).current;
  const card2Anim = useRef(new Animated.Value(0)).current;
  const card3Anim = useRef(new Animated.Value(0)).current;
  const horizontalPadding = 20;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(card1Anim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(card2Anim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(card3Anim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [headerAnim, card1Anim, card2Anim, card3Anim]);

  const navigateTo = (screenName) => {
    navigation.replace(screenName);
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={BG} barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.header, { opacity: headerAnim }]}>
          <Image
            source={require('../../assets/images/Thick Logo Final 1.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
        </Animated.View>

        <View style={[styles.cardsContainer, { paddingHorizontal: horizontalPadding }]}>
          <AppCard
            iconSource={require('../../assets/images/SketchOutlined.png')}
            title="CUSTOM"
            subtitle="Start Designing"
            onPress={() => navigateTo('CustomApp')}
            animValue={card1Anim}
            delay={0}
          />

          <AppCard
            iconSource={require('../../assets/images/list-restart.png')}
            title="REORDER"
            subtitle="Browse past orders"
            onPress={() => navigateTo('CatalogApp')}
            animValue={card2Anim}
            delay={8}
          />
          <AppCard
            iconSource={require('../../assets/images/productivity.png')}
            title="Production"
            subtitle="Production mode"
            onPress={() => navigateTo('ProductionApp')}
            animValue={card3Anim}
            delay={16}
            fullWidth={true}
          />
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  header: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 72,
  },
  brandLogo: {
    width: 200,
    height: 150,
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  cardWrapper: {
    flex: 1,
    flexBasis: '48%',
    maxWidth: '48%',
    marginBottom: 16,
  },
  cardWrapperFull: {
    flexBasis: '100%',
    maxWidth: '100%',
  },
  card: {
    flex: 1,
    backgroundColor: '#F9F9FB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 8,
    marginHorizontal: 5,
    minHeight: 148,
  },
  cardIcon: {
    width: 44,
    height: 44,
    tintColor: ICON_COLOR,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 16,
    color: TITLE_COLOR,
    fontWeight: 400,
    lineHeight: 32,
    marginBottom: 4,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 10,
    color: SUBTITLE_COLOR,
    fontWeight: 400,
    lineHeight: 17,
    textAlign: 'center',
  },
});

export default AppSelectionScreen;

import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/common';
import { Heading, BodyText } from '../../components/common/Text';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { images } from '../../constants/images';
import { markFirstLaunchComplete } from '../../utils/firstLaunch';
import Icon from '../../components/common/Icon';

const { width, height } = Dimensions.get('window');

const onboardingData = [
  {
    id: '1',
    title: 'Welcome to Chandra Jewels',
    description: 'Your complete jewelry management solution. Manage enquiries, designs, and client communications all in one place.',
    icon: 'diamond',
    image: images.logo,
    color: colors.primary,
  },
  {
    id: '2',
    title: 'Manage Enquiries',
    description: 'Track and manage all your jewelry enquiries efficiently. Add details, upload designs, and monitor progress.',
    icon: 'description',
    image: images.logo,
    color: colors.accent,
  },
  {
    id: '3',
    title: 'Real-time Communication',
    description: 'Stay connected with your team and clients through instant messaging and notifications.',
    icon: 'chat',
    image: images.logo,
    color: colors.secondary,
  },
  {
    id: '4',
    title: 'Get Started',
    description: 'Ready to transform your jewelry business? Sign in to access all features and start managing your business efficiently.',
    icon: 'check',
    image: images.logo,
    color: colors.success,
  },
];

const OnboardingScreen = ({ navigation, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [viewableItems, setViewableItems] = useState([]);

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    setViewableItems(viewableItems);
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const handleNext = () => {
    if (currentIndex < onboardingData.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = async () => {
    await markFirstLaunchComplete();
    // Navigate to Login screen
    if (onComplete) {
      onComplete();
    } else {
      navigation.replace('Login');
    }
  };

  const renderItem = ({ item, index }) => {
    const inputRange = [
      (index - 1) * width,
      index * width,
      (index + 1) * width,
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.8, 1, 0.8],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.5, 1, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <View style={[styles.slide, { width }]}>
        <Animated.View
          style={[
            styles.contentContainer,
            {
              transform: [{ scale }],
              opacity,
            },
          ]}>
          {/* Icon/Image Container */}
          <View style={[styles.iconContainer, { backgroundColor: `${item.color}15` }]}>
            <View style={[styles.iconCircle, { backgroundColor: item.color }]}>
              <Icon
                name={item.icon}
                size={60}
                color={colors.textWhite}
              />
            </View>
          </View>

          {/* Title */}
          <Heading
            style={styles.title}
            color="primary"
          >
            {item.title}
          </Heading>

          {/* Description */}
          <BodyText
            style={styles.description}
            color="secondary"
          >
            {item.description}
          </BodyText>
        </Animated.View>
      </View>
    );
  };

  const renderPagination = () => {
    return (
      <View style={styles.paginationContainer}>
        {onboardingData.map((_, index) => {
          const inputRange = [
            (index - 1) * width,
            index * width,
            (index + 1) * width,
          ];

          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 24, 8],
            extrapolate: 'clamp',
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.paginationDot,
                {
                  width: dotWidth,
                  opacity,
                  backgroundColor: currentIndex === index ? colors.primary : colors.border,
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      
      {/* Skip Button */}
      {currentIndex < onboardingData.length - 1 && (
        <View style={styles.skipContainer}>
          <Button
            title="Skip"
            variant="text"
            onPress={handleSkip}
            style={styles.skipButton}
            textStyle={styles.skipButtonText}
          />
        </View>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={onboardingData}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(data, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />

      {/* Pagination Dots */}
      {renderPagination()}

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {currentIndex > 0 && (
          <Button
            title="Previous"
            variant="outline"
            onPress={() => flatListRef.current?.scrollToIndex({ index: currentIndex - 1 })}
            style={styles.previousButton}
          />
        )}
        <Button
          title={currentIndex === onboardingData.length - 1 ? 'Get Started' : 'Next'}
          onPress={handleNext}
          style={[
            styles.nextButton,
            currentIndex === 0 && styles.nextButtonFull,
          ]}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skipContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipButtonText: {
    color: colors.textSecondary,
    fontSize: fonts.base,
    fontFamily: fonts.medium,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingBottom: 100,
  },
  iconContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: fonts['3xl'],
    fontFamily: fonts.bold,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  description: {
    fontSize: fonts.lg,
    textAlign: 'center',
    lineHeight: fonts.lg * 1.6,
    paddingHorizontal: 20,
    color: colors.textSecondary,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 12,
  },
  previousButton: {
    flex: 1,
  },
  nextButton: {
    flex: 1,
    borderRadius: 20,
  },
  nextButtonFull: {
    flex: 1,
    width: '100%',
  },
});

export default OnboardingScreen;


import React, { useRef } from 'react';
import { View, TouchableOpacity, Animated, PanResponder, StyleSheet } from 'react-native';
import Icon from '../common/Icon';
import { colors } from '../../constants/colors';

const SwipeableMessage = ({ message, myMessage, onSwipeRight, onLongPress, children }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const replyIconOpacity = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => {
        // Allow capture if it's a horizontal gesture from the start
        return Math.abs(gestureState.dx) > 5 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes (right swipe for reply)
        // Prioritize horizontal over vertical to prevent FlatList scroll conflict
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const isRightSwipe = gestureState.dx > 10;
        return isHorizontal && isRightSwipe;
      },
      onPanResponderGrant: () => {
        translateX.setOffset(translateX._value);
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only allow swiping right (positive dx) for reply
        // Increase max distance for better UX
        if (gestureState.dx > 0 && gestureState.dx < 150) {
          translateX.setValue(gestureState.dx);
          // Fade in reply icon as user swipes
          const opacity = Math.min(gestureState.dx / 50, 1);
          replyIconOpacity.setValue(opacity);
        } else if (gestureState.dx <= 0) {
          // Reset if swiping left
          translateX.setValue(0);
          replyIconOpacity.setValue(0);
        }
      },
      onPanResponderTerminationRequest: () => false, // Don't allow parent to take over
      onPanResponderRelease: (evt, gestureState) => {
        translateX.flattenOffset();
        // Lower threshold for easier triggering (30px instead of 50px)
        if (gestureState.dx > 30) {
          // Swipe threshold reached - trigger reply
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              tension: 50,
              friction: 7,
            }),
            Animated.timing(replyIconOpacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            // Callback after animation completes
            if (onSwipeRight) {
              onSwipeRight();
            }
          });
        } else {
          // Reset position
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              tension: 50,
              friction: 7,
            }),
            Animated.timing(replyIconOpacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.swipeableContainer}>
      {/* Reply Icon Background (shows when swiping) */}
      <Animated.View
        style={[
          styles.replyIconBackground,
          {
            opacity: replyIconOpacity,
          },
        ]}
      >
        <Icon
          name="reply"
          size={24}
          color={colors.primary}
        />
      </Animated.View>
      
      <Animated.View
        style={[
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
        collapsable={false}
      >
        <TouchableOpacity
          style={[
            styles.messageContainer,
            myMessage ? styles.myMessageContainer : styles.otherMessageContainer,
          ]}
          onLongPress={onLongPress}
          activeOpacity={0.9}
          delayLongPress={500}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  swipeableContainer: {
    position: 'relative',
  },
  replyIconBackground: {
    position: 'absolute',
    left: 10,
    top: '50%',
    marginTop: -12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  messageContainer: {
    marginBottom: 16,
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
});

export default SwipeableMessage;



























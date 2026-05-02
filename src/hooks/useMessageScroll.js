import { useRef, useCallback } from 'react';

/**
 * Hook for managing message scroll-to-reply functionality
 */
export const useMessageScroll = (enrichedMessages, scrollViewRef) => {
  const messagePositionsRef = useRef(new Map());
  const lastScrollAttemptRef = useRef(null);
  const flatListLayoutReadyRef = useRef(false);

  const scrollToMessage = useCallback((messageIdStr, setHighlightedMessageId) => {
    if (!messageIdStr || !scrollViewRef.current) {
      if (__DEV__) {
        console.log('❌ [Reply Tap] Missing messageId or scrollViewRef');
      }
      return;
    }

    // Prevent rapid multiple taps
    const now = Date.now();
    if (lastScrollAttemptRef.current && (now - lastScrollAttemptRef.current) < 500) {
      if (__DEV__) {
        console.log('🔴 [Reply Tap] Ignoring rapid tap (debounced)');
      }
      return;
    }
    lastScrollAttemptRef.current = now;

    // Find the message index
    const messageIndex = enrichedMessages.findIndex(m => {
      const mId = String(m._id || m.id || '').trim();
      return mId && mId === messageIdStr;
    });

    if (messageIndex === -1) {
      if (__DEV__) {
        console.log('❌ [Reply Tap] Message not found in list:', {
          messageId: messageIdStr,
          totalMessages: enrichedMessages.length,
        });
      }
      return;
    }

    // Highlight the message immediately
    if (setHighlightedMessageId) {
      setHighlightedMessageId(messageIdStr);
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 3000);
    }

    // Scroll function with retry logic
    const performScroll = (attempt = 1) => {
      if (!scrollViewRef.current) {
        if (__DEV__) {
          console.log('❌ [Reply Tap] No scrollViewRef, attempt:', attempt);
        }
        return;
      }

      // Use scrollToIndex first (most reliable for FlatList)
      // scrollToOffset can be inaccurate if items have variable heights
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            const flatList = scrollViewRef.current;
            if (!flatList) return;

            // Try scrollToIndex first - it's more reliable for FlatList
            if (typeof flatList.scrollToIndex === 'function') {
              try {
                flatList.scrollToIndex({
                  index: messageIndex,
                  animated: true,
                  viewPosition: 0.3, // Position message at 30% from top
                });

                if (__DEV__) {
                  console.log('✅ [Reply Tap] scrollToIndex called, attempt:', attempt, 'index:', messageIndex);
                }
                return; // Success, don't try scrollToOffset
              } catch (indexError) {
                // scrollToIndex failed (item not rendered yet), fall back to scrollToOffset
                if (__DEV__) {
                  console.log('⚠️ [Reply Tap] scrollToIndex failed, trying scrollToOffset:', indexError);
                }
              }
            }

            // Fallback to scrollToOffset if scrollToIndex fails
            if (typeof flatList.scrollToOffset === 'function') {
              // Calculate offset based on estimated message height
              const estimatedMessageHeight = 110;
              const contentPadding = 16;
              
              // Calculate the scroll position for this message
              // For messages near the top (index < 3), use minimal offset
              // For other messages, calculate proper offset
              let offset;
              if (messageIndex < 3) {
                // Messages near top - use small offset to avoid scrolling to very top
                offset = Math.max(50, messageIndex * estimatedMessageHeight);
              } else {
                // Normal calculation - position message in upper-middle of screen
                const estimatedScrollY = messageIndex * estimatedMessageHeight;
                offset = estimatedScrollY + contentPadding - 200;
                // Ensure offset is never negative or too small
                offset = Math.max(100, offset);
              }

              if (__DEV__) {
                console.log('🔴 [Reply Tap] scrollToOffset calculation:', {
                  messageIndex,
                  estimatedScrollY: messageIndex * estimatedMessageHeight,
                  calculatedOffset: offset,
                  attempt,
                });
              }

              flatList.scrollToOffset({
                offset: offset,
                animated: true,
              });

              if (__DEV__) {
                console.log('✅ [Reply Tap] scrollToOffset called, attempt:', attempt, 'offset:', offset);
              }
            }
          } catch (error) {
            if (__DEV__) {
              console.log('❌ [Reply Tap] Scroll failed:', error);
            }
          }
        });
      });
    };

    // Try scrolling with increasing delays
    // Start with a small delay to ensure FlatList is ready
    setTimeout(() => {
      performScroll(1);
    }, 50);
    
    const retryDelays = [200, 400, 600, 1000];
    retryDelays.forEach((delay, idx) => {
      setTimeout(() => {
        performScroll(idx + 2);
      }, delay);
    });
  }, [enrichedMessages, scrollViewRef]);

  const storeMessagePosition = useCallback((messageId, y) => {
    if (messageId && y !== undefined && y !== null) {
      messagePositionsRef.current.set(messageId, y);
    }
  }, []);

  return {
    scrollToMessage,
    storeMessagePosition,
    messagePositionsRef,
  };
};


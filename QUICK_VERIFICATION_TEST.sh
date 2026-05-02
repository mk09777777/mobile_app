#!/bin/bash

# Quick Notification Verification Test Script
# This script helps you verify all notification flows

echo "🔔 Notification Setup Verification Test"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "This script will help you verify your notification setup."
echo ""
echo "What would you like to test?"
echo ""
echo "1. Check initialization flow (open app and login)"
echo "2. Get FCM token"
echo "3. Monitor foreground notifications"
echo "4. Monitor background notifications"
echo "5. Monitor killed state notifications"
echo "6. Full test (all of the above)"
echo ""
read -p "Enter choice (1-6): " choice

case $choice in
  1)
    echo ""
    echo "${YELLOW}📱 Test 1: Initialization Flow${NC}"
    echo "-----------------------------------"
    echo "1. Open your app and login"
    echo "2. Watch the logs below"
    echo ""
    echo "Expected logs:"
    echo "  - [PushNotification] Initializing push notifications..."
    echo "  - [PushNotification] Permission granted"
    echo "  - [PushNotification] FCM token obtained"
    echo "  - [PushNotification] Token registered with backend successfully"
    echo ""
    echo "Press Ctrl+C to stop monitoring"
    echo ""
    adb logcat -c
    adb logcat | grep -E "PushNotification" --color=always
    ;;
    
  2)
    echo ""
    echo "${YELLOW}🔑 Test 2: Get FCM Token${NC}"
    echo "---------------------------"
    echo "Getting your FCM token..."
    echo ""
    TOKEN=$(adb logcat -d | grep "FCM TOKEN:" | tail -1 | sed 's/.*FCM TOKEN: //')
    if [ -z "$TOKEN" ]; then
      echo "${RED}❌ Token not found in logs${NC}"
      echo ""
      echo "Please:"
      echo "1. Open your app"
      echo "2. Login"
      echo "3. Run this script again"
    else
      echo "${GREEN}✅ Token found:${NC}"
      echo "$TOKEN"
      echo ""
      echo "Copy this token to test with Firebase Console"
    fi
    ;;
    
  3)
    echo ""
    echo "${YELLOW}📲 Test 3: Foreground Notifications${NC}"
    echo "----------------------------------------"
    echo "1. Keep your app OPEN (in foreground)"
    echo "2. Send a test notification from Firebase Console"
    echo "3. Watch the logs below"
    echo ""
    echo "Expected logs:"
    echo "  - [PushNotification] Received foreground message"
    echo "  - [PushNotification] Foreground notification displayed"
    echo ""
    echo "Press Ctrl+C to stop monitoring"
    echo ""
    adb logcat -c
    adb logcat | grep -E "PushNotification|FCM" --color=always
    ;;
    
  4)
    echo ""
    echo "${YELLOW}📲 Test 4: Background Notifications${NC}"
    echo "----------------------------------------"
    echo "1. Open your app, then press HOME button (minimize)"
    echo "2. Send a test notification from Firebase Console"
    echo "3. Watch the logs below"
    echo ""
    echo "Expected logs:"
    echo "  - [FCM Background] Message received"
    echo "  - [FCM Background] Notification displayed successfully"
    echo ""
    echo "Press Ctrl+C to stop monitoring"
    echo ""
    adb logcat -c
    adb logcat | grep -E "FCM Background|PushNotification" --color=always
    ;;
    
  5)
    echo ""
    echo "${YELLOW}💀 Test 5: Killed State Notifications${NC}"
    echo "-------------------------------------------"
    echo "1. Force stop your app:"
    echo "   adb shell am force-stop com.chandrajewellery"
    echo ""
    read -p "Press Enter after force stopping the app..."
    echo ""
    echo "2. Send a test notification from Firebase Console"
    echo "3. Watch the logs below"
    echo ""
    echo "Expected logs:"
    echo "  - [FCM Background] Message received"
    echo "  - [FCM Background] Notification displayed successfully"
    echo ""
    echo "Press Ctrl+C to stop monitoring"
    echo ""
    adb logcat -c
    adb logcat | grep -E "FCM Background" --color=always
    ;;
    
  6)
    echo ""
    echo "${YELLOW}🧪 Full Test${NC}"
    echo "============="
    echo ""
    echo "Step 1: Initialization"
    echo "----------------------"
    echo "1. Open your app and login"
    echo "2. Watch for initialization logs"
    echo ""
    read -p "Press Enter when app is open and logged in..."
    echo ""
    adb logcat -c
    echo "Monitoring initialization (10 seconds)..."
    timeout 10 adb logcat | grep -E "PushNotification" --color=always || true
    echo ""
    echo ""
    echo "Step 2: Get Token"
    echo "-----------------"
    TOKEN=$(adb logcat -d | grep "FCM TOKEN:" | tail -1 | sed 's/.*FCM TOKEN: //')
    if [ -z "$TOKEN" ]; then
      echo "${RED}❌ Token not found${NC}"
    else
      echo "${GREEN}✅ Token:${NC} $TOKEN"
      echo ""
      echo "Use this token in Firebase Console to send test notifications"
    fi
    echo ""
    read -p "Press Enter to continue to foreground test..."
    echo ""
    echo ""
    echo "Step 3: Foreground Test"
    echo "-----------------------"
    echo "1. Keep app OPEN"
    echo "2. Send test notification from Firebase Console"
    echo "3. Monitoring for 30 seconds..."
    echo ""
    adb logcat -c
    timeout 30 adb logcat | grep -E "PushNotification|FCM" --color=always || true
    echo ""
    read -p "Press Enter to continue to background test..."
    echo ""
    echo ""
    echo "Step 4: Background Test"
    echo "----------------------"
    echo "1. Press HOME button (minimize app)"
    echo "2. Send test notification from Firebase Console"
    echo "3. Monitoring for 30 seconds..."
    echo ""
    read -p "Press Enter after minimizing app..."
    adb logcat -c
    timeout 30 adb logcat | grep -E "FCM Background|PushNotification" --color=always || true
    echo ""
    echo ""
    echo "${GREEN}✅ Full test complete!${NC}"
    echo ""
    echo "Check the logs above to verify each step worked correctly."
    ;;
    
  *)
    echo "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac





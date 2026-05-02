#!/bin/bash

# Quick diagnostic script to check notification status on Android device

echo "=========================================="
echo "Android Notification Status Check"
echo "=========================================="
echo ""

# Check if device is connected
if ! adb devices | grep -q "device$"; then
    echo "❌ No Android device connected"
    echo "   Please connect your device via USB and enable USB debugging"
    exit 1
fi

echo "✅ Android device connected"
echo ""

# Check for FCM token in logs
echo "Checking for FCM token registration..."
TOKEN=$(adb logcat -d | grep "FCM TOKEN:" | tail -1 | sed 's/.*FCM TOKEN: //')
if [ -z "$TOKEN" ]; then
    echo "⚠️  No FCM token found in recent logs"
    echo "   The app might not have registered the token yet"
    echo "   Try: Open the app and check logs again"
else
    echo "✅ FCM token found:"
    echo "   ${TOKEN:0:50}..."
    echo ""
    echo "   Full token: $TOKEN"
fi

echo ""
echo "=========================================="
echo "Monitoring notification logs..."
echo "Press Ctrl+C to stop"
echo "=========================================="
echo ""
echo "Waiting for notifications..."
echo ""

# Monitor logs for notification-related messages
adb logcat -c  # Clear log buffer
adb logcat | grep --line-buffered -E "FCM Background|PushNotification|FCM TOKEN|Notification channel|ERROR.*FCM|Error.*Notification" --color=always




































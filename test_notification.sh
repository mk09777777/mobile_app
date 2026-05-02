#!/bin/bash

# Test Push Notification Script
# This script sends a test notification directly to your device via Firebase

echo "🔔 Push Notification Tester"
echo "=========================="
echo ""

# Get FCM token from user
echo "Enter your FCM token (from logs: 'FCM token obtained'):"
read FCM_TOKEN

if [ -z "$FCM_TOKEN" ]; then
    echo "❌ Error: FCM token is required"
    exit 1
fi

# Get Firebase Server Key
echo ""
echo "Enter your Firebase Server Key:"
echo "(Get it from: Firebase Console > Project Settings > Cloud Messaging > Server Key)"
read SERVER_KEY

if [ -z "$SERVER_KEY" ]; then
    echo "❌ Error: Server Key is required"
    exit 1
fi

echo ""
echo "📤 Sending test notification..."
echo ""

# Send notification
RESPONSE=$(curl -s -X POST https://fcm.googleapis.com/fcm/send \
  -H "Authorization: key=$SERVER_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"to\": \"$FCM_TOKEN\",
    \"notification\": {
      \"title\": \"Test Notification\",
      \"body\": \"This is a test notification from script\"
    },
    \"data\": {
      \"Title\": \"Test Notification\",
      \"Body\": \"This is a test notification from script\",
      \"link\": \"/notifications\"
    },
    \"priority\": \"high\"
  }")

echo "Response: $RESPONSE"
echo ""

# Check response
if echo "$RESPONSE" | grep -q "success"; then
    echo "✅ Notification sent successfully!"
    echo "📱 Check your device - you should see the notification"
    echo ""
    echo "💡 Monitor logs with: adb logcat | grep -E 'PushNotification|FCM'"
else
    echo "❌ Failed to send notification"
    echo "Response: $RESPONSE"
fi





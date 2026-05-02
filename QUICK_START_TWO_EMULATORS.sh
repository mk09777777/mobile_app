#!/bin/bash

# Quick Start Script for Testing Chat on Two Emulators
# Run this script to start both emulators and the app

echo "🚀 Starting Chat Testing Setup..."

# Step 1: Start Metro Bundler (in background)
echo "📦 Starting Metro Bundler..."
cd /Users/mohitrathod/Documents/cravora/Projects/Chandra-jewels
npm start &
METRO_PID=$!
echo "Metro started with PID: $METRO_PID"
sleep 5

# Step 2: Start First Emulator
echo "📱 Starting First Emulator (Medium_Phone_API_36.1)..."
emulator -avd Medium_Phone_API_36.1 &
EMULATOR1_PID=$!
echo "First emulator starting with PID: $EMULATOR1_PID"
sleep 10

# Step 3: Start Second Emulator
echo "📱 Starting Second Emulator (Medium_Tablet)..."
emulator -avd Medium_Tablet &
EMULATOR2_PID=$!
echo "Second emulator starting with PID: $EMULATOR2_PID"
sleep 15

# Step 4: Wait for emulators to boot
echo "⏳ Waiting for emulators to boot..."
echo "Checking devices..."
sleep 10

# Step 5: Check connected devices
echo "📋 Checking connected devices..."
adb devices

# Step 6: Build and install on first device
echo "🔨 Building and installing on first emulator..."
DEVICE1=$(adb devices | grep "emulator" | head -1 | awk '{print $1}')
if [ ! -z "$DEVICE1" ]; then
    echo "Installing on device: $DEVICE1"
    if [ -x /usr/libexec/java_home ]; then export JAVA_HOME="$(/usr/libexec/java_home -v 17)"; fi
    export ANDROID_HOME="$HOME/Library/Android/sdk"
    export PATH="$PATH:$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
    npx react-native run-android --deviceId=$DEVICE1
else
    echo "❌ First device not found. Please wait for emulator to boot and run:"
    echo "   npm run android"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Wait for first app to install and login with User 1"
echo "2. In a new terminal, run:"
echo "   cd /Users/mohitrathod/Documents/cravora/Projects/Chandra-jewels"
echo "   DEVICE2=\$(adb devices | grep 'emulator' | tail -1 | awk '{print \$1}')"
echo "   npx react-native run-android --deviceId=\$DEVICE2"
echo "3. Login with User 2 on the second emulator"
echo "4. Test chat between both users!"
echo ""
echo "To stop everything:"
echo "  kill $METRO_PID $EMULATOR1_PID $EMULATOR2_PID"


#!/bin/bash

# Chandra Jewellery App Setup Script
echo "🏗️  Setting up Chandra Jewellery Management App..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js >= 20 first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version 20 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Install iOS dependencies if on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 Installing iOS dependencies..."
    cd ios && pod install && cd ..
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install iOS dependencies"
        exit 1
    fi
    
    echo "✅ iOS dependencies installed successfully"
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📱 To run the app:"
echo "   iOS:     npm run ios"
echo "   Android: npm run android"
echo ""
echo "🔑 Demo credentials:"
echo "   Admin:    admin@chandrajewels.com / admin123"
echo "   Client:   john@example.com / client123"
echo "   Coral:    coral@chandrajewels.com / coral123"
echo "   CAD:      cad@chandrajewels.com / cad123"
echo ""
echo "📚 Check README.md for detailed documentation"

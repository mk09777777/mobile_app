#!/bin/bash

# Script to fix iOS fonts and icons
# This script helps ensure fonts and icons are properly linked in Xcode

echo "🔧 Fixing iOS Fonts and Icons..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -d "ios" ]; then
    echo -e "${RED}❌ Error: Please run this script from the project root directory${NC}"
    exit 1
fi

cd ios

echo -e "${YELLOW}Step 1: Installing CocoaPods dependencies...${NC}"
pod install

echo ""
echo -e "${YELLOW}Step 2: Checking font files...${NC}"

FONT_DIR="chandrajewellery"
FONTS_FOUND=0
FONTS_MISSING=0

# Check Avenir fonts
for font in AvenirLTStd-Roman.otf AvenirLTStd-Book.otf AvenirLTStd-Medium.otf \
           AvenirLTStd-Heavy.otf AvenirLTStd-Black.otf AvenirLTStd-Light.otf \
           AvenirLTStd-Oblique.otf AvenirLTStd-BookOblique.otf \
           AvenirLTStd-MediumOblique.otf AvenirLTStd-HeavyOblique.otf \
           AvenirLTStd-BlackOblique.otf AvenirLTStd-LightOblique.otf; do
    if [ -f "$FONT_DIR/$font" ]; then
        echo -e "${GREEN}✅ Found: $font${NC}"
        ((FONTS_FOUND++))
    else
        echo -e "${RED}❌ Missing: $font${NC}"
        ((FONTS_MISSING++))
    fi
done

# Check MaterialIcons
if [ -f "$FONT_DIR/MaterialIcons.ttf" ]; then
    echo -e "${GREEN}✅ Found: MaterialIcons.ttf${NC}"
    ((FONTS_FOUND++))
else
    echo -e "${RED}❌ Missing: MaterialIcons.ttf${NC}"
    ((FONTS_MISSING++))
fi

echo ""
echo -e "${YELLOW}Font Summary:${NC}"
echo "  Found: $FONTS_FOUND"
echo "  Missing: $FONTS_MISSING"

if [ $FONTS_MISSING -gt 0 ]; then
    echo -e "${RED}⚠️  Some fonts are missing. Please ensure all font files are in ios/chandrajewellery/${NC}"
fi

echo ""
echo -e "${YELLOW}Step 3: Verifying Info.plist...${NC}"
if grep -q "UIAppFonts" "$FONT_DIR/Info.plist"; then
    echo -e "${GREEN}✅ UIAppFonts key found in Info.plist${NC}"
else
    echo -e "${RED}❌ UIAppFonts key not found in Info.plist${NC}"
fi

echo ""
echo -e "${YELLOW}Step 4: Instructions for Xcode${NC}"
echo ""
echo "📋 MANUAL STEPS REQUIRED IN XCODE:"
echo ""
echo "1. Open the workspace:"
echo "   ${GREEN}open chandrajewellery.xcworkspace${NC}"
echo ""
echo "2. In Xcode Project Navigator (left sidebar):"
echo "   - Right-click on 'chandrajewellery' folder"
echo "   - Select 'Add Files to chandrajewellery...'"
echo "   - Navigate to ios/chandrajewellery/"
echo "   - Select ALL font files (.otf and .ttf)"
echo "   - ✅ Check 'Copy items if needed'"
echo "   - ✅ Check 'Add to targets: chandrajewellery'"
echo "   - Click 'Add'"
echo ""
echo "3. Verify fonts in Build Phases:"
echo "   - Select 'chandrajewellery' project in Navigator"
echo "   - Select 'chandrajewellery' target"
echo "   - Go to 'Build Phases' tab"
echo "   - Expand 'Copy Bundle Resources'"
echo "   - Verify all font files are listed"
echo "   - If missing, click '+' and add them"
echo ""
echo "4. Clean and rebuild:"
echo "   - Product → Clean Build Folder (Shift+Cmd+K)"
echo "   - Product → Build (Cmd+B)"
echo ""
echo -e "${GREEN}✅ Script completed!${NC}"
echo ""
echo "After completing the Xcode steps, rebuild your app."








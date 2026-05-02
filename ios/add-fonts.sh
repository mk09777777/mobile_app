#!/bin/bash

# Script to add fonts to Xcode project
# This script helps ensure fonts are properly included in the iOS app bundle

echo "Checking fonts in chandrajewellery directory..."

FONT_DIR="chandrajewellery"
FONTS_FOUND=0

# Check for Avenir fonts
for font in AvenirLTStd-*.otf; do
    if [ -f "$FONT_DIR/$font" ]; then
        echo "✓ Found: $font"
        FONTS_FOUND=$((FONTS_FOUND + 1))
    fi
done

# Check for MaterialIcons
if [ -f "$FONT_DIR/MaterialIcons.ttf" ]; then
    echo "✓ Found: MaterialIcons.ttf"
    FONTS_FOUND=$((FONTS_FOUND + 1))
fi

echo ""
echo "Total fonts found: $FONTS_FOUND"
echo ""
echo "IMPORTANT: Fonts must be manually added to Xcode project:"
echo "1. Open chandrajewellery.xcworkspace in Xcode"
echo "2. Right-click on 'chandrajewellery' folder in Project Navigator"
echo "3. Select 'Add Files to chandrajewellery...'"
echo "4. Navigate to chandrajewellery folder"
echo "5. Select all .otf and .ttf font files"
echo "6. Check 'Copy items if needed' (if not already in project)"
echo "7. Check 'Add to targets: chandrajewellery'"
echo "8. Click 'Add'"
echo ""
echo "Alternatively, drag and drop all font files from Finder into Xcode project."








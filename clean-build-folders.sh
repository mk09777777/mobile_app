#!/bin/bash

# Script to clean all numbered build folders and standard build folders
# This fixes the issue where macOS/Windows creates numbered folders (build 2/, build 4/, etc.)
# when the build system tries to create a folder that already exists or is locked

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

echo "🧹 Cleaning numbered build folders..."

# Function to safely remove directories
safe_remove() {
    local pattern="$1"
    local count=0
    while IFS= read -r -d '' dir; do
        if [ -d "$dir" ]; then
            echo "    Removing: $dir" >&2
            rm -rf "$dir" 2>/dev/null || true
            ((count++))
        fi
    done < <(find . -type d -name "$pattern" -print0 2>/dev/null)
    echo "$count"
}

# Android build folders
echo ""
echo "📱 Cleaning Android build folders..."
cd "$PROJECT_ROOT/android"

if [ -d "app" ]; then
    cd app
    
    # Remove numbered build folders (build 2/, build 4/, etc.)
    echo "  Searching for numbered build folders in app/..."
    count=$(safe_remove "build [0-9]*")
    if [ "$count" -gt 0 ]; then
        echo "    Removed $count numbered build folder(s)"
    fi
    
    # Remove numbered subdirectories within build folders
    if [ -d "build" ]; then
        cd build
        total=0
        total=$((total + $(safe_remove "intermediates [0-9]*")))
        total=$((total + $(safe_remove "generated [0-9]*")))
        total=$((total + $(safe_remove "outputs [0-9]*")))
        total=$((total + $(safe_remove "kotlin [0-9]*")))
        if [ "$total" -gt 0 ]; then
            echo "    Removed $total numbered subdirectory(ies) from build/"
        fi
        cd ..
    fi
    
    cd ..
fi

# Remove numbered build folders in root android directory
echo "  Searching for numbered build folders in android/..."
count=$(safe_remove "build [0-9]*")
if [ "$count" -gt 0 ]; then
    echo "    Removed $count numbered build folder(s)"
fi

cd "$PROJECT_ROOT"

# iOS build folders
echo ""
echo "🍎 Cleaning iOS build folders..."
cd "$PROJECT_ROOT/ios"

# Remove numbered build folders
echo "  Searching for numbered build folders..."
count=$(safe_remove "build [0-9]*")
if [ "$count" -gt 0 ]; then
    echo "    Removed $count numbered build folder(s)"
fi

# Remove numbered generated folders within build
if [ -d "build" ]; then
    cd build
    echo "  Searching for numbered generated folders..."
    count=$(safe_remove "generated [0-9]*")
    if [ "$count" -gt 0 ]; then
        echo "    Removed $count numbered generated folder(s)"
    fi
    cd ..
fi

# Remove numbered Pods subdirectories (but keep the main Pods folder)
if [ -d "Pods" ]; then
    cd Pods
    echo "  Searching for numbered Pods subdirectories..."
    # Find directories with numbers at root level of Pods
    count=0
    for dir in */; do
        if [[ "$dir" =~ [0-9]+ ]]; then
            # Check if it's a numbered duplicate (has space and number)
            if [[ "$dir" =~ .*\ [0-9]+ ]]; then
                echo "    Removing: $dir"
                rm -rf "$dir" 2>/dev/null || true
                ((count++))
            fi
        fi
    done
    # Also use find for patterns like "boost 2", "DoubleConversion 2", etc.
    find_count=$(safe_remove "* [0-9]*")
    count=$((count + find_count))
    if [ "$count" -gt 0 ]; then
        echo "    Removed $count numbered Pods subdirectory(ies)"
    fi
    cd ..
fi

cd "$PROJECT_ROOT"

# Node modules build folders (React Native packages)
echo ""
echo "📦 Cleaning numbered build folders in node_modules..."
if [ -d "node_modules" ]; then
    cd node_modules
    
    # Find and remove numbered build folders in all React Native packages
    echo "  Searching for numbered build folders in node_modules..."
    total_removed=0
    
    # Find all numbered build folders in node_modules/*/android/build/
    while IFS= read -r -d '' dir; do
        if [ -d "$dir" ]; then
            echo "    Removing: $dir" >&2
            rm -rf "$dir" 2>/dev/null || true
            ((total_removed++))
        fi
    done < <(find . -type d -path "*/android/build/generated [0-9]*" -print0 2>/dev/null)
    
    # Also find numbered build folders at package level
    while IFS= read -r -d '' dir; do
        if [ -d "$dir" ]; then
            echo "    Removing: $dir" >&2
            rm -rf "$dir" 2>/dev/null || true
            ((total_removed++))
        fi
    done < <(find . -type d -path "*/android/build [0-9]*" -print0 2>/dev/null)
    
    # Find numbered subdirectories within build folders
    while IFS= read -r -d '' dir; do
        if [ -d "$dir" ]; then
            echo "    Removing: $dir" >&2
            rm -rf "$dir" 2>/dev/null || true
            ((total_removed++))
        fi
    done < <(find . -type d \( -name "intermediates [0-9]*" -o -name "outputs [0-9]*" -o -name "kotlin [0-9]*" \) -print0 2>/dev/null)
    
    if [ "$total_removed" -gt 0 ]; then
        echo "    Removed $total_removed numbered folder(s) from node_modules"
    else
        echo "    No numbered folders found in node_modules"
    fi
    
    cd ..
fi

cd "$PROJECT_ROOT"

echo ""
echo "✅ Numbered build folders cleaned!"
echo ""
echo "💡 Tips to prevent this issue:"
echo "   1. Always run 'npm run clean:build' before building"
echo "   2. Ensure no processes are locking build folders"
echo "   3. Use 'npm run clean:android' or 'npm run clean:ios' for platform-specific cleaning"
echo "   4. Use 'npm run clean:all' to clean everything"


/**
 * Script to Remove Console.log Statements for Production
 * 
 * This script removes console.log, console.debug, console.info statements
 * but keeps console.error and console.warn (for critical errors)
 * 
 * Usage:
 *   node scripts/removeConsoleLogs.js
 * 
 * Or use babel-plugin-transform-remove-console in babel.config.js
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns to match console statements (but keep console.error and console.warn)
const consolePatterns = [
  /console\.log\([^)]*\);?/g,
  /console\.debug\([^)]*\);?/g,
  /console\.info\([^)]*\);?/g,
];

// Keep these (for errors)
const keepPatterns = [
  /console\.error/,
  /console\.warn/,
];

function shouldKeepLine(line) {
  return keepPatterns.some(pattern => pattern.test(line));
}

function removeConsoleLogs(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let modified = false;

    // Split into lines
    const lines = content.split('\n');
    const newLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip if it's a keep pattern (console.error, console.warn)
      if (shouldKeepLine(line)) {
        newLines.push(line);
        continue;
      }

      // Check if line contains console.log, console.debug, or console.info
      let modifiedLine = line;
      
      // Remove console.log statements
      if (line.includes('console.log')) {
        // Check if it's wrapped in __DEV__ check (keep those)
        if (i > 0 && lines[i - 1].includes('__DEV__')) {
          newLines.push(line);
          continue;
        }
        
        // Remove the console.log line
        modifiedLine = line.replace(/console\.log\([^)]*\);?/g, '');
        if (modifiedLine.trim() !== line.trim()) {
          modified = true;
        }
      }
      
      // Remove console.debug statements
      if (line.includes('console.debug')) {
        modifiedLine = line.replace(/console\.debug\([^)]*\);?/g, '');
        if (modifiedLine.trim() !== line.trim()) {
          modified = true;
        }
      }
      
      // Remove console.info statements
      if (line.includes('console.info')) {
        modifiedLine = line.replace(/console\.info\([^)]*\);?/g, '');
        if (modifiedLine.trim() !== line.trim()) {
          modified = true;
        }
      }

      // Only add non-empty lines (or lines that weren't just console.log)
      if (modifiedLine.trim() || line.trim() === '') {
        newLines.push(modifiedLine);
      } else {
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Find all JS/JSX/TS/TSX files
const files = glob.sync('src/**/*.{js,jsx,ts,tsx}', {
  ignore: ['**/node_modules/**', '**/__tests__/**', '**/*.test.js', '**/*.spec.js']
});

let modifiedCount = 0;

console.log('🔍 Scanning for console.log statements...\n');

files.forEach(file => {
  if (removeConsoleLogs(file)) {
    modifiedCount++;
    console.log(`✅ Removed console.logs from: ${file}`);
  }
});

console.log(`\n✨ Done! Modified ${modifiedCount} files.`);
console.log('⚠️  Note: This script is basic. For production, use babel-plugin-transform-remove-console');


































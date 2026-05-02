#!/bin/bash

# Fix import statements in all JavaScript files
find src -name "*.js" -type f -exec sed -i '' "s|import { colors, fonts } from '../constants/colors'; import { fonts } from '../constants/fonts';|import { colors } from '../constants/colors';\nimport { fonts } from '../constants/fonts';|g" {} \;

# Fix any remaining malformed imports
find src -name "*.js" -type f -exec sed -i '' "s|from '../constants/colors'; import { fonts } from '../constants/fonts';|from '../constants/colors';\nimport { fonts } from '../constants/fonts';|g" {} \;

echo "Fixed import statements in all files"

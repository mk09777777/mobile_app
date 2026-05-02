module.exports = {
  dependencies: {
    '@sentry/react-native': {
      platforms: {
        ios: null, // Disable autolinking for iOS
      },
    },
  },
  // Link custom fonts placed under src/assets/fonts/
  // After adding new .ttf/.otf files, run: npx react-native-asset
  assets: ['./src/assets/fonts/'],
};










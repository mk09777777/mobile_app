module.exports = {
  presets: ['module:@react-native/babel-preset'],
  env: {
    production: {
      plugins: [
        // Remove console.log, console.debug, console.info in production builds only
        // Keep console.error and console.warn for critical errors
        [
          'transform-remove-console',
          {
            exclude: ['error', 'warn'], // Keep console.error and console.warn
          },
        ],
      ],
    },
  },
};

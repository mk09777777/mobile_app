module.exports = {
  root: true,
  extends: '@react-native',
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      configFile: __dirname + '/babel.config.js',
    },
  },
};

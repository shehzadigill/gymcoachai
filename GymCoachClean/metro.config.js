const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    alias: {
      // AWS SDK v3 compatibility
      crypto: 'react-native-crypto',
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

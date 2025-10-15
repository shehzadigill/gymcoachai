/**
 * @format
 */

// MUST be first for react-navigation gesture handling
import 'react-native-gesture-handler';

// Import polyfills for AWS SDK
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Add ReadableStream polyfill for AWS SDK v3 compatibility
import {
  ReadableStream,
  WritableStream,
  TransformStream,
} from 'web-streams-polyfill';

if (!global.ReadableStream) {
  global.ReadableStream = ReadableStream;
}
if (!global.WritableStream) {
  global.WritableStream = WritableStream;
}
if (!global.TransformStream) {
  global.TransformStream = TransformStream;
}

import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

console.log('[index] Registering app component:', appName);
AppRegistry.registerComponent(appName, () => App);

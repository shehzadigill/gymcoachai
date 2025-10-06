/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

console.log('App name from app.json:', appName);
console.log('Registering app component:', appName);

AppRegistry.registerComponent(appName, () => App);

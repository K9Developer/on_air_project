/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import PushNotification from "react-native-push-notification";

import Shortcuts from "react-native-actions-shortcuts";

PushNotification.configure({
  onNotification: function (notification) {
    console.log("NOTIFICATION:", notification);

  },
  requestPermissions: Platform.OS === 'ios'
});

PushNotification.createChannel({
  channelId: "done-channel",
  channelName: "Done Notifications",
  playSound: true, // (optional) default: true
  soundName: "done_beep.mp3",
  vibrate: true,
  vibration: 20000,
});

PushNotification.createChannel({
  channelId: "disconnect-channel",
  channelName: "Disconnect Notifications",
  playSound: true, // (optional) default: true
  soundName: "disconnect_sound.mp3",
  vibrate: true,
  vibration: 20000,
});

let shortcutItem = null;
Shortcuts.getInitialShortcut().then(d => shortcutItem = d).catch(e => console.log("ERROR when tried getting initial shortcut"));
const shortcut = {
  type: "onair.bluetooth.connect",
  title: "Connect to OnAir",
  shortTitle: "Connect",
  subtitle: "Connect to OnAir",
  iconName: "ic_launcher",
  data: {
    "connect": true,
    "start": false
  }
};

Shortcuts.setShortcuts([shortcut]);



AppRegistry.registerComponent(appName, () => App);

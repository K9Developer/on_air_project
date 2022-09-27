import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Home from './screens/Home';
import Details from './screens/Settings';
import Permissions from './screens/Permissions';
import AboutMe from './screens/AboutMe';
import FactorInfo from './screens/FactorInfo';
import DeviceChooser from './screens/DeviceChooser';
import { I18nManager, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import RNRestart from 'react-native-restart';
import { log } from './services/logs'

try {
  log("APP", `Is Right To Left layout: ${I18nManager.isRTL}`)

  AsyncStorage.getItem('@restarted').then(d => {
    if (d != "true") {
      I18nManager.allowRTL(false);
      I18nManager.forceRTL(false);
      log("APP", `Restarting to force LTR`)
      AsyncStorage.setItem('@restarted', "true").then(() => { RNRestart.Restart() });
    }
  })


} catch (error) {
  log("APP", `Failed forcing LTR. error: ${error}`)
}

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    backgroundColor: '#5D5D5D',
    background: '#3E3D3D',
  },
};

const Stack = createStackNavigator();
const storeData = async () => {
  if (!JSON.parse(await AsyncStorage.getItem('@factor'))) {
    log("APP", `Factor is not set! setting to default: 3.5`);
    try {
      await AsyncStorage.setItem('@factor', JSON.stringify(3.5));
    } catch (error) {
      log("APP", `ERROR when tried to save default data for factor. error: ${error}`);
    }
  }

  if (!JSON.parse(await AsyncStorage.getItem('@wantedPsi'))) {
    log("APP", `Wanted PSI is not set! setting to default: 3`);
    try {
      await AsyncStorage.setItem('@wantedPsi', JSON.stringify(3));
    } catch (error) {
      log("APP", `ERROR when tried to save default data for Wanted PSI. error: ${error}`);
    }
  }

  if (!JSON.parse(await AsyncStorage.getItem('@roadPreset'))) {
    log("APP", `Road Preset is not set! setting to default: 32`);
    try {
      await AsyncStorage.setItem('@roadPreset', JSON.stringify(32));
    } catch (error) {
      log("APP", `ERROR when tried to save default data for Road Preset. error: ${error}`);
    }
  }

  if (!JSON.parse(await AsyncStorage.getItem('@trailPreset'))) {
    log("APP", `Trail Preset is not set! setting to default: 16`);
    try {
      await AsyncStorage.setItem('@trailPreset', JSON.stringify(16));
    } catch (error) {
      log("APP", `ERROR when tried to save default data for Trail Preset. error: ${error}`);
    }
  }

  if (!JSON.parse(await AsyncStorage.getItem('@btImage'))) {
    log("APP", `BT Image is not set! setting to default: null`);
    try {
      await AsyncStorage.setItem('@BtImage', JSON.stringify(null));
    } catch (error) {
      log("APP", `ERROR when tried to save default data for BT Image. error: ${error}`);
    }
  }
};
storeData();

const logDeviceInfo = async () => {
  log("APP", `\n-----------------DEVICE INFO-----------------\n\t*Is Tablet: ${DeviceInfo.isTablet()}\n\t*OS name: ${DeviceInfo.getSystemName()}\n\t*${await DeviceInfo.getDeviceName()}\n\t*API level: ${await DeviceInfo.getApiLevel()}\n\t*Release version: ${Platform.constants['Release']}\n\n`)
}
logDeviceInfo()

const App = () => {
  return (

    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName="Home">
        <Stack.Screen name="Permissions" component={Permissions} />
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Settings" component={Details} />
        <Stack.Screen name="AboutMe" component={AboutMe} />
        <Stack.Screen name="DeviceChooser" component={DeviceChooser} />
        <Stack.Screen name="FactorInfo" component={FactorInfo} />
      </Stack.Navigator>
    </NavigationContainer>

  );
};

export default App;

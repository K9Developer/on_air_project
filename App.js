import React, { useEffect } from 'react';

import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Home from './screens/Home';
import Details from './screens/Settings';
import Permissions from './screens/Permissions';
import AboutMe from './screens/AboutMe';
import Feedback from './screens/Feedback';
import FactorInfo from './screens/FactorInfo';
import DeviceChooser from './screens/DeviceChooser';
import { I18nManager, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import RNRestart from 'react-native-restart';
import { log } from './services/logs'
import RNOtpVerify from 'react-native-otp-verify';




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
  if (await AsyncStorage.getItem('@factor')) {
    log("APP", `Factor is not set! setting to default: 3.5`);
    try {
      await AsyncStorage.setItem('@factor', JSON.stringify(3.5));
    } catch (error) {
      log("APP", `ERROR when tried to save default data for factor. error: ${error}`);
    }
  }

  if (await AsyncStorage.getItem('@wantedPsi')) {
    log("APP", `Wanted PSI is not set! setting to default: 3`);
    try {
      await AsyncStorage.setItem('@wantedPsi', JSON.stringify(3));
    } catch (error) {
      log("APP", `ERROR when tried to save default data for Wanted PSI. error: ${error}`);
    }
  }

  if (await AsyncStorage.getItem('@roadPreset')) {
    log("APP", `Road Preset is not set! setting to default: 32`);
    try {
      await AsyncStorage.setItem('@roadPreset', JSON.stringify(32));
    } catch (error) {
      log("APP", `ERROR when tried to save default data for Road Preset. error: ${error}`);
    }
  }

  if (await AsyncStorage.getItem('@trailPreset')) {
    log("APP", `Trail Preset is not set! setting to default: 16`);
    try {
      await AsyncStorage.setItem('@trailPreset', JSON.stringify(16));
    } catch (error) {
      log("APP", `ERROR when tried to save default data for Trail Preset. error: ${error}`);
    }
  }

  if (await AsyncStorage.getItem('@btImage')) {
    log("APP", `BT Image is not set! setting to default: null`);
    try {
      await AsyncStorage.setItem('@BtImage', JSON.stringify(null));
    } catch (error) {
      log("APP", `ERROR when tried to save default data for BT Image. error: ${error}`);
    }
  }
};


const logDeviceInfo = async () => {
  log("APP", `\n-----------------DEVICE INFO-----------------\n\t*Is Tablet: ${DeviceInfo.isTablet()}\n\t*OS name: ${DeviceInfo.getSystemName()}\n\t*${await DeviceInfo.getDeviceName()}\n\t*API level: ${await DeviceInfo.getApiLevel()}\n\t*Release version: ${Platform.constants['Release']}\n\n`)
}


const App = () => {

  useEffect(() => {
    let mounted = true

    const startProcess = async () => {
      let sessionLogs = await AsyncStorage.getItem("@sessionLogs")
      if (sessionLogs && mounted) {
        try {
          await AsyncStorage.setItem("@prevSessionLogs", sessionLogs)

        } catch (e) {
          log("APP", `ERROR when tried saving last logs as prev logs. (${e})`)
        }
        try {
          await AsyncStorage.setItem("@sessionLogs", "[]")
          log("APP", "Saved last logs as prev logs")
          log("APP", "Cleaned last logs")
        } catch (e) {
          log("APP", `ERROR when tried cleaning last logs. (${e})`)
        }
      }



      AsyncStorage.getItem('@restarted').then(d => {
        log("APP", `Is Right To Left layout: ${I18nManager.isRTL}. Restarted: ${d}`)
        if (d != "true") {
          I18nManager.allowRTL(false);
          I18nManager.forceRTL(false);
          log("APP", `Restarting to force LTR`)
          AsyncStorage.setItem('@restarted', "true").then(() => { RNRestart.Restart() });
        }
      })

      AsyncStorage.getItem("@appRunCount").then((value) => {
        if (mounted) {
          if (value) {
            AsyncStorage.setItem("@appRunCount", JSON.stringify(parseInt(value) + 1)).then(() => log("APP", `Updated app run count to: ${parseInt(value) + 1}`)).catch((e) => log("APP", `ERROR when tried updating app run count. (${e})`))
          } else {
            AsyncStorage.setItem("@appRunCount", "1").then(() => log("APP", `Updated app run count to: 1`)).catch((e) => log("APP", `ERROR when tried updating app run count. (${e})`))
          }
        }
      })

      RNOtpVerify.getHash()
        .then((hash) => {
          log("APP", "App HASH: " + hash);
        })
        .catch((e) => {
          log("APP", `ERROR when tried getting hash for app. (${e})`);
        });

      await logDeviceInfo()
      await storeData();
    }

    startProcess()

    return () => {
      mounted = false
    }
  }, [])


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
        <Stack.Screen name="Feedback" component={Feedback} />
      </Stack.Navigator>
    </NavigationContainer>

  );
};

export default App;

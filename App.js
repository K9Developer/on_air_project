import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Home from './screens/Home';
import Details from './screens/Settings';
import Permissions from './screens/Permissions';
import AboutMe from './screens/AboutMe';
import DeviceChooser from './screens/DeviceChooser';
import {I18nManager} from 'react-native';

try {
  I18nManager.allowRTL(false);
  
} catch (e) {
  console.log('I18nManager Error:', e);
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
  if (!AsyncStorage.getItem('@factor')) {
    try {
      await AsyncStorage.setItem('@factor', JSON.stringify(3.2) + 'setup');
    } catch (error) {
      console.log('ERROR SAVING FACTOR', error);
    }
  }

  if (!AsyncStorage.getItem('@wantedPsi')) {
    try {
      await AsyncStorage.setItem('@wantedPsi', JSON.stringify(3) + 'setup');
    } catch (error) {
      console.log('ERROR SAVING WANTED PSI', error);
    }
  }

  if (!AsyncStorage.getItem('@roadPreset')) {
    try {
      await AsyncStorage.setItem('@roadPreset', JSON.stringify(32) + 'setup');
    } catch (error) {
      console.log('ERROR SAVING ROAD PRESET', error);
    }
  }
  if (!AsyncStorage.getItem('@trailPreset')) {
    try {
      await AsyncStorage.setItem('@trailPreset', JSON.stringify(16) + 'setup');
    } catch (error) {
      console.log('ERROR SAVING TRAIL PRESET', error);
    }
  }

  if (!AsyncStorage.getItem('@btImage')) {
    try {
      await AsyncStorage.setItem('@BtImage', JSON.stringify(null));
    } catch (error) {
      console.log('ERROR SAVING BtImage', error);
    }
  }
};
storeData();

const App = () => {
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{headerShown: false}}
        initialRouteName="Home">
        <Stack.Screen name="Permissions" component={Permissions} />
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Settings" component={Details} />
        <Stack.Screen name="AboutMe" component={AboutMe} />
        <Stack.Screen name="DeviceChooser" component={DeviceChooser} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;

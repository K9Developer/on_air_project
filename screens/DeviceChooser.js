import {
  FlatList,
  View,
  Text,
  Image,
  TouchableOpacity,
  AppState,
  ActivityIndicator,
  Dimensions,
  BackHandler,
  SafeAreaView,
} from 'react-native';
import React, { useEffect, useState } from 'react';
import { CircleButton } from '../components';
import { BleManager } from 'react-native-ble-plx';
import Toast, { SuccessToast, ErrorToast } from 'react-native-toast-message';
import { log } from '../services/logs'


const Buffer = require('buffer').Buffer;

let MANAGER = null;
let timeoutTimer = null;
let connectedDevice = null;
let pingCounter = 0;
const winWidth = Dimensions.get('window').width;
let readMonitor = null;
let meantToDisconnect = false;

const toastConfig = {
  error: props => (
    <ErrorToast
      {...props}
      text1Style={{
        fontSize: 17,
      }}
      text2Style={{
        fontSize: 15,
      }}
    />
  ),
  success: props => (
    <SuccessToast
      {...props}
      text1Style={{
        fontSize: 17,
      }}
      text2Style={{
        fontSize: 15,
      }}
    />
  ),
};

const isPortrait = () => {
  const dim = Dimensions.get('screen');
  return dim.height >= dim.width;
};

const DeviceChooser = ({ navigation, route }) => {

  const [loadingPing, setLoadingPing] = useState([false, null]);
  const [loadingConnection, setLoadingConnection] = useState(false);
  const [isPortraitOrientation, setIsPortraitOrientation] = useState(isPortrait());

  Dimensions.addEventListener('change', () => {
    setIsPortraitOrientation(isPortrait())
  });

  useEffect(() => {
    log("DEVICE-CHOOSER", "Loading device chooser screen")
  }, [])


  const exitApp = () => {
    log("DEVICE-CHOOSER", "Exited device chooser. cancelling connection.")
    clearTimeout(timeoutTimer);
    try {
      let tmp = { ...connectedDevice };
      tmp.cancelConnection();
    } catch (error) { }
  };

  navigation.addListener('blur', e => {
    exitApp();
  });

  const exit = async () => {
    try {
      for (let i = 0; i < 10; i++) {
        await sendDeviceSignal(connectedDevice, 'Ok');
      }
      log("DEVICE-CHOOSER", "Pressed back button. sent OK messages to arduino")
    } catch (error) {
      log("DEVICE-CHOOSER", `ERROR when pressed the back button: ${error}`)
    }
    navigation.navigate('Settings', { connectToDevice: false, device: null });
    log("DEVICE-CHOOSER", `Navigating to settings`)
  };

  useEffect(() => {

    AppState.addEventListener('change', currentState => {
      if (currentState === 'background') {
        exitApp();
      }
    });

    BackHandler.addEventListener('hardwareBackPress', async () => {
      log("DEVICE-CHOOSER", `Pressed hardware back button`)
      await exit();
    });

    return () => {
      BackHandler.removeEventListener('hardwareBackPress', async () => {
        log("SETTINGS", 'Exit back button');
        await exit();
      });
    };
  }, []);

  const transferToSettings = async device => {
    log("DEVICE-CHOOSER", `Transferring data to settings`)
    if (connectedDevice) {
      try {
        for (let i = 0; i < 10; i++) {
          await sendDeviceSignal(connectedDevice, 'Ok');
        }
        log("DEVICE-CHOOSER", `Sent OK signals to arduino`)
      } catch (error) {
        log("DEVICE-CHOOSER", `ERROR when tried to send OK signals`)
      }
    }
    try {
      if (
        !connectedDevice ||
        (connectedDevice && device.id != connectedDevice.id) ||
        (connectedDevice && !(await connectedDevice.isConnected()))
      ) {
        log("DEVICE-CHOOSER", `First time connecting/Selected device not connected. Connecting to ${device.id}`)
        connectedDevice = await connectToDevice(device);
      }
    } catch (error) {
      log("DEVICE-CHOOSER", `ERROR when tried to connect to device: ${error}`)
    }
    try {
      log("DEVICE-CHOOSER", `Sending Connected signal to arduino`)
      await sendDeviceSignal(connectedDevice, 'Connected');
    } catch (error) {
      log("DEVICE-CHOOSER", `ERROR when tried to send Connected signal to arduino: ${error}`)
    }

    log("DEVICE-CHOOSER", `Navigating to settings`)
    navigation.navigate('Settings', {
      connectToDevice: true,
      device: connectedDevice,
      manager: MANAGER,
      goHome: true,
    });
  };


  const createManager = () => {
    if (!MANAGER) {
      MANAGER = new BleManager();
      log("DEVICE-CHOOSER", `Reloaded bluetooth manager`)
    }
  };

  const connectToDevice = async device => {
    try {
      createManager();
      log("DEVICE-CHOOSER", `Connecting to bluetooth device - ${device.id}`)
      let connectedDevice = await MANAGER.connectToDevice(device.id);
      log("DEVICE-CHOOSER", `Discovering services and characteristics for bluetooth device - ${device.id}`)
      await connectedDevice.discoverAllServicesAndCharacteristics();
      setLoadingConnection(false);
      return connectedDevice;
    } catch (error) {
      log("DEVICE-CHOOSER", `ERROR when tried to connect/discover services and characteristics for device - ${device.id}`)
      setLoadingConnection(false);
      return null;
    }
  };

  const failed = () => {

    log("DEVICE-CHOOSER", `Failed to ping`)
    if (readMonitor) {
      log("DEVICE-CHOOSER", `Removing sent data listener`)
      readMonitor.remove();
      readMonitor = null;
    }

    pingCounter = 0;
    setLoadingPing([false, null]);

    Toast.show({
      type: 'error',
      text1: 'Ping Error',
      text2: "We couldn't ping the device!",
    });
  };

  const sendDeviceSignal = async (device, signal) => {

    try {
      let base64Signal = Buffer.from('~' + signal + '^').toString('base64');
      log("DEVICE-CHOOSER", `Sending data (${signal}-${base64Signal}) to device - ${device.id}`)
      return await MANAGER.writeCharacteristicWithoutResponseForDevice(
        device.id,
        'FFE0',
        'FFE1',
        base64Signal,
      );
    } catch {
      log("DEVICE-CHOOSER", `ERROR when tried sending data (${signal}-${base64Signal}) to device - ${device.id}`)
    }
  };

  const startPing = async device => {
    log("DEVICE-CHOOSER", `Starting ping for device - ${device.id}`)
    pingCounter++;

    if (readMonitor) {
      log("DEVICE-CHOOSER", `Removing sent data listener`)
      readMonitor.remove();
      readMonitor = null;
    }

    if (pingCounter > 3) {
      failed();
      return;
    }

    setLoadingPing([true, device.id]);
    createManager();

    try {
      if (connectedDevice.id != device.id && connectedDevice) {
        log("DEVICE-CHOOSER", `Current connected device is not selected device, disconnecting from ${connectedDevice.id}...`)
        await connectedDevice.cancelConnection();
        connectedDevice = null;
      }
    } catch { }

    try {
      log("DEVICE-CHOOSER", `Checking if connected device is not set (${connectedDevice == null || connectedDevice == undefined}), checking if device is connected (${connectedDevice && !(await connectedDevice.isConnected())})`)
      if (
        connectedDevice == null ||
        connectedDevice == undefined ||
        (connectedDevice && !(await connectedDevice.isConnected()))
      ) {
        log("DEVICE-CHOOSER", `Connecting to device - ${device.id}`)
        connectedDevice = await connectToDevice(device);
        if (!connectedDevice) {
          log("DEVICE-CHOOSER", `ERROR when tried connecting to device - ${device.id}. device is ${connectedDevice}`)
          Toast.show({
            type: 'error',
            text1: 'Connection Error',
            text2: "We couldn't connect to the device",
          });
          setLoadingPing([false, null]);
          return null;
        }
      } else {
        log("DEVICE-CHOOSER", `Already connected to device - ${device.id}`)
      }
    } catch (error) {
      log("DEVICE-CHOOSER", `ERROR when tried connecting to device - ${device.id}. error: ${error}`)
    }

    let x = 0;
    timeoutTimer = setInterval(async () => {
      x++;
      if (x > 30) {
        log("DEVICE-CHOOSER", `Tried pinging 30 times with no response.`)
        clearInterval(timeoutTimer);
        failed();
        if (connectedDevice) {
          log("DEVICE-CHOOSER", `Disconnecting from device - ${connectedDevice.id}`)
          connectedDevice.cancelConnection();
        }
        return;
      }

      try {
        log("DEVICE-CHOOSER", `Sending device (${connectedDevice.id}) ping message number ${x + 1}`)
        sendDeviceSignal(connectedDevice, 'ping');
      } catch (error) {
        log("DEVICE-CHOOSER", `ERROR when tried sending ping message to device - ${connectedDevice.id}. error: ${error}`)
      }

      try {
        if (!readMonitor) {
          log("DEVICE-CHOOSER", `Creating received data listener for device - ${connectedDevice.id}`)
          readMonitor = MANAGER.monitorCharacteristicForDevice(
            connectedDevice.id,
            'FFE0',
            'FFE1',
            (error, readData) => {
              if (error && !meantToDisconnect) {
                Toast.show({
                  type: 'error',
                  text1: 'Connection Error',
                  text2: "We couldn't connect to the device",
                });
                setLoadingPing([false, null]);
                log("SETTINGS", 'ERR', error);
                return null;
              }
              if (!readData) {
                return;
              }
              readData = Buffer.from(readData.value, 'base64').toString();
              log("SETTINGS", 'read timeout - ' + JSON.stringify(readData));
              if (readData.includes('pong')) {
                log("SETTINGS", 'RESPONSE RECEIVED - ' + readData);

                pingCounter = 0;
                setLoadingPing(false);
                Toast.show({
                  type: 'success',
                  text1: 'Ping Successful',
                });
                if (readMonitor) {
                  readMonitor.remove();
                  readMonitor = null;
                }
                if (connectedDevice) {
                  connectedDevice.cancelConnection();
                }
                connectedDevice = null;
                meantToDisconnect = true;
                clearTimeout(timeoutTimer);
                try {
                  for (let i = 0; i < 10; i++) {
                    sendDeviceSignal(connectedDevice, 'Ok');
                  }
                  log("SETTINGS", 'SENT OK SIGNAL');
                } catch (error) {
                  log("SETTINGS", 'ERROR SENDING Ok:', error);
                }
                return true;
              } else {
                log("SETTINGS",
                  'NO RESPONSE... TRYING AGAIN [manual read] - ' + readData,
                );

                // monitorSub.remove();

                // connectedDevice.cancelConnection();
              }
            },
          );
        }
        // let readData = await connectedDevice.readCharacteristicForService(
        //   'FFE0',
        //   'FFE1',
        // );
      } catch (error) {
        if (error.errorCode == 205) {
          Toast.show({
            type: 'error',
            text1: 'Connection Error',
            text2: "We couldn't connect to the device",
          });
          setLoadingPing([false, null]);
          return null;
        }
        log("SETTINGS", 'ERROR READING DATA:', JSON.stringify(error)); // ISOLATE PONG MESSAGE, IF DOESNT WORK THEN ADD TO STATUS
      }
    }, 500);
  };

  const Item = ({ title, id, data, index, length }) => (
    <SafeAreaView
      style={{
        marginBottom: 10,
      }}>
      <View
        style={{
          borderColor: '#0a0a0a',
          borderBottomWidth: 7,
          borderLeftWidth: 5,
          borderRightWidth: 1,
          borderTopWidth: 1,
          borderBottomLeftRadius: index == length - 1 ? 2 * (winWidth / 35) : 5,
          borderBottomRightRadius:
            index == length - 1 ? 2 * (winWidth / 35) : 5,

          backgroundColor: '#1B1B1B',

          borderTopLeftRadius: index == 0 ? 2 * (winWidth / 35) : 0,
          borderTopRightRadius: index == 0 ? 2 * (winWidth / 35) : 0,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
        }}>
        <View
          style={{
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderColor: 'rgba(255,255,255,0.1)',
            borderRightWidth: 1,
            width: '55%',
            marginRight: 2 * (winWidth / 35),
          }}>
          <TouchableOpacity
            onPress={() => {
              setLoadingConnection(true);
              transferToSettings(data);
            }}>
            <Text
              style={{
                fontSize: 2 * (winWidth / 60),
                fontWeight: 'bold',
                color: 'white',
                marginTop: 2 * (winWidth / 50),
              }}>
              OnAir-{id.replace(/:/g, "").slice(-4)}
            </Text>
            <Text
              style={{
                fontSize: 2 * (winWidth / 70),
                color: 'gray',
                marginBottom: 2 * (winWidth / 70),
              }}>
              {id}
            </Text>
          </TouchableOpacity>
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'center',
          }}>
          {loadingPing[0] && loadingPing[1] == id ? (
            <ActivityIndicator
              size="large"
              color="#fff"
              style={{
                width: 30,
                height: 30,
                marginRight: 20,
              }}
            />
          ) : (
            <TouchableOpacity
              onPress={() => {
                log("SETTINGS", 'Starting Ping');
                clearTimeout(timeoutTimer);
                startPing(data);
              }}>
              <Image
                source={require('../assets/icons/bell.png')}
                style={{
                  width: winWidth / 15,
                  height: winWidth / 15,
                  marginRight: 10,
                }}
              />
            </TouchableOpacity>
          )}

          {loadingConnection ? (
            <ActivityIndicator
              size="large"
              color="#fff"
              style={{
                width: 30,
                height: 30,
                marginRight: 20,
              }}
            />
          ) : (
            <TouchableOpacity
              onPress={() => {
                setLoadingConnection(true);
                transferToSettings(data);
              }}>
              <Image
                source={require('../assets/icons/bluetooth_connected2.png')}
                style={{
                  width: winWidth / 13,
                  height: winWidth / 13,
                }}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );

  let DATA = route.params.scannedDevices;

  const renderItem = ({ item, index }) => (
    <Item
      title={item.name}
      id={item.id}
      data={item}
      index={index}
      length={DATA.length}
    />
  );

  return (
    <SafeAreaView
      style={{
        width: '100%',
        height: '100%',
      }}>
      <View
        style={{
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Toast
          visibilityTime={5000}
          config={toastConfig}
          style={{
            zIndex: 20,
          }}
        />
        <View
          style={{
            width: '95%',
            height: '93%',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <View
            style={{
              flexDirection: 'row',
              position: 'relative',
              width: '100%',
              marginBottom: winWidth / 15,
              paddingBottom: winWidth / 25,
              borderBottomWidth: 1,
              borderColor: 'gray',
              zIndex: -10,
            }}>
            <CircleButton
              imgUrl={require('../assets/icons/back.png')}
              handlePressDown={() => { }}
              handlePressUp={async () => {
                await exit();
              }}
              size={[winWidth / 15, winWidth / 15]}
              {...{
                backgroundColor: 'transparent',
                position: 'absolute',
                zIndex: 1,
              }}
            />
            <View
              style={{
                width: '100%',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <Text
                style={{
                  fontSize: isPortraitOrientation ? 2 * (winWidth / 30) : 2 * (winWidth / 60),
                  fontWeight: 'bold',
                  color: "white"
                }}>
                Choose your device
              </Text>
            </View>
          </View>
          {/* <Text
        style={{
          textAlign: 'center',
          borderBottomColor: 'gray',
          borderBottomWidth: 2,
          marginBottom: 20,
          paddingBottom: 10,
        }}>
        We have found multiple OnAir devices, choose your own device (you can
        remember it for next time by it's ID shows below the name)
      </Text> */}
          <FlatList
            data={DATA}
            renderItem={renderItem}
            keyExtractor={item => item.id}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};
export default DeviceChooser;

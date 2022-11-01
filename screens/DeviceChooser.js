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

let BluetoothManager = null;
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
    log("DEVICE-CHOOSER", `Changed rotation. Is portrait - ${isPortrait()}`);
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



    BackHandler.addEventListener('hardwareBackPress', async () => {
      log("DEVICE-CHOOSER", `Pressed hardware back button`)
      await exit();
    });

    return () => {
      // BackHandler.removeEventListener('hardwareBackPress', () => { });
      // AppState.removeEventListener('change', () => { });
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
        log("DEVICE-CHOOSER", `First time connecting/Selected device not connected. Connecting to ${device ? device.id : null}`)
        connectedDevice = await connectToDevice(device);
        setLoadingConnection(false);
      }
    } catch (error) {
      log("DEVICE-CHOOSER", `ERROR when tried to connect to device: ${error}`)
    }
    // try {
    //   log("DEVICE-CHOOSER", `Sending Connected signal to arduino`)
    //   await sendDeviceSignal(connectedDevice, 'Connected');
    // } catch (error) {
    //   log("DEVICE-CHOOSER", `ERROR when tried to send Connected signal to arduino: ${error}`)
    // }

    log("DEVICE-CHOOSER", `Navigating to settings`)
    navigation.navigate('Settings', {
      connectToDevice: true,
      device: connectedDevice,
      manager: BluetoothManager,
      goHome: true,
    });
  };


  const createManager = () => {
    if (!BluetoothManager) {
      BluetoothManager = new BleManager();
      log("DEVICE-CHOOSER", `Reloaded bluetooth manager`)
    }
  };

  const connectToDevice = async device => {
    createManager();
    let connectedDevice = null;
    try {
      log("DEVICE-CHOOSER", `Connecting to bluetooth device - ${device ? device.id : null}`)
      connectedDevice = await BluetoothManager.connectToDevice(device.id);
    } catch (error) {
      connectedDevice = null;
      log("DEVICE-CHOOSER", `Error when tried connecting to device - ${device ? device.id : null} (${error})`)
    }
    try {
      log("DEVICE-CHOOSER", `Discovering services and characteristics for bluetooth device - ${device ? device.id : null}`)
      await connectedDevice.discoverAllServicesAndCharacteristics();


    } catch (error) {
      log("DEVICE-CHOOSER", `ERROR when tried to connect/discover services and characteristics for device - ${device ? device.id : null} (${error})`)
      connectedDevice = null;
    }
    return connectedDevice;

  }

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
      log("DEVICE-CHOOSER", `Sending data (${signal}-${base64Signal}) to device - ${device ? device.id : null}`)
      return await BluetoothManager.writeCharacteristicWithoutResponseForDevice(
        device.id,
        'FFE0',
        'FFE1',
        base64Signal,
      );
    } catch {
      log("DEVICE-CHOOSER", `ERROR when tried sending data (${signal}) to device - ${device ? device.id : null}`)
    }
  };

  const startPing = async device => {
    log("DEVICE-CHOOSER", `Starting ping for device - ${device ? device.id : null}`)
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
        log("DEVICE-CHOOSER", `Current connected device is not selected device, disconnecting from ${connectedDevice ? connectedDevice.id : null}...`)
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
        log("DEVICE-CHOOSER", `Connecting to device - ${device ? device.id : null}`)
        connectedDevice = await connectToDevice(device);
        if (!connectedDevice) {
          log("DEVICE-CHOOSER", `ERROR when tried connecting to device - ${device ? device.id : null}. device is ${connectedDevice}`)
          Toast.show({
            type: 'error',
            text1: 'Connection Error',
            text2: "We couldn't connect to the device",
          });
          setLoadingPing([false, null]);
          return null;
        }
      } else {
        log("DEVICE-CHOOSER", `Already connected to device - ${device ? device.id : null}`)
      }
    } catch (error) {
      log("DEVICE-CHOOSER", `ERROR when tried connecting to device - ${device ? device.id : null}. error: ${error}`)
    }

    let x = 0;
    timeoutTimer = setInterval(async () => {
      x++;
      if (x > 30) {
        log("DEVICE-CHOOSER", `Tried pinging 30 times with no response.`)
        clearInterval(timeoutTimer);
        failed();
        if (connectedDevice) {
          log("DEVICE-CHOOSER", `Disconnecting from device - ${connectedDevice ? connectedDevice.id : null}`)
          connectedDevice.cancelConnection();
        }
        return;
      }

      try {
        log("DEVICE-CHOOSER", `Sending device (${connectedDevice ? connectedDevice.id : null}) ping message number ${x + 1}`)
        sendDeviceSignal(connectedDevice, 'ping');
      } catch (error) {
        log("DEVICE-CHOOSER", `ERROR when tried sending ping message to device - ${connectedDevice ? connectedDevice.id : null}. error: ${error}`)
      }

      try {
        if (!readMonitor) {
          log("DEVICE-CHOOSER", `Creating received data listener for device - ${connectedDevice ? connectedDevice.id : null}`)
          readMonitor = BluetoothManager.monitorCharacteristicForDevice(
            connectedDevice.id,
            'FFE0',
            'FFE1',
            (error, readData) => {

              if (error && !meantToDisconnect) {
                log("DEVICE-CHOOSER", `ERROR when tried to create received data listener for device - ${device ? device.id : null}. error: ${error}`)
                Toast.show({
                  type: 'error',
                  text1: 'Connection Error',
                  text2: "We couldn't connect to the device",
                });
                setLoadingPing([false, null]);
                return null;
              }

              if (!readData) {
                return;
              }

              readData = Buffer.from(readData.value, 'base64').toString();
              log("DEVICE-CHOOSER", `Received raw data - ${readData}`)
              if (readData.includes('pong')) {
                log("DEVICE-CHOOSER", `Received ping response!`)

                pingCounter = 0;

                setLoadingPing(false);
                Toast.show({
                  type: 'success',
                  text1: 'Ping Successful',
                });
                log("DEVICE-CHOOSER", `Removing received data listener and disconnecting device - ${connectedDevice ? connectedDevice.id : null}`)

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
                  log("DEVICE-CHOOSER", `Sending OK signal to device - ${connectedDevice ? connectedDevice.id : null}`)
                  for (let i = 0; i < 10; i++) {
                    sendDeviceSignal(connectedDevice, 'Ok');
                  }
                } catch (error) {
                  log("DEVICE-CHOOSER", `ERROR when sending OK message to arduino. error: ${error}`)
                }
                return true;
              } else {
                log("DEVICE-CHOOSER", `No response for ping! trying again...`)
              }
            },
          );
        }
      } catch (error) {
        if (error.errorCode == 205) {
          log("DEVICE-CHOOSER", `Error when connecting to device - ${connectedDevice ? connectedDevice.id : null}. error: ${error}`)

          Toast.show({
            type: 'error',
            text1: 'Connection Error',
            text2: "We couldn't connect to the device",
          });

          setLoadingPing([false, null]);
          return null;
        }
        log("DEVICE-CHOOSER", `ERROR when tried reading data sent from device - ${connectedDevice ? connectedDevice.id : null}. error: ${error}`)
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

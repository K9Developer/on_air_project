import {
  FlatList,
  View,
  Text,
  Image,
  TouchableOpacity,
  AppState,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import React, {useEffect, useState} from 'react';
import {CircleButton} from '../components';
import {BleManager} from 'react-native-ble-plx';
import Toast from 'react-native-toast-message';
const Buffer = require('buffer').Buffer;

let MANAGER = null;
// let monitorSub = null;
let timeoutTimer = null;
let connectedDevice = null;
let pingCounter = 0;
const winWidth = Dimensions.get('window').width;

const DeviceChooser = ({navigation, route}) => {
  // 0: Bell
  // 1: Checkmark
  // 2: X
  // route = {
  //   params: {
  //     scannedDevices: [],
  //   },
  // };

  // route.params.scannedDevices = [
  //   {
  //     name: 'Test1',
  //     id: '1',
  //     otherData: 'sdfsdf',
  //   },
  //   {
  //     name: 'Test2',
  //     id: '2',
  //     otherData: 'sdfsdf',
  //   },
  //   {
  //     name: 'Test3',
  //     id: '3',
  //     otherData: 'sdfsdf',
  //   },
  // ];

  const [loadingPing, setLoadingPing] = useState([false, null]);

  const exitApp = () => {
    // monitorSub.remove();
    clearTimeout(timeoutTimer);
    try {
      let tmp = {...connectedDevice};
      tmp.cancelConnection();
    } catch (error) {}
    // try {
    //   console.log('MAN: ' + MANAGER != null);
    //   if (MANAGER != null) {
    //     MANAGER.destroy();
    //   }
    // } catch (error) {}
  };

  navigation.addListener('blur', e => {
    exitApp();
  });

  useEffect(() => {
    AppState.addEventListener('change', currentState => {
      if (currentState === 'background') {
        exitApp();
      }
    });
  }, []);

  const transferToSettings = async device => {
    console.log(
      'connectedDevice: ' + !connectedDevice ||
        (connectedDevice && device.id != connectedDevice.id),
    );
    if (
      !connectedDevice ||
      (connectedDevice && device.id != connectedDevice.id) ||
      (connectedDevice && !(await connectedDevice.isConnected()))
    ) {
      console.log('Device is not connected, connecting...');
      connectedDevice = await connectToDevice(device);
    }
    navigation.navigate('Settings', {
      connectToDevice: true,
      device: connectedDevice,
      manager: MANAGER,
    });
  };

  const createManager = () => {
    if (!MANAGER) {
      MANAGER = new BleManager();
      console.log('CREATED BLE MANAGER [connect btn]');
    } else {
      console.log('BLE MANAGER ALREADY EXISTS [connect btn]');
    }
  };

  const connectToDevice = async device => {
    try {
      if (!MANAGER) {
        createManager();
      }
      let connectedDevice = await MANAGER.connectToDevice(device.id);
      await connectedDevice.discoverAllServicesAndCharacteristics();
      return connectedDevice;
    } catch (error) {
      console.log('ERROR CONNECTING TO DEVICE', error);
      return null;
    }
  };

  const failed = () => {
    // Icon change
    pingCounter = 0;
    setLoadingPing([false, null]);

    Toast.show({
      type: 'error',
      text1: 'Ping Error',
      text2: "We couldn't ping the device!",
    });
    console.log('FAILED TO PING');
    console.log('FAILED TO PING');
    console.log('FAILED TO PING');
    console.log('FAILED TO PING');
    console.log('FAILED TO PING');
  };

  const sendDeviceSignal = async (device, signal) => {
    let base64Signal = Buffer.from('~' + signal + '^').toString('base64');
    return await MANAGER.writeCharacteristicWithoutResponseForDevice(
      device.id,
      'FFE0',
      'FFE1',
      base64Signal,
    );
  };

  const startPing = async device => {
    // Create bluetooth manager
    console.log(device.id);
    pingCounter++;

    if (pingCounter > 3) {
      failed();
      return;
    }
    setLoadingPing([true, device.id]);
    await createManager();
    // Connect

    try {
      if (connectedDevice.id != device.id) {
        console.log(
          'Clicked device id isnt equal to last device pinged, cancelling and connecting',
        );
        await connectedDevice.cancelConnection();
        connectedDevice = null;
      }
    } catch {}

    try {
      if (
        connectedDevice == null ||
        connectedDevice == undefined ||
        (connectedDevice && !(await connectedDevice.isConnected()))
      ) {
        connectedDevice = await connectToDevice(device);
        console.log('Connected to device - ' + device);
      } else {
        console.log('Already connected to device - ' + device);
      }
    } catch (error) {
      console.log('ERROR CONNECTING TO DEVICE:', error);
    }
    try {
      sendDeviceSignal(connectedDevice, 'ping');
    } catch (error) {
      console.log('ERROR SENDING PING:', error);
    }
    timeoutTimer = setTimeout(async () => {
      for (let i = 0; i < 10; i++) {
        try {
          let readData = await connectedDevice.readCharacteristicForService(
            'FFE0',
            'FFE1',
          );
          readData = Buffer.from(readData.value, 'base64').toString();
          console.log('read timeout - ' + JSON.stringify(readData));
          if (readData.includes('pong')) {
            console.log('RESPONSE RECEIVED - ' + readData);

            pingCounter = 0;
            setLoadingPing(false);
            Toast.show({
              type: 'success',
              text1: 'Ping Successful',
            });

            clearTimeout(timeoutTimer);
            try {
              for (let i = 0; i < 10; i++) {
                sendDeviceSignal(connectedDevice, 'Ok');
              }
              console.log('SENT OK SIGNAL');
            } catch (error) {
              console.log('ERROR SENDING Ok:', error);
            }
            return true;
          } else {
            console.log('NO RESPONSE... TRYING AGAIN [manual read]');

            // monitorSub.remove();

            // connectedDevice.cancelConnection();
          }
        } catch (error) {
          console.log('ERROR READING DATA:', error); // ISOLATE PONG MESSAGE, IF DOESNT WORK THEN ADD TO STATUS
        }
      }
      return startPing(connectedDevice);
    }, 3000);
    // try {
    //   monitorSub = await connectedDevice.monitorCharacteristicForService(
    //     'FFE0',
    //     'FFE1',
    //     (error, data) => {
    //       if (error) {
    //         console.log('Error in read monitor: ', JSON.stringify(error));
    //       }
    //       if (data == 'pong') {
    //         clearTimeout(timeoutTimer);
    //         monitorSub.remove();
    //         // connectedDevice.cancelConnection();
    //       } else {
    //         console.log('NO RESPONSE... TRYING AGAIN [auto read]');
    //         monitorSub.remove();
    //         clearTimeout(timeoutTimer);
    //         // connectedDevice.cancelConnection();
    //         return startPing(connectedDevice);
    //       }
    //     },
    //   );
    // } catch (error) {
    //   console.log('ERROR MONITORING CHARACTERISTIC:', error);
    // }
  };

  const Item = ({title, id, data, index, length}) => (
    <View
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
          borderBottomLeftRadius: index == length - 1 ? 2 * (winWidth / 25) : 5,
          borderBottomRightRadius:
            index == length - 1 ? 2 * (winWidth / 25) : 5,
          borderTopLeftRadius: index == 0 ? 2 * (winWidth / 25) : 5,
          borderTopRightRadius: index == 0 ? 2 * (winWidth / 25) : 5,
          backgroundColor: '#1B1B1B',
          borderBottomLeftRadius: index == length - 1 ? 2 * (winWidth / 35) : 0,
          borderBottomRightRadius:
            index == length - 1 ? 2 * (winWidth / 35) : 0,
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
              transferToSettings(data);
            }}>
            <Text
              style={{
                fontSize: 2 * (winWidth / 40),
                fontWeight: 'bold',
                color: 'white',
                marginTop: 2 * (winWidth / 50),
              }}>
              {title}
            </Text>
            <Text
              style={{
                fontSize: 2 * (winWidth / 50),
                color: 'gray',
                marginBottom: 2 * (winWidth / 50),
              }}>
              {id}
            </Text>
          </TouchableOpacity>
        </View>
        <View
          style={{
            flexDirection: 'row',
            marginRight: 10,
            justifyContent: 'center',
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
                console.log('Starting Ping');
                clearTimeout(timeoutTimer);
                startPing(data);
              }}>
              <Image
                source={require('../assets/icons/bell.png')}
                style={{
                  width: winWidth / 10,
                  height: winWidth / 10,
                  marginRight: 10,
                }}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              transferToSettings(data);
            }}>
            <Image
              source={require('../assets/icons/bluetooth_connected2.png')}
              style={{
                width: winWidth / 9,
                height: winWidth / 9,
                marginRight: 10,
              }}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  let DATA = route.params.scannedDevices;

  const renderItem = ({item, index}) => (
    <Item
      title={item.name}
      id={item.id}
      data={item}
      index={index}
      length={DATA.length}
    />
  );

  return (
    <View
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
          visibilityTime={6000}
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
              handlePressDown={() => {}}
              handlePressUp={async () => {
                try {
                  for (let i = 0; i < 10; i++) {
                    await sendDeviceSignal(connectedDevice, 'Ok');
                  }
                  console.log('SENT OK SIGNAL');
                } catch (error) {
                  console.log('ERROR SENDING Ok:', error);
                }
                navigation.navigate('Settings', {connectToDevice: false});
              }}
              size={[winWidth / 15, winWidth / 15]}
              {...{
                top: '-50%',
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
                  fontSize: 2 * (winWidth / 30),
                  fontWeight: 'bold',
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
    </View>
  );
};
export default DeviceChooser;

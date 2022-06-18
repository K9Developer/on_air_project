import {
  View,
  SafeAreaView,
  TextInput,
  Text,
  Linking,
  Modal,
  Pressable,
  Image,
  Animated,
} from 'react-native';
import React, {useState, useRef, useEffect} from 'react';
import {FocusedStatusBar, CircleButton} from '../components';
import {useNavigation} from '@react-navigation/native';
import {COLORS, SHADOWS} from '../constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {BleManager} from 'react-native-ble-plx';
const Buffer = require('buffer').Buffer;

const MIN_FACTOR = 3;
const MAX_FACTOR = 10;
const MIN_PRESET = 3;
const MAX_PRESET = 50;
let BT05_DEVICE = null;
let DEVICE_SERVICE_UUID = null;
let DEVICE_CHARACTERISTICS_UUID = null;
let MANAGER = null;

const getData = async key => {
  try {
    const data = await AsyncStorage.getItem(key);
    if (data !== null) {
      return data;
    }
  } catch (error) {
    console.log('getData error:', error);
  }
};

const getErrorText = error => {
  console.log('error from getErrorText: ' + error);

  console.log('-----------------------------------------------------');
  console.log('Caller of getErrorText: ' + JSON.stringify(getErrorText.caller));
  console.log('-----------------------------------------------------');

  console.log('Error reason: ' + error.reason);

  if (error.reason == null) {
    return null;
  }

  let errorMap = {
    0:
      'Unknown error occurred . (Please try again) info: ' +
      JSON.stringify(error),
    1: 'BleManager was destroyed',
    2: 'Operation was cancelled. info: ' + JSON.stringify(error),
    3: 'Operation timed out',
    4: 'Operation was rejected',
    5: 'Invalid UUIDs or IDs were passed',
    100: 'BluetoothLE is unsupported on this device',
    101: 'Device is not authorized to use BluetoothLE',
    102: 'The bluetooth option on your phone is turned off',
    103: 'BluetoothLE is in unknown state',
    104: 'BluetoothLE is resetting',
    105: 'Bluetooth state change failed',
    200: 'Device connection failed',
    201: 'Device was disconnected',
    202: 'RSSI read failed for device',
    203: 'Device is already connected',
    204: 'Device not found',
    205: 'Device is not connected',
    206: 'Device could not change MTU size',
    300: 'Services discovery failed for device',
    301: 'Included services discovery failed for device and service',
    302: 'Service for device not found',
    303: 'Services not discovered for device',
    400: 'Characteristic discovery failed for device and service',
    401: 'Characteristic write failed for device and service',
    402: 'Characteristic read failed for device and service',
    403: 'Characteristic notify change failed for device and service',
    404: 'Characteristic not found',
    405: 'Characteristics not discovered for device and service',
    406: 'Cannot write to characteristic with invalid data format',
    500: 'Descriptor discovery failed for device, service and characteristic',
    501: 'Descriptor write failed for device, service and characteristic',
    502: 'Descriptor read failed for device, service and characteristic',
    503: 'Descriptor not found',
    504: 'Descriptors not discovered for device, service and characteristic',
    505: 'Cannot write to descriptor with invalid data format',
    506: "Cannot write to descriptor. It's not allowed by iOS and therefore forbidden on Android as well.",
    600: "Please allow all requested permissions to this app, if that doesn't work try restarting it.",
    601: 'Location services are disabled',
  };
  return (
    errorMap[error.errorCode] ??
    'Unknown error occurred [custom]. (Please try again) info: ' +
      JSON.stringify(error)
  );
};

const sendDeviceSignal = async signal => {
  let base64Signal = Buffer.from('~' + signal + '^').toString('base64');

  return MANAGER.writeCharacteristicWithoutResponseForDevice(
    BT05_DEVICE.id,
    'FFE0',
    'FFE1',
    base64Signal,
  )
    .then(d => {
      console.log(base64Signal + ' - ' + (base64Signal.length + 3));
      // if (signal != 'DATA WAS READ') {
      //   allMessagesSentByDevice.push('~' + signal + '^');
      //   // sendDeviceSignal('DATA WAS READ');
      // }
      return d;
    })
    .catch(e => {
      return e;
    });
};

const Settings = ({navigation, route}) => {
  useEffect(() => {
    navigation.addListener('focus', () => {
      if (
        route != null &&
        route != undefined &&
        route.params != null &&
        route.params != undefined
      ) {
        if (route.params.device != null && route.params.device != undefined) {
          BT05_DEVICE = route.params.device;
          DEVICE_SERVICE_UUID = route.params.serviceUUID;
          DEVICE_CHARACTERISTICS_UUID = route.params.characteristicsUUID;
        }
        setStartScan(route.params.startConnect);
        console.log('Start connection with device: ' + startScan);
      }

      getData('@factor')
        .then(value => {
          if (value != null && value != undefined) {
            setFactor(parseFloat(value.replace('"', '')));
          }
        })
        .catch(err => console.log('getData factor error:', err));

      getData('@roadPreset')
        .then(value => {
          if (value != null && value != undefined) {
            setFactor(parseFloat(value.replace('"', '')));
          }
        })
        .catch(err => console.log('getData roadPreset error', err));

      getData('@trailPreset')
        .then(value => {
          if (value != null && value != undefined) {
            setFactor(parseFloat(value.replace('"', '')));
          }
        })
        .catch(err => console.log('getData trailPreset error', err));

      getData('@device')
        .then(value => {
          if (value != null && value != undefined) {
            if (BT05_DEVICE == null && BT05_DEVICE == undefined) {
              console.log('Source of device: AsyncStorage');
              BT05_DEVICE = JSON.parse(value);
            }
          }
        })
        .catch(err => console.log('getData device error', err));

      getData('@btImage')
        .then(value => {
          if (value != null && value != undefined) {
            console.log('LOADED BT Image: ' + typeof BT05_DEVICE);
            if (JSON.parse(value) == 2) {
              if (BT05_DEVICE != null && BT05_DEVICE != undefined) {
                try {
                  console.log('BT05_DEVICE: ' + JSON.stringify(BT05_DEVICE));
                  BT05_DEVICE.isConnected()
                    .then(connected => {
                      if (connected) {
                        setBluetoothImageId(2);
                      } else {
                        setBluetoothImageId(3);
                      }
                    })
                    .catch(e => {
                      console.log("Couldn't get connected status: " + e);
                    });
                } catch (error) {
                  console.log(
                    "Couldn't get BT05_DEVICE.isConnected(): " + error,
                  );
                  setBluetoothImageId(1);
                }
              }
            } else if (JSON.parse(value) == 4) {
              setBluetoothImageId(1);
            } else {
              setBluetoothImageId(JSON.parse(value));
            }
            console.log('\n-----------------------------------------\n');
          } else {
            setBluetoothImageId(1);
            console.log('VALUE IS NULL');
          }
        })
        .catch(err => console.log('getData btImage error', err));
    });
  }, [route]);

  // if (nav) {
  //   navigation = nav;
  // } else {
  //   navigation = useNavigation();
  // }

  const [factor, setFactor] = useState(3.2);
  const [roadPreset, setRoadPreset] = useState(36);
  const [trailPreset, setTrailPreset] = useState(16);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalError, setModalError] = useState(false);
  const [modalText, setModalText] = useState('N/A');
  const [statusText, setStatusText] = useState('Idle');
  const [startScan, setStartScan] = useState(false);
  // 1: ../assets/icons/bluetooth.png
  // 2: ../assets/icons/bluetooth_connected.png
  // 3: ../assets/icons/bluetooth_disconnected.png
  // 4: ../assets/icons/bluetooth_scanning.png
  const [bluetoothImageId, setBluetoothImageId] = useState(1);
  const dropAnim = useRef(new Animated.Value(0)).current;

  navigation.addListener('blur', e => {
    AsyncStorage.setItem('@device', JSON.stringify(BT05_DEVICE));
    AsyncStorage.setItem('@btImage', JSON.stringify(bluetoothImageId));
    AsyncStorage.setItem('@factor', JSON.stringify(factor));
    AsyncStorage.setItem('@roadPreset', JSON.stringify(roadPreset));
    AsyncStorage.setItem('@trailPreset', JSON.stringify(trailPreset));
  });

  const onDeviceDisconnect = (error, device) => {
    if (error) {
      console.log(console.log('On device disconnect error: ', err));
    } else {
      console.log('Device disconnected: ' + device.id);
      setStatusText('Device has been disconnected');
      setBluetoothImageId(3);
    }
  };

  const connectToDevice = device => {
    setStatusText('Connected to device!');
    setBluetoothImageId(2);

    let deviceConnected = MANAGER.connectToDevice(device.id)
      .then(device => {
        console.log('connect success:', device.name, device.id);
        console.log('Source of device: Connect function');
        BT05_DEVICE = device;

        return device
          .discoverAllServicesAndCharacteristics()
          .then(d => {
            console.log('DISCOVER ALL SUCCESS');
            return d;
          })
          .catch(e => {
            setModalError(true);
            setModalText(getErrorText(error));
            setModalVisible(true);
            setStatusText('An Error occurred');
          });
      })
      .then(device => {
        device
          .services()
          .then(d => {
            console.log('DEVICE SERVICE UUID:', d[0].uuid);
            DEVICE_SERVICE_UUID = d[0].uuid;
            return d;
          })
          .then(d =>
            d[0]
              .characteristics()
              .then(data => {
                DEVICE_CHARACTERISTICS_UUID = data[0].uuid;
                console.log(
                  'Device CHARACTERISTICS:',
                  DEVICE_CHARACTERISTICS_UUID,
                );
                reconnect = true;
                return DEVICE_CHARACTERISTICS_UUID;
              })
              .catch(error => {
                setModalError(true);
                setModalText(getErrorText(error));
                setModalVisible(true);
                setStatusText('An Error occurred');
              }),
          )
          .catch(e => {
            setModalError(true);
            setModalText(
              'Failed fetching device services! info: ' + JSON.stringify(e),
            );
            setModalVisible(true);
            setStatusText('An Error occurred');
          });

        return device
          .services()
          .then(d => {
            console.log('SERVICE DATA:', d);
            sendDeviceSignal('Connected');
            BT05_DEVICE.onDisconnected(onDeviceDisconnect);
            return d;
          })
          .catch(e => {
            setModalError(true);
            setModalText(
              'Failed returning device services! info: ' + JSON.stringify(e),
            );
            setModalVisible(true);
            setStatusText('An Error occurred');
          });
      })
      .catch(err => {
        setModalError(true);
        setModalText(
          'Connection to device failed! info: ' + JSON.stringify(err),
        );
        setModalVisible(true);
        setStatusText('An Error occurred');
      });
    console.log('Source of device: Connect function end');
    BT05_DEVICE = {...deviceConnected};
    return deviceConnected;
  };

  console.log();

  const saveStates = () => {
    AsyncStorage.setItem('@device', JSON.stringify(BT05_DEVICE));
    AsyncStorage.setItem('@btImage', JSON.stringify(bluetoothImageId));
  };

  const scanForDevice = async manager => {
    setStatusText('Scanning for devices...');
    await manager.startDeviceScan(
      null,
      null,
      (error, device) => {
        if (error) {
          setModalError(true);
          setModalText(getErrorText(error));
          setModalVisible(true);
          setStatusText('An Error occurred');
        }
        if (device !== null) {
          console.log('Found Device Name: ' + device.name);
          if (device.name === 'BT05') {
            console.log('Found BT05');
            setStatusText('Found On Air bluetooth device!');
            manager.stopDeviceScan();
            console.log('Stopped Scan');
            setStatusText('Connecting to device...');
            connectToDevice(device);
          }
        }
      },
      setBluetoothImageId(4),
    );
  };

  const dropIn = () => {
    // Will change fadeAnim value to 1 in 5 seconds
    Animated.timing(dropAnim, {
      toValue: 50,
      duration: 500,
      useNativeDriver: false,
      // useNativeDriver: true,
    }).start();
  };

  const removeSubscriptions = () => {
    for (const [_key, val] of Object.entries(MANAGER._activeSubscriptions)) {
      try {
        MANAGER._activeSubscriptions[val].remove();
      } catch (error) {
        console.log('Error removing subscription (manager): ', error);
      }
    }

    for (const [_key, val] of Object.entries(
      BT05_DEVICE._manager._activeSubscriptions,
    )) {
      try {
        BT05_DEVICE._manager._activeSubscriptions[val].remove();
      } catch (error) {
        console.log('Error removing subscription (device): ', error);
      }
    }
  };

  const startConnection = () => {
    dropIn();
    try {
      MANAGER.destroy();
      MANAGER = null;
    } catch (error) {
      console.log('Error destroying manager: ', error);
    }
    console.log('CREATING BLE MANAGER [connect btn]');
    if (MANAGER === null) {
      MANAGER = new BleManager();
      console.log('CREATED BLE MANAGER [connect btn]');
    } else {
      console.log('BLE MANAGER ALREADY EXISTS [connect btn]');
    }

    console.log('Active manager: ' + MANAGER);
    BT05_DEVICE = null;
    console.log('Source of device: Reconnect');
    DEVICE_SERVICE_UUID = null;
    DEVICE_CHARACTERISTICS_UUID = null;

    if (BT05_DEVICE == null && MANAGER !== null) {
      MANAGER.state().then(state => {
        console.log('MANAGER STATUS: ' + state);
      });

      console.log('SCANNING FOR DEVICE');

      const subscription = MANAGER.onStateChange(state => {
        if (state === 'PoweredOn') {
          scanForDevice(MANAGER);
          subscription.remove();
        }
      }, true);
    }
  };

  if (startScan == true) {
    startConnection();
    setStartScan(false);
  }

  return (
    <SafeAreaView style={{flex: 1}}>
      <FocusedStatusBar backgroundColor={COLORS.primary} />

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalText == null ? false : modalVisible}
        onRequestClose={() => {
          Alert.alert('Modal has been closed.');
          setModalVisible(!modalVisible);
        }}>
        <View
          style={{
            backgroundColor: 'rgba(0,0,0,0.5)',
            flex: 1,
          }}>
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: 22,
            }}>
            <View
              style={{
                width: '80%',
                margin: 20,
                backgroundColor: 'white',
                borderRadius: 20,
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: {
                  width: 0,
                  height: 2,
                },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 5,
                paddingTop: '5%',
              }}>
              <Image
                source={
                  modalError
                    ? require('../assets/icons/error.png')
                    : require('../assets/icons/info.png')
                }
                style={{width: 90, height: 90, marginBottom: 20}}
              />
              <Text
                style={{
                  color: '#6f7173',
                  paddingRight: 40,
                  paddingLeft: 40,
                  marginBottom: 20,
                  fontSize: 30,
                  fontWeight: 'bold',
                  textAlign: 'center',
                }}>
                {modalError ? 'Oh Snap!' : 'Info'}
              </Text>
              <Text
                style={{
                  color: '#6f7173',
                  paddingRight: 40,
                  paddingLeft: 40,
                  fontSize: 15,
                  textAlign: 'center',
                }}>
                {modalText}
              </Text>

              <Pressable
                style={{
                  borderBottomRightRadius: 20,
                  borderBottomLeftRadius: 20,
                  width: '100%',
                  padding: 20,
                  elevation: 2,
                  backgroundColor: modalError ? '#db4d4d' : '#2196F3',
                  marginTop: 30,
                  bottom: 0,
                }}
                onPress={() => setModalVisible(!modalVisible)}>
                <Text
                  style={{
                    color: 'white',
                    fontSize: 20,
                    textAlign: 'center',
                  }}>
                  {modalError ? 'Dismiss' : 'Ok'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Animated.View
        style={[
          {
            ...{
              width: '100%',
              backgroundColor: '#2e2d2d',
              justifyContent: 'center',
              alignItems: 'center',
              paddingBottom: 10,
              paddingTop: 10,
              transformOrigin: 'right top',
              ...SHADOWS.extraDark,
            },
          },
          {
            // Bind opacity to animated value

            height: dropAnim,
          },
        ]}>
        <Text style={{fontSize: 20, color: 'white'}}>{statusText}</Text>
      </Animated.View>

      <View
        style={{
          flexDirection: 'row',
        }}>
        <CircleButton
          imgUrl={require('../assets/icons/back.png')}
          handlePressDown={() => {}}
          handlePressUp={() => {
            // AsyncStorage.setItem('@factor', JSON.stringify(factor));
            // AsyncStorage.setItem('@roadPreset', JSON.stringify(roadPreset));
            // AsyncStorage.setItem('@trailPreset', JSON.stringify(trailPreset));
            // saveStates();
            console.log(
              `\n-----------------------------------\n
              Type of MANAGER: ${typeof MANAGER}
              \nType of DEVICE: ${JSON.stringify(BT05_DEVICE)}
              \nType of SERVICE_UUID: ${typeof DEVICE_SERVICE_UUID}
              \nType of CHARACTERISTICS_UUID: ${typeof DEVICE_CHARACTERISTICS_UUID}
              \n-----------------------------------\n`,
            );
            try {
              removeSubscriptions();
            } catch (error) {
              console.log('Error removing subscriptions: ', error);
            }
            if (MANAGER) {
              MANAGER.stopDeviceScan();
            }

            navigation.navigate('Home', {
              manager: MANAGER,
              device: BT05_DEVICE,
              serviceUUID: DEVICE_SERVICE_UUID,
              characteristicUUID: DEVICE_CHARACTERISTICS_UUID,
            });
          }}
          size={[30, 30]}
          {...{marginLeft: 10, marginTop: 10, backgroundColor: 'transparent'}}
        />

        <CircleButton
          imgUrl={
            bluetoothImageId == 1
              ? require('../assets/icons/bluetooth.png')
              : bluetoothImageId == 2
              ? require('../assets/icons/bluetooth_connected.png')
              : bluetoothImageId == 3
              ? require('../assets/icons/bluetooth_disconnected.png')
              : require('../assets/icons/bluetooth_scanning.png')
          }
          handlePressDown={() => {}}
          handlePressUp={() => {
            startConnection();
            // if (BT05_DEVICE != null && BT05_DEVICE != undefined) {
            //   try {
            //     BT05_DEVICE.isConnected()
            //       .then(d => (d ? {} : scanForDevice(MANAGER)))
            //       .catch(err => console.log(err));
            //   } catch (error) {}
            // }
          }}
          size={[50, 50]}
          {...{
            marginTop: 10,
            backgroundColor: 'transparent',
            marginLeft: 260,
            ...SHADOWS.dark,
          }}
        />
      </View>
      <View
        style={{
          marginBottom: 20,
          marginTop: 10,
          width: '100%',
          alignContent: 'center',
          alignItems: 'center',
        }}>
        <Text style={{fontSize: 30}}>Settings</Text>
      </View>

      <View
        style={{
          backgroundColor: '#242424',
          width: '100%',
          height: '17%',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          alignItems: 'center',
          flexDirection: 'row',
        }}>
        <Text style={{fontSize: 40, marginLeft: 20}}>Factor</Text>
        <TextInput
          keyboardType="numeric"
          allowFontScaling={true}
          maxLength={3}
          onChangeText={text => {
            console.log(text);
            setFactor(text);
          }}
          onPressOut={() => {
            setFactor(factor !== '' ? parseFloat(factor) : MIN_FACTOR);
            if (factor > MAX_FACTOR) {
              setFactor(MAX_FACTOR);
            } else if (factor < MIN_FACTOR) {
              setFactor(MIN_FACTOR);
            }
          }}
          onEndEditing={() => {
            console.log('factor', factor);
            setFactor(factor !== '' ? parseFloat(factor) : MIN_FACTOR);
            if (factor > MAX_FACTOR) {
              setFactor(MAX_FACTOR);
            } else if (factor < MIN_FACTOR) {
              setFactor(MIN_FACTOR);
            }
          }}
          style={{
            fontSize: 40,
            right: 30,
            position: 'absolute',
            marginRight: 20,
            backgroundColor: '#1B1B1B',
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 10,
            paddingBottom: 10,
            borderRadius: 20,
          }}
          value={factor.toString()}></TextInput>
      </View>

      <View
        style={{
          marginTop: 10,
          backgroundColor: '#242424',
          width: '100%',
          height: '17%',

          alignItems: 'center',
          flexDirection: 'row',
        }}>
        <Text style={{fontSize: 40, marginLeft: 20}}>Road Preset</Text>
        <TextInput
          keyboardType="numeric"
          allowFontScaling={true}
          maxLength={2}
          onChangeText={text => {
            setRoadPreset(text);
          }}
          onPressOut={() => {
            setRoadPreset(
              roadPreset !== ''
                ? Math.floor(parseFloat(roadPreset))
                : MIN_PRESET,
            );
            if (roadPreset > MAX_PRESET) {
              setRoadPreset(MAX_PRESET);
            } else if (roadPreset < MIN_PRESET) {
              setRoadPreset(MIN_PRESET);
            }
          }}
          onEndEditing={() => {
            setRoadPreset(
              roadPreset !== ''
                ? Math.floor(parseFloat(roadPreset))
                : MIN_PRESET,
            );
            if (roadPreset > MAX_PRESET) {
              setRoadPreset(MAX_PRESET);
            } else if (roadPreset < MIN_PRESET) {
              setRoadPreset(MIN_PRESET);
            }
          }}
          style={{
            fontSize: 40,
            right: 30,
            position: 'absolute',
            marginRight: 20,
            backgroundColor: '#1B1B1B',
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 10,
            paddingBottom: 10,
            borderRadius: 20,
          }}
          value={roadPreset.toString()}></TextInput>
      </View>

      <View
        style={{
          marginTop: 10,
          backgroundColor: '#242424',
          width: '100%',
          height: '17%',
          borderBottomLeftRadius: 20,
          borderBottomRightRadius: 20,
          alignItems: 'center',
          flexDirection: 'row',
        }}>
        <Text style={{fontSize: 40, marginLeft: 20}}>Trail Preset</Text>
        <TextInput
          keyboardType="numeric"
          allowFontScaling={true}
          maxLength={2}
          onChangeText={text => {
            setTrailPreset(text);
          }}
          onPressOut={() => {
            setTrailPreset(
              trailPreset !== ''
                ? Math.floor(parseFloat(trailPreset))
                : MIN_PRESET,
            );
            if (trailPreset > MAX_PRESET) {
              setTrailPreset(MAX_PRESET);
            } else if (trailPreset < MIN_PRESET) {
              setTrailPreset(MIN_PRESET);
            }
          }}
          onEndEditing={() => {
            setTrailPreset(
              trailPreset !== ''
                ? Math.floor(parseFloat(trailPreset))
                : MIN_PRESET,
            );
            if (trailPreset > MAX_PRESET) {
              setTrailPreset(MAX_PRESET);
            } else if (trailPreset < MIN_PRESET) {
              setTrailPreset(MIN_PRESET);
            }
          }}
          style={{
            fontSize: 40,
            right: 30,
            position: 'absolute',
            marginRight: 20,
            backgroundColor: '#1B1B1B',
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 10,
            paddingBottom: 10,
            borderRadius: 20,
          }}
          value={trailPreset.toString()}></TextInput>
        <View
          style={{
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            right: 220,
            top: 150,
          }}>
          <Text style={{fontSize: 20}}>All units are measured in PSI</Text>
          <Text style={{fontSize: 20}}>On Air Version 4.4</Text>
          <Text
            style={{
              fontSize: 20,
              position: 'absolute',
              top: 55,
              right: 235,
            }}>
            App By:
          </Text>
          <Text
            onPress={() => Linking.openURL('https://github.com/KingOfTNT10')}
            style={{
              color: '#2269B2',
              fontSize: 20,
              marginLeft: 50,
              position: 'absolute',
              top: 55,
              right: 100,
            }}>
            KingOfTNT10
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default Settings;

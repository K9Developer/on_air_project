import {
  View,
  SafeAreaView,
  TouchableWithoutFeedback,
  Text,
  Linking,
  Modal,
  Pressable,
  Image,
  Animated,
  AppState,
  Dimensions,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import React, { useState, useRef, useEffect } from 'react';
import { FocusedStatusBar, CircleButton } from '../components';
import { COLORS, SHADOWS } from '../constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Sound from 'react-native-sound';
import { BleManager } from 'react-native-ble-plx';
import ValuePicker from 'react-native-picker-horizontal';
import DeviceInfo from 'react-native-device-info';
import { log } from '../services/logs'

const Buffer = require('buffer').Buffer;

const winWidth = Dimensions.get('window').width;

const MIN_FACTOR = 3;
const MIN_PRESET = 3;
const startChar = '~';
const endChar = '^';
let scannedDevices = [];
const PRESET_OPTIONS = Array(48)
  .fill(3)
  .map((x, y) => x + y);
const FACTOR_OPTIONS = [
  3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10,
];

let BT05_DEVICE = null;
let DEVICE_SERVICE_UUID = null;
let DEVICE_CHARACTERISTICS_UUID = null;
let MANAGER = null;
let scanTimer = null;
let onDisconnectEvent = null;
let readMonitor = null;

log("SETTINGS", 'Set onDisconnectEvent [setup]');

const getData = async key => {
  try {
    const data = await AsyncStorage.getItem(key);
    if (data !== null) {
      return data;
    }
  } catch (error) {
    log("SETTINGS", 'getData error:', error);
  }
};

const isPortrait = () => {
  const dim = Dimensions.get('screen');
  return dim.height >= dim.width;
};

const getErrorText = error => {
  if (error.reason == null) {
    return null;
  }

  if (error.errorCode == 201 || error.errorCode == 0) {
    return null;
  }

  let errorMap = {
    0: null,
    1: null,
    2: null,
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
    201: 'Device was disconnected, please go to the settings page and reconnect.',
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
      log("SETTINGS", base64Signal + ' - ' + (base64Signal.length + 3));
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

const playConnectedSound = () => {
  let beep = new Sound('beep_short.mp3', Sound.MAIN_BUNDLE, error => {
    if (error) {
      log("SETTINGS", 'failed to load the sound', error);
      return;
    }
    // loaded successfully
    beep.setVolume(0.02);
    beep.play(success => {
      if (success) {
        log("SETTINGS", 'successfully finished playing');
        setTimeout(() => {
          beep.play(success => {
            if (success) {
              log("SETTINGS", 'successfully finished playing');
            } else {
              log("SETTINGS", 'playback failed due to audio decoding errors');
            }
          });
        }, 200);
      } else {
        log("SETTINGS", 'playback failed due to audio decoding errors');
      }
    });
  });
  return beep;
};

const storeData = async () => {
  if (!JSON.parse(await AsyncStorage.getItem('@factor'))) {
    try {
      await AsyncStorage.setItem('@factor', JSON.stringify(3.5));
    } catch (error) {
      log("SETTINGS", 'ERROR SAVING FACTOR', error);
    }
  }

  if (!JSON.parse(await AsyncStorage.getItem('@wantedPsi'))) {
    try {
      await AsyncStorage.setItem('@wantedPsi', JSON.stringify(3));
    } catch (error) {
      log("SETTINGS", 'ERROR SAVING WANTED PSI', error);
    }
  }

  log("SETTINGS", 'road:', await AsyncStorage.getItem('@roadPreset'));
  if (!JSON.parse(await AsyncStorage.getItem('@roadPreset'))) {
    try {
      await AsyncStorage.setItem('@roadPreset', JSON.stringify(32));
    } catch (error) {
      log("SETTINGS", 'ERROR SAVING ROAD PRESET', error);
    }
  }
  log("SETTINGS", await AsyncStorage.getItem('@trailPreset'));
  if (!JSON.parse(await AsyncStorage.getItem('@trailPreset'))) {
    try {
      log("SETTINGS", 'Storing data - trailPreset');
      await AsyncStorage.setItem('@trailPreset', JSON.stringify(16));
    } catch (error) {
      log("SETTINGS", 'ERROR SAVING TRAIL PRESET', error);
    }
  }

  if (!JSON.parse(await AsyncStorage.getItem('@btImage'))) {
    try {
      await AsyncStorage.setItem('@btImage', JSON.stringify(null));
    } catch (error) {
      log("SETTINGS", 'ERROR SAVING BtImage', error);
    }
  }
};

const Settings = ({ navigation, route }) => {
  const [factor, setFactor] = useState(MIN_FACTOR);
  const [roadPreset, setRoadPreset] = useState(MIN_PRESET);
  const [trailPreset, setTrailPreset] = useState(MIN_PRESET);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalError, setModalError] = useState(false);
  const [modalText, setModalText] = useState('N/A');
  const [statusText, setStatusText] = useState('ERROR, Please report!');
  const [startScan, setStartScan] = useState(false);
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [pickerModalText, setPickerModalText] = useState('N/A');
  const [factorIndex, setFactorIndex] = useState(0);
  const [roadPresetIndex, setRoadPresetIndex] = useState(0);
  const [trailPresetIndex, setTrailPresetIndex] = useState(0);
  const [isPortraitOrientation, setIsPortraitOrientation] = useState(isPortrait());

  Dimensions.addEventListener('change', () => {
    setIsPortraitOrientation(isPortrait())
  });

  const onDeviceDisconnect = (error, device) => {
    log("SETTINGS", 'REACHED DISCONNECT');

    if (readMonitor) {
      readMonitor.remove();
      readMonitor = null;
    }

    if (onDisconnectEvent) {
      onDisconnectEvent.remove();
      onDisconnectEvent = null;
    }

    if (error) {
      log("SETTINGS", log("SETTINGS", 'On device disconnect error: ', err));
    } else {
      dropIn();
      setStatusText('Device has been disconnected');
      setBluetoothImageId(3);
      BT05_DEVICE = null;
    }
  };

  const monitorDeviceData = (error, data) => {
    if (error) {
      if (error.errorCode != 0) {
        setModalError(true);
        setModalText(getErrorText(error));
        setModalVisible(true);
      }
      return null;
    }
    data = Buffer.from(data.value, 'base64').toString();
    data = data.substring(data.indexOf(startChar) + 1, data.indexOf(endChar));
    if (data.includes('alive')) {
      log("SETTINGS", 'Asking for connection status');
      let x = 0;
      let timer = setInterval(() => {
        x++;
        sendDeviceSignal('yes');
        if (x == 5) {
          clearInterval(timer);
        }
      }, 170);
    }
  };

  const goHome = () => {
    log("SETTINGS",
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
      log("SETTINGS", 'Error removing subscriptions: ', error);
    }
    if (MANAGER) {
      MANAGER.stopDeviceScan();
    }
    log("SETTINGS", 'MANAGER: ' + typeof MANAGER);
    if (readMonitor) {
      readMonitor.remove();
      readMonitor = null;
    }

    if (onDisconnectEvent) {
      onDisconnectEvent.remove();
      onDisconnectEvent = null;
    }
    navigation.navigate('Home', {
      manager: MANAGER,
      device: BT05_DEVICE,
      serviceUUID: DEVICE_SERVICE_UUID,
      characteristicUUID: DEVICE_CHARACTERISTICS_UUID,
    });
  }

  useEffect(() => {
    log("SETTINGS", 'ROUTE: ' + JSON.stringify(route));
    log("SETTINGS", 'ROUTE DEVICE: ' + JSON.stringify(route.params.device));
    navigation.addListener('focus', () => {
      if (readMonitor) {
        readMonitor.remove();
        readMonitor = null;
      }

      if (onDisconnectEvent) {
        onDisconnectEvent.remove();
        onDisconnectEvent = null;
      }

      log("SETTINGS", 'Gained Foucs');
      log("SETTINGS", 'ROUTE: ' + JSON.stringify(route));

      if (
        route != null &&
        route != undefined &&
        route.params != null &&
        route.params != undefined
      ) {
        if (
          route.params.device != null &&
          route.params.device != undefined &&
          route.params.device.hasOwnProperty('id')
        ) {
          BT05_DEVICE = { ...route.params.device };
          log("SETTINGS", '--->> DEVICE CHECK 1: ' + BT05_DEVICE);
          MANAGER = route.params.manager;
          log("SETTINGS", '--->> DEVICE CHECK 2: ' + BT05_DEVICE);

          MANAGER.isDeviceConnected(BT05_DEVICE.id).then(isConnected => {
            if (isConnected) {
              log("SETTINGS", 'Device is connect so setting events');
              onDisconnectEvent = MANAGER.onDeviceDisconnected(
                BT05_DEVICE.id,
                onDeviceDisconnect,
              );
              readMonitor = MANAGER.monitorCharacteristicForDevice(
                BT05_DEVICE.id,
                'FFE0',
                'FFE1',
                monitorDeviceData,
              );
            }
          });

          DEVICE_SERVICE_UUID = route.params.serviceUUID;
          DEVICE_CHARACTERISTICS_UUID = route.params.characteristicsUUID;
        }
        setStartScan(route.params.startConnect);

        log("SETTINGS", 'Start connection with device: ' + startScan);
      }

      storeData();

      getData('@factor')
        .then(value => {
          log("SETTINGS", 'getData factor value: ' + value);
          if (value != null && value != undefined) {
            setFactor(parseFloat(JSON.parse(value)));
          }
        })
        .catch(err => log("SETTINGS", 'getData factor error', err));

      getData('@roadPreset')
        .then(value => {
          log("SETTINGS", 'getData roadPreset value: ' + value);
          if (value != null && value != undefined) {
            setRoadPreset(parseFloat(JSON.parse(value)));
          }
        })
        .catch(err => log("SETTINGS", 'getData trailPreset error', err));

      getData('@trailPreset')
        .then(value => {
          log("SETTINGS", 'getData trailPreset value: ' + value);
          if (value != null && value != undefined) {
            setTrailPreset(parseFloat(JSON.parse(value)));
          }
        })
        .catch(err => log("SETTINGS", 'getData trailPreset error', err));
      log("SETTINGS", '--->> DEVICE CHECK 3: ' + BT05_DEVICE);
      log("SETTINGS", '=> PARAMS connectToDevice: ' + route.params.connectToDevice);
      if (route.params.connectToDevice) {
        if (BT05_DEVICE) {
          log("SETTINGS", '=> DEVICE is OK');
          MANAGER.isDeviceConnected(BT05_DEVICE.id).then(connected => {
            if (connected) {
              log("SETTINGS", '=> DEVICE is Connected : ' + BT05_DEVICE);

              dropIn();
              setStatusText('Connected To Device');
              if (!onDisconnectEvent) {
                onDisconnectEvent = MANAGER.onDeviceDisconnected(
                  BT05_DEVICE.id,
                  onDeviceDisconnect,
                );
              }

              if (!readMonitor) {
                readMonitor = MANAGER.monitorCharacteristicForDevice(
                  BT05_DEVICE.id,
                  'FFE0',
                  'FFE1',
                  monitorDeviceData,
                );
              }
              setBluetoothImageId(2);
              goHome();
            } else {
              log("SETTINGS", '=> DEVICE is not Connected');
              BT05_DEVICE = null;
              dropIn();
              setStatusText('Failed To Connect');
            }
          });
        } else {
          dropIn();
          setStatusText('Failed To Connect');
          log("SETTINGS", '=> DEVICE: ' + JSON.stringify(BT05_DEVICE));
          log("SETTINGS", '=> DEVICE is not OK');
        }

        scannedDevices = [];

        log("SETTINGS", 'Source of device: Reconnect');
        DEVICE_SERVICE_UUID = null;
        DEVICE_CHARACTERISTICS_UUID = null;

        log("SETTINGS", 'CONNECTING TO DEVICE [BEFORE]');
      }

      getData('@btImage')
        .then(value => {
          log("SETTINGS", 'VALUE: ' + value);
          log("SETTINGS", 'VALUE: ' + value);
          log("SETTINGS", 'VALUE: ' + value);
          log("SETTINGS", 'VALUE: ' + value);
          if (value != null && value != undefined) {
            if (parseInt(value) == 2) {
              if (
                BT05_DEVICE != null &&
                BT05_DEVICE != undefined &&
                BT05_DEVICE.hasOwnProperty('id')
              ) {
                log("SETTINGS", 'BT05_DEVICE: ' + JSON.stringify(BT05_DEVICE));
                try {
                  log("SETTINGS", 'MANAGER: ' + MANAGER);
                  MANAGER.isDeviceConnected(BT05_DEVICE.id).then(d =>
                    log("SETTINGS", 'IS DEVICE CONNECTED? - ' + d),
                  );

                  MANAGER.isDeviceConnected(BT05_DEVICE.id)
                    .then(connected => {
                      if (connected) {
                        setBluetoothImageId(2);
                        log("SETTINGS",
                          'onDisconnectEvent: ' +
                          JSON.stringify(typeof onDisconnectEvent),
                        );
                        log("SETTINGS", !onDisconnectEvent);
                        log("SETTINGS", typeof onDisconnectEvent == 'object');
                        log("SETTINGS",
                          !onDisconnectEvent ||
                          typeof onDisconnectEvent == 'object',
                        );
                        if (
                          !onDisconnectEvent ||
                          typeof onDisconnectEvent == 'object'
                        ) {
                          log("SETTINGS",
                            'Set onDisconnectEvent [icon switch focus]',
                          );
                        }
                        onDisconnectEvent = MANAGER.onDeviceDisconnected(
                          BT05_DEVICE.id,
                          onDeviceDisconnect,
                        );
                        readMonitor = MANAGER.monitorCharacteristicForDevice(
                          BT05_DEVICE.id,
                          'FFE0',
                          'FFE1',
                          monitorDeviceData,
                        );
                      } else {
                        setBluetoothImageId(3);
                      }
                    })
                    .catch(e => {
                      log("SETTINGS", "Couldn't get connected status: " + e);
                    });
                } catch (error) {
                  log("SETTINGS",
                    "Couldn't get BT05_DEVICE.isConnected(): " +
                    error +
                    ' - ' +
                    BT05_DEVICE,
                  );
                  setBluetoothImageId(1);
                }
              }
            } else if (parseInt(value) == 4) {
              setBluetoothImageId(1);
            } else {
              setBluetoothImageId(parseInt(value));
            }
            log("SETTINGS", '\n-----------------------------------------\n');
          } else {
            setBluetoothImageId(1);
            log("SETTINGS", 'VALUE IS NULL');
          }
        })
        .catch(err => log("SETTINGS", 'getData btImage error', err));
    });
  }, [route]);

  // if (nav) {
  //   navigation = nav;
  // } else {
  //   navigation = useNavigation();
  // }

  // 1: ../assets/icons/bluetooth.png
  // 2: ../assets/icons/bluetooth_connected.png
  // 3: ../assets/icons/bluetooth_disconnected.png
  // 4: ../assets/icons/bluetooth_scanning.png
  const [bluetoothImageId, setBluetoothImageId] = useState(1);
  const dropAnim = useRef(new Animated.Value(0)).current;

  navigation.addListener('blur', e => {
    // exitApp();
  });

  useEffect(() => {
    AppState.addEventListener('change', currentState => {
      if (currentState === 'background') {
        // exitApp();
      }
    });
  }, []);

  const dropIn = () => {
    // Will change fadeAnim value to 1 in 5 seconds
    Animated.timing(dropAnim, {
      toValue: isPortraitOrientation ? 50 : 25,
      duration: 200,
      useNativeDriver: false,
      // useNativeDriver: true,
    }).start();
  };

  const dropOut = () => {
    // Will change fadeAnim value to 1 in 5 seconds
    Animated.timing(dropAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
      // useNativeDriver: true,
    }).start();
  };

  const scanForDevice = async manager => {
    log("SETTINGS", 'Scan func');
    setStatusText('Scanning for devices... (Found: 0)');

    scanTimer = setTimeout(() => {
      if (scannedDevices.length == 0) {
        setModalError(false);
        setModalText(
          "We have been scanning for 5 seconds and didn't find any devices! please try the following:\n\n- Restart OnAir device\n- Restart App\n- Get closer to device\n- Make sure the device is on",
        );
        setModalVisible(true);
        setStatusText('Please try again');
        setBluetoothImageId(1);
        if (MANAGER) {
          MANAGER.stopDeviceScan();
        }
        // } else if (scannedDevices.length == 1) {
        //   MANAGER.stopDeviceScan();
        //   setStatusText('Pairing...');
        //   connectToDevice(scannedDevices[0]);
      } else {
        MANAGER.stopDeviceScan();
        dropOut();
        resetBluetoothData();
        navigation.navigate('DeviceChooser', {
          scannedDevices: scannedDevices,
        });
        // Go to DeviceChooser screen
      }
      log("SETTINGS", 'All Scanned Devices: ' + JSON.stringify(scannedDevices));
    }, 5000);

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

        if (device && device !== 'null') {
          log("SETTINGS", 'Found Device Name: ' + device.name);
          if (device.name === 'BT05') {
            let push = true;

            for (let bt of scannedDevices) {
              if (
                bt.id == device.id ||
                (BT05_DEVICE != null &&
                  BT05_DEVICE.hasOwnProperty('id') &&
                  device.id == BT05_DEVICE.id)
              ) {
                push = false;
              }
            }
            if (push) {
              scannedDevices.push(device);
              setStatusText(
                `Scanning for devices... (Found: ${scannedDevices.length})`,
              );
              log("SETTINGS", 'Found BT05 - ' + device.id);
            }
          }
        }
      },
      setBluetoothImageId(4),
    );
  };

  const removeSubscriptions = () => {
    for (const [_key, val] of Object.entries(MANAGER._activeSubscriptions)) {
      try {
        MANAGER._activeSubscriptions[val].remove();
      } catch (error) {
        log("SETTINGS", 'Error removing subscription (manager): ', error);
      }
    }

    for (const [_key, val] of Object.entries(
      BT05_DEVICE._manager._activeSubscriptions,
    )) {
      try {
        BT05_DEVICE._manager._activeSubscriptions[val].remove();
      } catch (error) {
        log("SETTINGS", 'Error removing subscription (device): ', error);
      }
    }
  };

  const createManager = () => {
    if (MANAGER === null) {
      MANAGER = new BleManager();
      log("SETTINGS", 'CREATED BLE MANAGER [connect btn]');
    } else {
      log("SETTINGS", 'BLE MANAGER ALREADY EXISTS [connect btn]');
    }
  };

  const resetBluetoothData = async () => {
    log("SETTINGS", 'CREATING BLE MANAGER [connect btn]');
    if (readMonitor) {
      readMonitor.remove();
      readMonitor = null;
    }

    if (onDisconnectEvent) {
      onDisconnectEvent.remove();
      onDisconnectEvent = null;
    }
    if (MANAGER === null) {
      MANAGER = new BleManager();
      log("SETTINGS", 'CREATED BLE MANAGER [connect btn]');
    } else {
      log("SETTINGS", 'BLE MANAGER ALREADY EXISTS [connect btn]');
      MANAGER.destroy();
      MANAGER = new BleManager();
    }
    log("SETTINGS", 'Active manager: ' + MANAGER);
    BT05_DEVICE = null;
    log("SETTINGS", 'Source of device: Reconnect');
    DEVICE_SERVICE_UUID = null;
    DEVICE_CHARACTERISTICS_UUID = null;
  };

  const startConnection = async () => {
    dropIn();

    scannedDevices = [];
    createManager();
    resetBluetoothData();
    if (MANAGER !== null) {
      log("SETTINGS", 'SCANNING FOR DEVICE');
      log("SETTINGS", 'Current manager: ' + MANAGER);
      try {
        const subscription = MANAGER.onStateChange(state => {
          if (state === 'PoweredOn') {
            scanForDevice(MANAGER);
            subscription.remove();
          }
        }, true);
      } catch {
        log("SETTINGS",
          'Error subscribing to state change, manager: ' +
          JSON.stringify(MANAGER),
        );
      }
    }
  };

  if (startScan == true) {
    startConnection();
    setStartScan(false);
  }

  const renderItem = (item, index) => {
    return (
      <Text
        adjustsFontSizeToFit
        numberOfLines={1}
        style={{
          width: winWidth / 5.1,
          fontSize: winWidth / 40,
          textAlign: 'center',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'black',

        }}>
        {item}
      </Text>
    );
  };
  const exitApp = () => {
    if (readMonitor) {
      readMonitor.remove();
      readMonitor = null;
    }

    if (onDisconnectEvent) {
      onDisconnectEvent.remove();
      onDisconnectEvent = null;
    }
    clearTimeout(scanTimer);
    scannedDevices = [];
    log("SETTINGS", 'Exit app');
  };

  useEffect(() => {
    const saveId = async () => {
      log("SETTINGS", '----- BLUETOOTH IMAGE ID - ' + bluetoothImageId + ' -----');
      if (bluetoothImageId != 1) {
        await AsyncStorage.setItem(
          '@btImage',
          JSON.stringify(bluetoothImageId),
        );
      } else {
        if ((await AsyncStorage.getItem('@btImage')) == '2') {
          setBluetoothImageId(2);
        }
      }
    };
    saveId();
  }, [bluetoothImageId]);

  // useEffect(() => {
  //   AsyncStorage.setItem('@factor', JSON.stringify(factor));
  // }, [factor]);

  // useEffect(() => {
  //   AsyncStorage.setItem('@roadPreset', JSON.stringify(roadPreset));
  // }, [roadPreset]);

  // useEffect(() => {
  //   AsyncStorage.setItem('@trailPreset', JSON.stringify(trailPreset));
  // }, [trailPreset]);
  log("SETTINGS", winWidth / 5.1);
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{
        minHeight: '100%'
      }}>

        <FocusedStatusBar backgroundColor={COLORS.primary} />
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalText == null ? false : modalVisible}
          onRequestClose={() => {
            setModalVisible(!modalVisible);
          }}>
          <TouchableWithoutFeedback
            onPress={() => setModalVisible(!modalVisible)}>
            <View
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.5)',
                flex: 1,
                position: 'absolute',
              }}></View>
          </TouchableWithoutFeedback>
          <ScrollView
            contentContainerStyle={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center', display: "flex",
              flexDirection: "column"
            }}>
            <View
              style={{
                width: '80%',
                maxHeight: '90%',
                minHeight: "30%",
                backgroundColor: 'white',
                borderRadius: 2 * (winWidth / 25),
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
                position: 'relative'
              }}>

              <Text
                style={{
                  color: '#6f7173',
                  paddingRight: 40,
                  paddingLeft: 40,
                  marginBottom: 20,
                  fontSize: isPortraitOrientation ? 2 * (winWidth / 30) : 2 * (winWidth / 60),
                  fontWeight: 'bold',
                  textAlign: 'center',
                }}>
                {modalError ? 'Oh Snap!' : 'Info'}
              </Text>
              {isPortraitOrientation && <Image
                source={
                  modalError
                    ? require('../assets/icons/error.png')
                    : require('../assets/icons/info.png')
                }
                style={{ width: winWidth / 7, height: winWidth / 7, marginBottom: 20 }}
              />}

              <Text
                adjustsFontSizeToFit
                style={{
                  color: '#6f7173',
                  paddingRight: "5%",
                  paddingLeft: "5%",
                  fontSize: isPortraitOrientation ? 2 * (winWidth / 40) : 2 * (winWidth / 90),
                  height: '50%',
                  textAlign: 'center',
                  marginBottom: isPortraitOrientation ? "2%" : 0
                }}>
                {modalText}
              </Text>

              <Pressable
                style={{
                  borderBottomRightRadius: 20,
                  borderBottomLeftRadius: 20,
                  width: '100%',
                  elevation: 2,
                  height: '20%', marginTop: "auto",
                  backgroundColor: modalError ? '#db4d4d' : '#2196F3',

                }}
                onPress={() => setModalVisible(!modalVisible)}>
                <Text

                  style={{
                    color: 'white',
                    fontSize: 2 * (winWidth / 60),
                    textAlign: 'center', height: '100%',
                    textAlignVertical: 'center'
                  }}>
                  {modalError ? 'Dismiss' : 'Ok'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Modal>
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalText == null ? false : pickerModalVisible}
          // visible
          onRequestClose={() => {
            setPickerModalVisible(!pickerModalVisible);
          }}>
          <TouchableWithoutFeedback
            onPress={() => setPickerModalVisible(!pickerModalVisible)}>
            <View
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.5)',
                flex: 1,
                position: 'absolute',
              }}></View>
          </TouchableWithoutFeedback>
          <View
            style={{
              width: '100%',
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <View
              style={{
                backgroundColor: 'white',
                borderRadius: 25,
                flex: 1,
                width: isPortraitOrientation ? '80%' : "60%",
                maxHeight: isPortraitOrientation ? '30%' : "60%",
                position: 'relative',
              }}>
              <View style={{ alignItems: 'center' }}>
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={{
                    fontSize: 20,
                    color: 'black',
                    fontWeight: 'bold',
                    paddingVertical: '5%',
                  }}>
                  {pickerModalText}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <ValuePicker
                  style={{
                    textAlign: 'center',
                    flex: 1,
                    width: '100%',
                    height: '100%',
                  }}
                  data={
                    pickerModalText == 'Factor' ? FACTOR_OPTIONS : PRESET_OPTIONS
                  }
                  renderItem={renderItem}
                  itemWidth={winWidth / 5.1}
                  mark={
                    <View
                      style={{
                        aspectRatio: 1,
                        width: isPortraitOrientation ? '20%' : "15%",
                        borderWidth: 1,
                        borderColor: '#6f7173',
                        borderRadius: 20,
                      }}></View>
                  }
                  onChange={index => {
                    if (pickerModalText == 'Road Preset') {
                      setRoadPresetIndex(index);
                    } else if (pickerModalText == 'Trail Preset') {
                      setTrailPresetIndex(index);
                    } else {
                      setFactorIndex(index);
                    }
                  }}
                />
              </View>
              <View
                style={{
                  marginTop: 10
                }}>
                <View style={{ flexDirection: 'row' }}>
                  <Pressable
                    style={{
                      borderBottomLeftRadius: 20,
                      paddingVertical: '5%',
                      width: '50%',
                      padding: 20,
                      elevation: 2,
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: 'red',
                    }}
                    onPress={() => setPickerModalVisible(!pickerModalVisible)}>
                    <Text
                      adjustsFontSizeToFit
                      numberOfLines={1}
                      style={{
                        color: 'white',
                        textAlign: 'center',
                      }}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    style={{
                      borderBottomRightRadius: 20,
                      width: '50%',
                      // padding: 20,
                      elevation: 2,
                      backgroundColor: '#2196F3',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    onPress={() => {
                      setPickerModalVisible(!pickerModalVisible);
                      setPickerModalVisible(!pickerModalVisible);

                      if (pickerModalText == 'Road Preset') {
                        setRoadPreset(PRESET_OPTIONS[roadPresetIndex]);
                        AsyncStorage.setItem(
                          '@roadPreset',
                          JSON.stringify(PRESET_OPTIONS[roadPresetIndex]),
                        );
                        log("SETTINGS",
                          'roadPreset',
                          PRESET_OPTIONS[roadPresetIndex],
                        );
                      } else if (pickerModalText == 'Trail Preset') {
                        setTrailPreset(PRESET_OPTIONS[trailPresetIndex]);
                        AsyncStorage.setItem(
                          '@trailPreset',
                          JSON.stringify(PRESET_OPTIONS[trailPresetIndex]),
                        );
                        log("SETTINGS",
                          'trailPreset',
                          PRESET_OPTIONS[trailPresetIndex],
                        );
                      } else {
                        setFactor(FACTOR_OPTIONS[factorIndex]);
                        AsyncStorage.setItem(
                          '@factor',
                          JSON.stringify(FACTOR_OPTIONS[factorIndex]),
                        );
                        log("SETTINGS", 'factor', FACTOR_OPTIONS[factorIndex]);
                      }
                    }}>
                    <Text
                      adjustsFontSizeToFit
                      numberOfLines={1}
                      style={{
                        color: 'white',
                        textAlign: 'center',
                      }}>
                      Submit
                    </Text>
                  </Pressable>
                </View>
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
                paddingBottom: 0,
                paddingTop: 0,
                transformOrigin: 'right top',
                ...SHADOWS.extraDark,
              },
            },
            {
              // Bind opacity to animated value

              height: dropAnim,
            },
          ]}>
          <Text style={{ color: 'white', fontSize: isPortraitOrientation ? 2 * (winWidth / 60) : 2 * (winWidth / 100) }}>
            {statusText}
          </Text>
        </Animated.View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: isPortraitOrientation ? "10%" : '1%'
          }}>
          <CircleButton
            imgUrl={require('../assets/icons/back.png')}
            handlePressDown={() => { }}
            handlePressUp={goHome}
            size={isPortraitOrientation ? [winWidth / 10, winWidth / 10] : [winWidth / 20, winWidth / 20]}
            {...{
              marginLeft: "2%",
              marginTop: "2%",
              backgroundColor: 'transparent',
            }}
          />
          <Text style={{
            fontSize: isPortraitOrientation ? 2 * (winWidth / 30) : 2 * (winWidth / 50),
            color: 'white',
            marginTop: "2%",

          }}>
            SETTINGS
          </Text>
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
            handlePressDown={() => { }}
            handlePressUp={() => {
              if (bluetoothImageId != 4) {
                startConnection();
              }
            }}
            size={isPortraitOrientation ? [winWidth / 7, winWidth / 7] : [winWidth / 20, winWidth / 20]}
            {...{
              marginRight: "2%",
              marginTop: "2%",
              backgroundColor: 'transparent',
            }}
          />
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
            justifyContent: 'space-between',
          }}>
          <View style={{
            flexDirection: 'row',
            marginLeft: isPortraitOrientation ? 50 : "25%",
            alignItems: 'center',
            // backgroundColor: 'red',
            maxWidth: '50%',
            justifyContent: 'space-between'
          }}>
            <Text
              style={{
                fontSize: isPortraitOrientation ? 2 * (winWidth / 30) : 2 * (winWidth / 60),
                color: 'white',
              }}>
              Factor
            </Text>
            <TouchableOpacity
              onPress={() => { navigation.navigate("FactorInfo") }}
              style={{
                width: "20%", aspectRatio: 1,
                maxWidth: '50%',
              }}>
              <Image
                key={new Date()}
                source={require('../assets/icons/qmark.png')}
                resizeMode="contain"
                style={{
                  width: '100%',
                  height: '100%',
                  aspectRatio: 1,

                }}
              /></TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => {
              setPickerModalText('Factor');
              setPickerModalVisible(true);
              setFactorIndex(0);
              // setModalError(false);
              // setModalText(
              //   `${Dimensions.get('window').width}, ${
              //     Dimensions.get('window').height
              //   }`,
              // );
              // setModalVisible(true);
            }}
            style={{
              paddingVertical: isPortraitOrientation ? "2%" : 0,
              width: '15%',
              maxHeight: "70%",
              backgroundColor: '#424242',
              borderRadius: 2 * (winWidth / 10),
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: isPortraitOrientation ? 50 : "25%",
            }}>
            <Text
              adjustsFontSizeToFit
              style={{
                textAlign: 'center',
                textAlignVertical: 'center',
                paddingHorizontal: '7%',
                color: 'white',
                fontSize: isPortraitOrientation ? 2 * (winWidth / 30) : 2 * (winWidth / 60),
              }}>
              {JSON.stringify(factor)}
            </Text>
          </TouchableOpacity>
        </View>
        <View
          style={{
            backgroundColor: '#242424',
            width: '100%',
            height: '17%',
            marginTop: '1%',
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}>
          <Text
            style={{
              fontSize: isPortraitOrientation ? 2 * (winWidth / 30) : 2 * (winWidth / 60),
              marginLeft: isPortraitOrientation ? 50 : "25%",
              color: 'white',
            }}>
            Road Preset
          </Text>
          <TouchableOpacity
            onPress={() => {
              setPickerModalText('Road Preset');
              setPickerModalVisible(true);
              setRoadPresetIndex(0);
              // setModalVisible(true);
              // setModalText(PRESET_OPTIONS);
              // setModalError(false);
            }}
            style={{
              paddingVertical: isPortraitOrientation ? "2%" : 0,
              width: '15%',
              maxHeight: "70%",
              backgroundColor: '#424242',
              borderRadius: 2 * (winWidth / 10),
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: isPortraitOrientation ? 50 : "25%",
            }}>
            <Text
              adjustsFontSizeToFit
              style={{
                textAlign: 'center',
                textAlignVertical: 'center',
                paddingHorizontal: '7%',
                color: 'white',
                fontSize: isPortraitOrientation ? 2 * (winWidth / 30) : 2 * (winWidth / 60),
              }}>
              {JSON.stringify(roadPreset)}
            </Text>
          </TouchableOpacity>
        </View>
        <View
          style={{
            backgroundColor: '#242424',
            width: '100%',
            height: '17%',
            marginTop: '1%',
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}>
          <Text
            style={{
              fontSize: isPortraitOrientation ? 2 * (winWidth / 30) : 2 * (winWidth / 60),
              marginLeft: isPortraitOrientation ? 50 : "25%",
              color: 'white',
            }}>
            Trail Preset
          </Text>
          <TouchableOpacity
            onPress={() => {
              setPickerModalText('Trail Preset');
              setPickerModalVisible(true);
              setTrailPresetIndex(0);
              // setModalVisible(true);
              // setModalText(Platform.constants['Release'], Platform.OS);
              // setModalError(false);
            }}
            style={{
              paddingVertical: isPortraitOrientation ? "2%" : 0,
              width: '15%',
              maxHeight: "70%",
              backgroundColor: '#424242',
              borderRadius: 2 * (winWidth / 10),
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: isPortraitOrientation ? 50 : "25%",
            }}>
            <Text
              adjustsFontSizeToFit
              style={{
                textAlign: 'center',
                textAlignVertical: 'center',
                paddingHorizontal: '7%',
                color: 'white',
                fontSize: isPortraitOrientation ? 2 * (winWidth / 30) : 2 * (winWidth / 60),
              }}>
              {JSON.stringify(trailPreset)}
            </Text>
          </TouchableOpacity>
        </View>
        <View
          style={{
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: isPortraitOrientation ? '15%' : 0,
          }}>
          <Text adjustsFontSizeToFit style={{ fontSize: isPortraitOrientation ? 2 * (winWidth / 40) : 2 * (winWidth / 70), color: 'white' }}>
            All units are measured in PSI

          </Text>
          <Text adjustsFontSizeToFit style={{ fontSize: isPortraitOrientation ? 2 * (winWidth / 40) : 2 * (winWidth / 70), color: 'white' }}>
            On Air Version 4.4
          </Text>
          <Text adjustsFontSizeToFit
            onPress={() =>
              Linking.openURL('https://github.com/KingOfTNT10/on_air_project')
            }
            style={{
              color: '#2269B2',
              fontSize: isPortraitOrientation ? 2 * (winWidth / 40) : 2 * (winWidth / 70),
            }}>
            Code On Github
          </Text>
        </View></ScrollView>
    </SafeAreaView >
  );
};

export default Settings;

import {
  View,
  SafeAreaView,
  TouchableWithoutFeedback,
  Text,
  BackHandler,
  Modal,
  Pressable,
  Image,
  Animated,
  AppState,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Platform,
  Vibration
} from 'react-native';
import React, { useState, useRef, useEffect } from 'react';
import { FocusedStatusBar, CircleButton } from '../components';
import { COLORS, SHADOWS } from '../constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BleManager } from 'react-native-ble-plx';
import ValuePicker from 'react-native-picker-horizontal';
import HorizontalPicker from '@vseslav/react-native-horizontal-picker';

import { log } from '../services/logs';
import { connectToDevice, recreateManager } from '../services/bluetoothUtils';
import { LocalNotification, DisconnectedNotification } from '../services/LocalPushController';

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

let BluetoothDevice = null;
let DEVICE_SERVICE_UUID = null;
let DEVICE_CHARACTERISTICS_UUID = null;
let BluetoothManager = null;
let onDisconnectEvent = null;
let scanTimer = null;
let readMonitor = null;

const getData = async key => {
  if (!key) return null;
  try {
    log("SETTINGS", `Getting data for key: ${data}`);
    const data = await AsyncStorage.getItem(key);
    if (data !== null) {
      return data;
    }
  } catch (error) {
    log("SETTINGS", `ERROR when tried getting data for key: ${data}`);
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

  let err = errorMap[error.errorCode] ??
    'Unknown error occurred [custom]. (Please try again) info: ' +
    JSON.stringify(error);

  log("SETTINGS", `Error code: ${error.errorCode}. Error text: ${err}`);
  return err;
};

const sendDeviceSignal = async signal => {
  let base64Signal = Buffer.from('~' + signal + '^').toString('base64');
  log("SETTINGS", `Sending signal for device - ${BluetoothDevice ? BluetoothDevice.id : null}. value: ${signal}-${base64Signal}`);

  return BluetoothManager.writeCharacteristicWithoutResponseForDevice(
    BluetoothDevice.id,
    'FFE0',
    'FFE1',
    base64Signal,
  )
    .then(d => {
      log("SETTINGS", `Successfully sent data`);
      return d;
    })
    .catch(error => {
      log("SETTINGS", `ERROR when tried sending data (${signal}-${base64Signal}) to device - ${BluetoothDevice ? BluetoothDevice.id : null}. error: ${error}`);
      return error;
    });
};

const storeData = async () => {
  if (!JSON.parse(await AsyncStorage.getItem('@factor'))) {
    log("SETTINGS", `Factor is not set! setting to default: 3.5`);
    try {
      await AsyncStorage.setItem('@factor', JSON.stringify(3.5));
    } catch (error) {
      log("SETTINGS", `ERROR when tried to save default data for factor. error: ${error}`);
    }
  }

  if (!JSON.parse(await AsyncStorage.getItem('@wantedPsi'))) {
    log("SETTINGS", `Wanted PSI is not set! setting to default: 3`);
    try {
      await AsyncStorage.setItem('@wantedPsi', JSON.stringify(3));
    } catch (error) {
      log("SETTINGS", `ERROR when tried to save default data for Wanted PSI. error: ${error}`);
    }
  }

  if (!JSON.parse(await AsyncStorage.getItem('@roadPreset'))) {
    log("SETTINGS", `Road Preset is not set! setting to default: 32`);
    try {
      await AsyncStorage.setItem('@roadPreset', JSON.stringify(32));
    } catch (error) {
      log("SETTINGS", `ERROR when tried to save default data for Road Preset. error: ${error}`);
    }
  }

  if (!JSON.parse(await AsyncStorage.getItem('@trailPreset'))) {
    log("SETTINGS", `Trail Preset is not set! setting to default: 16`);
    try {
      await AsyncStorage.setItem('@trailPreset', JSON.stringify(16));
    } catch (error) {
      log("SETTINGS", `ERROR when tried to save default data for Trail Preset. error: ${error}`);
    }
  }

  // if (!JSON.parse(await AsyncStorage.getItem('@btImage'))) {
  //   log("SETTINGS", `BT Image is not set! setting to default: null`);
  //   try {
  //     await AsyncStorage.setItem('@BtImage', JSON.stringify(null));
  //   } catch (error) {
  //     log("SETTINGS", `ERROR when tried to save default data for BT Image. error: ${error}`);
  //   }
  // }
};




const Settings = ({ navigation, route }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [factor, setFactor] = useState(MIN_FACTOR);
  const [wheels, setWheels] = useState(1);
  const [roadPreset, setRoadPreset] = useState(MIN_PRESET);
  const [trailPreset, setTrailPreset] = useState(MIN_PRESET);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalError, setModalError] = useState(false);
  const [modalText, setModalText] = useState('N/A');
  const [statusText, setStatusText] = useState('ERROR, Please report!');
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [pickerModalText, setPickerModalText] = useState('N/A');
  const [factorIndex, setFactorIndex] = useState(0);
  const [wheelsIndex, setWheelsIndex] = useState(0);
  const [roadPresetIndex, setRoadPresetIndex] = useState(0);
  const [trailPresetIndex, setTrailPresetIndex] = useState(0);
  const [isPortraitOrientation, setIsPortraitOrientation] = useState(isPortrait());
  const [voltage, setVoltage] = useState("0.0");
  const [bluetoothImageId, setBluetoothImageId] = useState(1);
  const [longPress, setLongPress] = useState(false);

  const exitApp = () => {
    // log("SETTINGS", `Exited settings screen`);

  };

  const hardwareBackBtn = () => {
    goHome();
  };

  const handleAppInBackground = currentState => {
    if (currentState === 'background') {
      exitApp();
    }
  };

  Dimensions.addEventListener('change', () => {
    log("SETTINGS", `Changed rotation. Is portrait - ${isPortrait()}`);
    setIsPortraitOrientation(isPortrait());
  });


  const onDeviceDisconnect = (error, device) => {
    if (error) {
      log("HOME", `ERROR when device disconnected, device - ${device ? device.id : null}. error: ${error}`);
      setModalError(true);
      setModalText(getErrorText(error));
      setModalVisible(true);
    } else {
      setBluetoothImageId(3);
      log("HOME", `Device ${device ? device.id : null} disconnected successfully`);
      if (onDisconnectEvent) {
        log("HOME", `Removing disconnect listener.`);
        onDisconnectEvent.remove();
        onDisconnectEvent = null;
      }

      setStatusText('Disconnected');
      if (readMonitor) {
        log("HOME", `Removing received data listener.`);
        readMonitor.remove();
        readMonitor = null;

      }

      if (Platform.OS === 'android') {
        Vibration.vibrate([200, 200, 200, 500]);
      } else {
        Vibration.vibrate([200, 500]);
      }
      DisconnectedNotification();
      removeSubscriptions();
      setStatusText('You have disconnected from the device.');
      dropIn();
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
    log("SETTINGS", `Received raw data: ${data}`);
    data = data.substring(data.indexOf(startChar) + 1, data.indexOf(endChar));
    log("SETTINGS", `Filtered data: ${data}.`);
    try {
      data = JSON.parse(data);
      log("DEBUG", `ARRAY PARSED WITH LENGTH ${data.length}`);
      if (data.length == 2) {
        sendDeviceSignal("gp");
        setVoltage(data[0]);
      } else {
        if (data[0] == 3) {
          let wantedPSI = null;
          AsyncStorage.getItem("@wantedPsi").then(d => {
            if (d) {
              wantedPSI = JSON.parse(d);
            } else {
              wantedPSI = "N/A";
            }

            LocalNotification(wantedPSI);
            setTimeout(() => {
              Vibration.vibrate([0, 1000, 1000, 1000, 1000, 1000, 1000, 1000]);
            }, 1000);
            playDoneSound();
          });

        }
      }
    } catch (error) {
      log("SETTINGS", "ERROR when tried parsing data sent from arduino.");
    }

  };

  const goHome = () => {
    log("SETTINGS", `Going home via back button/device chooser`);
    try {
      log("SETTINGS", `Removing subscriptions`);
      removeSubscriptions();
    } catch (error) {
      log("SETTINGS", `ERROR when tried removing subscriptions`);
    }
    if (BluetoothManager) {
      log("SETTINGS", `Stopped scan for devices`);
      BluetoothManager.stopDeviceScan();
    }

    if (readMonitor) {
      log("SETTINGS", `Removed data received listener`);
      readMonitor.remove();
      readMonitor = null;
    }

    if (onDisconnectEvent) {
      log("SETTINGS", `Removed device disconnect listener`);
      onDisconnectEvent.remove();
      onDisconnectEvent = null;
    }

    if (scanTimer) {
      clearTimeout(scanTimer);
    }

    log("SETTINGS", `Navigating home`);
    navigation.navigate('Home', {
      manager: BluetoothManager,
      device: BluetoothDevice,
      serviceUUID: DEVICE_SERVICE_UUID,
      characteristicUUID: DEVICE_CHARACTERISTICS_UUID,
    });
  };

  useEffect(() => {


    let mounted = true;

    let navListener = navigation.addListener('focus', () => {
      if (readMonitor) {
        readMonitor.remove();
        readMonitor = null;
      }

      if (onDisconnectEvent) {
        onDisconnectEvent.remove();
        onDisconnectEvent = null;
      }

      if (
        route != null &&
        route != undefined &&
        route.params != null &&
        route.params != undefined
      ) {
        log("SETTINGS", `Passed route checks`);
        if (
          route.params.device != null &&
          route.params.device != undefined &&
          route.params.device.hasOwnProperty('id')
        ) {
          log("SETTINGS", `Passed params checks. params: ${route.params}`);
          BluetoothDevice = { ...route.params.device };
          if (!route.params.manager) {
            BluetoothManager = recreateManager(null);
          } else {
            BluetoothManager = route.params.manager;
          }
          BluetoothManager.isDeviceConnected(BluetoothDevice.id).then(isConnected => {
            if (!mounted) {
              return;
            }

            if (isConnected) {
              setBluetoothImageId(2);
              AsyncStorage.setItem("@personalDeviceId", BluetoothDevice.id);
              log("SETTINGS", "Set personal device ID to: " + BluetoothDevice.id);
              log("SETTINGS", `Device - ${BluetoothDevice ? BluetoothDevice.id : null} connected. creating listeners`);

              if (BluetoothDevice && BluetoothManager) {
                log("HOME", `Sending arduino screen status`);
                sendDeviceSignal('settings');
              }

              if (!route.params.connectToDevice) {

                onDisconnectEvent = BluetoothManager.onDeviceDisconnected(
                  BluetoothDevice.id,
                  onDeviceDisconnect,
                );

                readMonitor = BluetoothManager.monitorCharacteristicForDevice(
                  BluetoothDevice.id,
                  'FFE0',
                  'FFE1',
                  monitorDeviceData,
                );
              }
            }
          });

          DEVICE_SERVICE_UUID = route.params.serviceUUID;
          DEVICE_CHARACTERISTICS_UUID = route.params.characteristicsUUID;
        } else {
          setBluetoothImageId(1);
        }
      }

      if (mounted) {
        storeData();
      }



      if (route.params.connectToDevice) {
        if (BluetoothDevice) {
          BluetoothManager.isDeviceConnected(BluetoothDevice.id).then(connected => {
            if (!mounted) {
              return;
            }

            if (connected) {
              setBluetoothImageId(2);
              log("SETTINGS", `Device - ${BluetoothDevice ? BluetoothDevice.id : null} is connected`);

              setStatusText('Connected To Device');
              dropIn();
              // if (!onDisconnectEvent) {
              //   log("SETTINGS", `Set disconnect event listener`);
              //   onDisconnectEvent = BluetoothManager.onDeviceDisconnected(
              //     BluetoothDevice.id,
              //     onDeviceDisconnect,
              //   );
              // }

              // if (!readMonitor) {
              //   log("SETTINGS", `Set data received event listener`);
              //   readMonitor = BluetoothManager.monitorCharacteristicForDevice(
              //     BluetoothDevice.id,
              //     'FFE0',
              //     'FFE1',
              //     monitorDeviceData,
              //   );
              // }

              Vibration.vibrate([0, 500]);

              goHome();

            } else {
              setBluetoothImageId(3);
              log("SETTINGS", `Device - ${BluetoothDevice ? BluetoothDevice.id : null} is not connected`);
              BluetoothDevice = null;
              setStatusText('Failed To Connect');
              dropIn();
            }
          });
        } else {
          if (!mounted) {
            return;
          }

          setBluetoothImageId(3);
          log("SETTINGS", `Failed to connect. device: ${typeof BluetoothDevice}`);
          setStatusText('Failed To Connect');
          dropIn();
        }

        scannedDevices = [];

        DEVICE_SERVICE_UUID = null;
        DEVICE_CHARACTERISTICS_UUID = null;
      }
    });
    return () => {
      mounted = false;
      navListener();
    };
  }, [route]);


  const dropAnim = useRef(new Animated.Value(0)).current;

  navigation.addListener('blur', e => {
    exitApp();
  });

  useEffect(() => {
    let appStateListener = AppState.addEventListener('change', handleAppInBackground);
    BackHandler.addEventListener('hardwareBackPress', hardwareBackBtn);
    if (BluetoothDevice && BluetoothManager) {
      sendDeviceSignal("settings");
    }
    let mounted = true;

    getData('@factor')
      .then(value => {
        if (value != null && value != undefined && mounted) {
          setFactor(parseFloat(JSON.parse(value)));
        }
      })
      .catch(error => log("SETTINGS", `ERROR when tried getting factor. error: ${error}`));

    getData('@wheels')
      .then(value => {
        if (value != null && value != undefined && mounted) {
          setWheels(parseFloat(JSON.parse(value)));
        }
      })
      .catch(error => log("SETTINGS", `ERROR when tried getting wheels. error: ${error}`));

    getData('@roadPreset')
      .then(value => {
        log("SETTINGS", 'getData roadPreset value: ' + value);
        if (value != null && value != undefined && mounted) {
          setRoadPreset(parseFloat(JSON.parse(value)));
        }
      })
      .catch(error => log("SETTINGS", `ERROR when tried getting road preset. error: ${error}`));

    getData('@trailPreset')
      .then(value => {
        log("SETTINGS", 'getData trailPreset value: ' + value);
        if (value != null && value != undefined && mounted) {
          setTrailPreset(parseFloat(JSON.parse(value)));
        }
      })
      .catch(error => log("SETTINGS", `ERROR when tried getting trail preset. error: ${error}`));

    return () => {
      mounted = false;
      appStateListener.remove();
      BackHandler.removeEventListener('hardwareBackPress', hardwareBackBtn);

    };
  }, []);

  const dropIn = () => {
    Animated.timing(dropAnim, {
      toValue: isPortraitOrientation ? 50 : 25,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const dropOut = () => {
    Animated.timing(dropAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const scanForDevice = async manager => {
    log("SETTINGS", `Starting scan for devices`);
    setStatusText('Scanning for devices... (Found: 0)');

    scanTimer = setTimeout(() => {
      if (scannedDevices.length == 0) {
        // clearInterval(countDownInterval)
        log("SETTINGS", `No devices found in scan.`);
        setModalError(false);
        setModalText(
          "We have been scanning for 5 seconds and didn't find any devices! please try the following:\n\n- Restart OnAir device\n- Restart App\n- Get closer to device\n- Make sure the device is on",
        );
        setModalVisible(true);
        setStatusText('Please try again');
        setBluetoothImageId(1);
        if (BluetoothManager) {
          BluetoothManager.stopDeviceScan();
        }

      } else {

        log("SETTINGS", `${scannedDevices.length} devices found. navigating to device chooser screen`);
        BluetoothManager.stopDeviceScan();
        dropOut();
        resetBluetoothData();
        navigation.navigate('DeviceChooser', {
          scannedDevices: scannedDevices,
        });
      }
    }, 5000);

    let personalDeviceId = null;
    try {
      personalDeviceId = await AsyncStorage.getItem("@personalDeviceId");
      log("SETTINGS", "Personal device exists: " + personalDeviceId);
    } catch (error) {
      log("SETTINGS", `ERROR when tried getting the personal device id. (${error})`);
    }
    let scannedDeviceIDs = [];
    await manager.startDeviceScan(
      null,
      null,
      (error, device) => {
        if (error) {
          setModalError(true);
          setModalText(getErrorText(error));
          setModalVisible(true);
          setStatusText('An Error occurred');
          log("SETTINGS", `ERROR when tried scanning for devices. error: ${error}`);
        }
        setBluetoothImageId(4);
        if (device && device != 'null' && device?.id && !scannedDeviceIDs.includes(device.id)) {
          if (device.name === 'BT05') {
            log("SETTING", "Device scanned: " + device.id);
            scannedDeviceIDs.push(device.id);
            if (personalDeviceId) {
              if (personalDeviceId) {
                if (personalDeviceId == device.id) {
                  removeSubscriptions();
                  if (BluetoothDevice) {
                    BluetoothDevice.cancelConnection();
                  }
                  connectToDevice(device, BluetoothManager).then(
                    bt => {
                      if (bt) {
                        BluetoothDevice = bt;
                        setBluetoothImageId(2);
                        clearTimeout(scanTimer);
                        manager.stopDeviceScan();
                        setStatusText("Connected to personal device");
                        Vibration.vibrate([0, 500]);

                        goHome();

                      }
                    }
                  ).catch(e => {
                    log("SETTINGS", `ERROR when tried connecting to the personal device. (${e})`);
                  });
                }
              }
            }
            let push = true;

            for (let bt of scannedDevices) {
              if (
                bt.id == device.id ||
                (BluetoothDevice != null &&
                  BluetoothDevice.hasOwnProperty('id') &&
                  device.id == BluetoothDevice.id)
              ) {
                push = false;
              }
            }
            if (push) {
              scannedDevices.push(device);
              setStatusText(
                `Scanning for devices... (Found: ${scannedDevices.length})`,
              );
            }

          }

        };
      });
  };



  const removeSubscriptions = () => {
    log("SETTINGS", `Removing subscriptions.`);

    if (BluetoothManager) {
      for (const [, val] of Object.entries(BluetoothManager._activeSubscriptions)) {
        try {
          BluetoothManager._activeSubscriptions[val].remove();
        } catch (error) {
        }
      }
    }

    if (BluetoothDevice) {
      for (const [, val] of Object.entries(
        BluetoothDevice._manager._activeSubscriptions,
      )) {
        try {
          BluetoothDevice._manager._activeSubscriptions[val].remove();
        } catch (error) {
        }
      }
    }
  };

  const resetBluetoothData = async () => {

    try {
      if (BluetoothDevice != null && BluetoothDevice != undefined) {
        await BluetoothDevice.cancelConnection();
      }
    } catch (e) { }

    if (readMonitor) {
      log("SETTINGS", `Removed data received listener`);
      await readMonitor.remove();
      readMonitor = null;
    }

    if (onDisconnectEvent) {
      log("SETTINGS", `Removed device disconnect listener`);
      await onDisconnectEvent.remove();
      onDisconnectEvent = null;
    }

    if (BluetoothManager === null) {
      BluetoothManager = new BleManager();
      log("SETTINGS", 'Bluetooth manager created');
    } else {
      await BluetoothManager.destroy();
      BluetoothManager = new BleManager();
      log("SETTINGS", 'Bluetooth manager reloaded');
    }

    BluetoothDevice = null;
    DEVICE_SERVICE_UUID = null;
    DEVICE_CHARACTERISTICS_UUID = null;
  };

  const startConnection = async () => {
    setStatusText("Disconnecting bluetooth...");
    dropIn();

    scannedDevices = [];
    await resetBluetoothData();
    if (BluetoothManager !== null) {

      try {
        const subscription = BluetoothManager.onStateChange(state => {
          if (state === 'PoweredOn') {
            subscription.remove();
            setTimeout(() => {
              // resetBluetoothData();
              scanForDevice(BluetoothManager);
            }, 1000);

          }
        }, true);
      } catch (error) {
        log("SETTINGS", `ERROR when tried setting state change for bluetooth manager. error: ${error}`);
      }
    }
  };

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

              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ValuePicker
                  style={{
                    textAlign: 'center',
                    flex: 1,
                    width: '100%',
                    height: '100%',
                  }}
                  data={
                    pickerModalText == 'Factor' ? FACTOR_OPTIONS : pickerModalText == "Wheels" ? [1, 2, 3, 4] : PRESET_OPTIONS
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
                    } else if (pickerModalText == 'Wheels') {
                      setWheelsIndex(index);
                    } else {
                      setFactorIndex(index);
                    }
                  }}
                />
              </View>
              <View style={{
                // ADD OIPACITY AT SIDES AND SIZE SMALLER
              }}></View>
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
                        ).then(() => log("SETTINGS", "Saved road preset successfully: " + PRESET_OPTIONS[roadPresetIndex])).catch(e => log("SETTINGS", `ERROR when tried setting road preset. (${e})`));
                        log("SETTINGS",
                          'roadPreset',
                          PRESET_OPTIONS[roadPresetIndex],
                        );
                      } else if (pickerModalText == 'Trail Preset') {
                        setTrailPreset(PRESET_OPTIONS[trailPresetIndex]);
                        AsyncStorage.setItem(
                          '@trailPreset',
                          JSON.stringify(PRESET_OPTIONS[trailPresetIndex]),
                        ).then(() => log("SETTINGS", "Saved trail preset successfully: " + PRESET_OPTIONS[roadPresetIndex])).catch(e => log("SETTINGS", `ERROR when tried setting trail preset. (${e})`));;
                        log("SETTINGS",
                          'trailPreset',
                          PRESET_OPTIONS[trailPresetIndex],
                        );
                      } else if (pickerModalText == 'Wheels') {
                        setWheels([1, 2, 3, 4][wheelsIndex]);
                        AsyncStorage.setItem(
                          '@wheels',
                          JSON.stringify([1, 2, 3, 4][wheelsIndex]),
                        ).then(() => log("SETTINGS", "Saved wheels successfully: " + [1, 2, 3, 4][wheelsIndex])).catch(e => log("SETTINGS", `ERROR when tried setting wheels. (${e})`));;
                        log("SETTINGS",
                          'wheels',
                          [1, 2, 3, 4][wheelsIndex],
                        );


                      } else {
                        setFactor(FACTOR_OPTIONS[factorIndex]);
                        AsyncStorage.setItem(
                          '@factor',
                          JSON.stringify(FACTOR_OPTIONS[factorIndex]),
                        ).then(() => log("SETTINGS", "Saved factor successfully: " + FACTOR_OPTIONS[factorIndex])).catch(e => log("SETTINGS", `ERROR when tried setting factor. (${e})`));;
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
            onLongPress={() => { }}
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
              if (bluetoothImageId != 4 && !longPress) {
                startConnection();
              }
              if (longPress) {
                setLongPress(false);
              }
            }}
            onLongPress={async () => {

              await AsyncStorage.removeItem("@personalDeviceId").then(
                () => setStatusText("Cleared personal device")
              ).catch(() => setStatusText("ERROR when tried clearing personal device"));
              dropIn();
              setLongPress(true);

            }}
            delayLongPress={700}
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
            height: '12%', // was 17%
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
              onPress={() => navigation.navigate("FactorInfo")}
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
            height: '12%', // 17%
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
            Wheels
          </Text>
          <TouchableOpacity
            onPress={() => {
              setPickerModalText('Wheels');
              setPickerModalVisible(true);
              setRoadPresetIndex(0);
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
              {JSON.stringify(wheels)}
            </Text>
          </TouchableOpacity>
        </View>
        <View
          style={{
            backgroundColor: '#242424',
            width: '100%',
            height: '12%', // was 17%
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
            height: '12%', // was 17%
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
        <View style={{
          marginTop: '2%',
          width: '100%',
          height: "5%",
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Text>Battery Voltage: {voltage != "0.0" ? voltage : "N/A"}</Text>
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
            On Air Version 5.0
          </Text>
          <Text adjustsFontSizeToFit
            onPress={async () => {
              // Linking.openURL('https://github.com/KingOfTNT10/on_air_project')

            }
            }
            style={{
              color: '#2269B2',
              fontSize: isPortraitOrientation ? 2 * (winWidth / 40) : 2 * (winWidth / 70),
            }}>
            Code On Github
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Settings;

import {
  View,
  SafeAreaView,
  Text,
  Modal,
  Pressable,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Image,
  Platform,
  Animated,
  AppState,
  Vibration,
  ScrollView,
  Dimensions,
  NativeEventEmitter,
  ActivityIndicator,
  I18nManager
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import ValuePicker from 'react-native-picker-horizontal';
import { check, PERMISSIONS } from 'react-native-permissions';
import BluetoothStateManager from 'react-native-bluetooth-state-manager';
import { DisconnectedNotification, LocalNotification } from '../services/LocalPushController';
import { FocusedStatusBar } from '../components';
import { COLORS, SHADOWS } from '../constants';
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Sound from 'react-native-sound';
import BackgroundTimer from 'react-native-background-timer';
import { log } from '../services/logs';
import { StackActions } from '@react-navigation/native';
import Shortcuts from "react-native-actions-shortcuts";
import { connectToDevice, scanForDevices, recreateManager } from '../services/bluetoothUtils';

let dropInTimer = null;
let permTimer = null;
let timer = null;
let waitTimer = null;
let BluetoothDevice = null;
let BluetoothManager = null;
let DEVICE_SERVICE_UUID = null;
let DEVICE_CHARACTERISTICS_UUID = null;
let MIN_FACTOR = 3;
const MAX_PSI = 50;

// Changed max PSI to 110 so I can scroll with petentiometer to 112 (bc its max) and check done

const MIN_PSI = 3;
const PSI_OPTIONS = Array(MAX_PSI - 2)
  .fill(3)
  .map((x, y) => x + y);
const startChar = '~';
const endChar = '^';
const StatusIdMap = {
  0: 'Inflating',
  1: 'Deflating',
  2: 'Measuring',
  3: 'Done',
  4: 'Stand By',
};
const timerList = [];

const winWidth = Dimensions.get('window').width;

const Buffer = require('buffer').Buffer;
Sound.setCategory('Playback');

const isPortrait = () => {
  const dim = Dimensions.get('screen');
  return dim.height >= dim.width;
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

const playDoneSound = () => {
  let beep = new Sound('done_beep.mp3', Sound.MAIN_BUNDLE, error => {
    if (error) {
      log("HOME", `Failed to load done_beep.mp3 sound. error: ${error}`);
      return;
    }
    beep.setVolume(1);
    beep.play(success => {
      if (success) {
        log("HOME", 'successfully finished playing');
      } else {
        log("HOME", 'playback failed due to audio decoding errors');
      }
    });
  });
  return beep;
};

const playDisconnectSound = () => {
  let beep = new Sound('disconnect_sound.mp3', Sound.MAIN_BUNDLE, error => {
    if (error) {
      log("HOME", `Failed to load disconnect_sound.mp3 sound. error: ${error}`);
      return;
    }
    beep.setVolume(1);
    beep.play(success => {
      if (success) {
        log("HOME", 'successfully finished playing');
      } else {
        log("HOME", 'playback failed due to audio decoding errors');
      }
    });
  });
  return beep;
};


const downPressPlus = (currentCounter, setCounter) => {
  if (currentCounter < MAX_PSI) {
    waitTimer = setTimeout(() => {
      log("HOME", 'Long press activated, starting plus loop');
      if (timer === null) {
        timer = setInterval(() => {
          setCounter(counter => counter + (counter < MAX_PSI ? 1 : 0));
          Vibration.vibrate([0, 5]);
        }, 75);
      }
    }, 700);
  }
};

const upPressPlus = (currentCounter, setCounter) => {
  if (currentCounter <= MAX_PSI) {
    if (timer) {
      log("HOME", `Set PSI to ${currentCounter + 1}. operation: +`);
    }
    clearInterval(timer);
    clearTimeout(waitTimer);
    Vibration.vibrate([0, 5]);
    timer = null;
    waitTimer = null;
    if (currentCounter < MAX_PSI) {
      setCounter(counter => counter + 1);
    }
  }
};

const downPressMinus = (currentCounter, setCounter) => {

  if (currentCounter > MIN_PSI) {
    waitTimer = setTimeout(() => {
      log("HOME", 'Long press activated, starting minus loop');
      if (timer === null) {
        timer = setInterval(() => {
          setCounter(counter => counter - (counter > MIN_PSI ? 1 : 0));
          Vibration.vibrate([0, 5]);
        }, 75);
      }
    }, 700);
  }
};

const upPressMinus = (currentCounter, setCounter) => {

  if (currentCounter >= MIN_PSI) {
    if (timer) {
      log("HOME", `Set PSI to ${currentCounter - 1}. operation: -`);
    }
    clearInterval(timer);
    clearTimeout(waitTimer);
    Vibration.vibrate([0, 5]);
    timer = null;
    if (currentCounter > MIN_PSI) {
      setCounter(counter => counter - 1);
    }
    waitTimer = null;
  }
};

const getData = async key => {
  if (!key) return null;

  try {
    log("HOME", `Getting data for key: ${key}`);
    const data = await AsyncStorage.getItem(key);
    if (data !== null) {
      return data;
    }
  } catch (error) {
    log("HOME", `ERROR when tried getting data for key: ${key}. error: ${error}`);
  }
};

const setData = async (key, value) => {
  try {
    log("HOME", `Setting data for key: ${key}, with value: ${value}`);
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    log("HOME", `ERROR when tried setting data for key: ${key}, with value: ${value}. error: ${error}`);
  }
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
    1: 'BleManager was destroyed',
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

  log("HOME", `Getting error code ${error.errorCode}. error text: ${err}`);

  return err;


};

const isValidData = data => {
  for (let char of data) {
    if (
      'abcdefghijklmnopqrstuvwxyz1234567890"[].,-'.includes(char)
    ) {
      continue;
    } else {
      log("HOME", `Data: "${data}" is not valid. (char: ${char})`);
      return false;
    }
  }
  log("HOME", `Data: "${data}" is valid.`);
  return true;
};

const storeData = async () => {
  if (!await AsyncStorage.getItem('@factor')) {
    log("HOME", `Factor is not set! setting to default: 3.5`);
    try {
      await AsyncStorage.setItem('@factor', JSON.stringify(3.5));
    } catch (error) {
      log("HOME", `ERROR when tried to save default data for factor. error: ${error}`);
    }
  }

  if (!await AsyncStorage.getItem('@wantedPsi')) {
    log("HOME", `Wanted PSI is not set! setting to default: 3`);
    try {
      await AsyncStorage.setItem('@wantedPsi', JSON.stringify(3));
    } catch (error) {
      log("HOME", `ERROR when tried to save default data for Wanted PSI. error: ${error}`);
    }
  }

  if (!await AsyncStorage.getItem('@roadPreset')) {
    log("HOME", `Road Preset is not set! setting to default: 32`);
    try {
      await AsyncStorage.setItem('@roadPreset', JSON.stringify(32));
    } catch (error) {
      log("HOME", `ERROR when tried to save default data for Road Preset. error: ${error}`);
    }
  }

  if (!await AsyncStorage.getItem('@trailPreset')) {
    log("HOME", `Trail Preset is not set! setting to default: 16`);
    try {
      await AsyncStorage.setItem('@trailPreset', JSON.stringify(16));
    } catch (error) {
      log("HOME", `ERROR when tried to save default data for Trail Preset. error: ${error}`);
    }
  }

  // if (!await AsyncStorage.getItem('@btImage')) {
  //   log("HOME", `BT Image is not set! setting to default: null`);
  //   try {
  //     await AsyncStorage.setItem('@BtImage', JSON.stringify(null));
  //   } catch (error) {
  //     log("HOME", `ERROR when tried to save default data for BT Image. error: ${error}`);
  //   }
  // }
};

const exitApp = () => {
  // log("HOME", `Exited home screen`);
  // AsyncStorage.setItem("@lastSave", JSON.stringify(Date.now()));
};


const handleAppInBackground = (currentState) => {
  if (currentState === 'background') {
    exitApp();
  }
};

const Home = ({ navigation, route }) => {

  const [reconnected, setReconnected] = useState(false);
  const [wantedPsi, setWantedPsi] = useState(MIN_PSI);
  const [factor, setFactor] = useState(MIN_FACTOR);
  const [wheels, setWheels] = useState(1);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalError, setModalError] = useState(false);
  const [modalText, setModalText] = useState('N/A');
  const [connected, setConnected] = useState(false);
  const [statusText, setStatusText] = useState('Disconnected');
  const [disconnectMonitor, setDisconnectMonitor] = useState(null);
  const [readMonitor, setReadMonitor] = useState(null);
  const [tirePressure, setTirePressure] = useState(0);
  const [showStatusLoading, setShowStatusLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [lowBattery, setLowBattery] = useState(false);
  const [dropMessageText, setDropMessageText] = useState('You have disconnected from the device.');
  const [dropMessageButtonText, setDropMessageButtonText] = useState('Reconnect');
  const [allMessagesSentByDevice, setAllMessagesSentByDevice] = useState([]);
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [psiIndex, setPsiIndex] = useState(0);
  const [isPortraitOrientation, setIsPortraitOrientation] = useState(isPortrait());

  const dropAnim = useRef(new Animated.Value(0)).current;

  Dimensions.addEventListener('change', () => {
    log("HOME", `Changed rotation. Is portrait - ${isPortrait()}`);
    setIsPortraitOrientation(isPortrait());
  });

  const handleShortcut = (item) => {
    log("HOME", "Shortcut pressed. data:", item);
    if (item.data.connect && checkPermission() == "good") {
      navigation.navigate('Settings', {
        device: null,
        serviceUUID: null,
        characteristicsUUID: null,
        startConnect: true,
        connectToDevice: false,
        manager: null,
      });
    }
  };

  const handleDisconnect = device => {
    setShowStatusLoading(false);
    log("HOME", `Device ${device ? device.id : null} disconnected successfully`);
    if (disconnectMonitor) {
      log("HOME", `Removing disconnect listener.`);
      disconnectMonitor.remove();
      setDisconnectMonitor(null);
    }

    log("HOME", `Removing all timers.`);
    for (timer of timerList) {
      BackgroundTimer.clearInterval(timer);
    }
   

    setStatusText('Disconnected');
    if (readMonitor) {
      log("HOME", `Removing received data listener.`);
      readMonitor.remove();
      setReadMonitor(null);
    }

    setConnected(false);

    if (Platform.OS === 'android') {
      Vibration.vibrate([200, 200, 200, 500]);
    } else {
      Vibration.vibrate([200, 500]);
    }

    DisconnectedNotification();
    removeSubscriptions();
    setShowStatusLoading(false);
    setStatusText("Disconnected");
    // setDropMessageText('You have disconnected from the device.');
    // dropIn();
  };

  const onDeviceDisconnect = async (error, device) => {
    setReconnected(false);
    setConnected(false);
    if (error) {
      log("HOME", `ERROR when device disconnected, device - ${device ? device.id : null}. error: ${error}`);
      setModalError(true);
      setModalText(getErrorText(error));
      setModalVisible(true);
    } else {
      BluetoothManager = recreateManager(BluetoothManager);
      setDropMessageText('Disconnected. Attempting to reconnect...');
      setDropMessageButtonText("");
      dropIn();
      for (timer of timerList) {
        BackgroundTimer.clearInterval(timer);
      }
      DisconnectedNotification();
      playDisconnectSound();
      BackgroundTimer.
      scanForDevices(BluetoothManager, 7000, async (devices) => {
        let scannedDevices = devices.scannedDevices;
        let targetDeviceId = device.id;
        console.log(targetDeviceId);
        for (d of scannedDevices) {
          console.log(device.id, device.name, device.id == targetDeviceId);
          if (d.id == targetDeviceId) {
            BluetoothManager.stopDeviceScan();
            clearTimeout(devices.stopTimer);
            setDropMessageText('Found device. connecting...');
            setDropMessageButtonText("");
            dropIn();
            let result = await connectToDevice(device, BluetoothManager);
            console.log(result);
            if (result) {
              setDropMessageText('Reconnected successfully!');
              setDropMessageButtonText("");
              dropIn();
              setConnected(true);
              setReconnected(true);
              BluetoothDevice = result;
              sendDeviceSignal('home');
              try {
                setDisconnectMonitor(
                  BluetoothManager.onDeviceDisconnected(
                    BluetoothDevice.id,
                    onDeviceDisconnect,
                  ),
                );
              } catch (error) {
                log("HOME", `ERROR when tried creating a disconnect listener. error: ${error}`);
              }

              try {
                setReadMonitor(
                  BluetoothManager.monitorCharacteristicForDevice(
                    BluetoothDevice.id,
                    'FFE0',
                    'FFE1',
                    monitorDeviceData,
                  ),
                );
              } catch (error) {
                log("HOME", `ERROR when tried creating a received data listener. error: ${error}`);
              }
            } else if (!connected && !reconnected) {
              setDropMessageText('Couldn\'t reconnect.');
              setDropMessageButtonText('Connect');
              dropIn();
              handleDisconnect(device);
            }
          }
        }
      }, e => { log("HOME", `ERROR when tried to reconnect to device. (e: ${e})`); handleDisconnect(device); }, async () => {
        console.log("DONE", connected, reconnected);
        if (!reconnected && !connected && !await BluetoothManager.isDeviceConnected(BluetoothDevice.id)) {
          setDropMessageText('Couldn\'t find device.');
          setDropMessageButtonText('Connect');
          dropIn();
          handleDisconnect(device);
        }
      });

    }
  };

  useEffect(() => {
    if (statusText == undefined) {
      if (connected) {
        setStatusText("Connected");
      } else {
        setStatusText("Disconnected");
      }
    }
  }, [statusText]);

  useEffect(() => {
    let mounted = true;

    if (mounted) {
      setStatusText(connected ? "Connected" : "Disconnected");
    }

    return () => {
      mounted = false;
    };
  }, [connected]);


  useEffect(() => {
    let mounted = true;

    log("HOME", `Loading home screen.`);



    if (Platform.OS === 'android' && Platform.Version <= 19) {
      log("HOME", `Android version too low (${Platform.Version})`);
      setModalError(true);
      setModalText(
        "You have to update your Android version to use this app. It's not supported on Android API versions below 19. You have API version " + Platform.Version,
      );
      setModalVisible(true);
    } else if (Platform.OS === 'ios' && Platform.Version <= 9) {
      log("HOME", `IOS version too low (${Platform.Version})`);
      setModalError(true);
      setModalText(
        "You have to update your iOS version to use this app. It's not supported on iOS versions below 9.",
      );
    }

    storeData();

    getData('@factor')
      .then(value => {
        if (value != null && value != undefined && mounted) {
          setFactor(parseFloat(JSON.parse(value)));
        }
      })
      .catch(error => log("HOME", `ERROR when tried getting factor data. error: ${error}`));

    getData('@wheels')
      .then(value => {
        if (mounted) {
          if (value != null && value != undefined) {
            setWheels(parseFloat(JSON.parse(value)));
          } else {
            setWheels(1);
          }
        }
      })
      .catch(error => log("HOME", `ERROR when tried getting factor data. error: ${error}`));

    getData('@wantedPsi')
      .then(value => {
        if (value != null && value != undefined && mounted) {
          setWantedPsi(parseInt(JSON.parse(value)));
        }
      })
      .catch(error => log("HOME", `ERROR when tried getting wanted psi data. error: ${error}`));

    if (disconnectMonitor) {
      log("HOME", `Removing disconnect listener.`);
      disconnectMonitor.remove();
      setDisconnectMonitor(null);
    }

    if (readMonitor) {
      log("HOME", `Removing received data listener.`);
      readMonitor.remove();
      setReadMonitor(null);
    }

    if (
      route != null &&
      route != undefined &&
      route.params != null &&
      route.params != undefined
    ) {
      log("HOME", `Passed route checks.`);

      if (
        route.params.device != null &&
        route.params.device != undefined &&
        route.params.manager != null &&
        route.params.manager != undefined
      ) {

        log("HOME", `Passed params checks. params: ${route.params}`);
        BluetoothManager = route.params.manager;
        BluetoothDevice = route.params.device;

        if (BluetoothDevice && BluetoothDevice.id) {
          BluetoothManager.isDeviceConnected(BluetoothDevice.id)
            .then(isConnected => {
              if (!mounted) {
                return;
              }

              if (isConnected) {
                setConnected(true);
                setStatusText('Connected');
                log("HOME", `Device ${BluetoothDevice ? BluetoothDevice.id : null} is connected.`);
                log("HOME", `Creating disconnect and received data listeners.`);

                if (BluetoothDevice && BluetoothManager) {
                  log("HOME", `Sending arduino screen status`);
                  sendDeviceSignal('home');
                }

                try {
                  setDisconnectMonitor(
                    BluetoothManager.onDeviceDisconnected(
                      BluetoothDevice.id,
                      onDeviceDisconnect,
                    ),
                  );
                } catch (error) {
                  log("HOME", `ERROR when tried creating a disconnect listener. error: ${error}`);
                }

                try {
                  setReadMonitor(
                    BluetoothManager.monitorCharacteristicForDevice(
                      BluetoothDevice.id,
                      'FFE0',
                      'FFE1',
                      monitorDeviceData,
                    ),
                  );
                } catch (error) {
                  log("HOME", `ERROR when tried creating a received data listener. error: ${error}`);
                }

              }
            })
            .catch(error => {
              log("HOME", `ERROR when tried to check connection status. error: ${error}`);
            });
        } else {
          BluetoothDevice = null;
          log("HOME", "Set device to null because the BluetoothDevice param is null or it's ID is.");
        }

        DEVICE_SERVICE_UUID = route.params.serviceUUID;
        DEVICE_CHARACTERISTICS_UUID = route.params.characteristicsUUID;
      } else {
        BluetoothDevice = null;
        log("HOME", "Set device to null because the BluetoothDevice param is null or the manager is.");
      }
    }
    ;



    return () => {
      mounted = false;
      // navListener();
    };
  }, [route]);

  const checkPermission = () => {
    if (I18nManager.isRTL) {
      AsyncStorage.setItem('@restarted', "false");
    }

    if (Platform.OS === 'android') {
      check(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT)
        .then(data => {
          if (
            data != 'granted' &&
            Platform.OS == 'android' &&
            Platform.constants['Release'] > 11
          ) {
            if (permTimer) {
              clearInterval(permTimer);
              permTimer = null;
            }

            log("HOME", `Permission requirement (${PERMISSIONS.ANDROID.BLUETOOTH_CONNECT}) not met.`);
            return navigation.navigate("Permissions");


          }
        })
        .catch(error => log("HOME", `ERROR when tried checking permission ${PERMISSIONS.ANDROID.BLUETOOTH_CONNECT}. error: ${error}`));

      check(PERMISSIONS.ANDROID.BLUETOOTH_SCAN)
        .then(data => {
          if (
            data != 'granted' &&
            Platform.OS == 'android' &&
            Platform.constants['Release'] > 11
          ) {
            if (permTimer) {
              clearInterval(permTimer);
              permTimer = null;
            }

            log("HOME", `Permission requirement (${PERMISSIONS.ANDROID.BLUETOOTH_SCAN}) not met.`);
            return navigation.navigate("Permissions");

          }
        })
        .catch(error => log("HOME", `ERROR when tried checking permission ${PERMISSIONS.ANDROID.BLUETOOTH_SCAN}. error: ${error}`));

      check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION)
        .then(data => {
          if (data != 'granted') {
            if (permTimer) {
              clearInterval(permTimer);
              permTimer = null;
            }

            log("HOME", `Permission requirement (${PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION}) not met.`);
            return navigation.navigate("Permissions");

          }
        })
        .catch(error => log("HOME", `ERROR when tried checking permission ${PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION}. error: ${error}`));

      BluetoothStateManager.getState()
        .then(data => {
          if (data != 'PoweredOn') {
            if (permTimer) {
              clearInterval(permTimer);
              permTimer = null;
            }

            log("HOME", `Permission requirement (BLUETOOTH_STATUS) not met.`);
            return navigation.navigate("Permissions");

          }
        })
        .catch(error => log("HOME", `ERROR when tried checking permission BLUETOOTH_STATUS. error: ${error}`));

    } else {
      check(PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL)
        .then(data => {
          if (data != 'granted') {
            navigation.dispatch(StackActions.replace('Permissions'));
            if (permTimer) {
              clearInterval(permTimer);
              permTimer = null;
            }
          }
        })
        .catch(err => log("HOME", 'error checking perm1:', err));

      check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE)
        .then(data => {
          if (data != 'granted') {
            navigation.dispatch(StackActions.replace('Permissions'));
            if (permTimer) {
              clearInterval(permTimer);
              permTimer = null;
            }
          }
        })
        .catch(err => log("HOME", 'error checking perm1:', err));

      BluetoothStateManager.getState()
        .then(data => {
          if (data != 'PoweredOn') {
            navigation.dispatch(StackActions.replace('Permissions'));
            if (permTimer) {
              clearInterval(permTimer);
              permTimer = null;
            }
          }
        })
        .catch(err => log("HOME", 'error checking perm1:', err));
    }
    return "good";
  };


  navigation.addListener('blur', e => {
    exitApp();
  });

  useEffect(() => {

    log("HOME", `Initializing permission check loop`);
    let appStateListener = AppState.addEventListener('change', handleAppInBackground);


    if (!permTimer) {
      permTimer = BackgroundTimer.setInterval(() => {
        checkPermission();
      }, 500);
    }

    const ShortcutsEmitter = new NativeEventEmitter(Shortcuts);
    let shortcutListener = ShortcutsEmitter.addListener("onShortcutItemPressed", handleShortcut);

    if (!connected) {

      BluetoothManager = recreateManager(BluetoothManager);


      AsyncStorage.getItem("@personalDeviceId").then((data) => {
        if (data) {
          setDropMessageText('connecting to previously connected device...');
          setDropMessageButtonText("");
          dropIn();
          scanForDevices(BluetoothManager, 5000, async (devices) => {
            let scannedDevices = devices.scannedDevices;
            let targetDeviceId = data;
            for (d of scannedDevices) {
              if (d.id == targetDeviceId) {
                BluetoothManager.stopDeviceScan();
                clearTimeout(devices.stopTimer);
                setDropMessageText('Found device. connecting...');
                setDropMessageButtonText("");
                dropIn();
                let result = await connectToDevice(d, BluetoothManager);
                if (result) {
                  setDropMessageText('Reconnected successfully!');
                  setDropMessageButtonText("");
                  dropIn();
                  setConnected(true);
                  setReconnected(true);
                  BluetoothDevice = result;
                  sendDeviceSignal('home');
                  try {
                    setDisconnectMonitor(
                      BluetoothManager.onDeviceDisconnected(
                        BluetoothDevice.id,
                        onDeviceDisconnect,
                      ),
                    );
                  } catch (error) {
                    log("HOME", `ERROR when tried creating a disconnect listener. error: ${error}`);
                  }
                  try {
                    setReadMonitor(
                      BluetoothManager.monitorCharacteristicForDevice(
                        BluetoothDevice.id,
                        'FFE0',
                        'FFE1',
                        monitorDeviceData,
                      ),
                    );
                  } catch (error) {
                    log("HOME", `ERROR when tried creating a received data listener. error: ${error}`);
                  }
                } else if (!connected && !reconnected) {
                  setDropMessageText('Couldn\'t reconnect.');
                  setDropMessageButtonText('Connect');
                  dropIn();
                }
              }
            }
          }, () => { }, () => {
            setDropMessageText('Couldn\'t find device!');
            setDropMessageButtonText('Connect');
            dropIn();
          });
        }
      });
    }

    return () => {
      BackgroundTimer.clearInterval(permTimer);
      appStateListener.remove();
      shortcutListener.remove();
    };
  }, []);

  // useEffect(() => {
  //   if (!imHereTimer && connected) {
  //     imHereTimer = BackgroundTimer.setInterval(async () => {
  //       if (BluetoothManager && BluetoothDevice) {
  //         BluetoothManager.isDeviceConnected(BluetoothDevice.id).then(
  //           isConnected => {
  //             if (!isConnected) {
  //               BackgroundTimer.clearInterval(imHereTimer);
  //               imHereTimer = null;
  //             }
  //           }
  //         ).catch();
  //       }
  //       sendDeviceSignal("here");
  //     }, 3000);
  //   }
  // }, [connected]);


  const sendDeviceSignal = async signal => {
    let base64Signal = Buffer.from(startChar + signal + endChar).toString(
      'base64',
    );
    log("HOME", `Sending data (${signal}-${base64Signal}) to device - ${BluetoothDevice ? BluetoothDevice.id : null}`);
    return BluetoothManager.writeCharacteristicWithoutResponseForDevice(
      BluetoothDevice.id,
      'FFE0',
      'FFE1',
      base64Signal,
    )
      .then(d => {
        setAllMessagesSentByDevice(oldArray => [...oldArray, signal]);
        return d;
      })
      .catch(error => {
        log("HOME", `ERROR when tried sending data (${signal}) to device - ${BluetoothDevice ? BluetoothDevice.id : null}. error: ${error}`);
        setModalError(true);
        setModalText(getErrorText(error));
        setModalVisible(true);
        return error;
      });
  };

  const sendAllData = async (wantedPsi, factor, wheels=1) => {
    log("HOME", `Sending all data to device - ${BluetoothDevice ? BluetoothDevice.id : null}. data: {${parseFloat(wantedPsi).toFixed(1)},${parseFloat(factor).toFixed(1)}}`);
    await sendDeviceSignal(`{${wantedPsi},${parseFloat(factor).toFixed(1)},${wheels}}`);
  };

  const removeSubscriptions = () => {
    log("HOME", `Removing all subscriptions.`);

    if (readMonitor) {
      log("HOME", `Removing received data listener.`);
      readMonitor.remove();
      setReadMonitor(null);

    }

    if (disconnectMonitor) {
      log("HOME", `Removing device disconnect listener.`);
      disconnectMonitor.remove();
      setDisconnectMonitor(null);

    }


    if (BluetoothManager != null) {
      for (const [, val] of Object.entries(BluetoothManager._activeSubscriptions)) {
        try {
          BluetoothManager._activeSubscriptions[val].remove();
        } catch (error) { }
      }
      try {
        for (const [, val] of Object.entries(
          BluetoothDevice._manager._activeSubscriptions,
        )) {
          try {
            BluetoothDevice._manager._activeSubscriptions[val].remove();
          } catch (error) { }
        }
      } catch (error) { }
    }
  };

  const doneStatus = async () => {
    log("HOME", `Done with current operation!`);
    setIsDone(true);
  };

  useEffect(() => {
    if (isDone) {
      LocalNotification(wantedPsi);
      setTimeout(() => {

        Vibration.vibrate([0, 1000, 1000, 1000, 1000, 1000, 1000, 1000]);
      }, 1000);
      playDoneSound();
    }
  }, [isDone]);


  const handleStatusId = async (startTime, statusId) => {
    log("HOME", `Started operation: ${StatusIdMap[statusId]} that will last: ${startTime}s`);
    // await AsyncStorage.setItem("@lastSave", "null");
    // if (statusId == prevStatusId) {
    //   prevStatusId = statusId;
    //   return;
    // }
    prevStatusId = statusId;

    for (timer of timerList) {
      BackgroundTimer.clearInterval(timer);
    }

    if (statusId == -1) {
      if (connected) {
        setStatusText("Connected");
      } else {
        setStatusText("Disconnected");
      }
      return;
    }

    startTime -= 2;

    if (startTime == -3) {
      setStatusText(StatusIdMap[statusId]);
      setShowStatusLoading(false);
      if (statusId == 3) {
        setStatusText('DONE');
        for (timer of timerList) {
          BackgroundTimer.clearInterval(timer);
        }
        doneStatus();
      } else {
        setStatusText('Connected');
      }
      return;
    } else {
      startTime = startTime + 2;
    }
    let x = 0;
    setStatusText(
      `${StatusIdMap[statusId]}: ${startTime - x >= 0 ? startTime - x : 0}s`,
    );
    setShowStatusLoading(true);
    timerList.push(
      BackgroundTimer.setInterval(() => {
        setStatusText(
          `${StatusIdMap[statusId]}: ${startTime - x >= 0 ? startTime - x : 0
          }s`,
        );

        if (++x === startTime) {
          for (timer of timerList) {
            clearInterval(timer);
          }
        }
      }, 1000),
    );
  };

  const monitorDeviceData = (error, data) => {
    if (error) {
      log("HOME", `ERROR when tried reading device data. error: ${error}`);
      setModalError(true);
      setModalText(getErrorText(error));
      setModalVisible(true);
      return null;
    }

    data = Buffer.from(data.value, 'base64').toString();
    log("HOME", `Got raw data from device - ${data}`);

    if (data != 'SUCCESS CONNECT') {
      data = data.substring(data.indexOf(startChar) + 1, data.indexOf("]") + 1);
      log("HOME", `Filtered data - ${data}`);
    }

    log("HOME", `Validating data sent:\n\t1. Duplicate message: ${allMessagesSentByDevice.includes(data)}\n\t2. Message empty: ${data == '~^' && data == '' && data == '~DATA WAS READ^' && data[0] != '['}\n\t3. Valid Data: ${isValidData(data)}`);

    if (
      !allMessagesSentByDevice.includes(data) &&
      data != '~^' &&
      data != '' &&
      data != '~DATA WAS READ^' &&
      data[0] == '[' &&
      isValidData(data)
    ) {

      let dataArray = JSON.parse(data);
      log("HOME", "Length of data: " + dataArray.length);
      if (dataArray.length == 5) {
        handleStatusId(dataArray[1], dataArray[0]);
        setTirePressure(dataArray[2]);
        setLowBattery(dataArray[4]);
      } else if (dataArray.length == 2) {
        log("HOME", "Got pressure from arduino: " + dataArray[1]);
        sendDeviceSignal("gp");
        if (dataArray[1] != "-1" && dataArray[1] <= MAX_PSI) {
          setWantedPsi(dataArray[1]);
          // Got Pressure
        }
      }
    }
  };

  const dropIn = () => {
    if (dropInTimer) {
      clearTimeout(dropInTimer);
    }
    Animated.timing(dropAnim, {
      toValue: 50,
      duration: 500,
      useNativeDriver: false,
    }).start();
    dropInTimer = setTimeout(() => {
      Animated.timing(dropAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }, 10000);
  };

  useEffect(() => {
    if (wantedPsi != 3) {
      setData('@wantedPsi', JSON.stringify(wantedPsi));
    }
  }, [wantedPsi]);

  return (

    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{
        minHeight: '100%',
      }}>
        <FocusedStatusBar backgroundColor={COLORS.primary} />

        <Modal
          animationType="slide"
          transparent={true}
          visible={pickerModalVisible}
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
                  Set PSI
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
                  data={PSI_OPTIONS}
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
                    setPsiIndex(index);
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
                      setWantedPsi(PSI_OPTIONS[psiIndex]);
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
          <ScrollView nestedScrollEnabled
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
                shadowColor: '#000',
                shadowOffset: {
                  width: 0,
                  height: 3,
                },
                shadowOpacity: 0.27,
                shadowRadius: 4.65,

                elevation: 6,
              },
            },
            {
              height: dropAnim,
            },
          ]}>
          <View
            style={{
              flexDirection: 'row',
            }}>
            <Text
              style={{
                color: 'white',
              }}>
              {dropMessageText}
            </Text>
            <Text
              style={{
                textDecorationLine: 'underline',
                marginLeft: '5%',
                color: 'white',
              }}
              onPress={() => {
                Animated.timing(dropAnim, {
                  toValue: 0,
                  duration: 1,
                  useNativeDriver: false,
                }).start();
                removeSubscriptions();
                navigation.navigate('Settings', {
                  device: BluetoothDevice,
                  serviceUUID: DEVICE_SERVICE_UUID,
                  characteristicsUUID: DEVICE_CHARACTERISTICS_UUID,
                  startConnect: true,
                  connectToDevice: false,
                  manager: BluetoothManager,
                });
              }}>
              {dropMessageButtonText}
            </Text>
          </View>
        </Animated.View>
        {/* Settings Button */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: "5%",
            paddingTop: "2%",
            position: 'relative',
            width: '100%',
            height: "20%",
            marginBottom: '1%'
          }}>


          <TouchableOpacity
            disabled={showStatusLoading}
            style={{
              borderRadius: 50,
              alignItems: 'center',
              justifyContent: 'center',
              width: isPortraitOrientation ? "15%" : "7%",
              aspectRatio: 1,
            }}
            onPressOut={() => {
              if (!showStatusLoading) {
                removeSubscriptions();
                log("HOME", `Going to settings via cog icon`);
                navigation.navigate('Settings', {
                  device: BluetoothDevice,
                  serviceUUID: DEVICE_SERVICE_UUID,
                  characteristicsUUID: DEVICE_CHARACTERISTICS_UUID,
                  startConnect: false,
                  connectToDevice: false,
                  manager: BluetoothManager,
                });
              }
            }}>
            <Image
              key={new Date().getTime()}
              source={showStatusLoading ? require('../assets/icons/cog_disabled.png') : require('../assets/icons/cog.png')}
              resizeMode="contain"
              style={{
                width: '100%',
                height: undefined,
                aspectRatio: 1,
              }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              width: isPortraitOrientation ? "50%" : "30%",
              height: isPortraitOrientation ? '50%' : "100%",
              justifyContent: 'center',
              alignItems: 'center',
              top: isPortraitOrientation ? "18%" : "2%",
            }}
            onPress={async () => {
              log("HOME", `OnAir button pressed`);

              if (BluetoothDevice != null) {
                try {
                  let isConnected = await BluetoothManager.isDeviceConnected(BluetoothDevice.id);
                  if (!isConnected) {
                    log("HOME", `Bluetooth device - ${BluetoothDevice ? BluetoothDevice.id : null} not connected`);
                    log("HOME", `Attempting to connect...`);
                    let device = false;//connectToDevice(BluetoothDevice, BluetoothManager);
                    if (!device) {
                      log("HOME", `Connection attempt failed!`);
                      setConnected(false);
                    } else {
                      BluetoothDevice = device;
                      log("HOME", `Connection attempt succeeded!`);
                      setConnected(true);
                    }

                  }
                } catch (error) {
                  log("HOME", `ERROR when tried checking connection status for bluetooth device - ${BluetoothDevice ? BluetoothDevice.id : null}. error: ${error}`);
                }

                if (connected) {
                  log("HOME", `Bluetooth device - ${BluetoothDevice ? BluetoothDevice.id : null} is connected`);
                  sendAllData(wantedPsi, factor, wheels);
                  if (isDone) {
                    log("HOME", `Turned off done status`);
                    setIsDone(false);
                  }
                } else {
                  if (JSON.stringify(dropAnim)) {

                    log("HOME", `Device - ${BluetoothDevice ? BluetoothDevice.id : null} is not connected`);
                    log("HOME", `Attempting to connect...`);
                    let device = false; //connectToDevice(BluetoothDevice, BluetoothManager);
                    if (!device) {
                      log("HOME", `Connection attempt failed!`);
                      setConnected(false);
                      dropIn();
                      setDropMessageText('You are not connected to the device.');
                      setDropMessageButtonText('Connect');
                    } else {
                      BluetoothDevice = device;
                      log("HOME", `Connection attempt succeeded!`);
                      setConnected(true);
                    }
                  }
                }
              } else {
                if (JSON.stringify(dropAnim)) {
                  setDropMessageText('You are not connected to the device.');
                  setDropMessageButtonText('Connect');
                  dropIn();
                  log("HOME", "Device is null");
                }
              }
            }}>

            <Image
              source={require('../assets/icons/logo.png')}
              resizeMode="center"
              style={{
                width: '100%',
                height: "100%",
              }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              alignItems: 'center',
              width: isPortraitOrientation ? "15%" : "7%",
              aspectRatio: 1,
              position: "relative",
            }}
            onPressOut={() => {
              log("HOME", `Going to about me via the about me button`);
              navigation.navigate('AboutMe');
            }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center'
            }}>

              <Image
                key={new Date().getTime()}
                source={require('../assets/icons/aboutme.png')}
                resizeMode="contain"
                style={{
                  width: '100%',
                  height: undefined,
                  aspectRatio: 1,

                }}
              />

              <Image
                key={1233464567}
                source={require('../assets/icons/low_battery.png')}
                resizeMode="contain"
                style={{
                  width: lowBattery ? '70%' : 0,
                  height: undefined,
                  aspectRatio: 1,
                  position: "absolute",
                  left: "-100%"
                }}
              />

            </View>
          </TouchableOpacity>
        </View>


        {/* BODY */}

        {/* TIRE TEXT */}

        <View
          style={{
            backgroundColor: '#242424',
            width: '100%',
            height: '12%',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-around',
            paddingHorizontal: '5%',
            ...SHADOWS.extraDark,
          }}>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{ fontSize: isPortraitOrientation ? 2 * (winWidth / 18) : 2 * (winWidth / 30), color: 'white', marginLeft: isPortraitOrientation ? 0 : '25%', }}>
            TIRE
          </Text>

          <View style={{
            marginRight: isPortraitOrientation ? 0 : '25%',
          }}>
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={{
                backgroundColor: '#1B1B1B',
                textAlign: 'center',
                textAlignVertical: 'center',
                paddingHorizontal: '7%',
                paddingVertical: '2%',
                borderRadius: 2 * (winWidth / 25),
                color: 'white',
                fontSize: isPortraitOrientation ? 2 * (winWidth / 18) : 2 * (winWidth / 60),

              }}>
              {connected ? Math.round(tirePressure * 2) / 2 >= 0 ? Math.round(tirePressure * 2) / 2 : 0 : "N/A"}
            </Text></View>
        </View>

        {/* SET GROUP */}
        <View
          style={{
            marginTop: isPortraitOrientation ? '2%' : '1%',
            backgroundColor: '#242424',
            width: '100%',
            height: isPortraitOrientation ? '20%' : "25%",
            flexDirection: 'column',
            justifyContent: 'center',
            paddingHorizontal: '5%',
            ...SHADOWS.extraDark,
          }}>
          {/* SET TEXT */}

          <View style={{
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <View style={{
              flexDirection: 'row', height: '50%',
              justifyContent: isPortraitOrientation ? 'space-around' : 'space-between',
              alignItems: 'flex-end'
            }}>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={{
                  color: 'white',
                  height: '100%',
                  textAlignVertical: 'center',
                  marginLeft: isPortraitOrientation ? 0 : '32%',
                  fontSize: isPortraitOrientation ? 2 * (winWidth / 18) : 2 * (winWidth / 30)
                }}>SET</Text>
              <TouchableOpacity
                disabled={showStatusLoading}
                onPress={() => {
                  log("HOME", `Opening picker modal`);
                  setPickerModalVisible(true);
                }}
                style={{
                  height: '100%',
                  justifyContent: 'center',
                  marginRight: isPortraitOrientation ? 0 : '32%',
                }}>

                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={{
                    backgroundColor: '#1B1B1B',
                    borderRadius: 2 * (winWidth / 25),
                    height: '100%',
                    textAlign: 'center',
                    textAlignVertical: 'center',
                    paddingHorizontal: '7%',
                    paddingVertical: '2%',
                    color: 'white',
                    fontSize: 2 * (winWidth / 18)
                  }}>
                  {wantedPsi}
                </Text>
              </TouchableOpacity>

            </View>
            <View style={{
              flexDirection: 'row',
              height: '45%',
              justifyContent: 'space-around',
              alignItems: 'flex-end'
            }}>
              <TouchableOpacity
                disabled={showStatusLoading}
                onPressOut={
                  () => {
                    Vibration.vibrate([0, 5]);
                    getData('@roadPreset')
                      .then(data => data)
                      .then(value => {
                        if (value) {
                          log("HOME", `Road Preset button pressed! value: ${value}`);
                          setWantedPsi(parseInt(value));
                        }
                      })
                      .catch(error => log("HOME", `ERROR when tried getting road preset value. error: ${error}`));
                  }
                }
                style={{
                  width: "20%",
                  height: "60%",
                  backgroundColor: showStatusLoading ? '#656769' : '#489143',
                  borderRadius: 10
                }}>
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={[{
                    textAlignVertical: 'center',
                    textAlign: 'center',
                    height: "100%",
                    color: 'white',
                  }, !isPortraitOrientation && {
                    fontSize: 2 * (winWidth / 90)
                  }]
                  }>ROAD</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={showStatusLoading}
                onPressOut={
                  () => {
                    Vibration.vibrate([0, 5]);
                    getData('@trailPreset')
                      .then(data => data)
                      .then(value => {
                        if (value) {
                          log("HOME", `Trail Preset button pressed! value: ${value}`);
                          setWantedPsi(parseInt(value));
                        }
                      })
                      .catch(error => log("HOME", `ERROR when tried getting trail preset value. error: ${error}`));
                  }
                }
                style={{
                  width: "20%",
                  height: "60%",
                  backgroundColor: showStatusLoading ? '#656769' : '#489143',
                  borderRadius: 10
                }}>
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={[{
                    textAlignVertical: 'center',
                    textAlign: 'center',
                    height: "100%",
                    color: 'white',
                  }, !isPortraitOrientation && {
                    fontSize: 2 * (winWidth / 90)
                  }]} > TRAIL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={showStatusLoading}

                onPressIn={() => downPressPlus(wantedPsi, setWantedPsi)}
                onPressOut={() => upPressPlus(wantedPsi, setWantedPsi)}

                style={{
                  width: "20%",
                  height: '60%',
                  backgroundColor: showStatusLoading ? '#656769' : '#116AC1',
                  borderRadius: 10
                }}>
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={{
                    width: "100%",
                    height: "100%",
                    fontSize: isPortraitOrientation ? 2 * (winWidth / 30) : 2 * (winWidth / 90),
                    fontWeight: "bold",
                    borderRadius: 10, textAlign: 'center',
                    textAlignVertical: 'center',
                    color: 'white'
                  }}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={showStatusLoading}
                onPressIn={() => downPressMinus(wantedPsi, setWantedPsi)}
                onPressOut={() => upPressMinus(wantedPsi, setWantedPsi)}
                style={{
                  width: "20%",
                  height: '60%',
                  backgroundColor: showStatusLoading ? '#656769' : '#116AC1',
                  borderRadius: 10,
                  justifyContent: 'center'
                }}>
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={{
                    fontSize: isPortraitOrientation ? 2 * (winWidth / 30) : 2 * (winWidth / 90),
                    textAlignVertical: 'center',
                    height: "100%",
                    color: 'white',
                    textAlign: 'center',
                    width: "100%", fontWeight: "bold",
                  }}>-</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* STATUS TEXT */}
        <View
          style={{
            backgroundColor: '#242424',
            width: '100%',
            height: '12%',
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-around',
            marginTop: isPortraitOrientation ? '2%' : '1%',
            ...SHADOWS.extraDark,
            paddingHorizontal: isPortraitOrientation ? "2%" : "32%",
          }}>
          <View style={{
            width: "25%",
          }}>
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={{ fontSize: isPortraitOrientation ? 2 * (winWidth / 30) : 2 * (winWidth / 60), color: 'white', }}>
              STATUS
            </Text>
          </View>
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'flex-end',
              width: '70%',
              paddingLeft: '5%',
              height: '100%',
            }}>
            {showStatusLoading && isPortraitOrientation ? (
              <ActivityIndicator
                size="large"
                color="#fff"
                style={{
                  width: 30,
                  height: 30,
                  marginRight: 20,
                }}
              />
            ) : null}

            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={{
                backgroundColor: '#1B1B1B',
                textAlign: 'center',
                maxWidth: winWidth - (winWidth * 0.30) - 50,
                textAlignVertical: 'center',
                paddingHorizontal: '7%',
                paddingVertical: '2%',
                borderRadius: 2 * (winWidth / 25),
                color: 'white',
                fontSize: isPortraitOrientation ? 2 * (winWidth / 30) : 2 * (winWidth / 60),
              }}>
              {statusText != "Disconnected" && statusText != "Connected" ? statusText : connected ? "Connected" : "Disconnected"}
            </Text>
          </View>
        </View>
        <View style={{
          width: '100%',
          height: '15%',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: isPortraitOrientation ? '5%' : "-2%",
        }}>
          <View
            style={{
              width: '75%',
              height: '100%',
              borderRadius: 2 * (winWidth / 16.666),
              borderColor: isDone ? '#2D9626' : '#545454',
              borderWidth: 1,
              marginTop: '10%',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text
              style={{
                fontSize: isPortraitOrientation ? 2 * (winWidth / 20) : 2 * (winWidth / 40),
                color: isDone ? '#2D9626' : '#545454',
                fontWeight: 'bold',
                textAlign: 'center',
                textAlignVertical: 'center',
              }}>
              DONE
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Home;
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
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import ValuePicker from 'react-native-picker-horizontal';
import { check, PERMISSIONS } from 'react-native-permissions';
import BluetoothStateManager from 'react-native-bluetooth-state-manager';
import { LocalNotification } from '../services/LocalPushController'
import { FocusedStatusBar } from '../components';
import { COLORS, SHADOWS } from '../constants';
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Sound from 'react-native-sound';
import DeviceInfo from 'react-native-device-info';
import BackgroundTimer from 'react-native-background-timer';
import { log } from '../services/logs'
import { StackActions } from '@react-navigation/native';


let permTimer = null;
let timer = null;
let waitTimer = null;
let BT05_DEVICE = null;
let MANAGER = null;
let DEVICE_SERVICE_UUID = null;
let DEVICE_CHARACTERISTICS_UUID = null;
let MIN_FACTOR = 3;
const MAX_PSI = 50;
const MIN_PSI = 3;
const PSI_OPTIONS = Array(48)
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
  let beep = new Sound('beep_long.mp3', Sound.MAIN_BUNDLE, error => {
    if (error) {
      log("HOME", 'failed to load the sound', error);
      return;
    }
    // loaded successfully
    beep.play(success => {
      if (success) {
        log("HOME", 'successfully finished playing');
        BackgroundTimer.setTimeout(() => {
          beep.play(success => {
            if (success) {
              log("HOME", 'successfully finished playing');
              BackgroundTimer.setTimeout(() => {
                beep.play(success => {
                  if (success) {
                    log("HOME", 'successfully finished playing');
                    BackgroundTimer.setTimeout(() => {
                      beep.play(success => {
                        if (success) {
                          log("HOME", 'successfully finished playing');
                        } else {
                          log("HOME",
                            'playback failed due to audio decoding errors',
                          );
                        }
                      });
                    }, 1000);
                  } else {
                    log("HOME", 'playback failed due to audio decoding errors');
                  }
                });
              }, 1000);
            } else {
              log("HOME", 'playback failed due to audio decoding errors');
            }
          });
        }, 1000);
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
      log("HOME", 'WAIT TIME OVER');
      if (timer === null) {
        timer = setInterval(() => {
          setCounter(counter => counter + (counter < MAX_PSI ? 1 : 0));
        }, 75);
      }
    }, 700);
  }
};

const upPressPlus = (currentCounter, setCounter) => {
  if (currentCounter <= MAX_PSI) {
    clearInterval(timer);
    clearTimeout(waitTimer);
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
      if (timer === null) {
        timer = setInterval(() => {
          setCounter(counter => counter - (counter > MIN_PSI ? 1 : 0));
        }, 75);
      }
    }, 700);
  }
};

const upPressMinus = (currentCounter, setCounter) => {
  if (currentCounter >= MIN_PSI) {
    clearInterval(timer);
    clearTimeout(waitTimer);
    timer = null;
    if (currentCounter > MIN_PSI) {
      setCounter(counter => counter - 1);
    }
    waitTimer = null;
  }
};

const getData = async key => {
  try {
    const data = await AsyncStorage.getItem(key);
    if (data !== null) {
      // log("HOME", 'data: ' + data);
      // log("HOME", 'type data:', typeof data);
      return data;
    }
  } catch (error) {
    log("HOME", error);
  }
};

const setData = async (key, value) => {
  try {
    let t = await AsyncStorage.setItem(key, value);
  } catch (error) {
    log("HOME", error);
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
  return (
    errorMap[error.errorCode] ??
    'Unknown error occurred [custom]. (Please try again) info: ' +
    JSON.stringify(error)
  );
};

const isValidData = data => {
  for (let char of data) {
    if (
      'abcdefghijklmnopqrstuvwxyz1234567890"[].,-'.includes(char)
    ) {
      continue;
    } else {
      return false;
    }
  }
  return true;
};

const storeData = async () => {
  if (!JSON.parse(await AsyncStorage.getItem('@factor'))) {
    try {
      await AsyncStorage.setItem('@factor', JSON.stringify(3.5));
    } catch (error) {
      log("HOME", 'ERROR SAVING FACTOR', error);
    }
  }

  if (!JSON.parse(await AsyncStorage.getItem('@wantedPsi'))) {
    try {
      await AsyncStorage.setItem('@wantedPsi', JSON.stringify(3));
    } catch (error) {
      log("HOME", 'ERROR SAVING WANTED PSI', error);
    }
  }

  log("HOME", 'road:', JSON.parse(await AsyncStorage.getItem('@roadPreset')));

  if (!JSON.parse(await AsyncStorage.getItem('@roadPreset'))) {
    try {
      await AsyncStorage.setItem('@roadPreset', JSON.stringify(32));
    } catch (error) {
      log("HOME", 'ERROR SAVING ROAD PRESET', error);
    }
  }
  log("HOME", !(await AsyncStorage.getItem('@trailPreset')));
  if (!JSON.parse(await AsyncStorage.getItem('@trailPreset'))) {
    try {
      log("HOME", 'Storing data - trailPreset');
      await AsyncStorage.setItem('@trailPreset', JSON.stringify(16));
    } catch (error) {
      log("HOME", 'ERROR SAVING TRAIL PRESET', error);
    }
  }

  if (!JSON.parse(await AsyncStorage.getItem('@btImage'))) {
    try {
      await AsyncStorage.setItem('@BtImage', JSON.stringify(null));
    } catch (error) {
      log("HOME", 'ERROR SAVING BtImage', error);
    }
  }
};

const Home = ({ navigation, route }) => {

  const [wantedPsi, setWantedPsi] = useState(MIN_PSI);
  const [factor, setFactor] = useState(MIN_FACTOR);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalError, setModalError] = useState(false);
  const [modalText, setModalText] = useState('N/A');
  // const [modalText, setModalText] = useState("");
  const [connected, setConnected] = useState(false);
  const [statusText, setStatusText] = useState('Disconnected');
  const [disconnectMonitor, setDisconnectMonitor] = useState(null);
  const [readMonitor, setReadMonitor] = useState(null);
  const [tirePressure, setTirePressure] = useState(0);
  const [showStatusLoading, setShowStatusLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [lowBattery, setLowBattery] = useState(false);
  const [dropMessageText, setDropMessageText] = useState(
    'You have disconnected from the device.',
  );
  const [dropMessageButtonText, setDropMessageButtonText] =
    useState('Reconnect');
  const [allMessagesSentByDevice, setAllMessagesSentByDevice] = useState([]);
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [psiIndex, setPsiIndex] = useState(0);
  const [isPortraitOrientation, setIsPortraitOrientation] = useState(isPortrait());


  const dropAnim = useRef(new Animated.Value(0)).current;

  Dimensions.addEventListener('change', () => {
    setIsPortraitOrientation(isPortrait())
  });



  const onDeviceDisconnect = (error, device) => {
    if (error) {
      log("HOME", 'ERROR');
      setModalError(true);
      setModalText(getErrorText(error));
      setModalVisible(true);
    } else {
      setShowStatusLoading(false);
      if (disconnectMonitor) {
        disconnectMonitor.remove();
        setDisconnectMonitor(null);
      }
      for (timer of timerList) {
        clearInterval(timer);
      }
      setStatusText('Disconnected');
      if (readMonitor) {
        readMonitor.remove();
        setReadMonitor(null);
      }
      log("HOME", 'Device disconnected: ' + device.id);
      setConnected(false);
      if (Platform.OS === 'android') {
        Vibration.vibrate([200, 200, 200, 500]);
      } else {
        Vibration.vibrate([200, 500]);
      }
      removeSubscriptions();
      setDropMessageText('You have disconnected from the device.');
      setDropMessageButtonText('Reconnect');
      dropIn();
    }
  };

  useEffect(() => {
    return navigation.addListener('focus', () => {
      if (BT05_DEVICE && MANAGER) {
        sendDeviceSignal('home');
      }
      log("HOME", 'navigation focus');
      if (Platform.OS === 'android' && Platform.Version <= 19) {
        setModalError(true);
        setModalText(
          "You have to update your Android version to use this app. It's not supported on Android API versions below 19. You have API version " + Platform.Version,
        );
        setModalVisible(true);
      } else if (Platform.OS === 'ios' && Platform.Version <= 9) {
        setModalError(true);
        setModalText(
          "You have to update your iOS version to use this app. It's not supported on iOS versions below 9.",
        );
      }

      storeData();
      getData('@factor')
        .then(value => {
          if (value != null && value != undefined) {
            setFactor(parseFloat(JSON.parse(value)));
          }
        })
        .catch(err => log("HOME", err));

      log("HOME", 1);
      getData('@wantedPsi')
        .then(value => {
          log("HOME", 'value: ' + value);
          if (value != null && value != undefined) {
            setWantedPsi(parseInt(JSON.parse(value)));
          }
        })
        .catch(err => log("HOME", err));

      if (disconnectMonitor) {
        disconnectMonitor.remove();
        setDisconnectMonitor(null);
      }

      if (readMonitor) {
        readMonitor.remove();
        setReadMonitor(null);
      }

      if (
        route != null &&
        route != undefined &&
        route.params != null &&
        route.params != undefined
      ) {
        log("HOME",
          `Passed route checks - device: ${route.params.device}, manager: ${route.params.manager}`,
        );
        if (
          route.params.device != null &&
          route.params.device != undefined &&
          route.params.manager != null &&
          route.params.manager != undefined
        ) {
          log("HOME", 'Passed params checks');
          MANAGER = route.params.manager;
          BT05_DEVICE = route.params.device;

          log("HOME", 'MANAGER: ' + JSON.stringify(MANAGER));
          log("HOME", 'DEVICE has id: ' + BT05_DEVICE.hasOwnProperty('id'));
          if (BT05_DEVICE.hasOwnProperty('id')) {
            MANAGER.isDeviceConnected(BT05_DEVICE.id)
              .then(isConnected => {
                log("HOME", 'IS CONNECTED: ' + isConnected);
                if (isConnected) {
                  log("HOME", 'Passed isConnected checks');
                  setDisconnectMonitor(
                    MANAGER.onDeviceDisconnected(
                      BT05_DEVICE.id,
                      onDeviceDisconnect,
                    ),
                  );

                  log("HOME", 'Passed set disconnect monitor');
                  setReadMonitor(
                    MANAGER.monitorCharacteristicForDevice(
                      BT05_DEVICE.id,
                      'FFE0',
                      'FFE1',
                      monitorDeviceData,
                    ),
                  );
                  log("HOME", 'Passed set read monitor');
                  setConnected(true);

                  log("HOME", 'Passed set connected');
                }
              })
              .catch(error => {
                log("HOME", 'ERROR: ' + JSON.stringify(error));
              });
          } else {
            BT05_DEVICE = null;
          }

          DEVICE_SERVICE_UUID = route.params.serviceUUID;
          DEVICE_CHARACTERISTICS_UUID = route.params.characteristicsUUID;
        } else {
          BT05_DEVICE = null;
        }
        log("HOME", 'AT END BT05 IS: ' + BT05_DEVICE);
        log("HOME", 'AT END BT05 IS: ' + BT05_DEVICE);
        log("HOME", 'AT END BT05 IS: ' + BT05_DEVICE);
        log("HOME", 'AT END BT05 IS: ' + BT05_DEVICE);
      }
    });
  }, [route]);

  // setInterval(() => {
  //   log("HOME", 'PSI: ' + wantedPsi);
  // }, 100);

  const checkPermission = () => {
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
            navigation.dispatch(StackActions.replace('Permissions'));
            log("HOME", permTimer)
          }
        })
        .catch(err => log("HOME", 'error checking perm1:', err));

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
            navigation.dispatch(StackActions.replace('Permissions'));
            log("HOME", permTimer)
          }
        })
        .catch(err => log("HOME", 'error checking perm1:', err));

      check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION)
        .then(data => {
          if (data != 'granted') {
            if (permTimer) {
              clearInterval(permTimer);
              permTimer = null;
            }
            navigation.dispatch(StackActions.replace('Permissions'));
            log("HOME", permTimer)
          }
        })
        .catch(err => log("HOME", 'error checking perm1:', err));

      BluetoothStateManager.getState()
        .then(data => {
          if (data != 'PoweredOn') {
            if (permTimer) {
              clearInterval(permTimer);
              permTimer = null;
            }
            navigation.dispatch(StackActions.replace('Permissions'));
            log("HOME", permTimer)
          }
        })
        .catch(err => log("HOME", 'error checking perm1:', err));
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
  };

  const exitApp = () => {
    // log("HOME", 'Wanted PSI: ' + wantedPsi);
    // setData('@wantedPsi', wantedPsi.toString());
    // log("HOME", 'exit APp');
    // setShowStatusLoading(false);
    // if (disconnectMonitor) {
    //   disconnectMonitor.remove();
    //   setDisconnectMonitor(null);
    // }

    // if (readMonitor) {
    //   readMonitor.remove();
    //   setReadMonitor(null);
    // }
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


    if (!permTimer) {
      permTimer = setInterval(() => {
        checkPermission();
      }, 500)
    }
  }, []);

  const sendDeviceSignal = async signal => {
    let base64Signal = Buffer.from(startChar + signal + endChar).toString(
      'base64',
    );
    // log("HOME", base64Signal + ' - ' + (base64Signal.length + 3));
    return MANAGER.writeCharacteristicWithoutResponseForDevice(
      BT05_DEVICE.id,
      'FFE0',
      'FFE1',
      base64Signal,
    )
      .then(d => {
        if (signal != 'DATA WAS READ') {
          // sendDeviceSignal('DATA WAS READ');
        }
        setAllMessagesSentByDevice(oldArray => [...oldArray, signal]);
        return d;
      })
      .catch(e => {
        setModalError(true);
        setModalText(getErrorText(e));
        setModalVisible(true);
        return e;
      });
  };

  const sendAllData = async (wantedPsi, factor) => {
    sendDeviceSignal(
      `{${parseFloat(wantedPsi).toFixed(1)},${parseFloat(factor).toFixed(1)}}`,
      false,
    );
  };

  const removeSubscriptions = () => {

    if (MANAGER != null) {
      for (const [_key, val] of Object.entries(MANAGER._activeSubscriptions)) {
        try {
          MANAGER._activeSubscriptions[val].remove();
        } catch (error) { }
      }
      try {
        for (const [_key, val] of Object.entries(
          BT05_DEVICE._manager._activeSubscriptions,
        )) {
          try {
            BT05_DEVICE._manager._activeSubscriptions[val].remove();
          } catch (error) { }
        }
      } catch (error) { }
    }
  };

  const doneStatus = async () => {
    setIsDone(true);
  };

  useEffect(() => {
    if (isDone) {
      LocalNotification(wantedPsi)
      setTimeout(() => {

        Vibration.vibrate([0, 1000, 1000, 1000, 1000, 1000, 1000, 1000]);
      }, 1000);
      playDoneSound()
    }
  }, [isDone])


  const handleStatusId = async (startTime, statusId) => {
    log("HOME", 'Called handleStatusId');
    log("HOME", statusId, startTime);
    startTime -= 2;
    for (timer of timerList) {
      BackgroundTimer.clearInterval(timer);
    }
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
      setModalError(true);
      setModalText(getErrorText(error));
      setModalVisible(true);
      return null;
    }

    data = Buffer.from(data.value, 'base64').toString();
    if (data != 'SUCCESS CONNECT') {
      data = data.substring(data.indexOf(startChar) + 1, data.indexOf(endChar));
    }
    log("HOME", data);
    if (
      !allMessagesSentByDevice.includes(data) &&
      data != '~^' &&
      data != '~DATA WAS READ^' &&
      data[0] == '[' &&
      isValidData(data)
    ) {
      if (data.includes('alive')) {
        // log("HOME", 'Asking for connection status');
        let x = 0;
        let timer = setInterval(() => {
          x++;
          sendDeviceSignal('yes');
          if (x == 5) {
            clearInterval(timer);
          }
        }, 170);
      } else {
        let dataArray = eval(data);
        log("HOME", dataArray);
        handleStatusId(dataArray[1], dataArray[0]);
        setTirePressure(dataArray[2]);
        setLowBattery(dataArray[4])
      }
    }
  };

  const dropIn = () => {
    // Will change fadeAnim value to 1 in 5 seconds
    Animated.timing(dropAnim, {
      toValue: 50,
      duration: 500,
      useNativeDriver: false,
      // useNativeDriver: true,
    }).start();
    setTimeout(() => {
      Animated.timing(dropAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: false,
        // useNativeDriver: true,
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
                // marginLeft: 10,
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
                  // useNativeDriver: true,
                }).start();
                removeSubscriptions();
                navigation.navigate('Settings', {
                  device: BT05_DEVICE,
                  serviceUUID: DEVICE_SERVICE_UUID,
                  characteristicsUUID: DEVICE_CHARACTERISTICS_UUID,
                  startConnect: true,
                  connectToDevice: false,
                  manager: MANAGER,
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
            style={{
              borderRadius: 50,
              alignItems: 'center',
              justifyContent: 'center',
              width: isPortraitOrientation ? "15%" : "7%",
              aspectRatio: 1,
            }}
            onPressOut={() => {
              try {
                MANAGER.isDeviceConnected(BT05_DEVICE.id).then(d => {
                  log("HOME", 'BEFORE LEAVE, CONNECTED 1 - ' + d);
                });
              } catch (err) {
                log("HOME",
                  'Error checking connected before leave home 1 - ' + err,
                );
              }
              removeSubscriptions();
              try {
                MANAGER.isDeviceConnected(BT05_DEVICE.id).then(d => {
                  log("HOME", 'BEFORE LEAVE, CONNECTED 2 - ' + d);
                });
              } catch (err) {
                log("HOME",
                  'Error checking connected before leave home 2 - ' + err,
                );
              }
              navigation.navigate('Settings', {
                device: BT05_DEVICE,
                serviceUUID: DEVICE_SERVICE_UUID,
                characteristicsUUID: DEVICE_CHARACTERISTICS_UUID,
                startConnect: false,
                connectToDevice: false,
                manager: MANAGER,
              });
            }}>
            <Image
              key={new Date()}
              source={require('../assets/icons/cog.png')}
              resizeMode="contain"
              style={{
                width: '100%',
                height: undefined,
                aspectRatio: 1,
              }}
            />
          </TouchableOpacity>


          {/* Logo */}

          <TouchableOpacity
            style={{
              width: isPortraitOrientation ? "50%" : "30%",
              height: isPortraitOrientation ? '50%' : "100%",
              justifyContent: 'center',
              alignItems: 'center',
              top: isPortraitOrientation ? "18%" : "2%",

            }}
            onPress={async () => {
              if (BT05_DEVICE != null) {
                try {
                  let d = await MANAGER.isDeviceConnected(BT05_DEVICE.id);
                  if (!d) {
                    log("HOME", 'BT05_DEVICE is not connected');
                    setConnected(false);
                  }
                } catch (err) {
                  log("HOME", 'Error checking connected - ' + err);
                }

                if (connected) {
                  log("HOME", 'Sending all data to the device');
                  sendAllData(wantedPsi, factor);
                  if (isDone) {
                    setIsDone(false);
                  }
                } else {
                  if (!JSON.parse(JSON.stringify(dropAnim))) {
                    dropIn();
                    setDropMessageText('You are not connected to the device.');
                    setDropMessageButtonText('Connect');
                    log("HOME", "Device is not connected")
                  }
                }
              } else {
                if (!JSON.parse(JSON.stringify(dropAnim))) {
                  setDropMessageText('You are not connected to the device.');
                  setDropMessageButtonText('Connect');
                  dropIn();
                  log("HOME", "Device is null")
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
              removeSubscriptions();
              navigation.navigate('AboutMe');
            }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center'
            }}>



              <Image
                key={new Date()}
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
              {Math.round(tirePressure * 2) / 2}
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
                </Text></TouchableOpacity>
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
                    getData('@roadPreset')
                      .then(data => data)
                      .then(value => {
                        setWantedPsi(parseInt(value));
                      })
                      .catch(err => log("HOME", err));
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
                    getData('@trailPreset')
                      .then(data => data)
                      .then(value => {
                        setWantedPsi(parseInt(value));
                      })
                      .catch(err => log("HOME", err));
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
            // paddingHorizontal: '5%',
            ...SHADOWS.extraDark,
          }}>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{ fontSize: isPortraitOrientation ? 2 * (winWidth / 30) : 2 * (winWidth / 60), color: 'white', marginLeft: isPortraitOrientation ? 0 : "32%" }}>
            STATUS
          </Text>
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'flex-end',
              width: '60%',
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
                textAlignVertical: 'center',
                paddingHorizontal: '7%',
                paddingVertical: '2%',
                borderRadius: 2 * (winWidth / 25),
                color: 'white',
                fontSize: isPortraitOrientation ? 2 * (winWidth / 30) : 2 * (winWidth / 60),
                marginRight: isPortraitOrientation ? 0 : "32%"
              }}>
              {statusText != "Disconnected" || statusText != "Connected" ? statusText : connected ? "Connected" : "Disconnected"}
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
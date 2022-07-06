import {
  View,
  SafeAreaView,
  Text,
  Modal,
  Pressable,
  TouchableWithoutFeedback,
  Image,
  Platform,
  Animated,
  AppState,
  Vibration,
  Dimensions,
} from 'react-native';
import {useState, useEffect, useRef} from 'react';

import {check, PERMISSIONS} from 'react-native-permissions';
import BluetoothStateManager from 'react-native-bluetooth-state-manager';

import {FocusedStatusBar, CircleButton, RectButton} from '../components';
import {COLORS, SHADOWS} from '../constants';
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Sound from 'react-native-sound';

let timer = null;
let waitTimer = null;
let BT05_DEVICE = null;
let MANAGER = null;
let DEVICE_SERVICE_UUID = null;
let DEVICE_CHARACTERISTICS_UUID = null;
let MIN_FACTOR = 3;
const MAX_PSI = 50;
const MIN_PSI = 3;
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
const winHeight = Dimensions.get('window').height;

const Buffer = require('buffer').Buffer;
Sound.setCategory('Playback');

const playDoneSound = () => {
  let beep = new Sound('beep_long.mp3', Sound.MAIN_BUNDLE, error => {
    if (error) {
      console.log('failed to load the sound', error);
      return;
    }
    // loaded successfully
    beep.play(success => {
      if (success) {
        console.log('successfully finished playing');
        setTimeout(() => {
          beep.play(success => {
            if (success) {
              console.log('successfully finished playing');
              setTimeout(() => {
                beep.play(success => {
                  if (success) {
                    console.log('successfully finished playing');
                    setTimeout(() => {
                      beep.play(success => {
                        if (success) {
                          console.log('successfully finished playing');
                        } else {
                          console.log(
                            'playback failed due to audio decoding errors',
                          );
                        }
                      });
                    }, 1000);
                  } else {
                    console.log('playback failed due to audio decoding errors');
                  }
                });
              }, 1000);
            } else {
              console.log('playback failed due to audio decoding errors');
            }
          });
        }, 1000);
      } else {
        console.log('playback failed due to audio decoding errors');
      }
    });
  });
  return beep;
};

const downPressPlus = (currentCounter, setCounter) => {
  if (currentCounter < MAX_PSI) {
    waitTimer = setTimeout(() => {
      console.log('WAIT TIME OVER');
      if (timer === null) {
        timer = setInterval(() => {
          setCounter(counter => counter + (counter < MAX_PSI ? 1 : 0));
        }, 75);
      }
    }, 700);
  }
};

const upPressPlus = (currentCounter, setCounter) => {
  if (currentCounter < MAX_PSI) {
    clearInterval(timer);
    clearTimeout(waitTimer);
    timer = null;
    waitTimer = null;
    setCounter(counter => counter + 1);
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
  if (currentCounter > MIN_PSI) {
    clearInterval(timer);
    clearTimeout(waitTimer);
    timer = null;
    setCounter(counter => counter - 1);
    waitTimer = null;
  }
};

const getData = async key => {
  try {
    const data = await AsyncStorage.getItem(key);
    if (data !== null) {
      // console.log('data: ' + data);
      // console.log('type data:', typeof data);
      return data;
    }
  } catch (error) {
    console.log(error);
  }
};

const setData = async (key, value) => {
  try {
    let t = await AsyncStorage.setItem(key, value);
  } catch (error) {
    console.log(error);
  }
};

const getErrorText = error => {
  if (error.reason == null) {
    return null;
  }

  if (error.errorCode == 201) {
    return null;
  }

  let errorMap = {
    0:
      'Unknown error occurred . (Please try again) info: ' +
      JSON.stringify(error),
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
      [
        'a',
        'b',
        'c',
        'd',
        'e',
        'f',
        'g',
        'h',
        'i',
        'j',
        'k',
        'l',
        'm',
        'n',
        'o',
        'p',
        'q',
        'r',
        's',
        't',
        'u',
        'v',
        'w',
        'x',
        'y',
        'z',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '0',
        '"',
        '[',
        ']',
        '.',
        ',',
        '-',
      ].includes(char)
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
      await AsyncStorage.setItem('@factor', JSON.stringify(3.2));
    } catch (error) {
      console.log('ERROR SAVING FACTOR', error);
    }
  }

  if (!JSON.parse(await AsyncStorage.getItem('@wantedPsi'))) {
    try {
      await AsyncStorage.setItem('@wantedPsi', JSON.stringify(3));
    } catch (error) {
      console.log('ERROR SAVING WANTED PSI', error);
    }
  }

  console.log('road:', JSON.parse(await AsyncStorage.getItem('@roadPreset')));

  if (!JSON.parse(await AsyncStorage.getItem('@roadPreset'))) {
    try {
      await AsyncStorage.setItem('@roadPreset', JSON.stringify(32));
    } catch (error) {
      console.log('ERROR SAVING ROAD PRESET', error);
    }
  }
  console.log(!(await AsyncStorage.getItem('@trailPreset')));
  if (!JSON.parse(await AsyncStorage.getItem('@trailPreset'))) {
    try {
      console.log('Storing data - trailPreset');
      await AsyncStorage.setItem('@trailPreset', JSON.stringify(16));
    } catch (error) {
      console.log('ERROR SAVING TRAIL PRESET', error);
    }
  }

  if (!JSON.parse(await AsyncStorage.getItem('@btImage'))) {
    try {
      await AsyncStorage.setItem('@BtImage', JSON.stringify(null));
    } catch (error) {
      console.log('ERROR SAVING BtImage', error);
    }
  }
};

const Home = ({navigation, route}) => {
  const [wantedPsi, setWantedPsi] = useState(MIN_PSI);
  const [factor, setFactor] = useState(MIN_FACTOR);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalError, setModalError] = useState(false);
  const [modalText, setModalText] = useState('N/A');
  const [connected, setConnected] = useState(false);
  const [statusText, setStatusText] = useState('Stand By');
  const [disconnectMonitor, setDisconnectMonitor] = useState(null);
  const [readMonitor, setReadMonitor] = useState(null);
  const [tirePressure, setTirePressure] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [dropMessageText, setDropMessageText] = useState(
    'You have disconnected from the device.',
  );
  const [dropMessageButtonText, setDropMessageButtonText] =
    useState('Reconnect');
  const [allMessagesSentByDevice, setAllMessagesSentByDevice] = useState([]);
  const dropAnim = useRef(new Animated.Value(0)).current;

  const onDeviceDisconnect = (error, device) => {
    if (error) {
      console.log('ERROR');
      setModalError(true);
      setModalText(getErrorText(error));
      setModalVisible(true);
    } else {
      if (disconnectMonitor) {
        disconnectMonitor.remove();
        setDisconnectMonitor(null);
      }

      if (readMonitor) {
        readMonitor.remove();
        setReadMonitor(null);
      }
      console.log('Device disconnected: ' + device.id);
      setConnected(false);

      removeSubscriptions();
      setDropMessageText('You have disconnected from the device.');
      setDropMessageButtonText('Reconnect');
      dropIn();
    }
  };

  useEffect(() => {
    return navigation.addListener('focus', () => {
      console.log('navigation focus');
      if (Platform.OS === 'android' && Platform.Version <= 19) {
        setModalError(true);
        setModalText(
          "You have to update your Android version to use this app. It's not supported on Android versions below 19.",
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
        .catch(err => console.log(err));

      console.log(1);
      getData('@wantedPsi')
        .then(value => {
          console.log('value: ' + value);
          if (value != null && value != undefined) {
            setWantedPsi(parseInt(JSON.parse(value)));
          }
        })
        .catch(err => console.log(err));

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
        console.log(
          `Passed route checks - device: ${route.params.device}, manager: ${route.params.manager}`,
        );
        if (
          route.params.device != null &&
          route.params.device != undefined &&
          route.params.manager != null &&
          route.params.manager != undefined
        ) {
          console.log('Passed params checks');
          MANAGER = route.params.manager;
          BT05_DEVICE = route.params.device;

          console.log('MANAGER: ' + JSON.stringify(MANAGER));
          console.log('DEVICE has id: ' + BT05_DEVICE.hasOwnProperty('id'));
          if (BT05_DEVICE.hasOwnProperty('id')) {
            MANAGER.isDeviceConnected(BT05_DEVICE.id)
              .then(isConnected => {
                console.log('IS CONNECTED: ' + isConnected);
                if (isConnected) {
                  console.log('Passed isConnected checks');
                  setDisconnectMonitor(
                    MANAGER.onDeviceDisconnected(
                      BT05_DEVICE.id,
                      onDeviceDisconnect,
                    ),
                  );

                  console.log('Passed set disconnect monitor');
                  setReadMonitor(
                    MANAGER.monitorCharacteristicForDevice(
                      BT05_DEVICE.id,
                      'FFE0',
                      'FFE1',
                      monitorDeviceData,
                    ),
                  );
                  console.log('Passed set read monitor');
                  setConnected(true);

                  console.log('Passed set connected');
                }
              })
              .catch(error => {
                console.log('ERROR: ' + JSON.stringify(error));
              });
          } else {
            BT05_DEVICE = null;
          }

          DEVICE_SERVICE_UUID = route.params.serviceUUID;
          DEVICE_CHARACTERISTICS_UUID = route.params.characteristicsUUID;
        } else {
          BT05_DEVICE = null;
        }
        console.log('AT END BT05 IS: ' + BT05_DEVICE);
        console.log('AT END BT05 IS: ' + BT05_DEVICE);
        console.log('AT END BT05 IS: ' + BT05_DEVICE);
        console.log('AT END BT05 IS: ' + BT05_DEVICE);
      }
    });
  }, [route]);

  // setInterval(() => {
  //   console.log('PSI: ' + wantedPsi);
  // }, 100);

  const checkPermission = () => {
    if (Platform.OS === 'android') {
      check(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT)
        .then(data => {
          if (data != 'granted') {
            navigation.navigate('Permissions');
          }
        })
        .catch(err => console.log('error checking perm1:', err));

      check(PERMISSIONS.ANDROID.BLUETOOTH_SCAN)
        .then(data => {
          if (data != 'granted') {
            navigation.navigate('Permissions');
          }
        })
        .catch(err => console.log('error checking perm1:', err));

      check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION)
        .then(data => {
          if (data != 'granted') {
            navigation.navigate('Permissions');
          }
        })
        .catch(err => console.log('error checking perm1:', err));

      BluetoothStateManager.getState()
        .then(data => {
          if (data != 'PoweredOn') {
            navigation.navigate('Permissions');
          }
        })
        .catch(err => console.log('error checking perm1:', err));
    } else {
      check(PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL)
        .then(data => {
          if (data != 'granted') {
            navigation.navigate('Permissions');
          }
        })
        .catch(err => console.log('error checking perm1:', err));

      check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE)
        .then(data => {
          if (data != 'granted') {
            navigation.navigate('Permissions');
          }
        })
        .catch(err => console.log('error checking perm1:', err));

      BluetoothStateManager.getState()
        .then(data => {
          if (data != 'PoweredOn') {
            navigation.navigate('Permissions');
          }
        })
        .catch(err => console.log('error checking perm1:', err));
    }
  };

  const exitApp = () => {
    // console.log('Wanted PSI: ' + wantedPsi);
    // setData('@wantedPsi', wantedPsi.toString());

    if (disconnectMonitor) {
      disconnectMonitor.remove();
      setDisconnectMonitor(null);
    }

    if (readMonitor) {
      readMonitor.remove();
      setReadMonitor(null);
    }
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
    setInterval(() => {
      checkPermission();
    }, 500);
  }, []);

  const sendDeviceSignal = async signal => {
    let base64Signal = Buffer.from(startChar + signal + endChar).toString(
      'base64',
    );
    console.log(base64Signal + ' - ' + (base64Signal.length + 3));
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
        } catch (error) {}
      }
      try {
        for (const [_key, val] of Object.entries(
          BT05_DEVICE._manager._activeSubscriptions,
        )) {
          try {
            BT05_DEVICE._manager._activeSubscriptions[val].remove();
          } catch (error) {}
        }
      } catch (error) {}
    }
  };

  const doneStatus = async () => {
    setIsDone(true);
    if (Platform.OS === 'android') {
      Vibration.vibrate([200, 1000, 1450, 1000, 1450, 1000, 1450, 1000]);
    } else {
      Vibration.vibrate([200, 1450, 1450, 1450]);
    }
    playDoneSound();
  };

  const handleStatusId = async (startTime, statusId) => {
    startTime -= 1;
    for (timer of timerList) {
      clearInterval(timer);
    }
    if (startTime == -2) {
      setStatusText(StatusIdMap[statusId]);
      if (statusId == 3) {
        doneStatus();
      }
      return;
    }
    let x = 0;

    timerList.push(
      setInterval(() => {
        setStatusText(
          `${StatusIdMap[statusId]}: ${
            startTime - x >= 0 ? startTime - x : 0
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
    console.log(
      data,
      '- ' + !allMessagesSentByDevice.includes(data) &&
        data != '~^' &&
        data != '~DATA WAS READ^' &&
        data[0] == '[' &&
        isValidData(data),
    );
    if (
      !allMessagesSentByDevice.includes(data) &&
      data != '~^' &&
      data != '~DATA WAS READ^' &&
      data[0] == '[' &&
      isValidData(data)
    ) {
      let dataArray = eval(data);
      console.log(dataArray);
      handleStatusId(dataArray[1], dataArray[0]);
      setTirePressure(dataArray[2]);
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
    <SafeAreaView style={{flex: 1}}>
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
                fontSize: 2 * (winWidth / 30),
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
                fontSize: 2 * (winWidth / 50),
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
                  fontSize: 2 * (winWidth / 30),
                  textAlign: 'center',
                }}>
                {modalError ? 'Dismiss' : 'Ok'}
              </Text>
            </Pressable>
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
        }}>
        <CircleButton
          imgUrl={require('../assets/icons/cog.png')}
          handlePressDown={() => {}}
          handlePressUp={() => {
            try {
              MANAGER.isDeviceConnected(BT05_DEVICE.id).then(d => {
                console.log('BEFORE LEAVE, CONNECTED 1 - ' + d);
              });
            } catch (err) {
              console.log(
                'Error checking connected before leave home 1 - ' + err,
              );
            }
            removeSubscriptions();
            try {
              MANAGER.isDeviceConnected(BT05_DEVICE.id).then(d => {
                console.log('BEFORE LEAVE, CONNECTED 2 - ' + d);
              });
            } catch (err) {
              console.log(
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
          }}
          size={[2 * (winWidth / 15), 2 * (winHeight / 15)]}
          {...{
            marginLeft: winWidth / 15,
            marginTop: winWidth / 15,
            backgroundColor: 'transparent',
          }}
        />
        <CircleButton
          imgUrl={require('../assets/icons/aboutme.png')}
          handlePressDown={() => {}}
          handlePressUp={() => {
            removeSubscriptions();
            navigation.navigate('AboutMe');
          }}
          size={[2 * (winWidth / 15), 2 * (winWidth / 15)]}
          {...{
            marginRight: winWidth / 15,
            marginTop: winWidth / 15,
            backgroundColor: 'transparent',
          }}
        />
      </View>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
        }}>
        {/* Logo */}
        <View
          style={{
            width: '100%',
            height: '10%',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '10%',
            marginTop: '2%',
          }}>
          <Pressable
            style={{
              width: '50%',
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => {
              if (BT05_DEVICE != null) {
                if (connected) {
                  console.log('Sending all data to the device');
                  sendAllData(wantedPsi, factor);
                } else {
                  dropIn();
                  setDropMessageText('You are not connected to the device.');
                  setDropMessageButtonText('Connect');
                }
              } else {
                setDropMessageText('You are not connected to the device.');
                setDropMessageButtonText('Connect');
                dropIn();
              }
            }}>
            <Image
              source={require('../assets/icons/logo.png')}
              resizeMode="center"
              style={{width: winWidth / 1.7, height: winWidth / 5}}
            />
          </Pressable>
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
            justifyContent: 'space-between',
            paddingHorizontal: '5%',
            ...SHADOWS.extraDark,
          }}>
          <Text style={{fontSize: 2 * (winWidth / 30), color: 'white'}}>
            TIRE
          </Text>
          <Text
            style={{
              fontSize: 2 * (winWidth / 30),
              backgroundColor: '#1B1B1B',
              paddingLeft: '7%',
              paddingRight: '7%',
              paddingTop: '2%',
              paddingBottom: '2%',
              borderRadius: 2 * (winWidth / 25),
              color: 'white',
            }}>
            {tirePressure}
          </Text>
        </View>

        {/* SET GROUP */}
        <View
          style={{
            marginTop: '2%',
            backgroundColor: '#242424',
            width: '100%',
            height: '25%',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingHorizontal: '5%',
            ...SHADOWS.extraDark,
          }}>
          {/* SET TEXT */}
          <View
            style={{
              width: '100%',

              justifyContent: 'space-between',
              alignItems: 'center',
              flexDirection: 'row',
              height: '50%',
              color: 'white',
            }}>
            <Text style={{fontSize: 2 * (winWidth / 30), color: 'white'}}>
              SET
            </Text>
            <Text
              style={{
                fontSize: 2 * (winWidth / 30),
                backgroundColor: '#1B1B1B',
                alignContent: 'center',
                justifyContent: 'center',
                paddingLeft: '7%',
                paddingRight: '7%',
                paddingTop: '2%',
                paddingBottom: '2%',
                borderRadius: 2 * (winWidth / 25),
                color: 'white',
              }}>
              {wantedPsi}
            </Text>
          </View>

          {/* SET BUTTONS */}
          <View
            style={{
              position: 'relative',
              flexDirection: 'row',
              marginTop: '2%',
            }}>
            <RectButton
              width={'20%'}
              fontSize={2 * (winWidth / 30)}
              handlePressDown={() => {
                downPressPlus(wantedPsi, setWantedPsi);
              }}
              handlePressUp={() => {
                upPressPlus(wantedPsi, setWantedPsi);
              }}
              text={'+'}
              {...{
                backgroundColor: '#116AC1',
                ...SHADOWS.dark,
                paddingBottom: 5,
                marginRight: '2%',
              }}
            />
            <RectButton
              width={'20%'}
              fontSize={2 * (winWidth / 30)}
              handlePressDown={() => {
                downPressMinus(wantedPsi, setWantedPsi);
              }}
              handlePressUp={() => {
                upPressMinus(wantedPsi, setWantedPsi);
              }}
              text={'-'}
              {...{
                backgroundColor: '#116AC1',
                ...SHADOWS.dark,
                paddingBottom: 5,
                marginRight: '5%',
              }}
            />
            <RectButton
              width={'25%'}
              fontSize={2 * (winWidth / 40)}
              handlePressUp={() => {
                getData('@roadPreset')
                  .then(data => data)
                  .then(value => {
                    setWantedPsi(parseInt(JSON.parse(value)));
                  })
                  .catch(err => console.log(err));
              }}
              text={'Road'}
              {...{
                backgroundColor: '#489143',
                ...SHADOWS.dark,
                paddingBottom: 5,
                marginRight: '2%',
              }}
            />
            <RectButton
              width={'25%'}
              fontSize={2 * (winWidth / 40)}
              handlePressUp={() => {
                getData('@trailPreset')
                  .then(data => data)
                  .then(value => {
                    setWantedPsi(parseInt(value));
                  })
                  .catch(err => console.log(err));
              }}
              text={'Trail'}
              {...{
                backgroundColor: '#489143',
                ...SHADOWS.dark,
                paddingBottom: 5,
              }}
            />
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
            justifyContent: 'space-between',
            marginTop: '2%',
            paddingHorizontal: '5%',
            ...SHADOWS.extraDark,
          }}>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{fontSize: 2 * (winWidth / 30), color: 'white'}}>
            STATUS
          </Text>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{
              fontSize: 2 * (winWidth / 35),
              backgroundColor: '#1B1B1B',

              paddingHorizontal: '6%',
              paddingVertical: '2%',
              borderRadius: 2 * (winWidth / 25),
              textAlign: 'center',
              maxWidth: '70%',
              color: 'white',
            }}>
            {statusText}
          </Text>
        </View>

        <View
          style={{
            width: '75%',
            height: '15%',
            borderRadius: 2 * (winWidth / 16.666),
            borderColor: isDone ? '#2D9626' : '#545454',
            borderWidth: 2 * (winWidth / 80),
            marginTop: '10%',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text
            style={{
              fontSize: 2 * (winWidth / 20),
              color: isDone ? '#2D9626' : '#545454',
              fontWeight: 'bold',
            }}>
            DONE
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default Home;

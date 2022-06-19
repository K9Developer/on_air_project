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
  PermissionsAndroid,
  AppState,
  Vibration,
} from 'react-native';
import {useState, useEffect, useRef} from 'react';
import {
  FocusedStatusBar,
  CircleButton,
  RectButton,
  ImageRectButton,
} from '../components';
import {COLORS, SHADOWS} from '../constants';
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Sound from 'react-native-sound';
import {LogBox} from 'react-native';

LogBox.ignoreLogs(['new NativeEventEmitter']);
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

let timer = null;
let waitTimer = null;
let BT05_DEVICE = null;
let DEVICE_SERVICE_UUID = null;
let DEVICE_CHARACTERISTICS_UUID = null;
let MANAGER = null;
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
        'A',
        'B',
        'C',
        'D',
        'E',
        'F',
        'G',
        'H',
        'I',
        'J',
        'K',
        'L',
        'M',
        'N',
        'O',
        'P',
        'Q',
        'R',
        'S',
        'T',
        'U',
        'V',
        'W',
        'X',
        'Y',
        'Z',
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
        '{',
        '}',
        '[',
        ']',
        ' ',
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

const Home = ({navigation, route}) => {
  // if (nav) {
  //   navigation = nav;
  // } else {
  //   navigation = useNavigation();
  // }

  let savedRoute = {...route};

  // if (nav) {
  //   navigation = nav;
  // } else {
  //   navigation = useNavigation();
  // }

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
  const [allMessagesSentByDevice, setAllMessagesSentByDevice] = useState([]);

  const dropAnim = useRef(new Animated.Value(0)).current;

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
      console.log('ASKING PERMS');
      requestPermissions();

      getData('@factor')
        .then(value => {
          if (value != null && value != undefined) {
            setFactor(parseFloat(value.replace('"', '')));
          }
        })
        .catch(err => console.log(err));

      console.log(1);
      getData('@wantedPsi')
        .then(value => {
          console.log('value: ' + value);
          if (value != null && value != undefined) {
            setWantedPsi(parseInt(value.replace('"', '')));
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

      console.log(
        `route: ${JSON.stringify(route)}, params: ${JSON.stringify(
          route.params,
        )}`,
      );
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
          console.log('MANAGER: ' + typeof MANAGER);
          MANAGER.isDeviceConnected(BT05_DEVICE.id)
            .then(isConnected => {
              console.log('IS CONNECTED: ' + isConnected);
              if (isConnected) {
                setDisconnectMonitor(
                  BT05_DEVICE.onDisconnected(onDeviceDisconnect),
                );
                setReadMonitor(
                  MANAGER.monitorCharacteristicForDevice(
                    BT05_DEVICE.id,
                    'FFE0',
                    'FFE1',
                    monitorDeviceData,
                  ),
                );
                setConnected(true);
              }
            })
            .catch(error => {
              console.log('ERROR: ' + error);
            });
          DEVICE_SERVICE_UUID = route.params.serviceUUID;
          DEVICE_CHARACTERISTICS_UUID = route.params.characteristicsUUID;
        }
      }
    });
  }, [route]);

  // setInterval(() => {
  //   console.log('PSI: ' + wantedPsi);
  // }, 100);

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

  const requestPermissions = async () => {
    try {
      const permList = [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ];

      for (perm of permList) {
        const granted = await PermissionsAndroid.check(perm);
        if (granted) {
          permList.splice(permList.indexOf(perm), 1);
        }
      }
      const granted = await PermissionsAndroid.requestMultiple(permList);
      console.log();
      for ([key, val] of Object.entries(granted)) {
        if (val != PermissionsAndroid.RESULTS.GRANTED) {
          PermissionsAndroid.check(key).then(allow => {
            if (!allow) {
              let permName = key.includes('BLUETOOTH')
                ? 'bluetooth'
                : 'location';
              setModalError(true);
              setModalText(
                `You have to grant access to the ${permName} permission to use this app, so we can find the OnAir device. please go to this app's android settings page and allow it! ${JSON.stringify(
                  granted,
                )}`,
              );
              setModalVisible(true);
              requestPermissions();
            }
          });
        } else if (val == PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          setModalError(true);
          setModalText(
            "You have to allow all requested permissions to this app, please go to this app's android settings page and allow it!",
          );
          setModalVisible(true);
        }
      }

      // console.log('PERMISSION 1:', granted);
    } catch (err) {
      setModalError(true);
      setModalText(
        "We couldn't ask you for permissions! please try to allow them in settings or contact the developer. info: " +
          err,
      );
      setModalVisible(true);
    }
  };

  // const requestLocationPermission = async () => {
  //   try {
  //     const granted = await PermissionsAndroid.request(
  //       PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  //       // {
  //       //   title: 'OnAir location permission',
  //       //   message: 'OnAir needs access to location to access bluetooth',
  //       //   buttonNeutral: 'Ask Me Later',
  //       //   buttonNegative: 'Cancel',
  //       //   buttonPositive: 'OK',
  //       // },
  //     );
  //     if (!granted === PermissionsAndroid.RESULTS.GRANTED) {
  //       setModalError(true);
  //       setModalText(
  //         'You have to grant access to the bluetooth permission to use this app',
  //       );
  //       setModalVisible(true);
  //       requestLocationPermission();
  //     }
  //     console.log('PERMISSION 1:', granted);
  //   } catch (err) {
  //     setModalError(true);
  //     setModalText(
  //       "We couldn't ask you for permissions! please try to allow them in settings or contact the developer",
  //     );
  //     setModalVisible(true);
  //   }
  // };

  const removeSubscriptions = () => {
    if (MANAGER != null) {
      for (const [_key, val] of Object.entries(MANAGER._activeSubscriptions)) {
        try {
          MANAGER._activeSubscriptions[val].remove();
        } catch (error) {}
      }

      for (const [_key, val] of Object.entries(
        BT05_DEVICE._manager._activeSubscriptions,
      )) {
        try {
          BT05_DEVICE._manager._activeSubscriptions[val].remove();
        } catch (error) {}
      }
    }
  };

  const onDeviceDisconnect = (error, device) => {
    if (error) {
      console.log('ERROR');
      setModalError(true);
      setModalText(getErrorText(error));
      setModalVisible(true);
    } else {
      console.log('Device disconnected: ' + device.id);
      setConnected(false);
      if (disconnectMonitor) {
        disconnectMonitor.remove();
        setDisconnectMonitor(null);
      }

      if (readMonitor) {
        readMonitor.remove();
        setReadMonitor(null);
      }
      removeSubscriptions();
      dropIn();
    }
  };

  const doneStatus = async () => {
    setIsDone(true);
    if (Platform.OS === 'android') {
      Vibration.vibrate([200, 1000, 1450, 1000, 1450, 1000, 1450, 1000]);
    } else {
      Vibration.vibrate([200,1450,1450,1450]);
    }
    playDoneSound();
  };

  const handleStatusId = async (startTime, statusId) => {
    startTime -= 2;
    for (timer of timerList) {
      clearInterval(timer);
    }
    if (startTime == -3) {
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
          `${StatusIdMap[statusId]} - ${
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
        visible={modalVisible}
        onRequestClose={() => {
          Alert.alert('Modal has been closed.');
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
              fontSize: 15,
              color: 'white',
              // marginLeft: 10,
            }}>
            You have disconnected from the device.
          </Text>
          <Text
            style={{
              textDecorationLine: 'underline',
              marginLeft: 25,
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
              });
            }}>
            Reconnect
          </Text>
        </View>
      </Animated.View>

      {/* Settings Button */}

      <CircleButton
        imgUrl={require('../assets/icons/cog.png')}
        handlePressDown={() => {}}
        handlePressUp={() => {
          removeSubscriptions();
          navigation.navigate('Settings', {
            device: BT05_DEVICE,
            serviceUUID: DEVICE_SERVICE_UUID,
            characteristicsUUID: DEVICE_CHARACTERISTICS_UUID,
            startConnect: false,
          });
        }}
        size={[50, 50]}
        {...{marginLeft: 10, marginTop: 10, backgroundColor: 'transparent'}}
      />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
        }}>
        {/* Logo */}

        <View
          style={{
            width: '100%',
            position: 'relative',
            alignItems: 'center',
          }}>
          <ImageRectButton
            handlePressDown={() => {}}
            handlePressUp={() => {
              console.log('...CLICK...');
              if (BT05_DEVICE != null) {
                if (connected) {
                  console.log('Sending all data to the device');
                  sendAllData(wantedPsi, factor);
                } else {
                  setModalError(true);
                  setModalText(
                    'You are not connected tp the device the device! to connect, please go to the settings page and click on the bluetooth icon. (device is not connected)',
                  );
                  setModalVisible(true);
                }
              } else {
                setModalError(true);
                setModalText(
                  'You have not connected tp the device the device! to connect, please go to the settings page and click on the bluetooth icon. (device is null)',
                );
                setModalVisible(true);
              }
            }}
            img={require('../assets/icons/logo.png')}
            size={[768 / 3, 260 / 3]}
            {...{
              marginBottom: 30,
              backgroundColor: 'transparent',
            }}
          />
          {/* <Image
            source={require('../assets/icons/logo.png')}
            style={{
              width: 768 / 3,
              height: 260 / 3,
              marginBottom: 30,
            }}
          /> */}
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
            ...SHADOWS.extraDark,
          }}>
          <Text style={{fontSize: 40, marginLeft: 70}}>TIRE</Text>
          <Text
            style={{
              fontSize: 50,
              right: 30,
              position: 'absolute',
              marginRight: 20,
              backgroundColor: '#1B1B1B',
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 0,
              paddingBottom: 0,
              borderRadius: 20,
            }}>
            {tirePressure}
          </Text>
        </View>

        {/* SET GROUP */}
        <View
          style={{
            marginTop: 10,
            backgroundColor: '#242424',
            width: '100%',
            height: '25%',
            flexDirection: 'row',
            ...SHADOWS.extraDark,
          }}>
          {/* SET TEXT */}
          <View
            style={{
              width: '100%',
              marginTop: 0,
              justifyContent: 'center',
              height: '50%',
            }}>
            <Text style={{fontSize: 40, marginLeft: 75, marginTop: 10}}>
              SET
            </Text>
            <Text
              style={{
                fontSize: 50,
                right: 30,
                position: 'absolute',
                marginRight: 20,
                backgroundColor: '#1B1B1B',
                paddingLeft: 20,
                paddingRight: 20,
                paddingTop: 0,
                paddingBottom: 0,
                borderRadius: 20,
              }}>
              {wantedPsi}
            </Text>
          </View>

          {/* SET BUTTONS */}
          <View
            style={{
              position: 'relative',
              flexDirection: 'row',
              marginTop: -10,
            }}>
            <RectButton
              width={60}
              fontSize={30}
              handlePressDown={() => {
                downPressPlus(wantedPsi, setWantedPsi);
              }}
              handlePressUp={() => {
                doneStatus();

                upPressPlus(wantedPsi, setWantedPsi);
                // setData('@wantedPsi', wantedPsi.toString());
              }}
              text={'+'}
              {...{
                paddingBottom: 5,
                backgroundColor: '#116AC1',
                ...SHADOWS.dark,
                position: 'absolute',
                right: 100,
                height: 50,
                top: 120,
              }}
            />
            <RectButton
              width={60}
              fontSize={30}
              handlePressDown={() => {
                downPressMinus(wantedPsi, setWantedPsi);
              }}
              handlePressUp={() => {
                upPressMinus(wantedPsi, setWantedPsi);
                // setData('@wantedPsi', wantedPsi.toString());
              }}
              text={'-'}
              {...{
                paddingBottom: 5,
                backgroundColor: '#116AC1',
                ...SHADOWS.dark,
                position: 'absolute',
                right: 25,
                height: 50,
                top: 120,
              }}
            />
            <RectButton
              width={20}
              fontSize={20}
              handlePressUp={() => {
                getData('@roadPreset')
                  .then(data => data)
                  .then(value => {
                    setWantedPsi(parseInt(value.replace('"', '')));
                    // setData('@wantedPsi', wantedPsi.toString());
                  })
                  .catch(err => console.log(err));
              }}
              text={'Road'}
              {...{
                paddingBottom: 4,
                backgroundColor: '#489143',
                ...SHADOWS.dark,
                position: 'absolute',
                right: 300,
                height: 60,
                top: 115,
                width: 90,
              }}
            />
            <RectButton
              width={20}
              fontSize={20}
              handlePressUp={() => {
                getData('@trailPreset')
                  .then(data => data)
                  .then(value => {
                    setWantedPsi(parseInt(value));
                    // setData('@wantedPsi', wantedPsi.toString());
                  })
                  .catch(err => console.log(err));
              }}
              text={'Trail'}
              {...{
                paddingBottom: 4,
                backgroundColor: '#489143',
                ...SHADOWS.dark,
                position: 'absolute',
                right: 200,
                height: 60,
                top: 115,
                width: 90,
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
            marginTop: 10,
            ...SHADOWS.extraDark,
          }}>
          <Text style={{fontSize: 40, marginLeft: 25}}>STATUS</Text>
          <Text
            adjustsFontSizeToFit
            style={{
              fontSize: 25,
              right: 0,
              position: 'absolute',
              marginRight: 20,
              backgroundColor: '#1B1B1B',
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 0,
              paddingBottom: 5,
              borderRadius: 10,
              textAlign: 'center',
              width: 200,
            }}>
            {statusText}
          </Text>
        </View>

        <View
          style={{
            width: '75%',
            height: '15%',
            borderRadius: 30,
            borderColor: isDone ? '#2D9626' : '#545454',
            borderWidth: 10,
            marginTop: 50,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text
            style={{
              fontSize: 50,
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

import {
  FlatList,
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  BackHandler,
  SafeAreaView,
  TextInput,
  Modal,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import React, { useEffect, useState } from 'react';
import { CircleButton } from '../components';
import Toast, { SuccessToast, ErrorToast } from 'react-native-toast-message';
import { log } from '../services/logs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { recreateManager } from '../services/bluetoothUtils';

const Buffer = require('buffer').Buffer;

const nameMap = {};
let mounted = true;
let BluetoothManager = null;
let timeoutTimer = null;
let connectedDevice = null;
let pingCounter = 0;
const winWidth = Dimensions.get('window').width;
const winHeight = Dimensions.get('window').height;
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

const hardwareBackBtn = async () => {
  log("DEVICE-CHOOSER", `Pressed hardware back button`);
  await exit();
};

const DeviceChooser = ({ navigation, route }) => {

  const [isKeyboardShowing, setIsKeyboardShowing] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [reload, setReload] = useState("");
  const [deviceNameMap, setDeviceNameMap] = useState({});
  const [listData, setListData] = useState([]);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameText, setRenameText] = useState("");
  const [openedId, setOpenedId] = useState("");
  const [renameModalName, setRenameModalName] = useState("");
  const [loadingPing, setLoadingPing] = useState([false, null]);
  const [loadingConnection, setLoadingConnection] = useState([false, null]);
  const [isPortraitOrientation, setIsPortraitOrientation] = useState(isPortrait());

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      e => {
        setIsKeyboardShowing(true);
        setKeyboardHeight(e.endCoordinates.height);
        // or some other action
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setIsKeyboardShowing(false); // or some other action
      }
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  Dimensions.addEventListener('change', () => {
    log("DEVICE-CHOOSER", `Changed rotation. Is portrait - ${isPortrait()}`);
    setIsPortraitOrientation(isPortrait());
  });

  useEffect(() => {
    log("DEVICE-CHOOSER", "Loading device chooser screen");

    return () => {
      mounted = false;
    };
  }, []);


  const exitApp = () => {
    // log("DEVICE-CHOOSER", "Exited device chooser. cancelling connection.");
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
      log("DEVICE-CHOOSER", "Pressed back button. sent OK messages to arduino");
    } catch (error) {
      log("DEVICE-CHOOSER", `ERROR when pressed the back button: ${error}`);
    }
    navigation.navigate('Settings', { connectToDevice: false, device: null });
    log("DEVICE-CHOOSER", `Navigating to settings`);
  };

  useEffect(() => {

    BackHandler.addEventListener('hardwareBackPress', hardwareBackBtn);

    return () => {
      BackHandler.removeEventListener('hardwareBackPress', hardwareBackBtn);
    };
  }, []);

  const transferToSettings = async device => {
    log("DEVICE-CHOOSER", `Transferring data to settings`);

    if (connectedDevice) {
      try {
        for (let i = 0; i < 10; i++) {
          await sendDeviceSignal(connectedDevice, 'Ok');
        }
        log("DEVICE-CHOOSER", `Sent OK signals to arduino`);
      } catch (error) {
        log("DEVICE-CHOOSER", `ERROR when tried to send OK signals`);
      }
    }

    try {
      if (
        !connectedDevice ||
        (connectedDevice && device.id != connectedDevice.id) ||
        (connectedDevice && !(await connectedDevice.isConnected()))
      ) {
        log("DEVICE-CHOOSER", `First time connecting/Selected device not connected. Connecting to ${device ? device.id : null}`);
        connectedDevice = await connectToDevice(device);
        setLoadingPing([false, null]);
      }
    } catch (error) {
      log("DEVICE-CHOOSER", `ERROR when tried to connect to device: ${error}`);
    }


    log("DEVICE-CHOOSER", `Navigating to settings`);
    navigation.navigate('Settings', {
      connectToDevice: true,
      device: connectedDevice,
      manager: BluetoothManager,
      goHome: true,
    });
  };

  const connectToDevice = async device => {
    BluetoothManager = recreateManager(null);
    let connectedDevice = null;
    try {
      log("DEVICE-CHOOSER", `Connecting to bluetooth device - ${device ? device.id : null}`);
      connectedDevice = await BluetoothManager.connectToDevice(device.id);
    } catch (error) {
      connectedDevice = null;
      log("DEVICE-CHOOSER", `Error when tried connecting to device - ${device ? device.id : null} (${error})`);
    }
    try {
      log("DEVICE-CHOOSER", `Discovering services and characteristics for bluetooth device - ${device ? device.id : null}`);
      await connectedDevice.discoverAllServicesAndCharacteristics();


    } catch (error) {
      log("DEVICE-CHOOSER", `ERROR when tried to connect/discover services and characteristics for device - ${device ? device.id : null} (${error})`);

      connectedDevice = null;
    }
    return connectedDevice;

  };

  const getDeviceNames = async (defaults) => {
    const nameMap = JSON.parse(await AsyncStorage.getItem("@deviceNameMap"));
    const nameList = defaults;
    if (!nameMap) {
      let list = [];
      for (let device of nameList) {
        list.push({
          id: device.id,
          name: `OnAir-${device.id.replace(/:/g, "").slice(-4)}`
        });
      }
      return list;
    }

    let index = 0;
    for (let device of defaults) {
      let deviceId = device.id;

      if (deviceId && nameMap[`${deviceId}`]) {
        nameList[index] = { "id": deviceId, "name": nameMap[deviceId] };

      } else {

        nameList[index] = { "id": deviceId, "name": `OnAir-${device.id.replace(/:/g, "").slice(-4)}` };
      };
      index++;
    }

    return nameList;
  };

  const renameDevice = async (id, name) => {
    let nameMap = await AsyncStorage.getItem("@deviceNameMap");
    if (!nameMap) {
      nameMap = { [id]: name };
    } else {
      nameMap = JSON.parse(nameMap);
      nameMap[id] = name;
    }
    await AsyncStorage.setItem("@deviceNameMap", JSON.stringify(nameMap));

    setDeviceNameMap(prevDeviceNameMap => {
      prevDeviceNameMap[id] = name;
      return prevDeviceNameMap;
    });
    setReload(!reload ? " " : "");
    setRenameModalVisible(false);
  };

  const failed = () => {
    if (connectedDevice) {
      connectedDevice.cancelConnection();
    }
    log("DEVICE-CHOOSER", `Failed to ping`);
    if (readMonitor) {
      log("DEVICE-CHOOSER", `Removing sent data listener`);
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

    if (!device?.id) {
      return;
    }

    try {
      let base64Signal = Buffer.from('~' + signal + '^').toString('base64');
      log("DEVICE-CHOOSER", `Sending data (${signal}-${base64Signal}) to device - ${device ? device.id : null}`);
      return await BluetoothManager.writeCharacteristicWithoutResponseForDevice(
        device.id,
        'FFE0',
        'FFE1',
        base64Signal,
      );
    } catch {
      log("DEVICE-CHOOSER", `ERROR when tried sending data (${signal}) to device - ${device ? device.id : null}`);
    }
  };

  const startPing = async device => {
    log("DEVICE-CHOOSER", `Starting ping for device - ${device ? device.id : null}`);
    pingCounter++;

    if (readMonitor) {
      log("DEVICE-CHOOSER", `Removing sent data listener`);
      readMonitor.remove();
      readMonitor = null;
    }

    if (pingCounter > 3) {
      failed();
      return;
    }

    setLoadingPing([true, device.id]);
    BluetoothManager = recreateManager(null);

    try {
      if (connectedDevice.id != device.id && connectedDevice) {
        log("DEVICE-CHOOSER", `Current connected device is not selected device, disconnecting from ${connectedDevice ? connectedDevice.id : null}...`);
        await connectedDevice.cancelConnection();
        connectedDevice = null;
      }
    } catch { }

    try {
      log("DEVICE-CHOOSER", `Checking if connected device is not set (${connectedDevice == null || connectedDevice == undefined}), checking if device is connected (${connectedDevice && !(await connectedDevice.isConnected())})`);
      if (
        connectedDevice == null ||
        connectedDevice == undefined ||
        (connectedDevice && !(await connectedDevice.isConnected()))
      ) {
        log("DEVICE-CHOOSER", `Connecting to device - ${device ? device.id : null}`);
        connectedDevice = await connectToDevice(device);
        if (!connectedDevice) {
          log("DEVICE-CHOOSER", `ERROR when tried connecting to device - ${device ? device.id : null}. device is ${connectedDevice}`);
          Toast.show({
            type: 'error',
            text1: 'Connection Error',
            text2: "We couldn't connect to the device",
          });
          setLoadingPing([false, null]);
          return null;
        }
      } else {
        log("DEVICE-CHOOSER", `Already connected to device - ${device ? device.id : null}`);
      }
    } catch (error) {
      log("DEVICE-CHOOSER", `ERROR when tried connecting to device - ${device ? device.id : null}. error: ${error}`);
    }

    let x = 0;
    timeoutTimer = setInterval(async () => {
      x++;
      if (x > 30) {
        log("DEVICE-CHOOSER", `Tried pinging 30 times with no response.`);
        clearInterval(timeoutTimer);
        failed();
        if (connectedDevice) {
          log("DEVICE-CHOOSER", `Disconnecting from device - ${connectedDevice ? connectedDevice.id : null}`);
          connectedDevice.cancelConnection();
        }
        return;
      }

      try {
        log("DEVICE-CHOOSER", `Sending device (${connectedDevice ? connectedDevice.id : null}) ping message number ${x + 1}`);
        sendDeviceSignal(connectedDevice, 'ping');
      } catch (error) {
        log("DEVICE-CHOOSER", `ERROR when tried sending ping message to device - ${connectedDevice ? connectedDevice.id : null}. error: ${error}`);
      }

      try {
        if (!readMonitor) {
          log("DEVICE-CHOOSER", `Creating received data listener for device - ${connectedDevice ? connectedDevice.id : null}`);
          readMonitor = BluetoothManager.monitorCharacteristicForDevice(
            connectedDevice.id,
            'FFE0',
            'FFE1',
            (error, readData) => {

              if (error && !meantToDisconnect) {
                log("DEVICE-CHOOSER", `ERROR when tried to create received data listener for device - ${device ? device.id : null}. error: ${error}`);
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
              log("DEVICE-CHOOSER", `Received raw data - ${readData}`);
              if (readData.includes('pong')) {
                log("DEVICE-CHOOSER", `Received ping response!`);

                pingCounter = 0;

                setLoadingPing(false);
                Toast.show({
                  type: 'success',
                  text1: 'Ping Successful',
                });
                log("DEVICE-CHOOSER", `Removing received data listener and disconnecting device - ${connectedDevice ? connectedDevice.id : null}`);

                try {
                  log("DEVICE-CHOOSER", `Sending OK signal to device - ${connectedDevice ? connectedDevice.id : null}`);
                  for (let i = 0; i < 10; i++) {
                    sendDeviceSignal(connectedDevice, 'Ok');
                  }
                } catch (error) {
                  log("DEVICE-CHOOSER", `ERROR when sending OK message to arduino. error: ${error}`);
                }

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


                return true;
              } else {
                log("DEVICE-CHOOSER", `No response for ping! trying again...`);
              }
            },
          );
        }
      } catch (error) {
        if (error.errorCode == 205) {
          log("DEVICE-CHOOSER", `Error when connecting to device - ${connectedDevice ? connectedDevice.id : null}. error: ${error}`);

          Toast.show({
            type: 'error',
            text1: 'Connection Error',
            text2: "We couldn't connect to the device",
          });

          setLoadingPing([false, null]);
          return null;
        }
        log("DEVICE-CHOOSER", `ERROR when tried reading data sent from device - ${connectedDevice ? connectedDevice.id : null}. error: ${error}`);
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
          <View style={{
            flexDirection: "row",
            alignItems: 'center',
          }}>
            <TouchableOpacity
              onPress={() => {
                setLoadingConnection([true, id]);
                transferToSettings(data);
              }}>
              <Text
                style={{
                  fontSize: 2 * (winWidth / 60),
                  fontWeight: 'bold',
                  color: 'white',
                  marginTop: 2 * (winWidth / 50),
                }}>
                {deviceNameMap[id]}{reload}
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
            <CircleButton
              imgUrl={require('../assets/icons/edit.png')}
              handlePressDown={() => { }}
              handlePressUp={async () => {
                let name = "";
                for (let device of listData) {
                  if (device.id == id) {
                    name = device.name;
                  }
                }
                setRenameModalName(name);
                setRenameText(name);
                setOpenedId(id);
                setRenameModalVisible(true);
              }}
              size={[winWidth / 15, winWidth / 15]}
              {...{
                backgroundColor: 'transparent',
                zIndex: 1,
                // backgroundColor: 'red',
                // height: '100%',
                marginLeft: 2 * (winWidth / 35),
              }}
            />
          </View>
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

          {loadingConnection[0] && loadingConnection[1] == id ? (
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
                setLoadingConnection([true, id]);
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

  useEffect(() => {

    let defaults = route.params.scannedDevices;
    getDeviceNames(defaults).then(tmpData => {

      setListData(tmpData);

      let nm = {};
      for (let device of tmpData) {
        nm[device.id] = device.name;
      }
      setDeviceNameMap(nm);
    }).catch(e => {
      log("DEVICE_CHOOSER", "ERROR when tried getting names for devices, using defaults. error: " + e);
      setListData(defaults);
    });

  }, []);



  const renderItem = ({ item, index }) => (
    <Item
      title={`OnAir-${item.id.replace(/:/g, "").slice(-4)}`}
      id={item.id}
      data={item}
      index={index}
      length={listData.length}
    />
  );

  return (
    <SafeAreaView
      style={{
        width: '100%',
        height: '100%',
      }}>
      <Modal

        animationType="slide"
        transparent={true}
        visible={renameModalVisible}
        onRequestClose={() => {
          setRenameModalVisible(!renameModalVisible);
        }}>
        <TouchableWithoutFeedback
          onPress={() => setRenameModalVisible(!renameModalVisible)}>
          <View
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0,0,0,0.5)',
              flex: 1,
              position: 'absolute',
            }}></View>
        </TouchableWithoutFeedback>

        <View style={{
          // '100%'
          width: '100%',
          height: winHeight,
          alignItems: 'center',
          justifyContent: 'center',


        }}>
          <View style={{
            minHeight: "30%",
            maxHeight: "30%",
            minWidth: "80%",
            maxWidth: "80%",
            backgroundColor: 'white',
            borderRadius: 10,
            flexDirection: 'column',
            justifyContent: 'space-between',
            marginBottom: isKeyboardShowing ? keyboardHeight : 0
          }}>
            <View style={{
              width: '100%',
              flexDirection: 'column',
              justifyContent: 'space-around',
              height: '70%',
            }}>
              <View style={{
                height: '50%'
              }}>
                <Text style={{
                  fontSize: 2 * (winWidth / 35),
                  textAlign: 'center',
                  color: 'black',
                  marginTop: 5
                }}>Rename This Device</Text>
                <Text style={{
                  fontSize: 2 * (winWidth / 50),
                  textAlign: 'center',
                  color: 'gray',
                  marginTop: 5
                }}>Only on your phone</Text></View>
              <TextInput
                onChangeText={d => setRenameText(d)}
                defaultValue={renameModalName}

                // onFocus={() => setIsKeyboardShowing(true)}
                // onBlur={() => setIsKeyboardShowing(false)}
                style={{
                  borderColor: 'lightblue',
                  borderWidth: 2,
                  borderRadius: 10,
                  marginHorizontal: "5%",
                  color: 'black',
                  paddingHorizontal: "5%"
                }} />
            </View>
            <View style={{
              width: '100%',
              flexDirection: 'row',
              height: '25%',
            }}>
              <TouchableOpacity
                onPress={async () => { await renameDevice(openedId, renameText); }}
                style={{
                  width: '50%',
                  height: '100%',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#1b68f7',
                  borderBottomLeftRadius: 10
                }}>
                <Text style={{ color: 'white', fontSize: 2 * (winWidth / 30) }}>Rename</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setRenameModalVisible(false)}
                style={{
                  width: '50%',
                  height: '100%',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#fa484f',
                  borderBottomRightRadius: 10
                }}>
                <Text style={{ color: 'white', fontSize: 2 * (winWidth / 30) }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

      </Modal>


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
            data={listData}
            extraData={openedId}
            renderItem={renderItem}
            keyExtractor={item => item.id}
          />
        </View>
      </View>
    </SafeAreaView >
  );
};
export default DeviceChooser;

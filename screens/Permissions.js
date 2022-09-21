import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Platform,
  Modal,
  TouchableWithoutFeedback,
  Image,
  SafeAreaView,
  Dimensions,
  ScrollView
} from 'react-native';
import React, { useEffect, useState } from 'react';
import {
  check,
  PERMISSIONS,
  requestMultiple,
  openSettings,
} from 'react-native-permissions';
import BluetoothStateManager from 'react-native-bluetooth-state-manager';
import { LogBox } from 'react-native';
import { StackActions } from '@react-navigation/native';
import DeviceInfo from 'react-native-device-info';

LogBox.ignoreLogs(['new NativeEventEmitter']);
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

const winWidth = Dimensions.get('window').width;
let permissionTimer = null;


const isPortrait = () => {
  if (DeviceInfo.getDeviceType() == "Handset") {
    return dim.height >= dim.width;
  } else {
    return true;
  }
};

const Permissions = ({ navigation, route }) => {
  const [locationPermission, setLocationPermission] = useState(null);
  const [bluetoothConnectPermission, setBluetoothConnectPermission] =
    useState(null);
  const [bluetoothScanPermission, setBluetoothScanPermission] = useState(null);
  const [bluetoothStatus, setBluetoothStatus] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalError, setModalError] = useState(false);
  const [modalText, setModalText] = useState('N/A');
  const [isPortraitOrientation, setIsPortraitOrientation] = useState(isPortrait());

  Dimensions.addEventListener('change', () => {
    setIsPortraitOrientation(isPortrait())
  });


  const checkPermission = async (perm, setter) => {
    try {
      let data = await check(perm);
      if (data != null) {
        setter(data);
      }
      return;
    } catch (error) {
      console.log('Error while checking permission: ' + e);
    }
  };

  const checkBluetooth = async setter => {
    BluetoothStateManager.getState()
      .then(data => {
        setter(data);
      })
      .catch(e => {
        console.log('Error while checking bluetooth: ' + e);
      });
  };

  const checkAllPermissions = () => {
    if (Platform.OS == 'android') {
      checkPermission(
        PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
        setBluetoothConnectPermission,
      );
      checkPermission(
        PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
        setBluetoothScanPermission,
      );
      checkPermission(
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        setLocationPermission,
      );
      checkBluetooth(setBluetoothStatus);

      // console.log(
      //   '\n-------------------------------------------------\n' +
      //     'Permission - BLUETOOTH_CONNECT:',
      //   bluetoothConnectPermission + ', Permission - BLUETOOTH_SCAN:',
      //   bluetoothScanPermission + ', Permission - ACCESS_FINE_LOCATION:',
      //   locationPermission + ', Bluetooth Status:',
      //   bluetoothStatus +
      //     '\n-------------------------------------------------\n',
      // );
    } else {
      checkPermission(
        PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL,
        setBluetoothConnectPermission,
      );
      checkPermission(
        PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
        setBluetoothScanPermission,
      );
      checkBluetooth(setBluetoothStatus);
    }
  };

  // Run every update
  useEffect(() => {

    permissionTimer = setInterval(async () => {

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
        setModalVisible(true);
      }

      if (await BluetoothStateManager.getState() == "Unsupported") {
        setModalError(true);
        setModalText(
          "Bluetooth is not supported on this device!",
        );
        setModalVisible(true);
      }

      checkAllPermissions();
      if (
        locationPermission == 'granted' &&
        bluetoothStatus == 'PoweredOn' &&
        ((bluetoothConnectPermission == 'granted' &&
          bluetoothScanPermission == 'granted') ||
          (Platform.OS == 'android' && Platform.constants['Release'] <= 11))
      ) {
        clearInterval(permissionTimer);


        navigation.dispatch(StackActions.replace('Home'));
      }
    }, 500);
  });

  return (
    <SafeAreaView
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ScrollView
        style={{
          marginVertical: "7%",
          width: '75%',
          height: '75%',
        }}>
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
              alignItems: 'center',
              display: "flex",
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
                onPress={() => {
                  setModalVisible(!modalVisible)
                  if (!modalError) {
                    openSettings().catch(() =>
                      console.warn('cannot open settings'),
                    );
                  }
                }}>
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

        <View style={{
          flex: 1,
        }}>
          <View
            contentContainerStyle={{
              flexGrow: 1,
              backgroundColor: 'green',
              height: '100%',
              width: "100%",
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text
              style={{
                fontFamily: 'Inter-Bold',
                marginBottom: '10%',
                color: 'white',
                fontSize: isPortraitOrientation ? 2 * (winWidth / 40) : 2 * (winWidth / 60),
                width: "100%",
                textAlign: 'center'
              }}>
              WE NEED SOME ACCESS
            </Text>
            <Text
              style={{
                textAlign: 'center',
                lineHeight: isPortraitOrientation ? 2 * (winWidth / 40) : 2 * (winWidth / 60),
                marginBottom: "5%",
                color: 'gray',
                fontSize: isPortraitOrientation ? 2 * (winWidth / 60) : 2 * (winWidth / 80),
              }}>
              Our app is using BLE (bluetooth low energy). Apps using that,
              require location and bluetooth permission. Don't worry we dont share
              or store your information.
            </Text>

            <TouchableOpacity
              onPress={() => {
                if (locationPermission != 'granted') {
                  if (locationPermission != 'blocked') {
                    if (Platform.OS == 'android') {
                      requestMultiple([
                        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
                      ]).then(() => {
                        checkAllPermissions();
                      });
                    } else {
                      requestMultiple([
                        PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
                      ]).then(() => {
                        checkAllPermissions();
                      });
                    }
                  } else {
                    setModalError(false);
                    setModalText(
                      "You've blocked this permission. we are going to open this app's settings and allow location permission from the permissions tab.",
                    );
                    setModalVisible(true);
                  }
                }
              }}
              style={{
                backgroundColor:
                  locationPermission != 'granted' ? 'white' : 'gray',
                borderRadius: 10,
                borderColor: 'black',
                borderWidth: locationPermission == 'granted' ? 0 : 2,
                shadowColor: '#000',
                shadowOffset: { width: -4, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 1,
                width: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: isPortraitOrientation ? '5%' : '2%',
                paddingVertical: '1%',
                elevation: locationPermission == 'granted' ? 0 : 2,
              }}>
              <Text
                style={{
                  color: locationPermission == 'granted' ? 'darkgrey' : 'black',
                  fontFamily: 'Inter-Bold',
                  fontSize: isPortraitOrientation ? 2 * (winWidth / 60) : 2 * (winWidth / 80),
                }}>
                GRANT LOCATION ACCESS
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (
                  bluetoothConnectPermission != 'granted' ||
                  bluetoothScanPermission != 'granted'
                ) {
                  if (
                    bluetoothScanPermission != 'blocked' ||
                    bluetoothConnectPermission != 'blocked'
                  ) {
                    if (Platform.OS == 'android') {
                      requestMultiple([
                        PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
                        PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
                      ]).then(s => {
                        checkAllPermissions();
                      });
                    } else {
                      requestMultiple([
                        PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL,
                      ]).then(() => {
                        checkAllPermissions();
                      });
                    }
                  } else {
                    setModalError(false);
                    setModalText(
                      "You've blocked this permission. we are going to open this app's settings and allow location permission from the permissions tab.",
                    );
                    setModalVisible(true);
                  }
                }
              }}
              style={{
                backgroundColor:
                  (bluetoothScanPermission == 'granted' &&
                    bluetoothConnectPermission == 'granted') ||
                    (Platform.OS == 'android' &&
                      Platform.constants['Release'] <= 11)
                    ? 'gray'
                    : 'white',
                borderRadius: 10,
                borderColor: 'black',
                borderWidth:
                  (bluetoothScanPermission == 'granted' &&
                    bluetoothConnectPermission == 'granted') ||
                    (Platform.OS == 'android' &&
                      Platform.constants['Release'] <= 11)
                    ? 0
                    : 2,
                shadowColor: '#000',
                shadowOffset: { width: -4, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 1,
                width: '100%',
                paddingVertical: '1%',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: isPortraitOrientation ? '5%' : '2%',
                elevation:
                  (bluetoothScanPermission == 'granted' &&
                    bluetoothConnectPermission == 'granted') ||
                    (Platform.OS == 'android' &&
                      Platform.constants['Release'] <= 11)
                    ? 0
                    : 2,
              }}>
              <Text
                style={{
                  color:
                    (bluetoothScanPermission == 'granted' &&
                      bluetoothConnectPermission == 'granted') ||
                      (Platform.OS == 'android' &&
                        Platform.constants['Release'] <= 11)
                      ? 'darkgrey'
                      : 'black',

                  fontFamily: 'Inter-Bold',
                  fontSize: isPortraitOrientation ? 2 * (winWidth / 60) : 2 * (winWidth / 80),
                }}>
                GRANT BLUETOOTH ACCESS
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (bluetoothStatus != 'granted') {
                  if (
                    (bluetoothScanPermission == 'granted' &&
                      bluetoothConnectPermission == 'granted') ||
                    (Platform.OS == 'android' &&
                      Platform.constants['Release'] <= 11)
                  ) {
                    BluetoothStateManager.requestToEnable().catch(e => {
                      console.log('error turning on bluetooth:', e);
                    });
                  } else {
                    setModalError(true);
                    setModalText(
                      'You have to allow bluetooth permission before trying to turn on bluetooth!',
                    );
                    setModalVisible(true);
                  }
                }
              }}
              style={{
                backgroundColor:
                  bluetoothStatus == 'PoweredOn' ? 'grey' : 'white',
                borderRadius: 10,
                borderColor: 'black',
                borderWidth: bluetoothStatus == 'PoweredOn' ? 0 : 2,
                shadowColor: '#000',
                shadowOffset: { width: -4, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 1,
                width: '100%',
                paddingVertical: '1%',
                justifyContent: 'center',
                alignItems: 'center',
                elevation: bluetoothStatus == 'PoweredOn' ? 0 : 2,
              }}>
              <Text
                style={{
                  color: bluetoothStatus == 'PoweredOn' ? 'darkgrey' : 'black',
                  fontFamily: 'Inter-Bold',
                  fontSize: isPortraitOrientation ? 2 * (winWidth / 60) : 2 * (winWidth / 80),
                }}>
                TURN ON BLUETOOTH
              </Text>
            </TouchableOpacity>
          </View>
        </View></ScrollView>

    </SafeAreaView>
  );
};
export default Permissions;

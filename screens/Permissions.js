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
} from 'react-native';
import React, {useEffect, useState} from 'react';
import {
  check,
  PERMISSIONS,
  requestMultiple,
  openSettings,
} from 'react-native-permissions';
import BluetoothStateManager from 'react-native-bluetooth-state-manager';
import {LogBox} from 'react-native';
import {StackActions} from '@react-navigation/native';

LogBox.ignoreLogs(['new NativeEventEmitter']);
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

const winWidth = Dimensions.get('window').width;
let permissionTimer = null;

const Permissions = ({navigation, route}) => {
  const [locationPermission, setLocationPermission] = useState(null);
  const [bluetoothConnectPermission, setBluetoothConnectPermission] =
    useState(null);
  const [bluetoothScanPermission, setBluetoothScanPermission] = useState(null);
  const [bluetoothStatus, setBluetoothStatus] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalError, setModalError] = useState(false);
  const [modalText, setModalText] = useState('N/A');

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
    // checkAllPermissions();
    // if (
    //   locationPermission == 'granted' &&
    //   bluetoothStatus == 'PoweredOn' &&
    //   bluetoothConnectPermission == 'granted' &&
    //   bluetoothScanPermission == 'granted'
    // ) {
    //   clearInterval(permissionTimer);
    //   navigation.dispatch(StackActions.replace('Home'));
    // }
    permissionTimer = setInterval(() => {
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
      style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <View
        style={{
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
                onPress={() => {
                  setModalVisible(!modalVisible);
                  if (!modalError) {
                    openSettings().catch(() =>
                      console.warn('cannot open settings'),
                    );
                  }
                }}>
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

        <View
          style={{
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text
            style={{
              fontFamily: 'Inter-Bold',
              marginBottom: '10%',
              color: 'white',
              fontSize: 2 * (winWidth / 60),
            }}>
            WE NEED SOME ACCESS
          </Text>
          <Text
            style={{
              textAlign: 'center',
              lineHeight: 2 * (winWidth / 60),
              marginBottom: 30,
              color: 'gray',
              fontSize: 2 * (winWidth / 80),
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
              borderRadius: 2 * (winWidth / 10),
              borderColor: 'black',
              borderWidth: locationPermission == 'granted' ? 0 : 2,
              shadowColor: '#000',
              shadowOffset: {width: -4, height: 4},
              shadowOpacity: 1,
              shadowRadius: 1,
              width: '100%',
              height: '8%',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '5%',
              elevation: locationPermission == 'granted' ? 0 : 2,
            }}>
            <Text
              style={{
                color: locationPermission == 'granted' ? 'darkgrey' : 'black',
                fontFamily: 'Inter-Bold',
                fontSize: 2 * (winWidth / 60),
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
              borderRadius: 2 * (winWidth / 10),
              borderColor: 'black',
              borderWidth:
                (bluetoothScanPermission == 'granted' &&
                  bluetoothConnectPermission == 'granted') ||
                (Platform.OS == 'android' &&
                  Platform.constants['Release'] <= 11)
                  ? 0
                  : 2,
              shadowColor: '#000',
              shadowOffset: {width: -4, height: 4},
              shadowOpacity: 1,
              shadowRadius: 1,
              width: '100%',
              height: '8%',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '5%',
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
                fontSize: 2 * (winWidth / 60),
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
              borderRadius: 2 * (winWidth / 10),
              borderColor: 'black',
              borderWidth: bluetoothStatus == 'PoweredOn' ? 0 : 2,
              shadowColor: '#000',
              shadowOffset: {width: -4, height: 4},
              shadowOpacity: 1,
              shadowRadius: 1,
              width: '100%',
              height: '8%',
              justifyContent: 'center',
              alignItems: 'center',
              elevation: bluetoothStatus == 'PoweredOn' ? 0 : 2,
            }}>
            <Text
              style={{
                color: bluetoothStatus == 'PoweredOn' ? 'darkgrey' : 'black',
                fontFamily: 'Inter-Bold',
                fontSize: 2 * (winWidth / 60),
              }}>
              TURN ON BLUETOOTH
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};
export default Permissions;

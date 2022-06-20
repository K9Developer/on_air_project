import {
  View,
  Text,
  Pressable,
  Platform,
  Modal,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';
import {SHADOWS} from '../constants';
import React, {useEffect, useState} from 'react';
import {
  check,
  PERMISSIONS,
  requestMultiple,
  openSettings,
} from 'react-native-permissions';
import BluetoothStateManager from 'react-native-bluetooth-state-manager';
import {LogBox} from 'react-native';

LogBox.ignoreLogs(['new NativeEventEmitter']);
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

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
    checkAllPermissions();
    if (
      locationPermission == 'granted' &&
      bluetoothStatus == 'PoweredOn' &&
      bluetoothConnectPermission == 'granted' &&
      bluetoothScanPermission == 'granted'
    ) {
      clearInterval(permissionTimer);
      navigation.navigate('Home');
    }
    permissionTimer = setInterval(() => {
      checkAllPermissions();
      if (
        locationPermission == 'granted' &&
        bluetoothStatus == 'PoweredOn' &&
        bluetoothConnectPermission == 'granted' &&
        bluetoothScanPermission == 'granted'
      ) {
        clearInterval(permissionTimer);
        navigation.navigate('Home');
      }
    }, 500);
  });

  return (
    <View>
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
              onPress={() => {
                setModalVisible(!modalVisible);
                openSettings().catch(() =>
                  console.warn('cannot open settings'),
                );
              }}>
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

      <View
        style={{
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 40,
        }}>
        <Text
          style={{
            fontFamily: 'Inter-Bold',
            fontSize: 20,
            marginBottom: 25,
            color: 'white',
          }}>
          WE NEED SOME ACCESS
        </Text>
        <Text style={{textAlign: 'center', lineHeight: 25, marginBottom: 30}}>
          Our app is using BLE (bluetooth low energy). Apps using that, require
          location and bluetooth permission. Don't worry we dont share or store
          your information.
        </Text>

        <View
          style={{
            marginBottom: 10,
          }}>
          <Pressable
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
              borderRadius: 50,
              borderColor:
                locationPermission == 'granted' ? 'darkgrey' : 'black',
              borderWidth: 2,
              ...SHADOWS.extraDark,
            }}>
            <Text
              style={{
                color: locationPermission == 'granted' ? 'darkgrey' : 'black',
                paddingHorizontal: 60,
                paddingVertical: 20,
                fontFamily: 'Inter-Bold',
              }}>
              GRANT LOCATION ACCESS
            </Text>
          </Pressable>
        </View>

        <View
          style={{
            marginBottom: 10,
          }}>
          <Pressable
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
                    ]).then(() => {
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
                bluetoothScanPermission != 'granted' &&
                bluetoothConnectPermission != 'granted'
                  ? 'white'
                  : 'gray',
              borderRadius: 50,
              borderColor:
                bluetoothScanPermission == 'granted' &&
                bluetoothConnectPermission == 'granted'
                  ? 'darkgrey'
                  : 'black',
              borderWidth: 2,
              ...SHADOWS.extraDark,
            }}>
            <Text
              style={{
                color:
                  bluetoothScanPermission == 'granted' &&
                  bluetoothConnectPermission == 'granted'
                    ? 'darkgrey'
                    : 'black',
                paddingHorizontal: 55,
                paddingVertical: 20,
                fontFamily: 'Inter-Bold',
              }}>
              GRANT BLUETOOTH ACCESS
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => {
            if (bluetoothStatus != 'granted') {
              BluetoothStateManager.requestToEnable().catch(e => {
                console.log('error turning on bluetooth:', e);
              });
            }
          }}
          style={{
            backgroundColor: bluetoothStatus == 'PoweredOn' ? 'grey' : 'white',
            borderRadius: 50,
            borderColor: bluetoothStatus == 'PoweredOn' ? 'darkgrey' : 'black',
            borderWidth: 2,
            ...SHADOWS.extraDark,
          }}>
          <Text
            style={{
              color: bluetoothStatus == 'PoweredOn' ? 'darkgrey' : 'black',
              paddingHorizontal: 80,
              paddingVertical: 20,
              fontFamily: 'Inter-Bold',
            }}>
            TURN ON BLUETOOTH
          </Text>
        </Pressable>
      </View>
    </View>
  );
};
export default Permissions;

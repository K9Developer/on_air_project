import {FlatList, View, Text, Image, TouchableOpacity} from 'react-native';
import React from 'react';
import {SHADOWS} from '../constants';
import {CircleButton} from '../components';

let DATA = [];

const DeviceChooser = ({navigation, route}) => {
  //   route = {
  //     params: {
  //       scannedDevices: [
  //         {name: 'BT05', id: 'DFKSHFS:DF:SD:F:SD'},
  //         {name: 'BT05', id: 'SDFSKDFJ:sdf:SDF:SDF'},
  //         {name: 'BT05', id: 'SDFSKDFJ:SDFSDF:SDF:SDF'},
  //       ],
  //     },
  //   };

  const connectDevice = device => {
    navigation.navigate('Settings', {connectToDevice: true, device: device});
  };

  const Item = ({title, id, data, index, length}) => (
    <TouchableOpacity
      onPress={() => {
        connectDevice(data);
      }}>
      <View
        style={{
          width: '100%',
          marginTop: 15,
          backgroundColor: '#1B1B1B',
          paddingVertical: 30,
          paddingTop: 30,
          paddingLeft: 20,
          borderBottomLeftRadius: index == length - 1 ? 20 : 0,
          borderBottomRightRadius: index == length - 1 ? 20 : 0,
          borderTopLeftRadius: index == 0 ? 20 : 0,
          borderTopRightRadius: index == 0 ? 20 : 0,
          ...SHADOWS.extraDark,
        }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}>
          <Text style={{fontSize: 20, fontWeight: 'bold'}}>{title}</Text>
          <View
            style={{
              flexDirection: 'row',
            }}>
            <TouchableOpacity>
              <Image
                source={require('../assets/icons/eye.png')}
                style={{
                  width: 30,
                  height: 30,
                  marginRight: 20,
                }}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                connectDevice(data);
              }}>
              <Image
                source={require('../assets/icons/checkmark.png')}
                style={{
                  width: 30,
                  height: 30,
                  marginRight: 10,
                }}
              />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={{fontSize: 15, color: 'gray'}}>{id}</Text>
      </View>
    </TouchableOpacity>
  );

  let DATA = route.params.scannedDevices;
  console.log(DATA);

  const renderItem = ({item, index}) => (
    <Item
      title={item.name}
      id={item.id}
      data={item}
      index={index}
      length={DATA.length}
    />
  );

  return (
    <View
      style={{
        margin: 10,
        width: '95%',
        height: '93%',
      }}>
      <CircleButton
        imgUrl={require('../assets/icons/back.png')}
        handlePressDown={() => {}}
        handlePressUp={() => {
          navigation.navigate('Settings', {connectToDevice: false});
        }}
        size={[30, 30]}
        {...{marginLeft: 10, marginTop: 10, backgroundColor: 'transparent'}}
      />

      <Text
        style={{
          fontSize: 25,
          width: '120%',
          marginLeft: -30,
          paddingBottom: 10,
          textAlign: 'center',
        }}>
        Choose your device
      </Text>
      <Text
        style={{
          textAlign: 'center',
          borderBottomColor: 'gray',
          borderBottomWidth: 2,
          marginBottom: 20,
          paddingBottom: 10,
        }}>
        We have found multiple OnAir devices, choose your own device (you can
        remember it for next time by it's ID shows below the name)
      </Text>
      <FlatList
        data={DATA}
        renderItem={renderItem}
        keyExtractor={item => item.id}
      />
    </View>
  );
};
export default DeviceChooser;

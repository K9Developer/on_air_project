import {useState} from 'react';
import React from 'react';
import {Alert, Modal, Pressable, Text, Image, View} from 'react-native';

// type 1: info
// type 0: error
const Popup = args => {
  let {text, visible, type} = args;

  const [visiblePopup, setVisiblePopup] = useState(visible);
  setVisiblePopup(visible);
  console.log('text: ' + text);
  console.log('visible: ' + visiblePopup, visible);
  console.log('type: ' + type);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visiblePopup}
      onRequestClose={() => {
        Alert.alert('Modal has been closed.');
      }}>
      <View
        style={{
          backgroundColor: 'rgba(0,0,0,0.5)',
          flex: 1,
        }}>
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
                type
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
              {type ? 'Oh Snap!' : 'Info'}
            </Text>
            <Text
              style={{
                color: '#6f7173',
                paddingRight: 40,
                paddingLeft: 40,
                fontSize: 15,
                textAlign: 'center',
              }}>
              {text}
            </Text>

            <Pressable
              style={{
                borderBottomRightRadius: 20,
                borderBottomLeftRadius: 20,
                width: '100%',
                padding: 20,
                elevation: 2,
                backgroundColor: type ? '#db4d4d' : '#2196F3',
                marginTop: 30,
                bottom: 0,
              }}
              onPress={() => setVisiblePopup(!visiblePopup)}>
              <Text
                style={{
                  color: 'white',
                  fontSize: 20,
                  textAlign: 'center',
                }}>
                {type ? 'Dismiss' : 'Ok'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default Popup;

import React, { useEffect } from 'react';
import {
  Text,
  View,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Platform,
} from 'react-native';
import { CircleButton } from '../components';
import { Linking } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import email from 'react-native-email';
import { log } from '../services/logs'

const winWidth = Dimensions.get('window').width;

const version = 1.5
let enter_time = null

const getLogs = async () => {
  let prevLogs = await AsyncStorage.getItem("@sessionLogs");
  return prevLogs
}

const AboutMe = ({ navigation }) => {

  useEffect(() => {
    log("ABOUTME", "Loading aboutme screen")
    enter_time = new Date().getTime()
  }, [])


  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{
          width: "100%",
          alignItems: "flex-start"
        }}>
          <CircleButton
            imgUrl={require('../assets/icons/back.png')}
            handlePressDown={() => { }}
            handlePressUp={() => {
              navigation.goBack();
              log("ABOUTME", `Exited about me screen.`)
            }}
            size={[winWidth / 10, winWidth / 10]}
            {...{
              marginLeft: winWidth / 15,
              marginTop: winWidth / 15,
              backgroundColor: 'transparent',
            }}
          /></View>
        <View
          style={{
            width: '100%',
            height: '100%',
            justifyContents: 'center',
            alignItems: 'center',
          }}>
          <View
            style={{
              marginTop: '10%',
              width: '80%',
              height: '90%',
              alignItems: 'center',
            }}>
            <Text
              style={{
                fontSize: 2 * (winWidth / 60),
                lineHeight: 2 * (winWidth / 30),
                color: 'white',
                textAlign: 'center',
              }}>
              Hello, This is the about me page. Here you'll be able to find out
              how to contact me and why I created this app.
            </Text>
            <Text
              style={{
                fontSize: 2 * (winWidth / 60),
                lineHeight: 2 * (winWidth / 30),
                marginTop: 50,
                textAlign: 'center',
                color: 'white',
              }}>
              My name is Ilai and I'm 14. I created this app, because my uncle
              had created a system that can automatically inflate and deflate
              wheels, and he wanted an interface that can interact with the
              system via his phone. So I made one.
            </Text>

            <Text
              style={{
                fontSize: 2 * (winWidth / 60),
                lineHeight: 2 * (winWidth / 30),
                marginTop: 50,
                color: 'white',
                textAlign: 'center',
              }}>
              Hope you enjoy the app, any feedback would be appreciated (you can
              click on the mail button).
              {'\n\n'}
              <Text style={{
                fontWeight: 'bold',

              }}>
                App Version: {version}</Text>
            </Text>
            <View
              style={{
                flexDirection: 'row',
              }}>
              <CircleButton
                imgUrl={require('../assets/icons/github.png')}
                handlePressDown={() => { }}
                handlePressUp={() => {
                  Linking.openURL('https://github.com/KingOfTNT10');
                }}
                size={[2 * (winWidth / 10), 2 * (winWidth / 10)]}
                {...{
                  marginRight: '25%',
                  marginTop: 100,
                  backgroundColor: 'transparent',
                }}
              />
              <CircleButton
                imgUrl={require('../assets/icons/email.png')}
                handlePressDown={() => { }}
                handlePressUp={async () => {
                  let os = Platform.OS;
                  let osVersion = Platform.Version;
                  let brand = DeviceInfo.getBrand();
                  let deviceId = DeviceInfo.getDeviceId();
                  let model = DeviceInfo.getModel();

                  email('ilai.keinan@gmail.com', {
                    subject: '--+=Feedback about OnAir App=+--',
                    body: `\n─────────────────────────────\n\nMy experience with the app [0-10]:\n\n─────────────────────────────\n\n\n\n─────────────────────────────\n\nHow many bugs did you find [0 - ∞]:\n\n─────────────────────────────\n\n\n\n─────────────────────────────\n\nOther notes (the bugs/feedback):\n\n─────────────────────────────\n\n\n\n─────────────────────────────\n\nSystem info (for developer):\n\n    OS: ${os}\n    OS Version: ${osVersion}\n    Device Brand: ${brand}\n    Device ID: ${deviceId}\n    Device Model: ${model}\n\n─────────────────────────────\n\n\n\n\n\n\nLOGS:\n${await getLogs()}`,
                    checkCanOpen: false,
                  }).catch(console.error);
                }}
                size={[2 * (winWidth / 10), 2 * (winWidth / 10)]}
                {...{
                  marginLeft: '25%',
                  marginTop: 100,
                  backgroundColor: 'transparent',
                }}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
export default AboutMe;

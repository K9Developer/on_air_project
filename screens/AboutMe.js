import React from 'react';
import {Text, View} from 'react-native';
import {CircleButton} from '../components';
import {Linking} from 'react-native';
import email from 'react-native-email';

const AboutMe = ({navigation}) => {
  return (
    <View>
      <CircleButton
        imgUrl={require('../assets/icons/back.png')}
        handlePressDown={() => {}}
        handlePressUp={() => {
          navigation.navigate('Home');
        }}
        size={[30, 30]}
        {...{marginLeft: 10, marginTop: 10, backgroundColor: 'transparent'}}
      />
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
            width: '90%',
            height: '90%',
            alignItems: 'center',
          }}>
          <Text style={{fontSize: 17, lineHeight: 30, textAlign: 'center'}}>
            Hello, This is the about me page. Here you'll be able to find out
            how to contact me and why I created this app.
          </Text>
          <Text
            style={{
              fontSize: 17,
              lineHeight: 30,
              marginTop: 50,
              textAlign: 'center',
            }}>
            My name is Ilai and I'm 14. I created this app, because my uncle had
            created a system that can automatically inflate and deflate wheels,
            and he wanted an interface that can interact with the system via his
            phone. So I made one.
          </Text>
          <Text
            style={{
              fontSize: 17,
              lineHeight: 30,
              marginTop: 50,
              textAlign: 'center',
            }}>
            Hope you enjoy the app, any feedback would be appreciated (you can
            click on the mail button).
          </Text>
          <View
            style={{
              flexDirection: 'row',
            }}>
            <CircleButton
              imgUrl={require('../assets/icons/github.png')}
              handlePressDown={() => {}}
              handlePressUp={() => {
                Linking.openURL('https://github.com/KingOfTNT10');
              }}
              size={[70, 70]}
              {...{
                marginRight: '25%',
                marginTop: 100,
                backgroundColor: 'transparent',
              }}
            />
            <CircleButton
              imgUrl={require('../assets/icons/email.png')}
              handlePressDown={() => {}}
              handlePressUp={() => {
                email('ilai.keinan@gmail.com', {
                  subject: '--+=Feedback about OnAir App=+--',
                  body: 'My experience using the app (out of 10):\n\n\nOther notes:\n',
                  checkCanOpen: false, // Call Linking.canOpenURL prior to Linking.openURL
                }).catch(console.error);
              }}
              size={[70, 70]}
              {...{
                marginTop: 100,
                backgroundColor: 'transparent',
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );
};
export default AboutMe;

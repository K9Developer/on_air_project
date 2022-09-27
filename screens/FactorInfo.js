import React, { useState } from 'react'
import {
    Text,
    SafeAreaView,
    TouchableOpacity,
    Image,
    View,
    Dimensions,
    ScrollView
} from 'react-native'

const winWidth = Dimensions.get('window').width;

const FactorInfo = ({ navigation, route }) => {

    return (
        <SafeAreaView style={{ flex: 1, padding: '5%', }}>
            <ScrollView>
                <View style={{
                    paddingBottom: 10,
                    borderBottomWidth: 2,
                    borderBottomColor: 'rgba(0,0,0,0.2)',
                    flexDirection: 'row',

                    paddingHorizontal: '5%'
                }}>
                    <TouchableOpacity
                        onPress={() => { navigation.goBack() }}
                        style={{
                            width: "10%",
                            aspectRatio: 1,
                            maxWidth: '50%',
                            position: 'absolute'
                        }}>
                        <Image
                            key={new Date()}
                            source={require('../assets/icons/back.png')}
                            resizeMode="contain"
                            style={{
                                width: '100%',
                                height: '100%',
                                aspectRatio: 1,

                            }}
                        /></TouchableOpacity>
                    <Text style={{
                        width: '100%',
                        fontSize: 2 * (winWidth / 25),
                        textAlign: 'center',
                        color: 'white',
                    }}>
                        FACTOR
                    </Text>


                </View>
                <View style={{
                    width: "100%",
                    height: '100%',
                    marginTop: '10%',
                    flexDirection: 'column',
                }}>

                    <Text style={{
                        lineHeight: 30, color: 'white',
                        fontSize: 2 * (winWidth / 50)
                    }}>
                        The factor is a calculation that takes these parameters into account:{'\n'}
                        {'    '}<Text style={{ fontWeight: 'bold' }}>1. Your tire size{'\n'} </Text>
                        {'    '}<Text style={{ fontWeight: 'bold' }}>2. Number of tires being On Aired{'\n'}</Text>
                        {'    '}<Text style={{ fontWeight: 'bold' }}>3. The power of your air compressor{'\n'}</Text>
                        {'\n'}
                        All together creates the algorithm that the On Air system uses to inflate/deflate your tires.{'\n'}
                        A value of 6 is a good point to start.{'\n'}
                        You will know the right value for your system when there are the least amount of stops to measure the air pressure at the tire.{'\n'}
                        A higher value means the system checks the tire pressure less frequently (higher value = bigger tire){'\n'}
                        Have fun using On Air.{'\n'}
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

export default FactorInfo

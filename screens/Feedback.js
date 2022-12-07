import React, { useState, useEffect } from 'react';
import {
    Text,
    SafeAreaView,
    View,
    TextInput,
    TouchableOpacity,
    Platform,
    Image,
    ActivityIndicator
} from 'react-native';
import BouncyCheckbox from "react-native-bouncy-checkbox";
import { Slider } from '@miblanchard/react-native-slider';
import Toast, { SuccessToast, ErrorToast } from 'react-native-toast-message';
const { Octokit } = require("@octokit/core");
import DeviceInfo from 'react-native-device-info';
import { log } from '../services/logs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from "buffer";

const emojiList = ["😖", "😕", "😐", "🙂", "🤩"];
const starRating = ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"];
const token = "Z2hwX2k3b1NSOVNWVEx4UU5OQVNOcEhBTmozV3FTQ09RYTFhQ1lYaQ==";
let buff = new Buffer(token, 'base64');
let text = buff.toString('ascii');
const octokit = new Octokit({ auth: text });

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

const Feedback = ({ navigation }) => {
    const [bug, setBug] = useState(false);
    const [appCrash, setAppCrash] = useState(false);
    const [rate, setRate] = useState(3);
    const [bugReport, setBugReport] = useState("");
    const [thoughtsOnApp, setThoughtsOnApp] = useState("");
    const [sending, setSending] = useState(false);


    useEffect(() => {
        log("HOME", `Loading feedback screen.`);
    }, []);


    const submit = async () => {
        if (bug && !bugReport) {
            Toast.show({
                type: 'error',
                text1: 'Please submit a bug report',
            });
        }
        let os = Platform.OS;
        let osVersion = Platform.Version;
        let brand = DeviceInfo.getBrand();
        let deviceId = DeviceInfo.getDeviceId();
        let model = DeviceInfo.getModel();
        let labels = ["feedback"];
        let logs = appCrash ? await AsyncStorage.getItem("@prevSessionLogs") : await AsyncStorage.getItem("@sessionLogs");
        setSending(true);
        if (bug) labels.push("bug");
        if (appCrash) labels.push("app crash");

        let mdFeedback = `
### Device Data
------
    * Operating System: \`${os}\`
    * Operating System Version: \`${osVersion}\`
    * Device Brand: \`${brand}\`
    * Device ID: \`${deviceId}\`
    * Device Model: \`${model}\`
    * Is Tablet: \`${DeviceInfo.isTablet()}\`
    * Device Name: \`${await DeviceInfo.getDeviceName()}\`
    * API Level: \`${await DeviceInfo.getApiLevel()}\`
    * Release Version: \`${Platform.constants['Release']}\`
    
- [${bug ? 'x' : ' '}] Bug
- [${appCrash ? 'x' : ' '}] App Crash

${bug ?
                `
### Bug Report
------
\`
${bugReport}  \`          
            ` : ''
            }

${thoughtsOnApp || rate ?
                `
### App Review
------
    * Rating: ${starRating[rate - 1]}
    * Thoughts On App: ${thoughtsOnApp ? thoughtsOnApp : 'N/A'}            
    ` : ''
            }

### Logs
------
<details>
<summary>logs</summary>

\`\`\`
${JSON.parse(logs ? logs : '[]').join('\n')}
\`\`\`
</details>
`;
        octokit.request('POST /repos/KingOfTNT10/on_air_project/issues', {
            owner: 'KingOfTNT10',
            repo: 'on_air_project',
            title: 'Feedback',
            body: mdFeedback,
            assignees: [
                'KingOfTNT10'
            ],
            labels: labels
        }).then(() => {
            log("FEEDBACK", "Sent feedback");
            Toast.show({
                type: 'success',
                text1: "Successfully Sent Feedback"
            });
            setSending(false);
        }).catch((e) => {
            log("FEEDBACK", `ERROR when tried sending feedback. (${e})`);
            Toast.show({
                type: 'error',
                text1: "Couldn't Send Feedback"
            });
            setSending(false);
        });

    };

    return (

        <SafeAreaView style={{ flex: 1, alignItems: 'center', margin: 10, marginTop: 0 }}>

            <View style={{
                width: '150%',
                height: '12%',
                marginBottom: '5%'
            }}>
                <View style={{
                    backgroundColor: '#2d86cf',
                    width: '100%',
                    height: '100%',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <TouchableOpacity
                        onPress={() => { log("ABOUT-ME", `Exited Feedback screen.`); navigation.goBack(); }}
                        style={{
                            width: "5%",
                            aspectRatio: 1,
                            left: "20%",
                            position: 'absolute'
                        }}>
                        <Image
                            key={new Date().getTime()}
                            source={require('../assets/icons/back.png')}
                            resizeMode="contain"
                            style={{
                                width: '100%',
                                height: '100%',
                                aspectRatio: 1,

                            }}
                        /></TouchableOpacity>
                    <Text style={{
                        fontSize: 30,

                        height: '100%',
                        color: 'white',
                        textAlignVertical: 'center',
                        textAlign: 'center'
                    }}>Feedback</Text>

                </View>
            </View>
            <Toast
                visibilityTime={5000}
                config={toastConfig}

            />
            <View style={{
                width: '100%',
                height: '100%',
                margin: 10,
            }}>
                <View style={{
                    flexDirection: 'row',

                    borderBottomWidth: 1,
                    marginBottom: '5%',
                    paddingBottom: '5%',
                    borderBottomColor: 'rgba(0,0,0,0.2)'
                }}>
                    <BouncyCheckbox
                        fillColor="lightblue"
                        unfillColor="#FFFFFF"
                        text="Bug Report"
                        textStyle={{ fontFamily: "JosefinSans-Regular", color: 'white', textDecorationLine: "none", }}
                        disableBuiltInState
                        isChecked={bug}
                        onPress={() => { setBug(!bug); }}
                    />

                    {
                        bug ? <BouncyCheckbox
                            style={{
                                marginLeft: "10%"
                            }}
                            fillColor="lightblue"
                            unfillColor="#FFFFFF"
                            text="App Crash"
                            textStyle={{ fontFamily: "JosefinSans-Regular", color: 'white', textDecorationLine: "none", }}
                            disableBuiltInState
                            isChecked={appCrash}
                            onPress={() => { setAppCrash(!appCrash); }}
                        /> : null
                    }

                </View>
                <View style={{
                    alignItems: 'stretch',

                    justifyContent: 'center',
                }}>
                    <Text style={{ color: 'white' }}>Rate The App: {emojiList[rate - 1]}</Text>
                    <Slider
                        containerStyle={{
                            width: '100%',
                            marginBottom: '10%'
                        }}
                        renderTrackMarkComponent={(a) => (
                            <Text style={{
                                marginTop: 30,
                                marginLeft: 5,
                                color: a + 1 > rate ? 'white' : a + 1 == rate ? '#f5cb25' : '#dee67c'
                            }}>{a + 1}</Text>
                        )}
                        animateTransitions
                        value={rate}
                        step={1}
                        minimumTrackTintColor="white"
                        maximumTrackTintColor="gray"
                        minimumValue={1}
                        maximumValue={5}
                        trackMarks={[1, 2, 3, 4, 5]}
                        onValueChange={value => { setRate(value[0]); console.log(rate); }}
                    />
                </View>

                {
                    bug ?
                        <View>
                            <Text style={{ color: 'white', marginBottom: 5 }}>What was the bug</Text>
                            <TextInput multiline style={{
                                borderColor: 'white',
                                borderRadius: 10,
                                borderWidth: 1,
                                marginBottom: "8%"
                            }} onChangeText={(text) => { setBugReport(text); }} />
                        </View> : null
                }
                <Text style={{ color: 'white', marginBottom: 5 }}>What did you think of the app</Text>
                <TextInput multiline style={{
                    borderColor: 'white',
                    borderRadius: 10,
                    borderWidth: 1
                }} onChangeText={(text) => { setThoughtsOnApp(text); }} />

                <View style={{
                    marginTop: '10%',
                    width: '100%',
                    height: '10%',
                    alignItems: 'center',
                    alignContent: 'center'
                }}>
                    {
                        sending ?
                            <ActivityIndicator
                                size="large"
                                color="#fff"
                                style={{
                                    width: 30,
                                    height: 30,
                                    marginRight: 20,
                                }}
                            />
                            :
                            <TouchableOpacity
                                onPress={submit}
                                style={{
                                    backgroundColor: '#2d86cf',
                                    width: '50%',
                                    height: '100%',
                                    borderRadius: 20
                                }}>
                                <Text style={{
                                    color: 'white',
                                    width: '100%',
                                    height: '100%',
                                    textAlign: 'center',
                                    textAlignVertical: 'center',
                                    fontSize: 30
                                }}>Submit</Text>
                            </TouchableOpacity>
                    }
                </View>

            </View>

        </SafeAreaView>
    );
};

export default Feedback;
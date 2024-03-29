import PushNotification from "react-native-push-notification";


export const LocalNotification = async (wantedPSI, debug = false) => {
    PushNotification.localNotification({
        channelId: "done-channel",
        bigText: "Your operation is done! we successfully inflated/deflated your tire to " + wantedPSI + " PSI",
        color: "#4bab52",
        vibrate: true,
        when: true,
        showWhen: true,
        vibration: 20000,
        group: "done-channel",
        invokeApp: true,
        subText: "Done with operation",
        bigLargeIcon: "ic_launcher",
        ignoreInForeground: false,
        title: debug ? "DEBUG" : "DONE OnAir",
        message: "We have inflated/deflated your tire",
        playSound: true, // (optional) default: true
        soundName: "android.resource://com.on_air_project/raw/done_beep",
        visibility: 'public',
        importance: 'max',
        id: 1
    });
};

export const DisconnectedNotification = async () => {


    PushNotification.localNotification({
        channelId: "disconnect-channel",
        bigText: "The OnAir device has been disconnected from your phone",
        subText: "Disconnected",
        bigLargeIcon: "ic_launcher",
        color: "#eb4034",
        group: "disconnect-channel",
        ignoreInForeground: false,
        title: "Disconnected OnAir",
        message: "To reconnect go into your app and connect again via the settings page",
        id: 2,
        vibrate: true,
        vibration: 20000,
        playSound: true,
        soundName: "android.resource://com.on_air_project/raw/disconnect_sound",
        visibility: 'public',
        importance: 'max',
    });

};
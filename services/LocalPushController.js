import PushNotification from 'react-native-push-notification';


export const LocalNotification = (wantedPSI, debug = false) => {
    PushNotification.createChannel({
        channelId: "done-notif",
        channelName: "Done Notification",
        vibrate: true,
        vibration: 10000,
        soundName: 'long_beep.mp3',
        playSound: true,
    })

    PushNotification.localNotification({
        channelId: "done-notif",
        bigText: "Your operation is done! we successfully inflated/deflated your tire to " + wantedPSI + " PSI",
        subText: "Done with operation",
        bigLargeIcon: "ic_launcher",
        color: "#4bab52",
        visibility: "private",
        ignoreInForeground: false,
        title: debug ? "DEBUG" : "DONE OnAir",
        message: "We have inflated/deflated your tire",
    })
}
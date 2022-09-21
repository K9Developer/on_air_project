import PushNotification from 'react-native-push-notification';


export const LocalNotification = () => {
    PushNotification.createChannel({
        channelId: "done-notif",
        channelName: "Done Notification",
        vibrate: true,
        vibration: 10000,
        soundName: 'long_beep.mp3',
        playSound: true,
    })

    PushNotification.presentLocalNotification(
        {
            alertBody: 'Hello world!!!'
        }
    );
}
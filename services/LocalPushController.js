import PushNotification from 'react-native-push-notification';



export const LocalNotification = async (wantedPSI, debug = false) => {


    await PushNotification.channelExists("done-notif", (exists) => {
        if (!exists) {
            PushNotification.createChannel({
                channelId: "done-notif",
                channelName: "Done Notification",
            })
        }
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

export const DisconnectedNotification = async () => {


    await PushNotification.channelExists("disconnect-notif", (exists) => {
        if (!exists) {
            PushNotification.createChannel({
                channelId: "disconnect-notif",
                channelName: "Disconnect Notification",
            })
        }
    })

    PushNotification.localNotification({
        channelId: "disconnect-notif",
        bigText: "The OnAir device has been disconnected from your phone",
        subText: "Disconnected",
        bigLargeIcon: "ic_launcher",
        color: "#eb4034",
        visibility: "private",
        ignoreInForeground: false,
        title: "Disconnected OnAir",
        message: "To reconnect go into your app and connect again via the settings page",
    })
}
import AsyncStorage from '@react-native-async-storage/async-storage';

const updateLogs = async (log) => {
    let prevLogs = await AsyncStorage.getItem("@sessionLogs");
    prevLogs = JSON.parse(prevLogs)
    if (!prevLogs) {
        prevLogs = []
    }
    prevLogs.push(log)
    await AsyncStorage.setItem("@sessionLogs", JSON.stringify(prevLogs))
}

export const log = (loc = "N/A", ...args) => {

    let text = ""

    for (const [index, elem] of args.entries()) {
        let new_elem = elem;
        if (typeof elem != "string") {
            new_elem = JSON.stringify(elem)
        }
        text += new_elem + (index != args.length && " ")
    }
    let date = new Date()
    let now = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}.${date.getMilliseconds()}`;

    console.log(`INFO [${now}] (${loc}): ` + text);
    updateLogs(`INFO [${now}] (${loc}): ` + text)
}
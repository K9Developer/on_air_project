import { BleManager } from 'react-native-ble-plx';
import { log } from './logs'

export const recreateManager = (manager) => {
    if (manager === null) {
        manager = new BleManager();
        log("BLUETOOTH-UTILS", 'Bluetooth manager created');
    } else {
        manager.destroy();
        manager = new BleManager();
        log("BLUETOOTH-UTILS", 'Bluetooth manager reloaded');
    }
    return manager
}

export const connectToDevice = async (device, manager) => {
    try {
        log("BLUETOOTH-UTILS", `Connecting to bluetooth device - ${device ? device.id : null}`)
        let connectedDevice = await manager.connectToDevice(device.id);
        log("BLUETOOTH-UTILS", `Discovering services and characteristics for bluetooth device - ${device ? device.id : null}`)
        await connectedDevice.discoverAllServicesAndCharacteristics();
        return connectedDevice;
    } catch (error) {
        log("BLUETOOTH-UTILS", `ERROR when tried to connect/discover services and characteristics for device - ${device ? device.id : null}`)
        return null;
    }
}

export const sendDataToDevice = async (device, manager, data) => {
    try {
        let base64Signal = Buffer.from('~' + data + '^').toString('base64');
        log("BLUETOOTH-UTILS", `Sending data (${data}-${base64Signal}) to device - ${device ? device.id : null}`)
        return await manager.writeCharacteristicWithoutResponseForDevice(
            device.id,
            'FFE0',
            'FFE1',
            base64Signal,
        );
    } catch {
        log("BLUETOOTH-UTILS", `ERROR when tried sending data (${data}) to device - ${device ? device.id : null}`)
    }
}

export const scanForDevices = async (manager, timeout, found_callback, error_callback) => {
    log("BLUETOOTH-UTILS", "Starting scan")

    const scannedDevices = []

    setTimeout(() => {
        manager.stopDeviceScan();
        return { "scannedDevices": scannedDevices }
    }, timeout);

    await manager.startDeviceScan(
        null,
        null,
        (error, device) => {
            if (error) {
                error_callback(error)
            }

            if (device && device != 'null') {
                scannedDevices.push(device)
                found_callback(
                    {
                        "scannedDevices": scannedDevices
                    })
            }
        }

    );
}
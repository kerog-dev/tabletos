import deviceId from "./deviceid.ts";
import * as fs from "./fs.ts";

async function loadDeviceName() {
  try {
    return await fs.readTextFile("/devicename.txt");
  } catch {
    return deviceId;
  }
}

const deviceName = await loadDeviceName();

export default deviceName;

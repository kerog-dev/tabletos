import type { Sdk } from "../sdk.ts";

const { fs }: Sdk = (window as any).$;

let deviceId: string;
if (await fs.pathExists("/deviceid.txt")) deviceId = await fs.readTextFile("/deviceid.txt");
else {
  deviceId = (60466176 + Math.floor(Math.random() * (36 ** 6 - 60466176))).toString(36);
  await fs.writeFile("/deviceid.txt", deviceId);
}

export default deviceId;

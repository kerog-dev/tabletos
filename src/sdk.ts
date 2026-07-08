import type { WindowDesc } from "./components/wm/WindowManager.tsx";
import { createDatabase } from "./jsondb.ts";
import deviceId from "./lib/deviceid.ts";
import deviceName from "./lib/devicename.ts";
import * as fs from "./lib/fs.ts";
import { fetch as afetch } from "./lib/net.ts";
import conn from "./lib/rpc.ts";
import * as ws from "./lib/ws.ts";
import { sv, useApps } from "./loader/loader.ts";
import { toast, Urgency } from "./toast.tsx";

interface Sdk {
  toast: typeof toast;
  Urgency: typeof Urgency;
  fs: typeof fs;
  getAppDir(name: string): Promise<string>;
  useApps: typeof useApps;
  conn: typeof conn;
  spawnWindow: (w: Omit<Partial<WindowDesc>, "app" | "id" | "z"> & { app: string }) => void;
  sv: typeof sv;
  afetch: typeof afetch;
  deviceId: string;
  deviceName: string;
  ws: typeof ws;
  jsonDB: typeof createDatabase;
}

const sdk: Sdk = {
  toast,
  Urgency,
  fs,
  async getAppDir(name: string) {
    if (!(await fs.isDir("/appdata"))) await fs.mkdir("/appdata");
    if (!(await fs.isDir(`/appdata/${name}`))) await fs.mkdir(`/appdata/${name}`);
    return `/appdata/${name}`;
  },
  useApps,
  conn,
  spawnWindow: () => {},
  sv,
  afetch,
  deviceId,
  deviceName,
  ws,
  jsonDB: createDatabase,
};

(window as any).$ = sdk;
(window as any).$resolve();

export { type Sdk };

import type { RpcConnection } from "./applib/rpc.ts";
import conn from "./applib/rpc.ts";
import { useApps } from "./apps.ts";
import type { WindowDesc } from "./components/wm/WindowManager.tsx";
import * as fs from "./fs.ts";
import storage, { useStorage } from "./storage.ts";
import { toast, Urgency } from "./toast.tsx";

interface Sdk {
  toast: typeof toast;
  Urgency: typeof Urgency;
  storage: typeof storage;
  useStorage: typeof useStorage;
  fs: typeof fs;
  getAppDir(name: string): Promise<string>;
  useApps: typeof useApps;
  conn: RpcConnection;
  spawnWindow: (w: Omit<Partial<WindowDesc>, "app" | "id" | "z"> & { app: string }) => void;
}

const sdk: Sdk = {
  toast,
  Urgency,
  storage,
  useStorage,
  fs,
  async getAppDir(name: string) {
    if (!(await fs.isDir("/appdata"))) await fs.mkdir("/appdata");
    if (!(await fs.isDir(`/appdata/${name}`))) await fs.mkdir(`/appdata/${name}`);
    return `/appdata/${name}`;
  },
  useApps,
  conn,
  spawnWindow: () => {},
};

(window as any).$ = sdk;
(window as any).$resolve();

export { type Sdk };

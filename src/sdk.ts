import type { WindowDesc } from "./components/wm/WindowManager.tsx";
import * as fs from "./lib/fs.ts";
import type { RpcConnection } from "./lib/rpc.ts";
import conn from "./lib/rpc.ts";
import storage, { useStorage } from "./lib/storage.ts";
import { useApps } from "./packages.ts";
import { sv } from "./packages.ts";
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
  sv: typeof sv;
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
  sv,
};

(window as any).$ = sdk;
(window as any).$resolve();

export { type Sdk };

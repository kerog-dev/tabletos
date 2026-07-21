import { MarkdownComponent } from "./components/MarkdownComponent.tsx";
import { useDialog } from "./components/wm/Dialog.tsx";
import { deleteTray, setTray } from "./components/wm/tray.ts";
import { useWindow } from "./components/wm/WindowContext.tsx";
import type { WindowDesc } from "./components/wm/WindowManager.tsx";
import { eventlog } from "./eventlog.ts";
import { createDatabase } from "./jsondb.ts";
import deviceId from "./lib/deviceid.ts";
import deviceName from "./lib/devicename.ts";
import * as fs from "./lib/fs.ts";
import { fetch as afetch } from "./lib/net.ts";
import conn from "./lib/rpc.ts";
import * as ws from "./lib/ws.ts";
import { sv, useApps } from "./loader/loader.ts";
import { toast, Urgency } from "./toast.tsx";
import { mountVendorFs } from "./vendorfs.ts";

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
  useWindow: typeof useWindow;
  useDialog: typeof useDialog;
  eventlog: typeof eventlog;
  MarkdownComponent: typeof MarkdownComponent;
  tray: {
    set: typeof setTray;
    delete: typeof deleteTray;
  };
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
  useWindow,
  useDialog,
  eventlog,
  MarkdownComponent,
  tray: {
    set: setTray,
    delete: deleteTray,
  },
};

await mountVendorFs(sdk.fs);
(window as any).$ = sdk;
(window as any).$resolve();

export { type Sdk };

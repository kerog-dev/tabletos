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
};

(window as any).$ = sdk;

export { type Sdk };

import { loadPackageBlob, type Service, unloadPackage } from "../../loader/loader.ts";
import type { ScreenshotService } from "../../packages/ScreenshotService/service.ts";
import type { Sdk } from "../../sdk.ts";
import { blobToJsonString, jsonStringToBlob } from "../../utils.ts";

export interface RemoteServerObject {
  fs: Sdk["fs"];
  spawnWindow: Sdk["spawnWindow"];
  toast: Sdk["toast"];
  eval: (script: string) => { ok: true; result: any } | { ok: false; error: unknown };
  loadPackageFromBlob: (name: string, blob: Blob, install?: boolean) => Promise<void>;
  loadPackageFromFs: (name: string, path: string, install?: boolean) => Promise<void>;
  unloadPackage: (name: string) => void;
  uninstallPackage: (name: string) => Promise<void>;
  screenshot: () => Promise<string>;
  readBlob: (path: string) => Promise<string>;
  writeBlob: (path: string, encoded: string) => Promise<void>;
}

interface DB {
  authorizedClients: string[];
}

const service: Service = {
  info: {
    name: "Remote Server Service",
    autostart: true,
  },
  async start({ fs, spawnWindow, toast, conn, jsonDB, getAppDir, sv }) {
    const appDir = await getAppDir("RemoteServer");
    const db = await jsonDB<DB>(`${appDir}/db.json`);

    db.object.authorizedClients ??= [];

    const object: RemoteServerObject = {
      fs,
      spawnWindow,
      toast,
      eval(script) {
        try {
          return { ok: true, result: window.eval(script) };
        } catch (e) {
          return { ok: false, error: e };
        }
      },
      async loadPackageFromBlob(name, blob, install = false) {
        try {
          await loadPackageBlob(name, blob);
        } catch (e) {}
        if (install) {
          try {
            await fs.writeFile(`/packages/${name}`, blob);
          } catch (e) {}
        }
      },
      async loadPackageFromFs(name, path, install = false) {
        await this.loadPackageFromBlob(name, await fs.readBlobFile(path), install);
      },
      async uninstallPackage(name) {
        try {
          await fs.unlink(`/packages/${name}.zip`);
        } catch (e) {}
        try {
          this.unloadPackage(name);
        } catch (e) {}
      },
      unloadPackage,
      screenshot: async () => {
        const svc = sv.get<ScreenshotService>("Screenshot Service");
        if (!svc) throw "Screenshot Service not running.";
        const screenshot = await svc.screenshot(0.3);
        if (!screenshot) throw "Failed to get screenshot.";
        return await blobToJsonString(screenshot);
      },
      readBlob: async path => await blobToJsonString(await fs.readBlobFile(path)),
      writeBlob: async (path, encoded) => await fs.writeFile(path, jsonStringToBlob(encoded)),
    };

    conn.exposeObject(object, "remoteserver", true, (_0, _1, from) => {
      return db.object.authorizedClients.includes(from);
    });
    return {
      stop() {
        conn.unexposeObject("remoteserver");
      },
    };
  },
};

export default service;

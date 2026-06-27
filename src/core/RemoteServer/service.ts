import { type Service } from "../../packages.ts";
import { loadAppFromScript, unloadApp } from "../../packages.ts";
import type { Sdk } from "../../sdk.ts";
import { blobToJsonString, compress } from "../../utils.ts";

export interface RemoteServerObject {
  fs: Sdk["fs"];
  spawnWindow: Sdk["spawnWindow"];
  toast: Sdk["toast"];
  eval: (script: string) => { ok: true; result: any } | { ok: false; error: unknown };
  loadAppFromScript: (name: string, script: string, install?: boolean) => Promise<void>;
  loadAppFromFs: (name: string, path: string, install?: boolean) => Promise<void>;
  unloadApp: (name: string) => void;
  uninstallApp: (name: string) => Promise<void>;
  screenshot: () => Promise<string>;
}

const service: Service = {
  info: {
    name: "Remote Server Service",
    dependencies: [],
    autostart: false,
  },
  start({ fs, spawnWindow, toast, conn, screenshot }) {
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
      async loadAppFromScript(name, script, install = false) {
        await loadApp(name, script, install);
      },
      async loadAppFromFs(name, path, install = false) {
        await loadApp(name, await fs.readTextFile(path), install);
      },
      async uninstallApp(name) {
        await fs.unlink(`/apps/${name}.js.gz`);
        unloadApp(name);
      },
      unloadApp(name) {
        unloadApp(name);
      },
      screenshot: async () => await blobToJsonString(await screenshot(0.3)),
    };

    async function loadApp(name: string, script: string, install: boolean) {
      if (name.includes(".") || name.includes("/")) throw "Name mustn't contain dot or slash";
      if (install) {
        await fs.writeFile(`/apps/${name}.js.gz`, await compress(new Blob([script], { type: "text/javascript" })));
      }
      await loadAppFromScript(name, script);
    }

    conn.exposeObject(object, "remoteserver");
    return {
      stop() {
        conn.unexposeObject("remoteserver");
      },
    };
  },
};

export default service;

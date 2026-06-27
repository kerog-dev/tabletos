import { loadAppFromScript, unloadApp } from "../../packages.ts";
import type { Sdk } from "../../sdk.ts";
import { compress } from "../../utils.ts";

export interface RemoteServerObject {
  fs: Sdk["fs"];
  spawnWindow: Sdk["spawnWindow"];
  toast: Sdk["toast"];
  eval: (script: string) => { ok: true; result: any } | { ok: false; error: unknown };
  loadAppFromScript: (name: string, script: string, install?: boolean) => Promise<void>;
  loadAppFromFs: (name: string, path: string, install?: boolean) => Promise<void>;
  unloadApp: (name: string) => void;
  uninstallApp: (name: string) => Promise<void>;
}

const { conn, fs, spawnWindow, toast }: Sdk = (window as any).$;

class Server {
  private object: RemoteServerObject;
  private exposed = false;

  constructor() {
    const server = this;
    this.object = {
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
        await server.loadApp(name, script, install);
      },
      async loadAppFromFs(name, path, install = false) {
        await server.loadApp(name, await fs.readTextFile(path), install);
      },
      async uninstallApp(name) {
        await fs.unlink(`/apps/${name}.js.gz`);
        unloadApp(name);
      },
      unloadApp(name) {
        unloadApp(name);
      },
    };
  }

  private async loadApp(name: string, script: string, install: boolean) {
    if (name.includes(".") || name.includes("/")) throw "Name mustn't contain dot or slash";
    if (install) {
      await fs.writeFile(`/apps/${name}.js.gz`, await compress(new Blob([script], { type: "text/javascript" })));
    }
    await loadAppFromScript(name, script);
  }

  get status() {
    return this.exposed ? "Started" : "Stopped";
  }

  start() {
    if (this.exposed) return;
    conn.exposeObject(this.object, "remoteserver");
    this.exposed = true;
  }

  stop() {
    if (!this.exposed) return;
    conn.unexposeObject("remoteserver");
    this.exposed = false;
  }
}

const server = new Server();

export default function RemoteServer() {
  return (
    <div>
      Server status: {server.status}
      <br />
      Your client name: {conn.name}
      <br />
      <button onClick={() => server.start()}>Start</button>
      <button onClick={() => server.stop()}>Stop</button>
    </div>
  );
}

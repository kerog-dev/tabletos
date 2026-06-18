import { useEffect, useRef, useState } from "react";
import { loadAppFromScript, unloadApp } from "../apps.ts";
import { useApps } from "../apps.ts";
import * as fs from "../fs.ts";
import { fetch } from "../net.ts";
import { compress, decompress } from "../utils.ts";

export default function Installer() {
  const apps = useApps();
  const [remoteApps, setRemoteApps] = useState<string[] | null>(null);

  const installAppNameRef = useRef<HTMLInputElement | null>(null);
  const installFileInputRef = useRef<HTMLInputElement | null>(null);
  const installFileCompressedRef = useRef<HTMLInputElement | null>(null);

  const uninstallAppNameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("http://server/available-apps").then(res => res.json()).then(json => setRemoteApps(json));
  }, []);

  async function getData(compressed: boolean): Promise<[string, string] | null> {
    if (!installAppNameRef.current || !installFileInputRef.current || !installFileInputRef.current.files) return null;
    const file = installFileInputRef.current.files[0];
    const script = compressed ? await (await decompress(file)).text() : await file.text();
    return [installAppNameRef.current.value, script];
  }

  async function tempLoad(compressed: boolean, quiet = false) {
    const data = await getData(compressed);
    if (!data) {
      alert(`Did you provide the correct data?`);
      return;
    }
    loadAppFromScript(data[0], data[1]).then(() => quiet ? void 0 : alert(`Loaded successfully!`))
      .catch((reason) => alert(`Failed to load: ${reason}`));
    return data;
  }

  async function install(compressed: boolean) {
    const data = await tempLoad(compressed);
    if (!data) return;
    if (!(await fs.isDir("/apps"))) {
      await fs.mkdir("/apps");
    }
    await fs.writeFile(
      `/apps/${data[0]}.js.gz`,
      compressed
        ? new Blob([data[1]], { type: "application/gzip" })
        : await compress(new Blob([data[1]], { type: "text/javascript" })),
    );
  }

  async function uninstall(name?: string) {
    if (!name && !uninstallAppNameRef.current) return;
    if (!name && uninstallAppNameRef.current) name = uninstallAppNameRef.current.value;

    try {
      await fs.unlink(`/apps/${name}.js.gz`);
      unloadApp(name!);
      alert("Uninstalled successfully!");
    } catch (e) {
      alert(`Failed to uninstall: ${e}`);
    }
  }

  async function remoteInstall(name: string) {
    const response = await fetch(`http://server/apps/${name}.js.gz`);
    const inBlob = await response.blob();
    const decompressed = await decompress(inBlob);
    const script = await decompressed.text();
    loadAppFromScript(name, script).catch((reason) => alert(`Failed to load: ${reason}`));
    if (!(await fs.isDir("/apps"))) {
      await fs.mkdir("/apps");
    }
    await fs.writeFile(`/apps/${name}.js.gz`, inBlob);
    alert("Installed successfully!");
  }

  return (
    <div>
      <input type="text" ref={installAppNameRef} />
      <br />
      <input type="file" ref={installFileInputRef} />
      <br />
      <label>gz compressed?</label>
      <input type="checkbox" ref={installFileCompressedRef} />
      <button onClick={() => tempLoad(installFileCompressedRef.current?.checked ?? false)}>Load temporarily</button>
      <button onClick={() => install(installFileCompressedRef.current?.checked ?? false)}>Install</button>
      <hr />
      <input type="text" ref={uninstallAppNameRef} />
      <button onClick={() => uninstall()}>Uninstall</button>
      <hr />
      Or install from your local server:
      {remoteApps
        ? (
          <ul>
            {remoteApps.map(app => (
              <li key={app}>
                {app} ({apps.some(app2 => app2.name === app)
                  ? (
                    <>
                      Installed, <button onClick={() => uninstall(app)}>Uninstall</button>,{" "}
                      <button
                        onClick={() => {
                          uninstall(app).then(() => remoteInstall(app)).then(() => alert("Updated successfully!"))
                            .catch((reason) => alert(`Failed to update: ${reason}`));
                        }}
                      >
                        Update
                      </button>
                    </>
                  )
                  : <button onClick={() => remoteInstall(app)}>Install</button>})
              </li>
            ))}
          </ul>
        )
        : <p>Loading...</p>}
    </div>
  );
}

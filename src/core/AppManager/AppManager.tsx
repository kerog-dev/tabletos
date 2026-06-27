import { useEffect, useRef, useState } from "react";
import { fetch } from "../../lib/net.ts";
import { unloadApp } from "../../packages.ts";
import type { Sdk } from "../../sdk.ts";
import { toast } from "../../toast.tsx";

const { fs }: Sdk = (window as any).$;

export default function Installer() {
  const packageDirListing = fs.useDirListing("/packages");
  const [remotePackages, setRemotePackages] = useState<string[] | null>(null);

  const installPackageNameRef = useRef<HTMLInputElement | null>(null);
  const installFileInputRef = useRef<HTMLInputElement | null>(null);

  const uninstallPackageNameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("http://server/available-packages").then(res => res.json()).then(json => setRemotePackages(json));
  }, []);

  async function install(name: string, zipBlob: Blob) {
    if (!(await fs.isDir("/packages"))) await fs.mkdir("/packages");
    await fs.writeFile(`/packages/${name}.zip`, zipBlob);
    toast({ title: "Installed successfully!" });
  }

  async function uninstall(name?: string, quiet = false) {
    if (!name) throw "No name provided!";

    try {
      await fs.unlink(`/packages/${name}.zip`);
      unloadApp(name);
      if (!quiet) toast({ title: "Uninstalled successfully!" });
    } catch (e) {
      toast({ title: "Failed to uninstall", desc: "Error: " + e });
    }
  }

  async function remoteInstall(name: string) {
    const response = await fetch(`http://server/packages/${name}.zip`);
    const zipBlob = await response.blob();
    install(name, zipBlob);
  }

  return (
    <div>
      <input type="text" ref={installPackageNameRef} />
      <br />
      <input type="file" ref={installFileInputRef} />
      <br />
      <button
        onClick={() => {
          if (!installPackageNameRef.current || !installFileInputRef.current) return;
          const file = installFileInputRef.current.files?.[0];
          if (!file) throw "No file provided";
          install(installPackageNameRef.current.value, file);
        }}
      >
        Install
      </button>
      <hr />
      <input type="text" ref={uninstallPackageNameRef} />
      <button onClick={() => uninstall(uninstallPackageNameRef.current?.value)}>Uninstall</button>
      <hr />
      Or install from your local server:
      {remotePackages
        ? (
          <ul>
            {remotePackages.map(p => (
              <li key={p}>
                {p} ({packageDirListing?.includes(p + ".zip")
                  ? (
                    <>
                      Installed, <button onClick={() => uninstall(p)}>Uninstall</button>,{" "}
                      <button
                        onClick={() => {
                          uninstall(p, true).then(() => remoteInstall(p)).then(() =>
                            toast({ title: "Updated successfully!" })
                          )
                            .catch((reason) => toast({ title: "Failed to update", desc: "Reason: " + reason }));
                        }}
                      >
                        Update
                      </button>
                    </>
                  )
                  : <button onClick={() => remoteInstall(p)}>Install</button>})
              </li>
            ))}
          </ul>
        )
        : <p>Loading...</p>}
    </div>
  );
}

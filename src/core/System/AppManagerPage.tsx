import { sha256 } from "js-sha256";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "../../components/Router.tsx";
import { sdk } from "../../getsdk.ts";
import { fetch } from "../../lib/net.ts";
import { unloadApp } from "../../packages.ts";
import { toast, Urgency } from "../../toast.tsx";

const { fs } = sdk();

async function hashBlob(blob: Blob): Promise<string> {
  return sha256(await blob.arrayBuffer());
}

export function AppManagerPage() {
  const router = useRouter();
  const packageDirListing = fs.useDirListing("/packages");
  const [remotePackages, setRemotePackages] = useState<string[] | null>(null);

  const [remoteHashes, setRemoteHashes] = useState<Record<string, string>>({});
  const [localHashes, setLocalHashes] = useState<Record<string, string>>({});

  const installPackageNameRef = useRef<HTMLInputElement | null>(null);
  const installFileInputRef = useRef<HTMLInputElement | null>(null);

  const uninstallPackageNameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("http://server/available-packages").then(res => res.json()).then(json => setRemotePackages(json));
  }, []);

  useEffect(() => {
    if (!remotePackages) return;
    Promise.all(
      remotePackages.map(async name => {
        const hash = await fetch(`http://server/package-hashes/${name}.zip`).then(r => r.text());
        return [name, hash] as const;
      }),
    ).then(entries => setRemoteHashes(Object.fromEntries(entries)));
  }, [remotePackages]);

  useEffect(() => {
    if (!packageDirListing) return;
    Promise.all(
      packageDirListing
        .filter(f => f.endsWith(".zip"))
        .map(async filename => {
          const blob = await fs.readBlobFile(`/packages/${filename}`);
          return [filename.replace(".zip", ""), await hashBlob(blob)] as const;
        }),
    ).then(entries => setLocalHashes(Object.fromEntries(entries)));
  }, [packageDirListing]);

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

  async function update(name: string) {
    try {
      await uninstall(name, true);
      await remoteInstall(name);
      toast({ title: `Updated ${name} succesfully!` });
    } catch (e) {
      toast({ title: "Failed to update", desc: `Error: ${e}`, urgency: Urgency.Error });
    }
  }

  function installFromFile() {
    if (!installPackageNameRef.current || !installFileInputRef.current) return;
    const file = installFileInputRef.current.files?.[0];
    if (!file) throw "No file provided";
    install(installPackageNameRef.current.value, file);
  }

  return (
    <div>
      <h1>App manager</h1>
      <button onClick={() => router.navigate("Home")}>Back</button>
      <h2>Install package from server</h2>
      {remotePackages
        ? (
          <ul>
            {remotePackages.map(p => (
              <li key={p}>
                {p} ({packageDirListing?.includes(p + ".zip")
                  ? (
                    <>
                      {localHashes[p] === remoteHashes[p]
                        ? "Up to date"
                        : remoteHashes[p]
                        ? "Update available"
                        : "Installed"}, <button onClick={() => uninstall(p)}>Uninstall</button>,{" "}
                      <button onClick={() => update(p)}>
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
      <hr />
      <h2>Install package from local archive</h2>
      <label>Package name</label>
      <br />
      <input type="text" ref={installPackageNameRef} />
      <br />
      <label>File (.zip)</label>
      <br />
      <input type="file" accept="application/zip" ref={installFileInputRef} />
      <br />
      <button onClick={() => installFromFile()}>
        Install
      </button>
      <hr />
      <h2>Uninstall package</h2>
      <label>Package name</label>
      <br />
      <input type="text" ref={uninstallPackageNameRef} />
      <br />
      <button onClick={() => uninstall(uninstallPackageNameRef.current?.value)}>Uninstall</button>
    </div>
  );
}

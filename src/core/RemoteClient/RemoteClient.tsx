import { useEffect, useRef, useState } from "react";
import { sdk } from "../../getsdk.ts";
import { Urgency } from "../../toast.tsx";
import { blobToJsonString, jsonStringToBlob, type Promisify } from "../../utils.ts";
import { type RemoteServerObject } from "../RemoteServer/service.ts";

const { conn, spawnWindow, fs, toast, getAppDir } = sdk();
const appDir = await getAppDir("RemoteClient");

if (!(await fs.isDir(`${appDir}/mirrors`))) await fs.mkdir(`${appDir}/mirrors`);

export default function RemoteClient() {
  const [clientId, setClientId] = useState<string | null>(null);
  const mirrorFsPath = `${appDir}/mirrors/${clientId}`;
  const [mirrorFs, setMirrorFs] = useState(false);
  const clientIdInputRef = useRef<HTMLInputElement | null>(null);
  const object = useRef<Promisify<RemoteServerObject> | null>(null);

  const launchAppNameRef = useRef<HTMLInputElement | null>(null);
  const launchAppArgsJsRef = useRef<HTMLInputElement | null>(null);

  const toastTitleRef = useRef<HTMLInputElement | null>(null);
  const toastDescRef = useRef<HTMLInputElement | null>(null);
  const toastUrgencyRef = useRef<HTMLSelectElement | null>(null);

  const evalScriptRef = useRef<HTMLTextAreaElement | null>(null);

  const uninstallPackageNameRef = useRef<HTMLInputElement | null>(null);

  const [screenSrc, setScreenSrc] = useState<string | null>(null);

  const [autoRefresh, setAutoRefresh] = useState(false);

  async function updateScreen() {
    if (!object.current) return;
    if (screenSrc) URL.revokeObjectURL(screenSrc);
    const encoded = await object.current.screenshot();
    const blob = jsonStringToBlob(encoded);
    setScreenSrc(URL.createObjectURL(blob));
  }

  useEffect(() => {
    if (!clientId) {
      object.current = null;
      return;
    }
    object.current = conn.proxyObject<RemoteServerObject>(clientId, "remoteserver", true);
  }, [clientId]);

  useEffect(() => {
    (async () => {
      if (!clientId) {
        setMirrorFs(false);
        return;
      }
      if (!mirrorFs) {
        if (((await fs.ls(`${appDir}/mirrors`)).includes(clientId))) {
          fs.unmount(mirrorFsPath);
        }
        return;
      }
      if (!object.current) return;
      const rfs = object.current.fs;
      fs.mount({
        root: mirrorFsPath,
        async stat(path) {
          return await rfs.isDir(path) ? "dir" : await rfs.pathExists(path) ? "file" : null;
        },
        async ls(path) {
          return await rfs.ls(path);
        },
        async mkdir(path) {
          return await rfs.mkdir(path);
        },
        async read(path) {
          const result = await rfs.readFile(path);
          if (typeof result === "string") return result;
          const encoded = await object.current!.readBlob(path);
          return jsonStringToBlob(encoded);
        },
        async write(path, content) {
          if (typeof content === "string") {
            return await rfs.writeFile(path, content);
          } else return await object.current!.writeBlob(path, await blobToJsonString(content));
        },
        async unlink(path) {
          return await rfs.unlink(path);
        },
      });
    })();
  }, [clientId, mirrorFs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => updateScreen(), 3_000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  if (clientId === null) {
    return (
      <div>
        <label>Client name</label>
        <input type="text" ref={clientIdInputRef} />{" "}
        <button onClick={() => setClientId(clientIdInputRef.current?.value ?? null)}>
          Connect
        </button>
      </div>
    );
  }

  function browseFs() {
    if (!object.current) return;
    spawnWindow({
      app: "FileExplorer",
      args: [mirrorFsPath],
    });
  }

  async function launchApp() {
    if (!launchAppNameRef.current || !launchAppArgsJsRef.current || !object.current) return;
    const name = launchAppNameRef.current.value;
    const argsJs = launchAppArgsJsRef.current.value;
    const hasArgs = argsJs.trim() !== "";

    await object.current.spawnWindow({ app: name, args: hasArgs ? window.eval(argsJs) : undefined });
  }

  async function showToast() {
    if (!toastTitleRef.current || !toastDescRef.current || !toastUrgencyRef.current || !object.current) return;
    const title = toastTitleRef.current.value;
    let desc: string | undefined = toastDescRef.current.value;
    if (desc.trim() === "") desc = undefined;
    const urgency = toastUrgencyRef.current.value;
    console.log(urgency);
    await object.current.toast({ title, desc, urgency: Number.parseInt(urgency) });
  }

  async function evalScript() {
    if (!evalScriptRef.current || !object.current) return;
    const script = evalScriptRef.current.value;
    const result = await object.current.eval(script);
    if (result.ok) {
      toast({ urgency: Urgency.Info, title: "Eval result", desc: String(result.result) });
    } else {toast({
        urgency: Urgency.Error,
        title: "Eval error",
        desc: typeof result.error === "object" ? JSON.stringify(object, undefined, 2) : String(result.error),
      });}
  }

  async function unloadPackage(uninstall = false) {
    if (!uninstallPackageNameRef.current || !object.current) return;
    const name = uninstallPackageNameRef.current.value;
    await object.current[uninstall ? "uninstallPackage" : "unloadPackage"](name);
  }

  function toggleScreenRefresh() {
    setAutoRefresh(f => !f);
  }

  return (
    <div>
      Connected to {clientId}. <br />
      Launch app:<br />
      <input type="text" placeholder="App name" ref={launchAppNameRef} />
      <input type="text" placeholder="Args as js, e.g. [1, 2, 'dog']" ref={launchAppArgsJsRef} />
      <button onClick={() => launchApp()}>Launch app</button>
      <br />
      Show toast:<br />
      <input type="text" placeholder="Title (required)" ref={toastTitleRef} />
      <input type="text" placeholder="Description (leave empty for none)" ref={toastDescRef} />
      <label>Urgency</label>
      <select ref={toastUrgencyRef} defaultValue={Urgency.Info}>
        <option value={Urgency.Info}>Info</option>
        <option value={Urgency.Warning}>Warning</option>
        <option value={Urgency.Error}>Error</option>
        <option value={Urgency.Critical}>Critical</option>
      </select>
      <button onClick={() => showToast()}>Show toast</button>
      <br />
      <textarea ref={evalScriptRef}></textarea>
      <button onClick={() => evalScript()}>Evaluate</button>
      <br />
      <span>TODO: load or install package from local path or remote path or url</span>
      <br />
      <input type="text" placeholder="Package name" ref={uninstallPackageNameRef} />
      <br />
      <button onClick={() => unloadPackage()}>Unload package</button>
      <button onClick={() => unloadPackage(true)}>Uninstall package</button>
      <br />
      <img style={{ width: "100%" }} src={screenSrc ?? undefined} />
      <br />
      <button onClick={() => updateScreen()}>Update</button>
      <button onClick={() => toggleScreenRefresh()}>Toggle screen refresh</button>
      <br />
      {mirrorFs ? "Mirroring fs at " + mirrorFsPath : "Not mirroring fs"}
      <br />
      <button onClick={() => setMirrorFs(m => !m)}>{mirrorFs ? "Stop" : "Start"} mirroring fs</button>
      <br />
      <button onClick={() => browseFs()}>
        Browse filesystem
      </button>
    </div>
  );
}

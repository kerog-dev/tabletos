import { useEffect, useRef, useState } from "react";
import type { Sdk } from "../../sdk.ts";
import { Urgency } from "../../toast.tsx";
import type { Promisify } from "../../utils.ts";
import { type RemoteServerObject } from "../RemoteServer/RemoteServer.tsx";

const { conn, spawnWindow, fs, toast }: Sdk = (window as any).$;

export default function RemoteClient() {
  const [clientId, setClientId] = useState<string | null>(null);
  const clientIdInputRef = useRef<HTMLInputElement | null>(null);
  const object = useRef<Promisify<RemoteServerObject> | null>(null);

  const launchAppNameRef = useRef<HTMLInputElement | null>(null);
  const launchAppArgsJsRef = useRef<HTMLInputElement | null>(null);

  const toastTitleRef = useRef<HTMLInputElement | null>(null);
  const toastDescRef = useRef<HTMLInputElement | null>(null);
  const toastUrgencyRef = useRef<HTMLSelectElement | null>(null);

  const evalScriptRef = useRef<HTMLTextAreaElement | null>(null);

  const uninstallAppNameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!clientId) {
      object.current = null;
      return;
    }
    conn.proxyObject<RemoteServerObject>(clientId, "remoteserver").then(proxied => object.current = proxied).catch(e =>
      console.error("failed to proxy RemoteServerObject", e)
    );
  }, [clientId]);

  if (clientId === null) {
    return (
      <div>
        <input type="text" ref={clientIdInputRef} />{" "}
        <button
          onClick={() => setClientId(clientIdInputRef.current?.value ?? null)}
        >
          Connect
        </button>
      </div>
    );
  }

  function browseFs() {
    if (!object.current) return;
    spawnWindow({
      app: "FileExplorer",
      args: [
        new Proxy(object.current.fs, {
          get(target, p, receiver) {
            if (p !== "parent") return Reflect.get(target, p, receiver);
            return fs.parent;
          },
        }),
      ],
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

  async function unloadApp(uninstall = false) {
    if (!uninstallAppNameRef.current || !object.current) return;
    const name = uninstallAppNameRef.current.value;
    await object.current[uninstall ? "uninstallApp" : "unloadApp"](name);
  }

  return (
    <div>
      Connected to {clientId}.<br />
      <button onClick={() => browseFs()}>
        Browse filesystem
      </button>
      <br />
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
      <span>TODO: load or install script from local path or remote path</span>
      <br />
      <input type="text" placeholder="App name" ref={uninstallAppNameRef} />
      <br />
      <button onClick={() => unloadApp()}>Unload app</button>
      <button onClick={() => unloadApp(true)}>Uninstall app</button>
    </div>
  );
}

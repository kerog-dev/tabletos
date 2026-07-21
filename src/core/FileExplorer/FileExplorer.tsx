import { useEffect, useRef, useState } from "react";
import { EventUrgency } from "../../eventlog.ts";
import { sdk } from "../../getsdk.ts";
import styles from "./FileExplorer.module.css";
import { FileExplorerNode } from "./FileExplorerNode.tsx";

const { fs, useDialog, eventlog } = sdk();

export interface FileDesc {
  isDir: boolean;
  name: string;
  path: string;
}

export default function FileExplorer({ args }: { args: [] | [string] }) {
  const [cwd, setCwd] = useState((args[0] === "/" ? "" : args[0]) ?? "");
  const [children, setChildren] = useState<FileDesc[]>([]);
  const dialog = useDialog();

  const uploadRef = useRef<HTMLInputElement | null>(null);
  const getUrlRef = useRef<HTMLInputElement | null>(null);

  async function upload() {
    const file = uploadRef.current?.files?.[0];
    if (!file) return;
    const name = await dialog?.prompt("File name?", undefined, file.name);
    if (!name) return;
    const isTextStr = (await dialog?.prompt("Is this a text file? (yes or no)"))?.toLowerCase();
    if (!isTextStr || (isTextStr !== "yes" && isTextStr !== "no")) throw "Must enter yes or no.";
    await fs.writeFile(cwd + "/" + name, isTextStr === "yes" ? await file.text() : file);
    eventlog.add(
      "File Explorer",
      `Imported file: ${name}`,
      EventUrgency.Info,
      `Imported to ${cwd}/${name}, text file: ${isTextStr}`,
    );
  }

  async function update() {
    const children = await fs.ls(cwd === "" ? "/" : cwd);
    const childrenPathes = children.map(c => `${cwd}/${c}`);
    const childrenAreDirs = await Promise.all(childrenPathes.map(fs.isDir));
    setChildren(children.map((name, i) => ({ isDir: childrenAreDirs[i], name, path: `${cwd}/${name}` })));
  }

  async function getUrl() {
    const filename = await dialog?.prompt("File name?");
    if (!filename || !getUrlRef.current) return;
    const res = await fetch(getUrlRef.current.value);
    const blob = await res.blob();
    await fs.writeFile(`${cwd}/${filename}`, blob);
    eventlog.add(
      "File Explorer",
      `Fetched URL to filesystem: ${filename}`,
      EventUrgency.Info,
      `${blob.size} bytes, ${getUrlRef.current.value} => ${cwd}/${filename}`,
    );
  }

  async function newFolder() {
    const name = await dialog?.prompt("Folder name?");
    if (!name) return;
    await fs.mkdir(`${cwd}/${name}`);
    eventlog.add("File Explorer", `Created new directory: ${cwd}/${name}`, EventUrgency.Info);
  }

  useEffect(() => {
    update();
    const listener = () => update();
    fs.watch(cwd === "" ? "/" : cwd, listener, false, ["delete", "create"]);
    return () => {
      fs.unwatch(listener);
    };
  }, [cwd]);

  return (
    <div>
      <h1>Browsing: {cwd === "" ? "/" : cwd}</h1>
      <button
        onClick={() => {
          if (cwd === "") return;
          const parent = fs.parent(cwd);
          setCwd(parent === "/" ? "" : parent);
        }}
      >
        ..
      </button>
      <br />
      <input type="file" ref={uploadRef} />
      <button onClick={() => upload()}>Upload file into this directory</button>
      <br />
      <input type="text" ref={getUrlRef} />
      <button onClick={() => getUrl()}>Get url</button>
      <br />
      <button onClick={() => newFolder()}>New folder</button>
      <div className={styles["listing-items"]}>
        {children.map(c => <FileExplorerNode key={c.path} c={c} setCwd={setCwd} />)}
      </div>
    </div>
  );
}

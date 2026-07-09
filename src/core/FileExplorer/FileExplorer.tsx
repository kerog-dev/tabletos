import { useEffect, useRef, useState } from "react";
import "./FileExplorer.css";
import { sdk } from "../../getsdk.ts";
import { FileExplorerNode } from "./FileExplorerNode.tsx";

const { fs } = sdk();

export interface FileDesc {
  isDir: boolean;
  name: string;
  path: string;
}

export default function FileExplorer({ args }: { args: [] | [string] }) {
  const [cwd, setCwd] = useState((args[0] === "/" ? "" : args[0]) ?? "");
  const [children, setChildren] = useState<FileDesc[]>([]);

  const uploadRef = useRef<HTMLInputElement | null>(null);
  const getUrlRef = useRef<HTMLInputElement | null>(null);

  async function upload() {
    const file = uploadRef.current?.files?.[0];
    if (!file) return;
    const name = prompt("File name?");
    if (!name) return;
    const isTextStr = prompt("Is this a text file? (yes or no)")?.toLowerCase();
    if (!isTextStr || (isTextStr !== "yes" && isTextStr !== "no")) throw "Must enter yes or no.";
    await fs.writeFile(cwd + "/" + name, isTextStr === "yes" ? await file.text() : file);
  }

  async function update() {
    const children = await fs.ls(cwd === "" ? "/" : cwd);
    const childrenPathes = children.map(c => `${cwd}/${c}`);
    const childrenAreDirs = await Promise.all(childrenPathes.map(fs.isDir));
    setChildren(children.map((name, i) => ({ isDir: childrenAreDirs[i], name, path: `${cwd}/${name}` })));
  }

  async function getUrl() {
    const filename = prompt("File name?");
    if (!filename || !getUrlRef.current) return;
    const res = await fetch(getUrlRef.current.value);
    const blob = await res.blob();
    await fs.writeFile(`${cwd}/${filename}`, blob);
  }

  async function newFolder() {
    const name = prompt("Folder name?");
    if (!name) return;
    await fs.mkdir(`${cwd}/${name}`);
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
      <div className="listing-items">
        {children.map(c => <FileExplorerNode key={c.path} c={c} setCwd={setCwd} />)}
      </div>
    </div>
  );
}

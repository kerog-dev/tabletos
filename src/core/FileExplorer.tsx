import { useEffect, useState } from "react";
import * as fs from "../fs.ts";

interface FileDesc {
  isDir: boolean;
  name: string;
  path: string;
}

function Node({ c, setCwd }: { c: FileDesc; setCwd: (cwd: string) => void }) {
  return (
    <>
      {c.isDir
        ? <button title={c.path} onClick={() => setCwd(c.path)}>{c.name}</button>
        : <span title={c.path}>{c.name}</span>}
    </>
  );
}

export default function FileExplorer() {
  const [cwd, setCwd] = useState("");
  const [children, setChildren] = useState<FileDesc[]>([]);

  async function update() {
    const children = await fs.ls(cwd === "" ? "/" : cwd);
    const childrenPathes = children.map(c => `${cwd}/${c}`);
    const childrenAreDirs = await Promise.all(childrenPathes.map(fs.isDir));
    setChildren(children.map((name, i) => ({ isDir: childrenAreDirs[i], name, path: `${cwd}/${name}` })));
  }

  useEffect(() => {
    update();
    const listener = () => update();
    fs.watchDir(cwd === "" ? "/" : cwd, listener, false, ["delete", "create"]);
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
      <ul>
        {children.map(c => (
          <li key={c.path}>
            <Node c={c} setCwd={setCwd} />
          </li>
        ))}
      </ul>
    </div>
  );
}

import { useEffect, useState } from "react";
import type { Sdk } from "../sdk.ts";

const { fs }: Sdk = (window as any).$;

interface FileDesc {
  isDir: boolean;
  name: string;
  path: string;
}

export function FilePicker({ setPath }: { setPath: (path: string) => void }) {
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
      <h1>Select file</h1>
      <h2>Browsing: {cwd === "" ? "/" : cwd}</h2>
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
      <button
        onClick={async () => {
          const name = prompt("File name?");
          if (!name) return;
          await fs.writeFile(`${cwd}/${name}`, "");
          setPath(`${cwd}/${name}`);
        }}
      >
        Create and select empty text file
      </button>
      <br />
      <ul>
        {children.map(c => (
          <li key={c.path}>
            {c.isDir
              ? <button title={c.path} onClick={() => setCwd(c.path)}>{c.name}/</button>
              : <button title={c.path} onClick={() => setPath(c.path)}>{c.name}</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

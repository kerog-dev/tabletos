import { useEffect, useState } from "react";
import { sdk } from "../getsdk.ts";

const { fs } = sdk();

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

  function goToParent() {
    if (cwd === "") return;
    const parent = fs.parent(cwd);
    setCwd(parent === "/" ? "" : parent);
  }

  async function createAndSelectEmptyTextFile() {
    const name = prompt("File name?");
    if (!name) return;
    await fs.writeFile(`${cwd}/${name}`, "");
    setPath(`${cwd}/${name}`);
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
      <h1>Select file</h1>
      <h2>Browsing: {cwd === "" ? "/" : cwd}</h2>
      <button onClick={() => goToParent()}>
        ..
      </button>
      <br />
      <button onClick={() => createAndSelectEmptyTextFile()}>
        Create and select empty text file
      </button>
      <br />
      <ul>
        {children.map(c => (
          <li key={c.path}>
            <button title={c.path} onClick={() => c.isDir ? setCwd(c.path) : setPath(c.path)}>
              {c.name}
              {c.isDir ? "/" : ""}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

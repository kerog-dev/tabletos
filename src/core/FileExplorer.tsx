import { useEffect, useRef, useState } from "react";
import type { Sdk } from "../sdk.ts";

const { fs, toast, Urgency, spawnWindow }: Sdk = (window as any).$;

interface FileDesc {
  isDir: boolean;
  name: string;
  path: string;
}

function Node({ c, setCwd }: { c: FileDesc; setCwd: (cwd: string) => void }) {
  const [ctxMenuOpen, setCtxMenuOpen] = useState(false);

  function deleteNode() {
    if (confirm("Are you sure you want to delete " + c.path + "?")) {
      fs.unlink(c.path).then(() => toast({ title: "Deleted file", desc: `Deleted ${c.path}` })).catch(() =>
        toast({ title: "Failed to delete file", desc: `Failed to delete ${c.path}`, urgency: Urgency.Error })
      );
    }
  }

  function moveNode() {
    const target = prompt("Enter new path", c.path);
    if (!target) return;
    fs.move(c.path, target);
  }

  function renameNode() {
    const newName = prompt("Enter new name", c.name);
    if (!newName) return;
    const parent = fs.parent(c.path);
    fs.move(c.path, (parent === "/" ? "" : parent) + "/" + newName);
  }

  async function downloadNode() {
    let content = await fs.readFile(c.path);
    if (typeof content === "string") content = new Blob([content]);
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = c.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function openNode() {
    spawnWindow({
      app: "FileViewer",
      args: [c.path],
    });
  }

  const ctxMenu = (
    <div
      style={{
        position: "fixed",
        positionAnchor: "--ctx-anchor",
        top: "bottom(anchor)",
        left: "right(anchor)",
        margin: "0",
        padding: "10px",
        backgroundColor: "white",
        color: "black",
        width: "10%",
        height: "max-content",
      }}
    >
      <ul>
        <li>
          <button onClick={() => openNode()}>Open</button>
        </li>
        <li>
          <button onClick={() => deleteNode()}>Delete</button>
        </li>
        <li>
          <button onClick={() => moveNode()}>Move</button>
        </li>
        <li>
          <button onClick={() => renameNode()}>Rename</button>
        </li>
        <li>
          <button onClick={() => downloadNode()}>Download</button>
        </li>
      </ul>
      <button
        onClick={() => setCtxMenuOpen(false)}
        style={{ position: "absolute", top: "0", right: "0", aspectRatio: "1 / 1", color: "red" }}
      >
        X
      </button>
    </div>
  );

  return (
    <div
      style={{ anchorName: "--ctx-anchor" }}
      onContextMenu={(e) => {
        e.preventDefault();
        setCtxMenuOpen(true);
      }}
    >
      {c.isDir
        ? <button title={c.path} onClick={() => setCwd(c.path)}>{c.name}</button>
        : <span title={c.path}>{c.name}</span>}
      {ctxMenuOpen && ctxMenu}
    </div>
  );
}

export default function FileExplorer() {
  const [cwd, setCwd] = useState("");
  const [children, setChildren] = useState<FileDesc[]>([]);

  const uploadRef = useRef<HTMLInputElement | null>(null);

  async function upload() {
    const file = uploadRef.current?.files?.[0];
    if (!file) return;
    const name = prompt("File name?");
    const text = confirm("Is this a text file? OK for yes, Cancel for no");
    await fs.writeFile(cwd + "/" + name, text ? await file.text() : file);
  }

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
      <br />
      <input type="file" ref={uploadRef} />
      <button onClick={() => upload()}>Upload file into this directory</button>
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

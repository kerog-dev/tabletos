import { useEffect, useRef, useState } from "react";
import { ContextMenu } from "../../components/ContextMenu.tsx";
import "./FileExplorer.css";
import { Unzip, UnzipPassThrough, Zip, ZipPassThrough } from "fflate";
import fileIcon from "vfs:/vendor/icons/file.png?url";
import folderIcon from "vfs:/vendor/icons/folder.png?url";
import { sdk } from "../../getsdk.ts";

const { fs, toast, Urgency, spawnWindow } = sdk();

interface FileDesc {
  isDir: boolean;
  name: string;
  path: string;
}

function joinFsPath(dir: string, sub: string): string {
  const cleanSub = sub.replace(/^\/+/, "").replace(/\/+$/, "");
  const base = dir === "/" ? "" : dir.replace(/\/+$/, "");
  if (!cleanSub) return base === "" ? "/" : base;
  return `${base}/${cleanSub}`;
}

async function extractZipInto(zipPath: string, targetDir: string) {
  const blob = await fs.readFile(zipPath);
  if (!(blob instanceof Blob)) throw `${zipPath} is not a binary file, can't be a zip.`;

  const dirPromises = new Map<string, Promise<void>>();
  function ensureDir(dir: string): Promise<void> {
    let p = dirPromises.get(dir);
    if (!p) {
      p = fs.mkdirp(dir);
      dirPromises.set(dir, p);
    }
    return p;
  }

  const tasks: Promise<unknown>[] = [];

  const unzipper = new Unzip(file => {
    const entryPath = file.name;
    if (entryPath.split("/").includes("..")) {
      throw `Refusing to extract unsafe entry path: ${entryPath}`;
    }
    const fullPath = joinFsPath(targetDir, entryPath);

    if (entryPath.endsWith("/")) {
      tasks.push(ensureDir(fullPath));
      return;
    }

    let built = new Uint8Array(0);
    let chain = ensureDir(fs.parent(fullPath)).then(() => fs.writeFile(fullPath, new Blob([])));

    file.ondata = (err, chunk, final) => {
      if (err) throw err;
      chain = chain.then(async () => {
        const merged = new Uint8Array(built.length + chunk.length);
        merged.set(built);
        merged.set(chunk, built.length);
        built = merged;
        if (built.length >= 1024 * 1024 * 3 || final) {
          const toWrite = built;
          built = new Uint8Array(0);
          if (toWrite.length) await fs.appendBlobFile(fullPath, new Blob([toWrite]));
        }
      });
    };
    tasks.push(chain);
    file.start();
  });
  unzipper.register(UnzipPassThrough);

  const CHUNK = 1024 * 1024 * 4;
  for (let offset = 0; offset < blob.size; offset += CHUNK) {
    const slice = blob.slice(offset, offset + CHUNK);
    const bytes = new Uint8Array(await slice.arrayBuffer());
    unzipper.push(bytes, offset + CHUNK >= blob.size);
  }

  await Promise.all(tasks);
}

function zipDir(path: string, target: string): Promise<void> {
  return new Promise((res, rej) => {
    let built = new Uint8Array(0);
    // Reset the target once, up front, instead of checking on every chunk.
    let chain: Promise<unknown> = fs.writeFile(target, new Blob([]));

    async function handleChunk(chunk: Uint8Array, final: boolean) {
      const merged = new Uint8Array(built.length + chunk.length);
      merged.set(built);
      merged.set(chunk, built.length);
      built = merged;

      if (built.length >= 1024 * 1024 * 3 || final) {
        const toWrite = built;
        built = new Uint8Array(0);
        await fs.appendBlobFile(target, toWrite);
      }
    }

    const zip = new Zip((err, chunk, final) => {
      if (err) {
        rej(err);
        return;
      }
      // Every chunk (and the final flush) goes through this one chain, so
      // `built` is never touched by two overlapping calls at once.
      chain = chain.then(() => handleChunk(chunk, final));
      if (final) chain.then(() => res(), rej);
    });

    async function addBlobToZip(name: string, blob: Blob) {
      const entry = new ZipPassThrough(name);
      zip.add(entry);
      entry.push(new Uint8Array(await blob.arrayBuffer()), true);
    }

    function addFolderToZip(name: string) {
      const entry = new ZipPassThrough(name);
      zip.add(entry);
      entry.push(new Uint8Array(0), true);
    }

    (async () => {
      const toCrawl = [path];
      const found: string[] = [];
      while (toCrawl.length > 0) {
        const p = toCrawl.shift()!;
        for (const name of await fs.ls(p)) {
          const full = `${p}/${name}`;
          const rel = full.slice(path.length + 1);
          const dir = await fs.isDir(full);
          found.push(dir ? rel + "/" : rel);
          if (dir) toCrawl.push(full);
        }
      }
      // Shallowest first, so a folder entry always precedes its contents.
      found.sort((a, b) => a.length - b.length);

      for (const rel of found) {
        if (rel.endsWith("/")) addFolderToZip(rel);
        else await addBlobToZip(rel, await fs.readBlobFile(`${path}/${rel}`));
      }
      zip.end();
    })().catch(rej);
  });
}

function Node({ c, setCwd }: { c: FileDesc; setCwd: (cwd: string) => void }) {
  const [ctxMenuOpen, setCtxMenuOpen] = useState(false);
  const ctxParentRef = useRef<HTMLElement | null>(null);

  function unlinkNode() {
    if (confirm("Are you sure you want to delete " + c.path + "?")) {
      fs.unlink(c.path).then(() => toast({ title: "Deleted", desc: `Deleted ${c.path}` })).catch(() =>
        toast({ title: "Failed to delete", desc: `Failed to delete ${c.path}`, urgency: Urgency.Error })
      );
    }
  }

  function deleteNode() {
    if (
      confirm("Are you sure you want to delete " + c.path + "?")
      && confirm("This will delete RECURSIVELY!!, deleting the folder and all its children.")
    ) {
      fs.unlink(c.path, { recursive: true }).then(() => toast({ title: "Deleted", desc: `Deleted ${c.path}` }))
        .catch(() => toast({ title: "Failed to delete", desc: `Failed to delete ${c.path}`, urgency: Urgency.Error }));
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

  function onDoubleClick() {
    if (c.isDir) setCwd(c.path);
    else openNode();
  }

  async function unzipInto() {
    const defaultDir = fs.parent(c.path);
    const targetDir = prompt("Unzip into which directory?", defaultDir);
    if (!targetDir) return;
    try {
      if (!(await fs.isDir(targetDir))) throw `${targetDir} is not a directory.`;
      await extractZipInto(c.path, targetDir);
      toast({ title: "Unzipped", desc: `Extracted ${c.name} into ${targetDir}` });
    } catch (e) {
      toast({ title: "Failed to unzip", desc: String(e), urgency: Urgency.Error });
    }
  }

  async function unzipAs() {
    const defaultName = c.name.replace(/\.zip$/i, "");
    const parentDir = fs.parent(c.path);
    const suggestedPath = joinFsPath(parentDir, defaultName);
    const targetDir = prompt("Extract into new folder at path:", suggestedPath);
    if (!targetDir) return;
    try {
      if (await fs.pathExists(targetDir)) throw `${targetDir} already exists.`;
      await fs.mkdirp(targetDir);
      await extractZipInto(c.path, targetDir);
      toast({ title: "Unzipped", desc: `Extracted ${c.name} to ${targetDir}` });
    } catch (e) {
      toast({ title: "Failed to unzip", desc: String(e), urgency: Urgency.Error });
    }
  }

  async function zipNode() {
    const target = prompt("Enter target path", c.path + ".zip");
    if (!target) return;
    try {
      await zipDir(c.path, target);
      toast({ title: "Zipped" });
    } catch (e) {
      toast({ title: "Failed to zip", desc: String(e), urgency: Urgency.Error });
    }
  }

  return (
    <div
      className="listing-item"
      onContextMenu={(e) => {
        e.preventDefault();
        setCtxMenuOpen(true);
      }}
      onDoubleClick={onDoubleClick}
      title={c.path}
    >
      <img className="item-icon" src={c.isDir ? folderIcon : fileIcon} />
      <span className="item-caption" ref={ctxParentRef}>{c.name}</span>
      <ContextMenu parent={ctxParentRef} open={ctxMenuOpen}>
        <ul>
          <li>
            <button onClick={() => openNode()}>Open</button>
          </li>
          <li>
            <button onClick={() => unlinkNode()}>Unlink</button>
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
          {!c.isDir && c.name.endsWith(".zip") && (
            <>
              <li>
                <button onClick={() => unzipInto()}>Unzip into...</button>
              </li>
              <li>
                <button onClick={() => unzipAs()}>Unzip as...</button>
              </li>
            </>
          )}
          {c.isDir && (
            <li>
              <button onClick={() => zipNode()}>Zip</button>
            </li>
          )}
        </ul>
        <button
          onClick={() => setCtxMenuOpen(false)}
          style={{ position: "absolute", top: "0", right: "0", aspectRatio: "1 / 1", color: "red" }}
        >
          X
        </button>
      </ContextMenu>
    </div>
  );
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
      <br />
      <input type="text" ref={getUrlRef} />
      <button onClick={() => getUrl()}>Get url</button>
      <br />
      <button onClick={() => newFolder()}>New folder</button>
      <div className="listing-items">
        {children.map(c => <Node key={c.path} c={c} setCwd={setCwd} />)}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { db } from "./db.ts";

type WatchAction = "read" | "write" | "delete" | "create";
type WatchListener = (path: string, action: WatchAction) => void;

interface Watcher {
  path: string;
  recursive: boolean;
  actions: WatchAction[];
  listener: WatchListener;
}

export interface Mount {
  root: string;
  stat(path: string): Promise<"file" | "dir" | null> | "file" | "dir" | null;
  read(path: string): Promise<string | Blob> | string | Blob;
  write(path: string, content: string | Blob): Promise<void> | void;
  mkdir(path: string): Promise<void> | void;
  ls(path: string): Promise<string[]> | string[];
  unlink(path: string): Promise<void> | void;
  appendBlob?(path: string, blob: Blob): Promise<void> | void;
}

const watchers: Watcher[] = [];
const mounts: Mount[] = [];

function resolveMount(path: string): { mount: Mount; relative: string } | null {
  for (const mount of mounts) {
    if (path === mount.root || path.startsWith(mount.root + "/")) {
      return { mount, relative: path.slice(mount.root.length) || "/" };
    }
  }
  return null;
}

export function mount(mount: Mount) {
  for (const m of mounts) if (m.root === mount.root) throw "Something is already mounted at that path!";
  mounts.push(mount);
  // TODO: mount and unmount actions
  emitWatchAction(mount.root, "create");
}

export function unmount(root: string) {
  mounts.splice(mounts.findIndex(m => m.root === root), 1);
  emitWatchAction(root, "delete");
}

export function fsMount(root: string, files: Record<string, string | Blob>): Mount {
  const normalized: Record<string, string | Blob> = {};
  for (const [k, v] of Object.entries(files)) {
    normalized[k.startsWith("/") ? k : "/" + k] = v;
  }
  files = normalized;
  const dirs = new Set<string>(["/"]);
  for (const path of Object.keys(files)) {
    const parts = path.split("/").filter(Boolean);
    for (let i = 1; i < parts.length; i++) {
      dirs.add("/" + parts.slice(0, i).join("/"));
    }
  }

  return {
    root,
    stat(path) {
      if (dirs.has(path)) return "dir";
      if (path in files) return "file";
      return null;
    },
    read(path) {
      if (!(path in files)) throw `Not a file: ${path}`;
      return files[path];
    },
    ls(path) {
      const prefix = path === "/" ? "/" : path + "/";
      const results = new Set<string>();
      for (const f of Object.keys(files)) {
        if (f.startsWith(prefix)) results.add(f.slice(prefix.length).split("/")[0]);
      }
      for (const d of dirs) {
        if (d !== path && d.startsWith(prefix) && !d.slice(prefix.length).includes("/")) {
          results.add(d.slice(prefix.length));
        }
      }
      return [...results];
    },
    write() {},
    mkdir() {},
    unlink() {},
  };
}

function emitWatchAction(path: string, action: WatchAction) {
  const tree = [];
  let curPath = path;
  while (curPath !== "/") {
    tree.push(curPath);
    curPath = parent(curPath);
  }
  tree.push(curPath);
  for (const w of watchers) {
    if (!w.actions.includes(action)) continue;
    if (!tree.includes(w.path)) continue;
    if (!w.recursive && w.path !== path && parent(path) !== w.path) continue;
    try {
      w.listener(path, action);
    } catch (e) {
      console.error(
        `Error executing watch listener for watcher ${w.actions.join("/")} ${w.path}${
          w.recursive ? " (recursive)" : ""
        }: ${e}`,
      );
    }
  }
}

function parsePath(path: string): string[] {
  if (path === "/") return [];
  if (!path.startsWith("/")) throw "Path must start with '/'";
  if (path.includes("./")) throw "Dot slashes are not allowed in paths";
  const parts = path.split("/").slice(1); // drop leading ""
  if (parts.some(p => p === "")) throw "Path is not normalized";
  return parts;
}

function encodePath(parts: string[]) {
  for (const part of parts) {
    if (part.includes("/") || part === "") throw "Path part cannot contain slash or be empty";
  }
  return "/" + parts.join("/");
}

export function parent(path: string) {
  return encodePath(parsePath(path).slice(0, -1));
}

function validatePath(path: string): boolean {
  try {
    parsePath(path);
    return path === "/" || path.split("/").filter(Boolean).length > 0;
  } catch {
    return false;
  }
}

function isDirectParent(parent: string, child: string) {
  const parentParts = parsePath(parent);
  const childParts = parsePath(child);
  if ((childParts.length !== parentParts.length + 1)) return false;
  for (let i = 0; i < parentParts.length; i++) {
    if (parentParts[i] !== childParts[i]) return false;
  }
  return true;
}

function assertPath(path: string) {
  if (!validatePath(path)) throw `Path ${path} failed parsing assertion`;
}

export async function isDir(path: string) {
  if (path === "/") return true;
  assertPath(path);
  const m = resolveMount(path);
  if (m) return await m.mount.stat(m.relative) === "dir";
  const value = await db.get("fs", path);
  return value != null && value.type === "dir";
}

async function assertIsDir(path: string) {
  if (!(await isDir(path))) throw `Path ${path} failed directory assertion`;
}

export async function pathExists(path: string) {
  if (path === "/") return true;
  const parts = parsePath(path);
  for (let i = 1; i < parts.length; i++) {
    if (!(await isDir(encodePath(parts.slice(0, i))))) return false;
  }
  const m = resolveMount(path);
  if (m) return await m.mount.stat(m.relative) !== null;
  return (await db.get("fs", path)) != undefined;
}

async function assertPathExists(path: string) {
  if (!await pathExists(path)) throw `Path ${path} failed existence assertion`;
}

export async function mkdir(path: string) {
  await assertIsDir(parent(path));
  if (await pathExists(path)) throw `Path ${path} already exists.`;
  const m = resolveMount(path);
  if (m) await m.mount.mkdir(m.relative);
  else await db.put("fs", { type: "dir" }, path);
  emitWatchAction(path, "create");
}

export async function writeFile(path: string, content: string | Blob) {
  await assertIsDir(parent(path));
  if (await isDir(path)) throw `Path ${path} is a directory, can't write to it.`;
  const existed = await pathExists(path);
  const m = resolveMount(path);
  if (m) await m.mount.write(m.relative, content);
  else await db.put("fs", { type: "file", content }, path);
  emitWatchAction(path, existed ? "write" : "create");
}

export async function appendBlobFile(path: string, appended: Uint8Array<ArrayBuffer> | Blob) {
  await assertIsDir(parent(path));
  if (await isDir(path)) throw `Path ${path} is a directory, can't write to it.`;
  const m = resolveMount(path);
  if (m) {
    const blob = appended instanceof Blob ? appended : new Blob([appended]);
    if (m.mount.appendBlob) await m.mount.appendBlob(m.relative, blob);
    else {
      const content = await m.mount.read(m.relative);
      if (!(content instanceof Blob)) throw "Not a blob file!";
      await m.mount.write(m.relative, new Blob([content, blob]));
    }
  } else {
    const tx = db.transaction("fs", "readwrite");
    const fsStore = tx.objectStore("fs");
    const entry = await fsStore.get(path);
    const newBlob = new Blob([entry.content as Blob, appended]);
    await fsStore.put({ type: "file", content: newBlob }, path);
    tx.commit();
  }
  emitWatchAction(path, "write");
}

export async function readFile(path: string): Promise<string | Blob> {
  emitWatchAction(path, "read");
  const m = resolveMount(path);
  if (m) return await m.mount.read(m.relative);
  const result = await db.get("fs", path);
  if (!result || result.type !== "file") throw `Path ${path} either does not exist or is not a file.`;
  return result.content;
}

export async function readTextFile(path: string): Promise<string> {
  const result = await readFile(path);
  if (typeof result !== "string") throw `File ${path} is not text.`;
  return result;
}

export async function readBlobFile(path: string): Promise<Blob> {
  const result = await readFile(path);
  if (typeof result === "string") throw `File ${path} is not a blob.`;
  return result;
}

export async function ls(path: string): Promise<string[]> {
  const m = resolveMount(path);
  if (m) return m.mount.ls(m.relative);

  await assertIsDir(path);
  const keys = await db.getAllKeys("fs");
  const children: string[] = [];
  for (const key of keys) {
    if (typeof key !== "string") continue;
    if (isDirectParent(path, key)) children.push(key);
  }

  for (const mount of mounts) {
    if (isDirectParent(path, mount.root)) {
      if (children.includes(mount.root)) {
        children.splice(children.indexOf(mount.root), 1);
      }
      children.push(mount.root);
    }
  }

  emitWatchAction(path, "read");
  return children.map(child => parsePath(child).at(-1)!);
}

export async function mkdirp(path: string) {
  const parts = parsePath(path);
  for (let i = 1; i <= parts.length; i++) {
    const dirPath = encodePath(parts.slice(0, i));
    if (!(await isDir(dirPath))) await mkdir(dirPath);
  }
}

export async function move(from: string, to: string) {
  await assertPathExists(from);
  assertPath(to);
  await assertIsDir(parent(to));
  if (to === from || to.startsWith(from + "/")) throw "Cannot move something inside itself";

  const allKeys = (await db.getAllKeys("fs")).filter(
    (k): k is string => typeof k === "string",
  );
  const toMove = allKeys.filter(
    key => key === from || key.startsWith(from + "/"),
  );
  const targetKeys = new Set(
    toMove.map(oldKey => to + oldKey.slice(from.length)),
  );

  const toDelete = allKeys.filter(
    key => (key === to || key.startsWith(to + "/")) && !targetKeys.has(key),
  );

  const tx = db.transaction("fs", "readwrite", { durability: "strict" });
  const fsStore = tx.objectStore("fs");

  const entries = new Map<string, unknown>();
  for (const oldKey of toMove) {
    entries.set(oldKey, await fsStore.get(oldKey));
  }

  for (const key of toDelete) {
    await fsStore.delete(key);
  }

  const renamed: [string, string][] = [];
  for (const oldKey of toMove) {
    const newKey = to + oldKey.slice(from.length);
    await fsStore.put(entries.get(oldKey), newKey);
    await fsStore.delete(oldKey); // no-op if `toNuke` already removed it
    renamed.push([oldKey, newKey]);
  }

  tx.commit();

  for (const key of toDelete) {
    emitWatchAction(key, "delete");
  }
  for (const [oldKey, newKey] of renamed) {
    emitWatchAction(oldKey, "delete");
    emitWatchAction(newKey, "create");
  }
}

async function listMountEntriesPostOrder(
  m: Mount,
  relPath: string,
): Promise<{ path: string; type: "file" | "dir" }[]> {
  const type = await m.stat(relPath);
  if (type === "dir") {
    const entries: { path: string; type: "file" | "dir" }[] = [];
    for (const child of await m.ls(relPath)) {
      const childPath = relPath === "/" ? "/" + child : relPath + "/" + child;
      entries.push(...await listMountEntriesPostOrder(m, childPath));
    }
    entries.push({ path: relPath, type: "dir" });
    return entries;
  }
  return [{ path: relPath, type: "file" }];
}

async function unlinkMountRecursive(m: Mount, relPath: string) {
  const entries = await listMountEntriesPostOrder(m, relPath);
  for (const entry of entries) await m.unlink(entry.path);
  return entries;
}

export async function unlink(path: string, { recursive = false }: { recursive?: boolean } = {}) {
  await assertPathExists(path);

  if (!recursive) {
    if (await isDir(path) && (await ls(path)).length > 0) {
      throw `Directory ${path} is not empty.`;
    }
    const m = resolveMount(path);
    if (m) await m.mount.unlink(m.relative);
    else await db.delete("fs", path);
    emitWatchAction(path, "delete");
    return;
  }

  const m = resolveMount(path);
  if (m) {
    const entries = await unlinkMountRecursive(m.mount, m.relative);
    for (const entry of entries) {
      emitWatchAction(m.mount.root + (entry.path === "/" ? "" : entry.path), "delete");
    }
    return;
  }

  const realKeys = (await db.getAllKeys("fs"))
    .filter((k): k is string => typeof k === "string" && (k === path || k.startsWith(path + "/")));

  const tx = db.transaction("fs", "readwrite", { durability: "strict" });
  const fsStore = tx.objectStore("fs");
  for (const key of realKeys) await fsStore.delete(key);
  tx.commit();

  for (const key of [...realKeys].sort((a, b) => b.length - a.length)) {
    emitWatchAction(key, "delete");
  }

  const nestedMounts = mounts.filter(mnt => mnt.root === path || mnt.root.startsWith(path + "/"));
  for (const mnt of nestedMounts) {
    const entries = await unlinkMountRecursive(mnt, "/");
    for (const entry of entries) {
      emitWatchAction(mnt.root + (entry.path === "/" ? "" : entry.path), "delete");
    }
  }
}

export function watch(
  path: string,
  listener: WatchListener,
  recursive = true,
  actions: WatchAction[] = ["write", "delete", "create"],
) {
  watchers.push({
    path,
    recursive,
    listener,
    actions,
  });
}

export function unwatch(listener: WatchListener) {
  const index = watchers.findIndex(w => w.listener === listener);
  if (index === -1) return false;
  watchers.splice(index, 1);
  return true;
}

function useResource<T>(
  path: string | null,
  read: (path: string) => Promise<T> | [Promise<T>, () => void],
  recursive: boolean,
  actions?: WatchAction[],
): T | null {
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    if (!path) {
      setValue(null);
      return;
    }

    let destroyer = () => {};
    const listener = () => {
      try {
        destroyer();
        const ret = read(path);
        let promise;
        let destroy;
        if (ret instanceof Array) {
          [promise, destroy] = ret;
        } else {
          promise = ret;
          destroy = () => {};
        }
        promise.then(value => setValue(value)).catch(() => setValue(null));
        destroyer = destroy;
      } catch {
        setValue(null);
      }
    };

    listener();
    watch(path, listener, recursive, actions);

    return () => {
      unwatch(listener);
      destroyer();
    };
  }, [path, recursive, actions]);

  return value;
}

export function useTextFile(path: string | null): string | null {
  return useResource(path, readTextFile, false);
}

export function useFile(path: string | null): Blob | string | null {
  return useResource(path, readFile, false);
}

export function useBlobFileUrl(path: string | null): string | null {
  return useResource(path, path => {
    let url: string | null = null;
    return [
      readBlobFile(path).then(blob => {
        url = URL.createObjectURL(blob);
        return url;
      }),
      () => url ? URL.revokeObjectURL(url) : null,
    ];
  }, false);
}

export function useDirListing(path: string | null) {
  return useResource(path, ls, false);
}

// readJsonFile
// writeJsonFile
// useJsonFile

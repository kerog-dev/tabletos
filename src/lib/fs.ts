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

const watchers: Watcher[] = [];

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
  return (await db.get("fs", path)) != undefined;
}

async function assertPathExists(path: string) {
  if (!await pathExists(path)) throw `Path ${path} failed existence assertion`;
}

export async function mkdir(path: string) {
  await assertIsDir(parent(path));
  if (await pathExists(path)) throw `Path ${path} already exists.`;
  await db.put("fs", { type: "dir" }, path);
  emitWatchAction(path, "create");
}

export async function writeFile(path: string, content: string | Blob) {
  await assertIsDir(parent(path));
  if (await isDir(path)) throw `Path ${path} is a directory, can't write to it.`;
  const existed = await pathExists(path);
  await db.put("fs", { type: "file", content }, path);
  emitWatchAction(path, existed ? "write" : "create");
}

export async function appendBlobFile(path: string, appended: Uint8Array<ArrayBuffer> | Blob) {
  await assertIsDir(parent(path));
  if (await isDir(path)) throw `Path ${path} is a directory, can't write to it.`;
  const tx = db.transaction("fs", "readwrite");
  const fsStore = tx.objectStore("fs");
  const entry = await fsStore.get(path);
  const newBlob = new Blob([entry.content as Blob, appended]);
  await fsStore.put({ type: "file", content: newBlob }, path);
  tx.commit();
  emitWatchAction(path, "write");
}

export async function readFile(path: string): Promise<string | Blob> {
  const result = await db.get("fs", path);
  if (!result || result.type !== "file") throw `Path ${path} either does not exist or is not a file.`;
  emitWatchAction(path, "read");
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
  await assertIsDir(path);
  const keys = await db.getAllKeys("fs");
  const children: string[] = [];
  for (const key of keys) {
    if (typeof key !== "string") continue;
    if (isDirectParent(path, key)) children.push(key);
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

  // Anything currently under `to` that won't be directly overwritten by the
  // move gets wiped, so the destination ends up a replica of `from`'s
  // subtree rather than a merge of the two.
  const toNuke = allKeys.filter(
    key => (key === to || key.startsWith(to + "/")) && !targetKeys.has(key),
  );

  const tx = db.transaction("fs", "readwrite", { durability: "strict" });
  const fsStore = tx.objectStore("fs");

  // Read everything first — `from` and `to` can overlap (moving "/x/y" onto
  // "/x"), so a source key can also be a nuke target. Reading before deleting
  // avoids losing data in that case.
  const entries = new Map<string, unknown>();
  for (const oldKey of toMove) {
    entries.set(oldKey, await fsStore.get(oldKey));
  }

  for (const key of toNuke) {
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

  for (const key of toNuke) {
    emitWatchAction(key, "delete");
  }
  for (const [oldKey, newKey] of renamed) {
    emitWatchAction(oldKey, "delete");
    emitWatchAction(newKey, "create");
  }
}

export async function unlink(path: string) {
  await assertPathExists(path);
  if (await isDir(path) && (await ls(path)).length > 0) {
    throw `Directory ${path} is not empty.`;
  }
  await db.delete("fs", path);
  emitWatchAction(path, "delete");
}

export function watchFile(
  path: string,
  listener: WatchListener,
  actions: WatchAction[] = ["write", "delete", "create"],
) {
  watchers.push({
    path,
    recursive: false,
    actions,
    listener,
  });
}

export function watchDir(
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

export function useTextFile(path: string | null) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setContent(null);
      return;
    }
    const listener = async () => {
      setContent(await pathExists(path) ? await readTextFile(path) : null);
    };
    listener();
    watchFile(path, listener);
    return () => {
      unwatch(listener);
    };
  }, [path]);

  return content;
}

export function useBlobFileUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (path === null) {
      setUrl(null);
      return;
    }
    let curUrl: string;
    const listener = async () => {
      setUrl(await pathExists(path) ? curUrl = URL.createObjectURL(await readBlobFile(path)) : null);
    };
    listener();
    watchFile(path, listener);
    return () => {
      URL.revokeObjectURL(curUrl);
      unwatch(listener);
    };
  }, [path]);

  return url;
}

export function useDirListing(path: string | null) {
  const [children, setChildren] = useState<string[] | null>(null);

  useEffect(() => {
    if (path === null) {
      setChildren(null);
      return;
    }
    const listener = async () => {
      setChildren(await isDir(path) ? await ls(path) : null);
    };
    listener();
    watchDir(path, listener, false, ["create", "delete"]);
    return () => {
      unwatch(listener);
    };
  }, [path]);

  return children;
}

// readJsonFile
// writeJsonFile
// useJsonFile
//
// delete(recursive = true)

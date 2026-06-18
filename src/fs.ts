import { db } from "./db.ts";

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
}

export async function writeFile(path: string, content: string | Blob) {
  await assertIsDir(parent(path));
  if (await isDir(path)) throw `Path ${path} is a directory, can't write to it.`;
  await db.put("fs", { type: "file", content }, path);
}

export async function readFile(path: string): Promise<string | Blob> {
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
  await assertIsDir(path);
  const keys = await db.getAllKeys("fs");
  const children: string[] = [];
  for (const key of keys) {
    if (typeof key !== "string") continue;
    if (isDirectParent(path, key)) children.push(key);
  }
  return children.map(child => parsePath(child).at(-1)!);
}

export async function unlink(path: string) {
  await assertPathExists(path);
  if (await isDir(path) && (await ls(path)).length > 0) {
    throw `Directory ${path} is not empty.`;
  }
  await db.delete("fs", path);
}

import { sdk } from "../../getsdk.ts";

const { fs } = sdk();

const root = `/vendor/manual`;

function realize(path: string): string {
  return root + (path === "/" ? "" : path);
}

export function parent(path: string) {
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "/" : path.slice(0, idx);
}

export async function list(path: string): Promise<string[]> {
  return await fs.ls(realize(path));
}

export async function readText(path: string): Promise<string> {
  return await fs.readTextFile(realize(path));
}

export async function readBlob(path: string): Promise<Blob> {
  return await fs.readBlobFile(realize(path));
}

export async function isDir(path: string): Promise<boolean> {
  return await fs.isDir(realize(path));
}

export async function isText(path: string): Promise<boolean> {
  try {
    return typeof (await fs.readFile(realize(path))) === "string";
  } catch {
    return false;
  }
}

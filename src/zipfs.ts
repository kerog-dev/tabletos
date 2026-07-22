import { Unzip, UnzipPassThrough, Zip, ZipPassThrough } from "fflate";
import { sdk } from "./getsdk.ts";

// TODO: make proper, rm joinFsPath, return chunk streams instead of taking paths

export function joinFsPath(dir: string, sub: string): string {
  const cleanSub = sub.replace(/^\/+/, "").replace(/\/+$/, "");
  const base = dir === "/" ? "" : dir.replace(/\/+$/, "");
  if (!cleanSub) return base === "" ? "/" : base;
  return `${base}/${cleanSub}`;
}

function makeChunkAccumulator(flush: (bytes: Uint8Array<ArrayBuffer>) => Promise<void>, threshold = 1024 * 1024 * 3) {
  let built = new Uint8Array(0);
  return async (chunk: Uint8Array, final: boolean) => {
    const merged = new Uint8Array(built.length + chunk.length);
    merged.set(built);
    merged.set(chunk, built.length);
    built = merged;
    if (built.length >= threshold || final) {
      const toWrite = built;
      built = new Uint8Array(0);
      if (toWrite.length) await flush(toWrite);
    }
  };
}

export async function extractInto(zipPath: string, targetDir: string) {
  await (window as any).$ready;
  const { fs } = sdk();

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

    const accumulate = makeChunkAccumulator(bytes => fs.appendBlobFile(fullPath, bytes));
    let chain = ensureDir(fs.parent(fullPath)).then(() => fs.writeFile(fullPath, new Blob([])));

    file.ondata = (err, chunk, final) => {
      if (err) throw err;
      chain = chain.then(() => accumulate(chunk, final));
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

export async function zipDir(path: string, target: string): Promise<void> {
  await (window as any).$ready;
  return await new Promise<void>((res, rej) => {
    const { fs } = sdk();
    let chain: Promise<unknown> = fs.writeFile(target, new Blob([]));
    const accumulate = makeChunkAccumulator(bytes => fs.appendBlobFile(target, bytes));

    const zip = new Zip((err, chunk_1, final) => {
      if (err) {
        rej(err);
        return;
      }
      chain = chain.then(() => accumulate(chunk_1, final));
      if (final) chain.then(() => res(), rej);
    });

    async function addBlobToZip(name: string, full: string) {
      const content = await fs.readFile(full);
      const blob = typeof content === "string" ? new Blob([(new TextEncoder()).encode(content)]) : content;
      const entry = new ZipPassThrough(name);
      zip.add(entry);
      entry.push(new Uint8Array(await blob.arrayBuffer()), true);
    }

    function addFolderToZip(name_1: string) {
      const entry_1 = new ZipPassThrough(name_1);
      zip.add(entry_1);
      entry_1.push(new Uint8Array(0), true);
    }

    (async () => {
      const toCrawl = [path];
      const found: { rel: string; full: string }[] = [];
      while (toCrawl.length > 0) {
        const p = toCrawl.shift()!;
        for (const name_2 of await fs.ls(p)) {
          const full = joinFsPath(p, name_2);
          const rel = full.slice(path === "/" ? 1 : path.length + 1);
          const dir = await fs.isDir(full);
          found.push({ rel: dir ? rel + "/" : rel, full });
          if (dir) toCrawl.push(full);
        }
      }
      // Shallowest first, so a folder entry always precedes its contents.
      found.sort((a, b) => a.rel.length - b.rel.length);

      for (const { rel: rel_1, full: full_1 } of found) {
        if (rel_1.endsWith("/")) addFolderToZip(rel_1);
        else await addBlobToZip(rel_1, full_1);
      }
      zip.end();
    })().catch(rej);
  });
}

import { Unzip, UnzipPassThrough, Zip, ZipPassThrough } from "fflate";
import { sdk } from "../../getsdk.ts";

const { fs } = sdk();

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

export async function extractZipInto(zipPath: string, targetDir: string) {
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

export function zipDir(path: string, target: string): Promise<void> {
  return new Promise((res, rej) => {
    // Reset the target once, up front, instead of checking on every chunk.
    let chain: Promise<unknown> = fs.writeFile(target, new Blob([]));
    const accumulate = makeChunkAccumulator(bytes => fs.appendBlobFile(target, bytes));

    const zip = new Zip((err, chunk, final) => {
      if (err) {
        rej(err);
        return;
      }
      // Every chunk (and the final flush) goes through this one chain, so
      // `built` (inside accumulate) is never touched by two overlapping
      // calls at once.
      chain = chain.then(() => accumulate(chunk, final));
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

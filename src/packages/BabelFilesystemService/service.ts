import type { Mount } from "../../lib/fs.ts";
import type { Service } from "../../packages.ts";

const BABEL_MAX_NAME_LENGTH = 2n;
const BABEL_ALPHABET_LENGTH = 74n;
const BABEL_DIRECTORY_OBJECTS = BABEL_ALPHABET_LENGTH ** BABEL_MAX_NAME_LENGTH;

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789! &()-_+[]^=".split("");

const CHILD_DIRS: string[] = (() => {
  const n = Number(BABEL_ALPHABET_LENGTH);
  const len = Number(BABEL_MAX_NAME_LENGTH);
  let names = [""];
  for (let pos = 0; pos < len; pos++) {
    const next: string[] = [];
    for (const prefix of names) {
      for (let i = 0; i < n; i++) next.push(prefix + alphabet[i]);
    }
    names = next;
  }
  return names;
})();

function isDirSegment(segment: string): boolean {
  if (segment.length !== Number(BABEL_MAX_NAME_LENGTH)) return false;
  for (const ch of segment) {
    const i = alphabet.indexOf(ch);
    if (i === -1 || i >= Number(BABEL_ALPHABET_LENGTH)) return false;
  }
  return true;
}

function getPath(bytes: Uint8Array<ArrayBuffer>): string {
  // Bijective base-256: turns the byte string into one big integer with
  // no leading-zero ambiguity (bytes[i]=0 still counts as a real digit).
  let index = 0n;
  for (let i = 0n; i < BigInt(bytes.length); i++) {
    index += (BigInt(bytes[Number(i)]) + 1n) * (256n ** i);
  }

  let path = "";
  while (index) {
    index--;
    let handle = index % BABEL_DIRECTORY_OBJECTS;
    let name = "";
    for (let i = 0n; i < BABEL_MAX_NAME_LENGTH; i++) {
      name = alphabet[Number(handle % BABEL_ALPHABET_LENGTH)] + name;
      handle /= BABEL_ALPHABET_LENGTH;
    }
    path = "/" + name + path;
    index /= BABEL_DIRECTORY_OBJECTS;
  }

  return path + "/file";
}

function getFile(path: string): Uint8Array<ArrayBuffer> {
  const segments = path.split("/").filter(Boolean);

  // Re-derive the big integer from the directory names, most-significant
  // segment first (that's the order getPath builds the path in, since it
  // prepends each new digit).
  let index = 0n;
  for (const segment of segments) {
    if (segment.length !== Number(BABEL_MAX_NAME_LENGTH)) {
      throw new Error(`Invalid path segment "${segment}": expected length ${BABEL_MAX_NAME_LENGTH}`);
    }
    let handle = 0n;
    for (const ch of segment) {
      const digit = alphabet.indexOf(ch);
      if (digit === -1 || digit >= Number(BABEL_ALPHABET_LENGTH)) {
        throw new Error(`Invalid character "${ch}" in path`);
      }
      handle = handle * BABEL_ALPHABET_LENGTH + BigInt(digit);
    }
    index = index * BABEL_DIRECTORY_OBJECTS + (handle + 1n);
  }

  // Undo the bijective base-256 packing to recover the original bytes.
  const bytes = [];
  while (index) {
    index--;
    bytes.push(Number(index % 256n));
    index /= 256n;
  }

  return new Uint8Array(bytes);
}

const mount: Mount = {
  root: "/babel",
  stat(path) {
    const segments = path.split("/").filter(Boolean);
    const isFile = segments[segments.length - 1] === "file";
    const dirSegments = isFile ? segments.slice(0, -1) : segments;
    for (const seg of dirSegments) {
      if (!isDirSegment(seg)) throw `No such path in the babel fs: ${path}`;
    }
    return isFile ? "file" : "dir";
  },
  ls(path) {
    const segments = path.split("/").filter(Boolean);
    for (const seg of segments) {
      if (!isDirSegment(seg)) throw `Not a directory in the babel fs: ${path}`;
    }
    // Every directory holds all possible child dirs plus its own file.
    return [...CHILD_DIRS, "file"];
  },
  read(path) {
    if (!path.endsWith("/file")) throw "Not a file in the babel fs";
    return new Blob([getFile(path.replace(/\/file$/g, ""))]);
  },
  write() {
    throw "Cannot write to read-only babel fs";
  },
  mkdir() {
    throw "Cannot mkdir in read-only babel fs";
  },
  unlink() {
    throw "Cannot unlink in read-only babel fs";
  },
};

const service: Service = {
  info: {
    name: "Babel Infinite Filesystem Service",
    dependencies: [],
    autostart: false,
  },
  start(sdk) {
    sdk.fs.mount(mount);
    return {
      stop() {
        sdk.fs.unmount(mount.root);
      },
      exposed: {
        getPath,
      },
    };
  },
};

export default service;

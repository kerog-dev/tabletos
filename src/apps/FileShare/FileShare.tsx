import { useState } from "react";
import conn from "../../applib/rpc.ts";
import type { Sdk } from "../../sdk.ts";

const { fs, getAppDir }: Sdk = (window as any).$;
const appDir = await getAppDir(`FileShare`);

interface RpcObject {
  startTransfer(from: string, file: string, size: number, contentType: string): void;
  addChunk(from: string, file: string, range: [number, number], chunk: string): void;
}

interface Transfer {
  from: string;
  file: string;
  bytes: Uint8Array<ArrayBuffer>;
  size: number;
  ranges: [number, number][]; // sorted, merged, non-overlapping
  contentType: string;
}

const CHUNK_SIZE = 64 * 1024;

function bytesToBinaryString(bytes: Uint8Array): string {
  const BATCH = 0x8000;
  let out = "";
  for (let i = 0; i < bytes.length; i += BATCH) {
    out += String.fromCharCode(...bytes.subarray(i, i + BATCH));
  }
  return out;
}

const transfers: Transfer[] = [];

function markRange(transfer: Transfer, start: number, end: number) {
  transfer.ranges.push([start, end]);
  transfer.ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of transfer.ranges) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) {
      last[1] = Math.max(last[1], e);
    } else {
      merged.push([s, e]);
    }
  }
  transfer.ranges = merged;
}

function isComplete(transfer: Transfer): boolean {
  return transfer.ranges.length === 1
    && transfer.ranges[0][0] === 0
    && transfer.ranges[0][1] === transfer.size;
}

const object: RpcObject = {
  async startTransfer(from, file, size, contentType) {
    transfers.push({ from, file, bytes: new Uint8Array(size), size, ranges: [], contentType });
    if (!(await fs.isDir(`${appDir}/${from}`))) await fs.mkdir(`${appDir}/${from}`);
  },
  addChunk(from, file, range, chunk) {
    const transfer = transfers.find(t => t.from === from && t.file === file);
    if (!transfer) return;

    const bytes = Uint8Array.from(chunk, c => c.charCodeAt(0));
    transfer.bytes.set(bytes, range[0]);
    markRange(transfer, range[0], range[1]);

    if (isComplete(transfer)) {
      transfers.splice(transfers.indexOf(transfer), 1);
      fs.writeFile(
        `${appDir}/${transfer.from}/${transfer.file}`,
        new Blob([transfer.bytes], { type: transfer.contentType }),
      );
    }
  },
};

conn.unexposeObject("fileshare");
conn.exposeObject(object, "fileshare");

export default function FileShare() {
  const [sourceMode, setSourceMode] = useState<"local" | "virtual">("local");
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [virtualPath, setVirtualPath] = useState("");
  const [targetClient, setTargetClient] = useState("");
  const [filename, setFilename] = useState("");
  const [progress, setProgress] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setError(null);

    if (!targetClient || !filename) {
      setError("Target client and filename are required");
      return;
    }

    let blob: Blob;
    try {
      if (sourceMode === "virtual") {
        if (!virtualPath) {
          setError("Enter a virtual file path");
          return;
        }
        blob = await fs.readBlobFile(virtualPath);
      } else {
        if (!localFile) {
          setError("Choose a file");
          return;
        }
        blob = localFile;
      }
    } catch (err) {
      setError(`Couldn't read file: ${err}`);
      return;
    }

    setSending(true);
    setProgress(0);
    try {
      const proxy = await conn.proxyObject<RpcObject>(targetClient, "fileshare");
      const buffer = new Uint8Array(await blob.arrayBuffer());
      const size = buffer.length;

      await proxy.startTransfer(conn.name, filename, size, blob.type);

      for (let start = 0; start < size; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE, size);
        const chunkStr = bytesToBinaryString(buffer.subarray(start, end));
        await proxy.addChunk(conn.name, filename, [start, end], chunkStr);
        setProgress(Math.round((end / size) * 100));
      }
    } catch (err) {
      setError(`Send failed: ${err}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
      You are: {conn.name}

      <div>
        <label>
          <input
            type="radio"
            checked={sourceMode === "local"}
            onChange={() => setSourceMode("local")}
          />{" "}
          Local file
        </label>
        <label style={{ marginLeft: 12 }}>
          <input
            type="radio"
            checked={sourceMode === "virtual"}
            onChange={() => setSourceMode("virtual")}
          />{" "}
          Virtual file
        </label>
      </div>

      {sourceMode === "local"
        ? (
          <input
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setLocalFile(f);
              if (f && !filename) setFilename(f.name);
            }}
          />
        )
        : (
          <input
            type="text"
            placeholder="/path/in/virtual/fs"
            value={virtualPath}
            onChange={(e) => setVirtualPath(e.target.value)}
          />
        )}

      <input
        type="text"
        placeholder="Target client (e.g. tabletos-1a2b3c)"
        value={targetClient}
        onChange={(e) => setTargetClient(e.target.value)}
      />

      <input
        type="text"
        placeholder="Filename"
        value={filename}
        onChange={(e) => setFilename(e.target.value)}
      />

      <button onClick={handleSend} disabled={sending}>
        {sending ? "Sending…" : "Send"}
      </button>

      {error && <div style={{ color: "red" }}>{error}</div>}

      <progress value={progress} max={100} style={{ width: "100%" }} />
    </div>
  );
}

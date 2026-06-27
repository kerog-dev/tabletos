import type { Service } from "../../packages.ts";

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

export interface Control {
  sendFile(
    { blob, targetClient, filename, onError, onProgress, onFinished }: {
      blob: Blob;
      targetClient: string;
      filename: string;
      onError: (error: string) => void;
      onProgress: (progress: number) => void;
      onFinished: () => void;
    },
  ): Promise<void>;
}

const CHUNK_SIZE = 256 * 1024;

function bytesToBinaryString(bytes: Uint8Array): string {
  const BATCH = 0x8000;
  let out = "";
  for (let i = 0; i < bytes.length; i += BATCH) {
    out += String.fromCharCode(...bytes.subarray(i, i + BATCH));
  }
  return out;
}

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

const service: Service = {
  info: {
    name: "File Sharing Service",
    dependencies: [],
    autostart: false, // maybe change?
  },
  async start({ fs, getAppDir, conn }) {
    const appDir = await getAppDir(`FileShare`);
    const transfers: Transfer[] = [];

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

    conn.exposeObject(object, "fileshare");

    const control: Control = {
      async sendFile({ blob, targetClient, filename, onError, onProgress, onFinished }) {
        try {
          const proxy = await conn.proxyObject<RpcObject>(targetClient, "fileshare");
          const buffer = new Uint8Array(await blob.arrayBuffer());
          const size = buffer.length;

          await proxy.startTransfer(conn.name, filename, size, blob.type);

          for (let start = 0; start < size; start += CHUNK_SIZE) {
            const end = Math.min(start + CHUNK_SIZE, size);
            const chunkStr = bytesToBinaryString(buffer.subarray(start, end));
            await proxy.addChunk(conn.name, filename, [start, end], chunkStr);
            onProgress(Math.round((end / size) * 100));
          }
        } catch (err) {
          onError(`Send failed: ${err}`);
        } finally {
          onFinished();
        }
      },
    };

    return {
      exposed: control,
      stop() {
        conn.unexposeObject("fileshare");
      },
    };
  },
};

export default service;

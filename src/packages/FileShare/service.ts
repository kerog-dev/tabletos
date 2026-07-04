import type { Service } from "../../packages.ts";

interface RpcObject {
  startTransfer(from: string, file: string, size: number, contentType: string): void;
  addChunk(from: string, file: string, chunkI: number, chunk: string): void;
}

interface Transfer {
  from: string;
  file: string;
  bytes: Uint8Array<ArrayBuffer>;
  size: number;
  chunks: number;
  chunksReceived: Set<number>;
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

function isComplete(transfer: Transfer): boolean {
  return transfer.chunksReceived.size === transfer.chunks;
}

const service: Service = {
  info: {
    name: "File Sharing Service",
    autostart: false, // maybe change?
  },
  async start({ fs, getAppDir, conn }) {
    const appDir = await getAppDir(`FileShare`);
    const transfers: Transfer[] = [];

    const object: RpcObject = {
      async startTransfer(from, file, size, contentType) {
        transfers.push({
          from,
          file,
          bytes: new Uint8Array(size),
          size,
          chunks: Math.ceil(size / CHUNK_SIZE),
          chunksReceived: new Set(),
          contentType,
        });
        if (!(await fs.isDir(`${appDir}/${from}`))) await fs.mkdir(`${appDir}/${from}`);
      },
      addChunk(from, file, chunkI, chunk) {
        const transfer = transfers.find(t => t.from === from && t.file === file);
        if (!transfer) return;

        const bytes = Uint8Array.from(chunk, c => c.charCodeAt(0));
        transfer.chunksReceived.add(chunkI);
        transfer.bytes.set(bytes, chunkI * CHUNK_SIZE);

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
          const proxy = conn.proxyObject<RpcObject>(targetClient, "fileshare");
          const buffer = new Uint8Array(await blob.arrayBuffer());
          const size = buffer.length;

          await proxy.startTransfer(conn.name, filename, size, blob.type);

          const chunks = Math.ceil(size / CHUNK_SIZE);

          for (let chunkI = 0; chunkI < chunks; chunkI += 1) {
            const start = chunkI * CHUNK_SIZE;
            const end = (chunkI + 1) * CHUNK_SIZE;
            const chunkStr = bytesToBinaryString(buffer.subarray(start, end));
            await proxy.addChunk(conn.name, filename, chunkI, chunkStr);
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

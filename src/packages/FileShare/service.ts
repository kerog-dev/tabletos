import { EventUrgency } from "../../eventlog.ts";
import type { Service } from "../../loader/loader.ts";

interface RpcObject {
  startTransfer(from: string, file: string, size: number, contentType: string): void;
  addChunk(from: string, file: string, chunkI: number, chunk: string): void;
  finishTransfer(from: string, file: string, checksum: string): Promise<boolean>;
}

interface Transfer {
  from: string;
  file: string;
  bytes: Uint8Array<ArrayBuffer>;
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

function calcCrc(data: Uint8Array<ArrayBuffer>): number {
  const polynomial = 0xEDB88320;
  let crc = 0xFFFFFFFF;

  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];

    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? polynomial : 0);
    }
  }

  return crc ^ 0xFFFFFFFF;
}

function calcChecksum(data: Uint8Array<ArrayBuffer>): string {
  return `${calcCrc(data.slice(0, 1024))}-${calcCrc(data.slice(-1024))}-${data.length}`;
}

const service: Service = {
  info: {
    name: "File Sharing Service",
    autostart: false, // maybe change?
  },
  async start({ fs, getAppDir, conn, eventlog }) {
    const appDir = await getAppDir(`FileShare`);
    const transfers: Transfer[] = [];

    const object: RpcObject = {
      async startTransfer(from, file, size, contentType) {
        eventlog.add(
          "File Share",
          `Receiving transfer started: ${size} bytes, ${contentType}, from: ${from}, file name: ${file}`,
          EventUrgency.Info,
        );
        transfers.push({
          from,
          file,
          bytes: new Uint8Array(size),
          contentType,
        });
        if (!(await fs.isDir(`${appDir}/${from}`))) await fs.mkdir(`${appDir}/${from}`);
      },
      addChunk(from, file, chunkI, chunk) {
        const transfer = transfers.find(t => t.from === from && t.file === file);
        if (!transfer) return;

        const bytes = Uint8Array.from(chunk, c => c.charCodeAt(0));
        transfer.bytes.set(bytes, chunkI * CHUNK_SIZE);
      },
      async finishTransfer(from, file, crc) {
        const transfer = transfers.find(t => t.from === from && t.file === file);
        if (!transfer) return false;
        transfers.splice(transfers.indexOf(transfer), 1);
        fs.writeFile(
          `${appDir}/${transfer.from}/${transfer.file}`,
          new Blob([transfer.bytes], { type: transfer.contentType }),
        );
        const fileCRC = calcChecksum(transfer.bytes);
        eventlog.add(
          "File Share",
          `Receiving transfer finished: ${file} from ${from} with CRC ${crc}, matches: ${
            crc === fileCRC ? "yes" : "no"
          }`,
          EventUrgency.Info,
        );
        if (crc !== fileCRC) return false;
        return true;
      },
    };

    conn.exposeObject(object, "fileshare");

    const control: Control = {
      async sendFile({ blob, targetClient, filename, onError, onProgress, onFinished }) {
        const concurrency = 4;
        try {
          const proxy = conn.proxyObject<RpcObject>(targetClient, "fileshare");
          const buffer = new Uint8Array(await blob.arrayBuffer());
          const size = buffer.length;
          await proxy.startTransfer(conn.name, filename, size, blob.type);
          eventlog.add(
            "File Share",
            `Sending transfer started: ${size} bytes, ${blob.type}, to: ${targetClient}, file name: ${filename}`,
            EventUrgency.Info,
          );

          const chunks = Math.ceil(size / CHUNK_SIZE);
          let bytesSent = 0;

          async function sendChunk(chunkI: number) {
            const start = chunkI * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, size);
            const chunkStr = bytesToBinaryString(buffer.subarray(start, end));
            await proxy.addChunk(conn.name, filename, chunkI, chunkStr);
            bytesSent += end - start;
            onProgress(Math.round((bytesSent / size) * 100));
          }

          let next = 0;
          const inFlight = new Map<number, Promise<void>>();

          while (next < chunks || inFlight.size > 0) {
            while (inFlight.size < concurrency && next < chunks) {
              const i = next++;
              const p = sendChunk(i).finally(() => inFlight.delete(i));
              inFlight.set(i, p);
            }
            await Promise.race(inFlight.values());
          }

          const finishedOk = await proxy.finishTransfer(
            conn.name,
            filename,
            calcChecksum(buffer),
          );
          eventlog.add(
            "File Share",
            `Receiving transfer finished: ${filename} to ${targetClient}, ok: ${finishedOk ? "yes" : "no"}`,
            EventUrgency.Info,
          );
          if (!finishedOk) throw new Error("Did not finish ok");
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

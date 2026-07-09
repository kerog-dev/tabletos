export const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function decompress(input: Blob): Promise<Blob> {
  const outStream = input.stream().pipeThrough(new DecompressionStream("gzip"));
  const blob = await new Response(outStream).blob();
  return blob;
}

export async function compress(input: Blob): Promise<Blob> {
  const outStream = input.stream().pipeThrough(new CompressionStream("gzip"));
  const blob = await new Response(outStream).blob();
  return blob;
}

export type Promisify<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>>
    : T[K];
};

export function blobToJsonString(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve(JSON.stringify({ data: base64, type: blob.type }));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function jsonStringToBlob(json: string): Blob {
  const { data, type } = JSON.parse(json);
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type });
}

export function randomId(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2)));
  return [...bytes]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
}

export function createListenerSet<Args extends any[]>() {
  const listeners: ((...args: Args) => void)[] = [];
  return {
    add: (l: (...args: Args) => void) => listeners.push(l),
    remove: (l: (...args: Args) => void) => {
      const i = listeners.indexOf(l);
      if (i !== -1) listeners.splice(i, 1);
    },
    emit: (...args: Args) =>
      listeners.forEach(l => {
        try {
          l(...args);
        } catch (e) {
          console.error(e);
        }
      }),
  };
}

export function formatTime(time: number | Date): string {
  const date = typeof time === "number" ? new Date(time) : time;

  return date.toLocaleString();
}

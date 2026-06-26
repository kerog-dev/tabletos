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

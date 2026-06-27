import { unzip } from "fflate";
import vendorZip from "vendor:vendor.zip";
import type { Sdk } from "./sdk.ts";

await (window as any).$ready;
const { fs }: Sdk = (window as any).$;

const bytes = Uint8Array.from(atob(vendorZip), c => c.charCodeAt(0));
const files: Record<string, Uint8Array<ArrayBuffer>> = await new Promise((res, rej) =>
  unzip(bytes, (err, f) => err ? rej(err) : res(f))
);

const fsBlobs = Object.fromEntries(Object.entries(files).map(([k, v]): [typeof k, Blob] => [k, new Blob([v])]));

fs.mount(
  fs.fsMount(
    "/vendor",
    fsBlobs,
  ),
);

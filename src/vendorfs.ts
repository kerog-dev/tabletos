import { unzip } from "fflate";
import vendorZip from "vendor:vendor.zip";
import type { Sdk } from "./sdk.ts";

// ISSUE: needs refresh on first load

await (window as any).$ready;
const { fs }: Sdk = (window as any).$;

if (!(await fs.isDir("/vendor"))) {
  await fs.mkdir("/vendor");
}

const bytes = Uint8Array.from(atob(vendorZip), c => c.charCodeAt(0));
const files: Record<string, Uint8Array<ArrayBuffer>> = await new Promise((res, rej) =>
  unzip(bytes, (err, f) => err ? rej(err) : res(f))
);

for (const [path, data] of Object.entries(files)) {
  await fs.mkdirp(fs.parent("/vendor/" + path));
  await fs.writeFile("/vendor/" + path, new Blob([data]));
}

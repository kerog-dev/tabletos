import { unzip } from "fflate";
import vendorZip from "vendor:vendor.zip";
import { loadPackageBlob } from "./loader/packages.ts";
import { type Sdk } from "./sdk.ts";

const TEXT_EXTENSIONS = [".md", ".txt", ".json", ".js", ".ts", ".css", ".html"];

export async function mountVendorFs() {
  await (window as any).$ready;
  const { fs }: Sdk = (window as any).$;

  const bytes = Uint8Array.from(atob(vendorZip), c => c.charCodeAt(0));
  const files: Record<string, Uint8Array<ArrayBuffer>> = await new Promise((res, rej) =>
    unzip(bytes, (err, f) => err ? rej(err) : res(f))
  );

  const fsMounted = Object.fromEntries(
    Object.entries(files).map(([k, v]) => {
      if (TEXT_EXTENSIONS.some(ext => k.endsWith(ext))) {
        return [k, new TextDecoder().decode(v)];
      }
      return [k, new Blob([v])];
    }),
  );

  if (await fs.pathExists("/vendor")) fs.unmount("/vendor");
  fs.mount(
    fs.fsMount(
      "/vendor",
      fsMounted,
    ),
  );

  if (await fs.pathExists("/vendor/bundled-packages")) {
    for (const filename of await fs.ls("/vendor/bundled-packages")) {
      loadPackageBlob(filename.replace(".zip", ""), await fs.readBlobFile("/vendor/bundled-packages/" + filename));
    }
  }
}

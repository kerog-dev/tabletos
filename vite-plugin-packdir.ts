import { zipSync } from "fflate";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export default function packDir(virtualId: string, srcDir: string) {
  const absSrcDir = resolve(srcDir);
  const resolvedId = "\0" + virtualId;
  return {
    name: "pack-dir",
    resolveId(id: string) {
      if (id === virtualId) return resolvedId;
    },
    load(id: string) {
      if (id !== resolvedId) return;
      const files: Record<string, any> = {};
      const self = this as any;
      function walk(dir: string, prefix = "") {
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry);
          const rel = prefix + entry;
          if (statSync(full).isDirectory()) walk(full, rel + "/");
          else {
            self.addWatchFile(full);
            files[rel] = readFileSync(full);
          }
        }
      }
      walk(absSrcDir);
      const b64 = Buffer.from(zipSync(files)).toString("base64");
      console.log(`Vendor filesystem bundle size: ${Math.round(b64.length / 1024)} KB`);
      return `export default "${b64}";`;
    },
  };
}

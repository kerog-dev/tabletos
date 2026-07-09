import { sha256 } from "js-sha256";
import type { Service } from "../../loader/loader.ts";

const service: Service = {
  info: {
    name: "Auto-update Service",
    autostart: true,
  },
  start({ fs, afetch: fetch, toast, Urgency }) {
    async function update(name: string) {
      try {
        const response = await fetch(`http://server/packages/${name}.zip`);
        const zipBlob = await response.blob();
        if (!(await fs.isDir("/packages"))) await fs.mkdir("/packages");
        await fs.unlink(`/packages/${name}.zip`);
        await fs.writeFile(`/packages/${name}.zip`, zipBlob);
        toast({ title: `Auto-updated ${name} succesfully!` });
      } catch (e) {
        toast({ title: `Failed to auto-update ${name}`, desc: `Error: ${e}`, urgency: Urgency.Error });
      }
    }

    async function hashFile(path: string) {
      const blob = await fs.readBlobFile(path);
      return sha256(await blob.arrayBuffer());
    }

    async function checkPackage(name: string) {
      const hashes = await Promise.all([
        await fetch(`http://server/package-hashes/${name}.zip`).then(r => r.text()),
        await hashFile(`/packages/${name}.zip`),
      ]);
      const mismatch = hashes[0] !== hashes[1];
      if (!mismatch) return;
      await update(name);
    }

    async function check() {
      if (!(await fs.isDir("/packages"))) return;
      const packages = await fs.ls("/packages");
      return await Promise.all(packages.map(pkg => checkPackage(pkg.replace(".zip", ""))));
    }

    check();
    const id = setInterval(() => check(), 5 * 60 * 1_000);

    return {
      stop() {
        clearInterval(id);
      },
    };
  },
};

export default service;

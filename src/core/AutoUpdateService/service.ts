import { sha256 } from "js-sha256";
import type { Service } from "../../loader/loader.ts";

async function hashBlob(blob: Blob): Promise<string> {
  return sha256(await blob.arrayBuffer());
}

const service: Service = {
  info: {
    name: "Auto-update Service",
    autostart: true,
  },
  start({ fs, afetch: fetch, toast, Urgency }) {
    async function check() {
      if (!(await fs.isDir("/packages"))) return;
      const packageDirListing = await fs.ls("/packages");
      const availablePackages: string[] = await (await fetch("http://server/available-packages")).json();
      let remoteHashes: Record<string, string> = {};
      let localHashes: Record<string, string> = {};

      await Promise.all(
        availablePackages.map(async name => {
          const hash = await fetch(`http://server/package-hashes/${name}.zip`).then(r => r.text());
          remoteHashes[name] = hash;
        }),
      );

      await Promise.all(
        packageDirListing
          .filter(f => f.endsWith(".zip"))
          .map(async filename => {
            const blob = await fs.readBlobFile(`/packages/${filename}`);
            const packageName = filename.replace(".zip", "");
            const hash = await hashBlob(blob);
            localHashes[packageName] = hash;
          }),
      );

      const toUpdate = Object.entries(localHashes).filter(([name, local]) => {
        if (!remoteHashes[name]) return false;
        const remote = remoteHashes[name];
        return remote !== local;
      }).map(entry => entry[0]);

      async function update(name: string) {
        try {
          await fs.unlink(`/packages/${name}.zip`);
          const response = await fetch(`http://server/packages/${name}.zip`);
          const zipBlob = await response.blob();
          if (!(await fs.isDir("/packages"))) await fs.mkdir("/packages");
          await fs.writeFile(`/packages/${name}.zip`, zipBlob);
          toast({ title: `Auto-updated ${name} succesfully!` });
        } catch (e) {
          toast({ title: `Failed to auto-update ${name}`, desc: `Error: ${e}`, urgency: Urgency.Error });
        }
      }

      await Promise.allSettled(toUpdate.map(p => update(p)));
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

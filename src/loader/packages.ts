import { unzip } from "fflate";
import * as fs from "../lib/fs.ts";
import { apps, loadAppFromScript, unloadApp } from "./apps.ts";
import { type Service, sv } from "./services.ts";

const packageServiceNameMapping: Partial<Record<string, string>> = {};

async function loadPackageService(packageName: string, scriptBlob: Blob) {
  const url = URL.createObjectURL(scriptBlob);
  const module: { default: Service } = await import(/* @vite-ignore */ url);
  await sv.load(module.default, module.default.info.autostart);
  packageServiceNameMapping[packageName] = module.default.info.name;
}

export async function loadPackageBlob(name: string, zipBlob: Blob) {
  const zipBuf = await zipBlob.arrayBuffer();
  const data = await new Promise<Record<string, Uint8Array<ArrayBuffer>>>((res, rej) => {
    unzip(new Uint8Array(zipBuf), {}, (err, data) => {
      if (err) {
        return rej(err);
      }
      res(data);
    });
  });
  const promises = [];

  const iconMime: Record<string, string> = {
    png: "image/png",
    svg: "image/svg+xml",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };

  const iconKey = Object.keys(data).find(k => k.startsWith("icon.") && !k.includes("/"));
  const icon = iconKey
    ? URL.createObjectURL(new Blob([data[iconKey]], { type: iconMime[iconKey.split(".").at(-1)!] }))
    : undefined;

  if (data[name + ".js"]) promises.push(loadAppFromScript(name, new TextDecoder().decode(data[name + ".js"]), icon));
  if (data["service.js"]) {
    promises.push(loadPackageService(name, new Blob([data["service.js"]], { type: "text/javascript" })));
  }

  await Promise.all(promises);
  return console.log(`Loaded package successfully: ${name}`);
}

async function loadPackage(name: string): Promise<void> {
  try {
    const zipBlob = await fs.readBlobFile(`/packages/${name}.zip`);
    await loadPackageBlob(name, zipBlob);
  } catch (reason) {
    return console.error(`Error loading package ${name}: ${reason}`);
  }
}

export async function unloadPackage(name: string) {
  if (packageServiceNameMapping[name]) sv.unload(packageServiceNameMapping[name]);
  if (apps.some(app => app.name === name)) unloadApp(name);
}

export async function loadPackages() {
  if (!(await fs.isDir("/packages"))) return;
  const names = (await fs.ls("/packages")).map(filename => filename.replace(".zip", ""));
  await Promise.allSettled(names.map(name => loadPackage(name)));
  fs.watch(
    "/packages",
    async (path, action) => {
      const name = path.split("/").at(-1)!.replace(".zip", "");
      if (action === "create") {
        console.log(`New package: ${name}`);
        await loadPackage(name);
      } else if (action === "delete") {
        console.log(`Deleted package: ${name}`);
        await unloadPackage(name);
      }
    },
    false,
    ["create", "delete"],
  );
}

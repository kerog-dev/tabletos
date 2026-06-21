import { lazy, useEffect, useState } from "react";
import * as fs from "./fs.ts";
import { decompress } from "./utils.ts";

interface AppComponentParams {
  args: any[];
}

interface AppManifest {
  alternateToolbarPosition: boolean;
}

const defaultManifest: AppManifest = { alternateToolbarPosition: false };

interface App {
  name: string;
  component: React.LazyExoticComponent<React.FC<AppComponentParams>>;
  manifest: Promise<Partial<AppManifest>>;
  isCore: boolean;
}

// TODO: make manifests just a thing apps export
async function getManifestKey<T extends keyof AppManifest>(
  app: App,
  key: T,
): Promise<AppManifest[T]> {
  return (await app.manifest)[key] ?? defaultManifest[key];
}

const appModules = import.meta.glob("./core/*.tsx");
const appManifests = import.meta.glob("./core/*.json");

const apps: App[] = Object.entries(appModules).map(([path, importFn]) => {
  const name = path.replace("./core/", "").replace(".tsx", "");
  const manifestPath = `./core/${name}.json`;
  const manifestImport = appManifests[manifestPath];

  return {
    name,
    component: lazy(importFn as () => Promise<{ default: React.FC<AppComponentParams> }>),
    manifest: manifestImport
      ? (manifestImport() as Promise<{ default: Partial<AppManifest> }>)
        .then(m => m.default)
        .catch(() => defaultManifest)
      : Promise.resolve(defaultManifest),
    isCore: true,
  };
});

const appChangeListeners: (() => void)[] = [];
const appsChanged = () => appChangeListeners.forEach(l => l());

export async function loadAppFromScript(name: string, script: string) {
  if (apps.some(app => app.name === name)) throw "App with that name is already loaded!";

  const blob = new Blob([script], { type: "text/javascript" });
  const uri = URL.createObjectURL(blob);

  const mod = () => import(uri);
  const app: App = { name, manifest: Promise.resolve({}), component: lazy(mod), isCore: false };

  apps.push(app);
  appsChanged();
}

export function unloadApp(name: string) {
  const app = apps.find(app => app.name === name);
  if (!app) throw "App not found";
  if (app.isCore) throw "Cannot unload core app";
  apps.splice(apps.indexOf(app), 1);
  appsChanged();
}

function onAppsChanged(listener: () => void) {
  appChangeListeners.push(listener);
}

async function loadFsApps() {
  if (!(await fs.isDir("/apps"))) return;
  const children = await fs.ls("/apps");
  for (const child of children) {
    try {
      const compressed = await fs.readBlobFile(`/apps/${child}`);
      const decompressed = await decompress(compressed);
      loadAppFromScript(child.replace(".js.gz", ""), await decompressed.text());
    } catch {}
  }
}

loadFsApps();

export function useApps() {
  const [sapps, setSapps] = useState(apps);

  useEffect(() => {
    onAppsChanged(() => setSapps([...apps]));
  }, []);

  return sapps;
}

export { type App, apps, getManifestKey };

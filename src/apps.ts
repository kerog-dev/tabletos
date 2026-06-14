import { lazy } from "react";

interface AppComponentParams {}

interface AppManifest {
  alternateToolbarPosition: boolean;
}

const defaultManifest: AppManifest = { alternateToolbarPosition: false };

interface App {
  name: string;
  component: React.LazyExoticComponent<React.FC<AppComponentParams>>;
  manifest: Promise<Partial<AppManifest>>;
}

async function getManifestKey<T extends keyof AppManifest>(
  app: App,
  key: T,
): Promise<AppManifest[T]> {
  return (await app.manifest)[key] ?? defaultManifest[key];
}

const appModules = import.meta.glob("./apps/*.tsx");
const appManifests = import.meta.glob("./apps/*.json");

const apps: App[] = Object.entries(appModules).map(([path, importFn]) => {
  const name = path.replace("./apps/", "").replace(".tsx", "");
  const manifestPath = `./apps/${name}.json`;
  const manifestImport = appManifests[manifestPath];

  return {
    name,
    component: lazy(importFn as () => Promise<{ default: React.FC<AppComponentParams> }>),
    manifest: manifestImport
      ? (manifestImport() as Promise<{ default: Partial<AppManifest> }>)
        .then(m => m.default)
        .catch(() => defaultManifest)
      : Promise.resolve(defaultManifest),
  };
});

export { type App, apps, getManifestKey };

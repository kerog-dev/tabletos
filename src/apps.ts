import { lazy } from "react";

interface AppComponentParams {}

interface AppManifest {
  alternateToolbarPosition: boolean;
}

const defaultManifest: AppManifest = { alternateToolbarPosition: false };

export interface App {
  name: string;
  component: React.LazyExoticComponent<React.FC<AppComponentParams>>;
  manifest: Promise<Partial<AppManifest>>;
}

function loadApps(names: string[]): App[] {
  return names.map((name) => ({
    name,
    manifest: import(`./apps/${name}.json`).catch(() => defaultManifest),
    component: lazy(() => import(`./apps/${name}.tsx`)),
  }));
}

async function getManifestKey<T extends keyof AppManifest>(
  app: App,
  key: T,
): Promise<AppManifest[T]> {
  return (await app.manifest)[key] ?? defaultManifest[key];
}

const apps: App[] = loadApps([
  "Calculator",
  "Snap",
  "MediaClient",
  "Whiteboard",
  "Storage",
  "TicTacToe",
  "Chess",
  "WM",
]);

export { apps, getManifestKey };

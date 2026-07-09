import { lazy } from "react";
import { create } from "zustand";

interface AppComponentParams {
  args: any[];
}

export interface App {
  name: string;
  iconUrl?: string;
  component: React.LazyExoticComponent<React.FC<AppComponentParams>>;
  isCore: boolean;
}

// EXAMPLE: ./core/One/One.tsx but not ./core/Two/Other.tsx
const appModules = Object.entries(import.meta.glob("../core/*/*.tsx"))
  .filter(([path]) => {
    const parts = path.split("/");
    const file = parts.at(-1)?.replace(".tsx", "");
    const folder = parts.at(-2);
    return file === folder;
  });

const appIconModules = Object.entries(
  import.meta.glob("../core/*/icon.*", { eager: true, query: "?url" }) as Record<string, { default: string }>,
);
const appIcons = Object.fromEntries(
  appIconModules.map(([path, { default: url }]): [string, string] => [
    path.split("/").at(-2)!,
    url,
  ]),
);

const devPackageModules = import.meta.env.DEV
  ? Object.entries(
    Object.assign(import.meta.glob("../packages/*/*.tsx"), import.meta.glob("../private-packages/*/*.tsx")),
  )
    .filter(([path]) => {
      const parts = path.split("/");
      const file = parts.at(-1)?.replace(".tsx", "");
      const folder = parts.at(-2);
      return file === folder;
    })
  : [];

const devPackageIconModules = import.meta.env.DEV
  ? Object.entries(
    import.meta.glob("../packages/*/icon.*", { eager: true, query: "?url" }) as Record<string, { default: string }>,
  )
  : [];
const devPackageIcons = import.meta.env.DEV
  ? Object.fromEntries(
    devPackageIconModules.map(([path, { default: url }]): [string, string] => [
      path.split("/").at(-2)!,
      url,
    ]),
  )
  : {};

export const apps: App[] = [...appModules, ...devPackageModules].map(([path, importFunc]) => {
  const name = path.split("/").at(-2)!;

  return {
    name,
    iconUrl: appIcons[name] ?? devPackageIcons[name],
    component: lazy(importFunc as () => Promise<{ default: React.FC<AppComponentParams> }>),
    isCore: true,
  };
});

const useAppsStore = create<{ apps: App[] }>(() => ({ apps }));

function appsChanged() {
  useAppsStore.setState({ apps: [...apps] });
}

export async function loadAppFromScript(name: string, script: string, icon?: string) {
  if (apps.some(app => app.name === name)) throw "App with that name is already loaded!";

  const blob = new Blob([script], { type: "text/javascript" });
  const uri = URL.createObjectURL(blob);

  const mod = () => import(/* @vite-ignore */ uri);
  const app: App = { name, component: lazy(mod), isCore: false, iconUrl: icon };

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

export function useApps() {
  return useAppsStore(s => s.apps);
}

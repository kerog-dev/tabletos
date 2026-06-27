import { lazy, useEffect, useState } from "react";
import * as fs from "./lib/fs.ts";
import type { Sdk } from "./sdk.ts";
import { decompress } from "./utils.ts";

interface AppComponentParams {
  args: any[];
}

export interface App {
  name: string;
  component: React.LazyExoticComponent<React.FC<AppComponentParams>>;
  isCore: boolean;
}

export interface ServiceInfo {
  name: string;
  dependencies: string[];
  autostart: boolean;
}

export interface Service {
  info: ServiceInfo;
  start(sdk: Sdk): Promise<StartedService> | StartedService;
}

interface StartedService {
  exposed?: object;
  stop(): Promise<void> | void;
}

// EXAMPLE: ./core/One/One.tsx but not ./core/Two/Other.tsx
const appModules = Object.entries(import.meta.glob("./core/*/*.tsx"))
  .filter(([path]) => {
    const parts = path.split("/");
    const file = parts.at(-1)?.replace(".tsx", "");
    const folder = parts.at(-2);
    return file === folder;
  });

const devPackageModules = import.meta.env.DEV
  ? Object.entries(import.meta.glob("./packages/*/*.tsx"))
    .filter(([path]) => {
      const parts = path.split("/");
      const file = parts.at(-1)?.replace(".tsx", "");
      const folder = parts.at(-2);
      return file === folder;
    })
  : [];

export const apps: App[] = [...appModules, ...devPackageModules].map(([path, importFunc]) => {
  const name = path.split("/").at(-2)!;

  return {
    name,
    component: lazy(importFunc as () => Promise<{ default: React.FC<AppComponentParams> }>),
    isCore: true,
  };
});

const appChangeListeners: (() => void)[] = [];
const appsChanged = () => appChangeListeners.forEach(l => l());

export async function loadAppFromScript(name: string, script: string) {
  if (apps.some(app => app.name === name)) throw "App with that name is already loaded!";

  const blob = new Blob([script], { type: "text/javascript" });
  const uri = URL.createObjectURL(blob);

  const mod = () => import(/* @vite-ignore */ uri);
  const app: App = { name, component: lazy(mod), isCore: false };

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

const coreServiceModules = Object.entries(import.meta.glob("./core/*/service.ts"));

const devPackageServiceModules = import.meta.env.DEV
  ? Object.entries(import.meta.glob("./packages/*/service.ts"))
  : [];

async function loadServices() {
  const loads = [...coreServiceModules, ...devPackageServiceModules].map((
    [path, importFunc],
  ): [string, Promise<{ default: Service }>] => [
    path.split("/").at(-2)!,
    (importFunc as () => Promise<{ default: Service }>)(),
  ]);

  const results = await Promise.allSettled(loads.map(l => l[1]));

  for (const result of results.map((x, i): [PromiseSettledResult<{ default: Service }>, string] => [x, loads[i][0]])) {
    if (result[0].status === "rejected") {
      console.log(result[1] + "'s service failed to start: " + result[0].reason);
    }
  }

  results.filter(r => r.status === "fulfilled").forEach(r => services.push(r.value.default));
}

async function startServices(names: string[]) {
  names = names.filter(sn => !startedServices.some(s => s.service.info.name === sn));
  await (window as any).$ready;
  await Promise.allSettled(
    services.filter(s => names.includes(s.info.name)).map(async service =>
      startedServices.push({ service, started: await service.start((window as any).$) })
    ),
  );
}

async function stopServices(names: string[]) {
  names = names.filter(sn => startedServices.some(s => s.service.info.name === sn));
  await (window as any).$ready;
  await Promise.allSettled(
    startedServices.filter(s => names.includes(s.service.info.name)).map(async s => {
      await s.started.stop();
      startedServices.splice(startedServices.indexOf(s), 1);
    }),
  );
}

const services: Service[] = [];
const startedServices: { started: StartedService; service: Service }[] = [];

loadServices().then(() => ServiceManager.sv.loadFsServices()).then(() =>
  ServiceManager.sv.start(services.filter(s => s.info.autostart).map(s => s.info.name))
).then(() => console.log(`Started services succesfully!`)).catch(
  reason => console.log(`Failed to start services: ${reason}`),
);

class ServiceManager {
  static sv = new this();

  private runChangeListeners: [string[] | undefined, ((running: boolean, name: string) => void)][] = [];

  private constructor() {}

  async start(target?: string | string[]) {
    const targets = typeof target === "string" ? [target] : (target ?? services.map(s => s.info.name));
    const result = await startServices(targets);
    for (const target of targets) {
      for (const [svcs, listener] of this.runChangeListeners) {
        if (svcs && !svcs.includes(target)) continue;
        try {
          listener(true, target);
        } catch (e) {
          console.error(`Error running service state change listener (target: ${target}): ${e}`);
        }
      }
    }
    return result;
  }

  async stop(target?: string | string[]) {
    const targets = typeof target === "string" ? [target] : (target ?? services.map(s => s.info.name));
    const result = await stopServices(targets);
    for (const target of targets) {
      for (const [svcs, listener] of this.runChangeListeners) {
        if (svcs && !svcs.includes(target)) continue;
        try {
          listener(false, target);
        } catch (e) {
          console.error(`Error running service state change listener (target: ${target}): ${e}`);
        }
      }
    }
    return result;
  }

  async load(service: Service, start = true) {
    if (services.some(s => s.info.name === service.info.name)) throw "Service with that name is already loaded!";
    services.push(service);
    if (start) await this.start(service.info.name);
  }

  async unload(service: Service) {
    const isStarted = startedServices.some(s => s.service === service);
    if (isStarted) await this.stop(service.info.name);
    services.splice(services.indexOf(service), 1);
  }

  async loadFsServices() {
    if (!(await fs.isDir("/services"))) return;
    const children = await fs.ls("/services");
    for (const child of children) {
      try {
        const compressed = await fs.readBlobFile(`/services/${child}`);
        const decompressed = await decompress(compressed);
        const moduleBlobUrl = URL.createObjectURL(decompressed);
        const module: { default: Service } = await import(moduleBlobUrl);
        await this.load(module.default);
      } catch {}
    }
  }

  get(name: string): object | null {
    return startedServices.find(s => s.service.info.name === name)?.started.exposed ?? null;
  }

  isRunning(name: string): boolean {
    return startedServices.some(s => s.service.info.name === name);
  }

  onRunningStateChanged(targets: string[] | undefined, listener: (running: boolean, name: string) => void) {
    this.runChangeListeners.push([targets, listener]);
  }

  removeRunningStateChangeListener(listener: (running: boolean, name: string) => void) {
    this.runChangeListeners.splice(this.runChangeListeners.findIndex(e => e[1] === listener), 1);
  }

  list(): ServiceInfo[] {
    return services.map(s => s.info);
  }
}

export const sv = ServiceManager.sv;

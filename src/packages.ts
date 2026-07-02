import { unzip } from "fflate";
import { lazy, useEffect, useState } from "react";
import * as fs from "./lib/fs.ts";
import type { Sdk } from "./sdk.ts";

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
  ? Object.entries(
    Object.assign(import.meta.glob("./packages/*/*.tsx"), import.meta.glob("./private-packages/*/*.tsx")),
  )
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

export function useApps() {
  const [sapps, setSapps] = useState(apps);

  useEffect(() => {
    onAppsChanged(() => setSapps([...apps]));
  }, []);

  return sapps;
}

const coreServiceModules = Object.entries(import.meta.glob("./core/*/service.ts"));

const devPackageServiceModules = import.meta.env.DEV
  ? Object.entries(
    Object.assign(import.meta.glob("./packages/*/service.ts"), import.meta.glob("./private-packages/*/service.ts")),
  )
  : [];

class ServiceManager {
  static readonly sv = new ServiceManager();

  private services: Service[] = [];
  private startedServices: { started: StartedService; service: Service }[] = [];
  private runChangeListeners: [string[] | undefined, ((running: boolean, name: string) => void)][] = [];

  private constructor() {
    this.init().catch(reason => console.error(`Failed to start services: ${reason}`));
  }

  async init() {
    await this.loadServices();
    await sv.start(sv.list().filter(s => s.autostart).map(s => s.name));
    console.log("Started services successfully!");
  }

  private async loadServices() {
    const allModules = [...coreServiceModules, ...devPackageServiceModules];
    const results = await Promise.allSettled(
      allModules.map(([, importFunc]) => (importFunc as () => Promise<{ default: Service }>)()),
    );

    for (const [i, result] of results.entries()) {
      const name = allModules[i][0].split("/").at(-2)!;
      if (result.status === "rejected") {
        console.error(`${name}'s service failed to start: ${result.reason}`);
      } else {
        this.services.push(result.value.default);
      }
    }
  }

  private notifyListeners(running: boolean, targets: string[]) {
    for (const target of targets) {
      for (const [svcs, listener] of this.runChangeListeners) {
        if (svcs && !svcs.includes(target)) continue;
        try {
          listener(running, target);
        } catch (e) {
          console.error(`Error running service state change listener (target: ${target}): ${e}`);
        }
      }
    }
  }

  async start(target?: string | string[]) {
    const targets = typeof target === "string" ? [target] : (target ?? this.services.map(s => s.info.name));
    const toStart = targets.filter(n => !this.startedServices.some(s => s.service.info.name === n));
    await (window as any).$ready;
    await Promise.allSettled(
      this.services
        .filter(s => toStart.includes(s.info.name))
        .map(async service => this.startedServices.push({ service, started: await service.start((window as any).$) })),
    );
    this.notifyListeners(true, targets);
  }

  async stop(target?: string | string[]) {
    const targets = typeof target === "string" ? [target] : (target ?? this.services.map(s => s.info.name));
    const toStop = targets.filter(n => this.startedServices.some(s => s.service.info.name === n));
    await (window as any).$ready;
    await Promise.allSettled(
      this.startedServices
        .filter(s => toStop.includes(s.service.info.name))
        .map(async entry => {
          await entry.started.stop();
          this.startedServices.splice(this.startedServices.indexOf(entry), 1);
        }),
    );
    this.notifyListeners(false, targets);
  }

  async load(service: Service, start = true) {
    if (this.services.some(s => s.info.name === service.info.name)) throw "Service with that name is already loaded!";
    this.services.push(service);
    if (start) await this.start(service.info.name);
  }

  async unload(name: string) {
    const target = this.services.find(s => s.info.name === name);
    if (!target) throw "Service not found";
    if (this.startedServices.some(s => s.service === target)) await this.stop(name);
    this.services.splice(this.services.indexOf(target), 1);
  }

  get<T extends object>(name: string): T | null {
    return this.startedServices.find(s => s.service.info.name === name)?.started.exposed as T | null ?? null;
  }

  isRunning(name: string): boolean {
    return this.startedServices.some(s => s.service.info.name === name);
  }

  useRunning(name: string): boolean {
    const [running, setRunning] = useState(() => this.isRunning(name));

    useEffect(() => {
      const listener = (running: boolean) => {
        setRunning(running);
      };
      this.onRunningStateChanged([name], listener);
      return () => this.removeRunningStateChangeListener(listener);
    }, []);

    return running;
  }

  onRunningStateChanged(targets: string[] | undefined, listener: (running: boolean, name: string) => void) {
    this.runChangeListeners.push([targets, listener]);
  }

  removeRunningStateChangeListener(listener: (running: boolean, name: string) => void) {
    this.runChangeListeners.splice(this.runChangeListeners.findIndex(e => e[1] === listener), 1);
  }

  list(): ServiceInfo[] {
    return this.services.map(s => s.info);
  }
}

export const sv = ServiceManager.sv;

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

  if (data[name + ".js"]) promises.push(loadAppFromScript(name, new TextDecoder().decode(data[name + ".js"])));
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
  unloadApp(name);
}

async function loadPackages() {
  if (!(await fs.isDir("/packages"))) return;
  const names = (await fs.ls("/packages")).map(filename => filename.replace(".zip", ""));
  await Promise.allSettled(names.map(name => loadPackage(name)));
  fs.watchDir(
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

loadPackages();

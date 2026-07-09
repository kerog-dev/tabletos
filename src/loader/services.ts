import { create } from "zustand";
import * as fs from "../lib/fs.ts";
import type { Sdk } from "../sdk.ts";

export interface ServiceInfo {
  name: string;
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

const coreServiceModules = Object.entries(import.meta.glob("../core/*/service.ts"));

const devPackageServiceModules = import.meta.env.DEV
  ? Object.entries(
    Object.assign(import.meta.glob("../packages/*/service.ts"), import.meta.glob("../private-packages/*/service.ts")),
  )
  : [];

class ServiceManager {
  static readonly sv = new ServiceManager();

  private services: Service[] = [];
  private startedServices: { started: StartedService; service: Service }[] = [];
  private runningStore = create<{ running: Record<string, object | undefined> }>(() => ({ running: {} }));

  private constructor() {
    this.init().catch(reason => console.error(`Failed to start services: ${reason}`));
  }

  async init() {
    await this.loadServices();
    const infos = this.list();
    const autostarts = await this.autostarts(infos);
    await sv.start(infos.filter(s => autostarts[s.name]).map(s => s.name));
    console.log("Started services successfully!");
  }

  private async autostarts(services: ServiceInfo[]): Promise<Record<string, boolean>> {
    let json: Record<string, boolean>;
    try {
      json = JSON.parse(await fs.readTextFile("/services.json"));
    } catch {
      json = {};
      await fs.writeFile("/services.json", "{}");
    }
    return Object.fromEntries(services.map(s => [s.name, json[s.name] ?? s.autostart]));
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

  private syncRunningStore() {
    this.runningStore.setState({
      running: Object.fromEntries(this.startedServices.map(s => [s.service.info.name, s.started.exposed])),
    });
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
    this.syncRunningStore();
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
    this.syncRunningStore();
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

  use<T extends object>(name: string): T | null {
    return this.runningStore(s => (s.running[name] as T | undefined) ?? null);
  }

  isRunning(name: string): boolean {
    return this.startedServices.some(s => s.service.info.name === name);
  }

  useRunning(name: string): boolean {
    return this.runningStore(s => name in s.running);
  }

  useRunningServices(): string[] {
    return this.runningStore(s => Object.keys(s.running));
  }

  list(): ServiceInfo[] {
    return this.services.map(s => s.info);
  }
}

export const sv = ServiceManager.sv;

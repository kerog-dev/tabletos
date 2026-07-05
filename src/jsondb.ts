import { useEffect, useState } from "react";
import * as fs from "./lib/fs.ts";

interface Database<T extends object = any> {
  object: T;
  get(path: string): any;
  set(path: string, value: any): void;
  use<T extends any = any>(path: string): T;
}

function debounce<F extends (...args: any[]) => void>(fn: F, ms: number): F {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as F;
}

function getPath(obj: any, path: string): any {
  return path.split(".").reduce((cur, key) => (cur == null ? undefined : cur[key]), obj);
}

function setPath(obj: any, path: string, value: any): void {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (typeof current[key] !== "object" || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

function pathsOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  const as = a === "" ? [] : a.split(".");
  const bs = b === "" ? [] : b.split(".");
  const len = Math.min(as.length, bs.length);
  for (let i = 0; i < len; i++) {
    if (as[i] !== bs[i]) return false;
  }
  return true;
}

function cloneValue(value: any): any {
  if (typeof value !== "object" || value === null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

const proxyCache = new WeakMap<object, any>();

function makeReactive<T extends object>(
  target: T,
  path: string,
  notifyChange: (path: string) => void,
): T {
  if (typeof target !== "object" || target === null) return target;

  const cached = proxyCache.get(target);
  if (cached) return cached;

  const proxy = new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);
      if (typeof value === "object" && value !== null) {
        const childPath = path === "" ? String(prop) : `${path}.${String(prop)}`;
        return makeReactive(value, childPath, notifyChange);
      }
      return value;
    },
    set(obj, prop, value, receiver) {
      const result = Reflect.set(obj, prop, value, receiver);
      const changedPath = path === "" ? String(prop) : `${path}.${String(prop)}`;
      notifyChange(changedPath);
      return result;
    },
    deleteProperty(obj, prop) {
      const result = Reflect.deleteProperty(obj, prop);
      const changedPath = path === "" ? String(prop) : `${path}.${String(prop)}`;
      notifyChange(changedPath);
      return result;
    },
  });

  proxyCache.set(target, proxy);
  return proxy;
}

export async function createDatabase<T extends object = Record<string, any>>(
  path: string,
  debounceMs = 200,
): Promise<Database<T>> {
  let raw: T;
  try {
    const content = await fs.readTextFile(path);
    raw = content ? JSON.parse(content) : ({} as T);
  } catch {
    raw = {} as T;
  }

  const save = () => {
    fs.writeFile(path, JSON.stringify(raw, null, 2)).catch((err) => {
      console.error(`Failed to save database at "${path}":`, err);
    });
  };
  const debouncedSave = debounce(save, debounceMs);

  const listeners = new Map<string, Set<() => void>>();

  function subscribe(subscribedPath: string, callback: () => void): () => void {
    let set = listeners.get(subscribedPath);
    if (!set) {
      set = new Set();
      listeners.set(subscribedPath, set);
    }
    set.add(callback);
    return () => {
      set!.delete(callback);
      if (set!.size === 0) listeners.delete(subscribedPath);
    };
  }

  function notifyChange(changedPath: string): void {
    debouncedSave();
    for (const [subscribedPath, callbacks] of listeners) {
      if (pathsOverlap(changedPath, subscribedPath)) {
        callbacks.forEach((cb) => cb());
      }
    }
  }

  const proxy = makeReactive(raw, "", notifyChange);

  function use<T extends any = any>(keyPath: string): T {
    const [value, setValue] = useState(() => cloneValue(getPath(raw, keyPath)));

    useEffect(() => {
      setValue(cloneValue(getPath(raw, keyPath)));
      const unsubscribe = subscribe(keyPath, () => {
        setValue(cloneValue(getPath(raw, keyPath)));
      });
      return unsubscribe;
    }, [keyPath]);

    return value;
  }

  return {
    object: proxy,
    get(keyPath: string) {
      return getPath(raw, keyPath);
    },
    set(keyPath: string, value: any) {
      setPath(raw, keyPath, value);
      notifyChange(keyPath);
    },
    use,
  };
}

import { useState } from "react";

function makeProxy(target: any, flush: () => void): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  return new Proxy(target, {
    set(t, key: string, value) {
      t[key] = value;
      flush();
      return true;
    },
    get(t, key: string) {
      if (typeof t[key] === "object" && t[key] !== null) {
        return makeProxy(t[key], flush);
      }
      return t[key];
    },
    deleteProperty(t, key: string) {
      delete t[key];
      flush();
      return true;
    },
    has(t, key: string) {
      return key in t;
    },
    ownKeys(t) {
      return Reflect.ownKeys(t);
    },
    getOwnPropertyDescriptor(t, key: string) {
      return Object.getOwnPropertyDescriptor(t, key);
    },
  });
}

const root = JSON.parse(localStorage.getItem("tabletos") ?? "{}");
const flush = () => localStorage.setItem("tabletos", JSON.stringify(root));
const storage = makeProxy(root, flush);

export default storage;

export function exportJSON() {
  const data = JSON.stringify(root);
  return data;
}

export function importJSON(data: string) {
  const parsed = JSON.parse(data);
  Object.assign(root, parsed);
  flush();
}

export function useStorage<T>(
  path: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const keys = path.split(".");

  function get() {
    let cur = storage;
    for (const key of keys) cur = cur?.[key];
    return cur ?? defaultValue;
  }

  function set(newValue: T) {
    let cur = storage;
    for (const key of keys.slice(0, -1)) {
      cur[key] ??= {};
      cur = cur[key];
    }
    cur[keys.at(-1)!] = newValue;
  }

  const [value, setValue] = useState<T>(get);

  return [
    value,
    (newValue: T) => {
      set(newValue);
      setValue(newValue);
    },
  ];
}

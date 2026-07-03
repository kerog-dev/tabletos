import { type Promisify, randomId } from "../utils.ts";
import * as contacts from "./contacts.ts";
import deviceId from "./deviceid.ts";
import * as ws from "./ws.ts";

const name = "tabletos-" + deviceId;

function encodeFnPath(targetClient: string, ref: string, path: string): string {
  return `${targetClient}::${ref}::${path}`;
}

function decodeFnPath(fnPath: string): { targetClient: string; ref: string; path: string } {
  const [targetClient, ref, ...rest] = fnPath.split("::");
  return { targetClient, ref, path: rest.join("::") };
}

function call<T>(fnPath: string, args: any[]): Promise<T> {
  const { targetClient, ref, path } = decodeFnPath(fnPath);
  const mid = randomId(16);

  return new Promise((res, rej) => {
    const onResponse = (data: any) => {
      if (data.mid !== mid) return;
      ws.offMessage("rpc-response", onResponse);
      if (data.err) rej(`Remote function errored: ${data.err}`);
      else res(data.result);
    };
    ws.onMessage("rpc-response", onResponse);
    ws.send("rpc-call", targetClient, { ref, target: path, payload: args, mid });
  });
}

function proxyObject<T>(targetClient: string | contacts.Contact, ref: string): Promisify<T> {
  const targetId = typeof targetClient === "string" ? targetClient : targetClient.id;

  function makeNestedProxy(path: string[]): any {
    const fn = (...args: any[]) => call(encodeFnPath(targetId, ref, path.join(".")), args);
    return new Proxy(fn, {
      get(_t, p) {
        if (p === "then" || typeof p !== "string") return undefined;
        return makeNestedProxy([...path, p]);
      },
    });
  }

  return new Proxy({}, {
    get(_t, p) {
      if (p === "then" || typeof p !== "string") return undefined;
      return makeNestedProxy([p]);
    },
  }) as any;
}

const exposedObjects: Partial<Record<string, Record<string, any>>> = {};

function exposeObject(object: Record<string, any>, ref: string) {
  exposedObjects[ref] = object;
}

function unexposeObject(ref: string) {
  delete exposedObjects[ref];
}

ws.onMessage("rpc-call", async (data: any, from: string) => {
  const { ref, target, payload, mid } = data;
  const targetObject = exposedObjects[ref];
  if (!targetObject) return;

  const parts = target.split(".");
  let current: any = targetObject;
  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]];
    if (current == null) return;
  }
  const fn = current[parts[parts.length - 1]];
  if (typeof fn !== "function") return;

  let result: any, err: any;
  try {
    result = await fn.call(current, ...payload);
  } catch (e) {
    err = e instanceof Error ? { message: e.message, stack: e.stack } : e;
  }
  ws.send("rpc-response", from, { mid, result, err });
});

const conn = { name, call, proxyObject, exposeObject, unexposeObject };
export default conn;

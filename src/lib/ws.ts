import { createListenerSet } from "../utils.ts";
import deviceId from "./deviceid.ts";
import { getPublicKey } from "./keys.ts";
import { getServerAddr } from "./server.ts";

let ws: WebSocket | null = null;
let retries = 0;

const queue: string[] = [];
const pks: Record<string, string> = {};
const pkAddListener = createListenerSet<[]>();

async function connect() {
  const addr = await getServerAddr();
  if (!addr) return null;
  const newWs = new WebSocket(`${addr.replace("http:", "ws:")}/ws`);

  newWs.addEventListener("open", () => {
    retries = 0;
    newWs.send(JSON.stringify({
      type: "connect",
      name: "tabletos-" + deviceId,
      public_key: getPublicKey(),
    }));
    while (queue.length) newWs.send(queue.shift()!);
  });

  newWs.addEventListener("close", async () => {
    retries++;
    setTimeout(connect, retries > 5 ? 30_000 : 500);
    newWs.close();
  });

  newWs.addEventListener("message", e => {
    const data = JSON.parse(e.data);
    switch (data.type) {
      case "message":
        if (typeof data.subtype !== "string") break;
        listeners[data.subtype]?.forEach(listener => {
          try {
            listener(data.data, data.from);
          } catch (e) {
            console.error(`[WS] error in websocket listener for type ${data.subtype}:`, e);
          }
        });
        break;

      case "pk":
        pks[data.name] = data.public_key;
        pkAddListener.emit();
        break;

      default:
        console.warn(`[WS] unknown transport message type: ${data.type}`);
        break;
    }
  });

  ws = newWs;
}

connect();

export function send(type: string, to: string | string[] | "*all*", data: any) {
  const encoded = JSON.stringify({ type: "message", subtype: type, to, data });
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(encoded);
  else queue.push(encoded);
}

export type MessageListener = (data: any, from: string) => void;

const listeners: Partial<Record<string, MessageListener[]>> = {};

export function onMessage(type: string, listener: MessageListener) {
  listeners[type] ??= [];
  listeners[type].push(listener);
}

export function offMessage(type: string, listener: MessageListener) {
  listeners[type] ??= [];
  const i = listeners[type].indexOf(listener);
  if (i === -1) return;
  listeners[type].splice(i, 1);
}

export function getRemotePublicKey(target: string): Promise<string> {
  return new Promise((res, rej) => {
    if (target in pks) return res(pks[target]);
    let done = false;
    const listener = () => {
      if (target in pks) {
        done = true;
        pkAddListener.remove(listener);
        res(pks[target]);
      }
    };
    pkAddListener.add(listener);
    setTimeout(() => {
      if (done) return;
      pkAddListener.remove(listener);
      rej(`Timed out getting remote public key for ${target}.`);
    }, 10_000);
    ws?.send(JSON.stringify({
      type: "get_pk",
      name: target,
    }));
  });
}

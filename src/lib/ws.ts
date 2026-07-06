import { toast, Urgency } from "../toast.tsx";
import deviceId from "./deviceid.ts";
import { getServerAddr } from "./server.ts";

let ws: WebSocket | null = null;
let retries = 0;
let gaveUp = false;

const queue: string[] = [];

async function connect() {
  const addr = await getServerAddr();
  if (!addr) return null;
  const newWs = new WebSocket(`${addr.replace("http:", "ws:")}/ws`);

  newWs.addEventListener("open", () => {
    retries = 0;
    newWs.send(JSON.stringify({
      type: "set_name",
      name: "tabletos-" + deviceId,
    }));
    while (queue.length) newWs.send(queue.shift()!);
  });

  newWs.addEventListener("error", async () => {
    retries++;
    if (retries > 5) {
      toast({ title: "WebSocket Error", desc: "Giving up after 5 reconnects.", urgency: Urgency.Error });
      gaveUp = true;
      queue.splice(0, queue.length);
      return;
    }
    setTimeout(() => {
      connect();
    }, 500);
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

      default:
        console.warn(`[WS] unknown transport message type: ${data.type}`);
        break;
    }
  });

  ws = newWs;
}

connect();

export function send(type: string, to: string | string[] | "*all*", data: any) {
  if (gaveUp) return;
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

import { getServerAddr } from "../server.ts";
import * as contacts from "./contacts.ts";
import deviceId from "./deviceid.ts";

export class RpcConnection {
  private reconnects = -1;
  private ws!: WebSocket;
  private exposedObjects: Partial<Record<string, Record<string, any>>> = {};

  constructor(private readonly address: string, readonly name: string) {
    this.connect();
  }

  private connect() {
    this.reconnects++;
    if (this.reconnects >= 5) {
      throw "Gave up after 5 reconnects";
    }
    const ws = new WebSocket(this.address);
    ws.addEventListener("open", () => {
      this.reconnects = 0;
    });
    ws.addEventListener("error", () => {
      setTimeout(() => this.connect(), 3_000);
      this.ws.close();
    });
    ws.addEventListener("message", (e) => {
      const data = JSON.parse(e.data.toString());
      if (data.type !== "rpc-call" || data.targetClient !== this.name) return;
      delete data.type;
      delete data.targetClient;
      this.onWsMessage(data);
    });
    this.ws = ws;
  }

  private ready(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    else if (this.ws.readyState === WebSocket.CONNECTING) {
      return new Promise((res, rej) => {
        this.ws.addEventListener("open", () => res());
        this.ws.addEventListener("error", () => rej());
      });
    } else return Promise.reject();
  }

  private sendCall(
    to: string,
    { ref, target, payload, mid }: { ref: string; target: string; payload: any[]; mid: string },
  ) {
    this.ws.send(JSON.stringify({
      type: "rpc-call",
      ref,
      targetClient: to,
      target,
      payload,
      mid,
    }));
  }

  private sendResponse({ mid, result, err }: { mid: string; result: any; err: any }) {
    this.ws.send(JSON.stringify({ type: "rpc-response", mid, result, err }));
  }

  private onceListen(checker: (data: Record<string, any>) => boolean, handler: (data: Record<string, any>) => void) {
    const listener = (e: MessageEvent) => {
      const data = JSON.parse(e.data.toString());
      const isIt = checker(data);
      if (!isIt) return;
      this.ws.removeEventListener("message", listener);
      handler(data);
    };
    this.ws.addEventListener("message", listener);
  }

  async proxyObject<T>(
    targetClient: string | contacts.Contact,
    ref: string,
  ): Promise<
    { [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : T[K] }
  > {
    const targetId = typeof targetClient === "string" ? targetClient : targetClient.id;
    const self = this;
    await this.ready();
    return new Proxy({}, {
      get(_target, p, _receiver) {
        if (p === "then" || typeof p !== "string") return undefined;
        return function(...argArray: any[]) {
          return new Promise((res, rej) => {
            const mid = Math.floor(Math.random() * 0xf0000000).toString(16);
            self.onceListen(data => data.type === "rpc-response" && data.mid === mid, data => {
              if (data.err) rej(`Remote function errored: ${data.err}`);
              else res(data.result);
            });
            self.sendCall(targetId, { ref, target: p, payload: argArray, mid });
          });
        };
      },
    }) as any;
  }

  exposeObject(object: Record<string, any>, ref: string) {
    this.exposedObjects[ref] = object;
  }

  unexposeObject(ref: string) {
    try {
      delete this.exposedObjects[ref];
    } catch {}
  }

  private async onWsMessage(data: Record<string, any>) {
    const targetObjectName: string = data.ref;
    const targetName: string = data.target;
    const targetPayload = data.payload;
    const mid = data.mid;

    const targetObject = this.exposedObjects[targetObjectName];
    if (!targetObject) return;
    const targetFunction = targetObject[targetName];
    if (!targetFunction) return;
    let result: any | undefined;
    let err: any | undefined;
    try {
      result = await targetFunction(...targetPayload);
    } catch (e) {
      err = e instanceof Error ? { message: e.message, stack: e.stack } : e;
    }
    this.sendResponse({ mid, result, err });
  }

  close() {
    this.ws.close();
  }
}

const address = (await getServerAddr())?.replace(":8086", ":8085") ?? "nowhere.invalid";
const conn = new RpcConnection(address, "tabletos-" + deviceId);
export default conn;

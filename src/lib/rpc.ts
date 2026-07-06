import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/ciphers/utils.js";
import { type Promisify, randomId } from "../utils.ts";
import deviceId from "./deviceid.ts";
import { getSharedSecretWith } from "./keys.ts";
import * as ws from "./ws.ts";

type CallMessageObject = { encrypted: false; unencryptedDesc: string } | {
  encrypted: true;
  encryptedDesc: string;
  nonce: string;
};

type CallResponseObject = { encrypted: false; unencryptedResp: string } | {
  encrypted: true;
  encryptedResp: string;
  nonce: string;
};

const name = "tabletos-" + deviceId;

function encodeFnPath(targetClient: string, ref: string, path: string): string {
  return `${targetClient}::${ref}::${path}`;
}

function decodeFnPath(fnPath: string): { targetClient: string; ref: string; path: string } {
  const [targetClient, ref, ...rest] = fnPath.split("::");
  return { targetClient, ref, path: rest.join("::") };
}

async function encryptString(secretBytes: Uint8Array, input: string): Promise<[string, string]> {
  const inputBytes = (new TextEncoder()).encode(input);
  const nonce = randomBytes(24);
  const chacha = xchacha20poly1305(secretBytes, nonce);
  return [bytesToHex(chacha.encrypt(inputBytes)), bytesToHex(nonce)];
}

async function decryptCallResponse(from: string, encrypted: string, nonce: string): Promise<CallResponseObject> {
  const secretBytes = await getSharedSecretWith(from);
  const encryptedBytes = hexToBytes(encrypted);
  const nonceBytes = hexToBytes(nonce);
  const chacha = xchacha20poly1305(secretBytes, nonceBytes);
  return JSON.parse((new TextDecoder()).decode(chacha.decrypt(encryptedBytes)));
}

function call<T>(fnPath: string, args: any[], encrypt = false): Promise<T> {
  const { targetClient, ref, path } = decodeFnPath(fnPath);
  const mid = randomId(16);

  return new Promise(async (res, rej) => {
    const id = setTimeout(() => {
      ws.offMessage("rpc-response", onResponse);
      rej();
    }, 20_000);
    const onResponse = async (msg: { mid: string; encrypted: boolean; resp: string; nonce: string | undefined }) => {
      if (msg.mid !== mid) return;
      ws.offMessage("rpc-response", onResponse);
      clearTimeout(id);
      const data = msg.encrypted ? await decryptCallResponse(targetClient, msg.resp, msg.nonce!) : JSON.parse(msg.resp);
      if (data.err) rej(`Remote function errored: ${data.err}`);
      else res(data.result);
    };
    ws.onMessage("rpc-response", onResponse);
    const callDesc = { ref, target: path, payload: args, mid };
    const callDescStr = JSON.stringify(callDesc);
    let arg: CallMessageObject;
    if (encrypt) {
      const [encrypted, nonce] = await encryptString(await getSharedSecretWith(targetClient), callDescStr);
      arg = {
        encrypted: true,
        encryptedDesc: encrypted,
        nonce,
      };
    } else arg = { encrypted: false, unencryptedDesc: callDescStr };
    ws.send("rpc-call", targetClient, arg);
  });
}

function proxyObject<T>(targetClient: string, ref: string, encrypt = false): Promisify<T> {
  function makeNestedProxy(path: string[]): any {
    const fn = (...args: any[]) => call(encodeFnPath(targetClient, ref, path.join(".")), args, encrypt);
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

type AuthenticatorFunction = (
  path: ReturnType<typeof decodeFnPath>,
  args: any[],
  from: string,
) => boolean | Promise<boolean>;

const exposedObjects: Partial<
  Record<string, { object: object; encryptionRequired: boolean; authenticator: AuthenticatorFunction }>
> = {};

function exposeObject(
  object: Record<string, any>,
  ref: string,
  encryptionRequired = false,
  authenticator: AuthenticatorFunction = () => true,
) {
  exposedObjects[ref] = { object, encryptionRequired, authenticator };
}

function unexposeObject(ref: string) {
  delete exposedObjects[ref];
}

async function unencryptCallData(
  from: string,
  encrypted: string,
  nonce: string,
): Promise<{ ref: string; target: string; payload: any[]; mid: string }> {
  const encryptedBytes = hexToBytes(encrypted);
  const secretBytes = await getSharedSecretWith(from);
  const nonceBytes = hexToBytes(nonce);
  const chacha = xchacha20poly1305(secretBytes, nonceBytes);
  const decryptedBytes = chacha.decrypt(encryptedBytes);
  const decryptedStr = (new TextDecoder()).decode(decryptedBytes);
  return JSON.parse(decryptedStr);
}

ws.onMessage("rpc-call", async (data: CallMessageObject, from: string) => {
  const { ref, target, payload, mid } = data.encrypted
    ? await unencryptCallData(from, data.encryptedDesc, data.nonce)
    : JSON.parse(data.unencryptedDesc);
  const targetObj = exposedObjects[ref];
  if (!targetObj) return;

  if (targetObj.encryptionRequired && !data.encrypted) {
    return;
  }

  if (!(await targetObj.authenticator({ path: target, ref, targetClient: name }, payload, from))) {
    return;
  }

  const parts = target.split(".");
  let current: any = targetObj.object;
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

  let resp: string;
  let nonce: string | undefined = undefined;
  if (!data.encrypted) resp = JSON.stringify({ result, err });
  else [resp, nonce] = await encryptString(await getSharedSecretWith(from), JSON.stringify({ result, err }));
  ws.send("rpc-response", from, { mid, encrypted: data.encrypted, resp, nonce });
});

const conn = { name, call, proxyObject, exposeObject, unexposeObject };
export default conn;

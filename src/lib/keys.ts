import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { bytesToHex, hexToBytes } from "@noble/curves/utils.js";
import { createDatabase } from "../jsondb.ts";
import * as ws from "./ws.ts";

interface DB {
  secretKey: string;
  publicKey: string;
  remoteKeyCache: Record<string, string>;
}

const db = await createDatabase<DB>("/keys.json");

db.object.remoteKeyCache ??= {};

if (!db.object.secretKey || !db.object.publicKey) {
  const { secretKey, publicKey } = ed25519.keygen();
  db.object.secretKey = bytesToHex(secretKey);
  db.object.publicKey = bytesToHex(publicKey);
}

const { secretKey, publicKey } = {
  secretKey: hexToBytes(db.object.secretKey),
  publicKey: hexToBytes(db.object.publicKey),
};

function getSharedSecret(targetPublicKey: string) {
  const publicBytes = hexToBytes(targetPublicKey);
  const mySecretX = ed25519.utils.toMontgomerySecret(secretKey);
  const targetPublicX = ed25519.utils.toMontgomery(publicBytes);
  const shared = x25519.getSharedSecret(mySecretX, targetPublicX);
  return shared;
}

function getRemoteKey(target: string): Promise<string> {
  if (db.object.remoteKeyCache[target]) return Promise.resolve(db.object.remoteKeyCache[target]);
  else {
    return new Promise((res, rej) => {
      const listener: ws.MessageListener = (data, from) => {
        if (from !== target) return;
        ws.offMessage("public_key", listener);
        db.object.remoteKeyCache[from] = data;
        res(data);
      };
      ws.onMessage("public_key", listener);
      ws.send("get_public_key", target, null);
      setTimeout(() => {
        ws.offMessage("public_key", listener);
        rej("Target did not respond to public key request");
      }, 10_000);
    });
  }
}

ws.onMessage("get_public_key", (_data, from) => {
  ws.send("public_key", from, bytesToHex(publicKey));
});

export async function getSharedSecretWith(target: string): Promise<Uint8Array> {
  const targetPublicKey = await getRemoteKey(target);
  return getSharedSecret(targetPublicKey);
}

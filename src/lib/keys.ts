import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { bytesToHex, hexToBytes } from "@noble/curves/utils.js";
import { createDatabase } from "../jsondb.ts";
import * as ws from "./ws.ts";

interface DB {
  secretKey: string;
  publicKey: string;
}

const db = await createDatabase<DB>("/keys.json");

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

export async function getSharedSecretWith(target: string): Promise<Uint8Array> {
  const targetPublicKey = await ws.getRemotePublicKey(target);
  return getSharedSecret(targetPublicKey);
}

export function getPublicKey(): string {
  return bytesToHex(publicKey);
}

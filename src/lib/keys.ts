import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { bytesToHex, hexToBytes } from "@noble/curves/utils.js";
import { createDatabase } from "../jsondb.ts";

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
  const ws = await import("./ws.ts");
  const targetPublicKey = await ws.getRemotePublicKey(target);
  if (targetPublicKey === null) throw "Cannot get shared secret: no public key known by server";
  return getSharedSecret(targetPublicKey);
}

export function getPublicKey(): string {
  return bytesToHex(publicKey);
}

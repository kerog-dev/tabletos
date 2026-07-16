import { createDatabase } from "../jsondb.ts";

interface DB {
  serverIp: string | null;
  proxyRequired: boolean;
}

const db = await createDatabase<DB>("/net.json");

db.object.proxyRequired ??= false;
db.object.serverIp ??= null;

export function proxyRequired() {
  return db.object.proxyRequired;
}

const pingPromises: Record<string, Promise<boolean> | undefined> = {};

async function ping(ip: string): Promise<boolean> {
  try {
    const res = await fetch(`http://${ip}:8086/health`, { signal: AbortSignal.timeout(3000) });
    const result = res.ok && (await res.text()).toLowerCase().includes("tabletos");
    if (result) lastPing = Date.now();
    return result;
  } catch {
    return false;
  }
}

function doPing(ip: string): Promise<boolean> {
  if (ip in pingPromises) return pingPromises[ip]!;
  pingPromises[ip] = ping(ip).finally(() => delete pingPromises[ip]);
  return pingPromises[ip]!;
}

const ips: string[] = ["127.0.0.1"];
for (let i = 2; i <= 60; i++) {
  ips.push(`192.168.1.${i}`);
}

let lastPing = 0;

let curDiscoveryPromise: Promise<void> | null = null;

async function discovery() {
  const found: string[] = [];
  await Promise.allSettled(ips.map(ip =>
    doPing(ip).then(result => {
      if (result) found.push(ip);
    })
  ));
  console.log(`discovery: found: ${found.length > 0 ? found.join(", ") : "no servers"}`);
  db.object.serverIp = found[0] ?? null;
}

function doDiscovery() {
  if (curDiscoveryPromise !== null) return curDiscoveryPromise;
  curDiscoveryPromise = discovery().finally(() => curDiscoveryPromise = null);
  return curDiscoveryPromise;
}

async function getIp(): Promise<string | null> {
  const now = Date.now();
  if (!db.object.serverIp) await doDiscovery();
  else if (now - lastPing > 5 * 60 * 1_000) {
    if (!(await doPing(db.object.serverIp ?? ""))) {
      await doDiscovery();
    }
  }
  return db.object.serverIp ?? null;
}

export async function getServerAddr(): Promise<string | null> {
  const ip = await getIp();
  if (ip) return `http://${ip}:8086`;
  else return ip;
}

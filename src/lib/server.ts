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

async function ping(ip: string): Promise<boolean> {
  try {
    const res = await fetch(`http://${ip}:8086/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok && (await res.text()).toLowerCase().includes("tabletos");
  } catch {
    return false;
  }
}

const ips: string[] = ["127.0.0.1"];
for (let i = 2; i <= 60; i++) {
  ips.push(`192.168.1.${i}`);
}

let lastPing = 0;

async function discovery() {
  const found: string[] = [];
  await Promise.allSettled(ips.map(ip =>
    ping(ip).then(result => {
      if (result) found.push(ip);
    })
  ));
  console.log(`discovery: found: ${found.length > 0 ? found.join(", ") : "no servers"}`);
  db.object.serverIp = found[0] ?? null;
  lastPing = found.length > 0 ? Date.now() : 0;
}

async function getIp(): Promise<string | null> {
  const now = Date.now();
  if (!db.object.serverIp) await discovery();
  else if (now - lastPing > 5 * 60 * 1_000) {
    const result = await ping(db.object.serverIp ?? "");
    if (result) {
      lastPing = now;
    } else {
      lastPing = 0;
      await discovery();
      return db.object.serverIp ?? null;
    }
  }
  return db.object.serverIp ?? null;
}

export async function getServerAddr(): Promise<string | null> {
  const ip = await getIp();
  if (ip) return `http://${ip}:8086`;
  else return ip;
}

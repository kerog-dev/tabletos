import storage from "./storage.ts";

const getBaseUrl = (ip: string) => `http://${ip}:8484`;

let currentAddress: string | null = storage.backendIp;

async function ping(ip: string): Promise<boolean> {
  try {
    const res = await fetch(getBaseUrl(ip) + "/health", {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function scan(): Promise<string> {
  const promises = Array(30)
    .fill(null)
    .map((_, i) => {
      const ip = `192.168.1.${i + 1}`;
      return new Promise<string>((res, rej) => {
        ping(ip)
          .then((ok) => (ok ? res(ip) : rej()))
          .catch(rej);
      });
    });
  const result = await Promise.any(promises).catch(() => null);
  return result ?? "192.168.1.255";
}

export async function getServerIp(): Promise<string> {
  if (!currentAddress || !(await ping(currentAddress))) {
    currentAddress = await scan();
    storage.backendIp = currentAddress;
  }
  return currentAddress;
}

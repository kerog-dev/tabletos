import express from "express";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { networkInterfaces } from "os";
import { join } from "path";

// spawn("./build-apps.ts", { shell: true, cwd: join(import.meta.dirname, "../../") });

const appsDir = join(import.meta.dirname, "../../dist/apps/");

const PORT = 8086;
let ip: string | null = null;
const ifaces = networkInterfaces();
for (const ifKey in ifaces) {
  if (ifKey === "lo") continue;
  const iface = ifaces[ifKey];
  if (!iface) continue;
  for (const address of iface) {
    if (address.address.includes(":")) continue;
    ip = address.address;
  }
}

const app = express();

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/health", (req, res) => {
  res.send("hello! tabletos server");
});

app.get("/available-apps", async (req, res) => {
  const apps = (await fs.readdir(appsDir)).filter(x => x.endsWith(".js.gz")).map(x => x.replace(".js.gz", ""));
  res.json(apps);
});

app.use("/apps", express.static(appsDir));

app.listen(PORT, () => {
  console.log(`Listening on https://${ip ?? "0.0.0.0"}:${PORT}`);
});

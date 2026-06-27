import express from "express";
import fs from "node:fs/promises";
import { networkInterfaces } from "os";
import { join } from "path";

const packagesDir = join(import.meta.dirname, "../../dist/packages/");

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

app.get("/available-packages", async (req, res) => {
  const apps = (await fs.readdir(packagesDir)).map(x => x.replace(".zip", ""));
  res.json(apps);
});

app.use("/packages", express.static(packagesDir));

app.listen(PORT, () => {
  console.log(`Listening on https://${ip ?? "0.0.0.0"}:${PORT}`);
});

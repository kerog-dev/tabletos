import express from "express";
import sqlite from "node:sqlite";
import multer from "multer";
import { join } from "node:path";

const db = new sqlite.DatabaseSync("./server.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY,
    name TEXT,
    assetFilename TEXT
  );
  `);

const app = express();

app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
  next();
});

app.use(express.static(`${__dirname}/../public`));

const upload = multer({ dest: "assets/videoUpload" });

app.post("/videoUpload", upload.single("file"), (req, res) => {
  const name = req.body.name;
  const file = req.file;
  db.prepare(
    `
    INSERT INTO videos (name, assetFilename) VALUES (?, ?);
  `,
  ).run(name, file?.path!);
  res.json({ ok: true });
});

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});
app.options("/{*path}", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end();
});

app.get("/health", (req, res) => {
  res.send("ok! uptime: " + process.uptime() + "s");
});

app.get("/videos", (req, res) => {
  const result = db.prepare("SELECT * FROM videos").all() as {
    id: number;
    name: string;
    assetFilename: string;
  }[];
  res.json(result.map((x) => ({ id: x.id, name: x.name })));
});

app.get("/video/:id", (req, res) => {
  const id = Number.parseInt(req.params.id);
  if (!id || Number.isNaN(id)) {
    res.send("bad id!");
    return;
  }
  const row = db.prepare("SELECT * FROM videos WHERE id = ?").get(id) as {
    id: number;
    name: string;
    assetFilename: string;
  };
  res.sendFile(join(__dirname, "..", row.assetFilename));
});

app.listen(8484, () => {
  console.log(
    `Listening on port 8484! This server should be automatically discovered by tabletos clients as long as port :8484 is allowed through the firewall (Incoming TCP).`,
  );
});

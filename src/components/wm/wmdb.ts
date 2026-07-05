import { createDatabase } from "../../jsondb.ts";

interface DB {
  windowTransparency: number;
}

const db = await createDatabase<DB>("/wm.json");

db.object.windowTransparency ??= 0;

export function useWindowTransparency() {
  return db.use<number>("windowTransparency");
}

export function setWindowTransparency(value: number) {
  db.set("windowTransparency", value);
}

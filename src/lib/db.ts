import * as idb from "idb";

const db = await idb.openDB("tabletos", 1, {
  upgrade(db) {
    db.createObjectStore("fs");
  },
});

export { db };

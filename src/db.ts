import * as idb from "idb";

// TODO: rename to tabletos for uniqueness and delete localstorage and move all its uses to indexeddb
const db = await idb.openDB("tabletos", 1, {
  upgrade(db) {
    db.createObjectStore("fs");
  },
});

export { db };

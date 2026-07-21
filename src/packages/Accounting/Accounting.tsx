import { useEffect, useMemo, useRef, useState } from "react";
import { sdk } from "../../getsdk.ts";
import { formatTime, randomId } from "../../utils.ts";
import styles from "./Accounting.module.css";

const CURRENT_PAGE_VERSION = 2;

interface Item {
  id: string;
  type: string;
  expense: boolean;
  note: string | null;
  price: number;
  history: Omit<Item, "history">[];
  timestamp: number;
}

interface Page {
  name: string;
  version: number;
  timestamp: number;
  types: string[];
  items: Item[];
}

interface DB {
  pages: Record<string, Page>;
}

const { jsonDB, getAppDir, fs, useDialog } = sdk();
const appDir = await getAppDir("Accounting");
const db = await jsonDB<DB>(`${appDir}/db.json`);

db.object.pages ??= {};

function PageSelector({ setName }: { setName: (name: string) => void }) {
  const pages = db.use<Record<string, Page>>("pages");
  const dialog = useDialog();

  async function createPage() {
    const name = await dialog?.prompt("Enter a name for your page.");
    if (!name) return;
    if (name.includes(".")) {
      await dialog?.alert("Page name must not include dots");
      return;
    }
    const page: Page = {
      name,
      version: CURRENT_PAGE_VERSION,
      timestamp: Date.now(),
      types: [],
      items: [],
    };
    db.object.pages[page.name] = page;
  }

  return (
    <div className={styles["page-selector"]}>
      <button onClick={createPage}>Create page</button> <br />
      Pages:<br />
      <ul>
        {Object.values(pages).map(p => (
          <li key={p.name}>
            <button onClick={() => setName(p.name)}>{p.name}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ItemDataComponent({ m, i }: { m: Item; i: number }) {
  return (
    <span className={styles["item-data"]}>
      (#{i + 1}, {formatTime(m.timestamp)}):{" "}
      <span style={{ color: m.expense ? "red" : "lime" }}>{m.expense ? "-" : "+"}{m.price}</span>: {m.type}
      {m.note && <>{" "}-- {m.note}</>}
    </span>
  );
}

function ItemComponent({ m, i, page }: { m: Item; i: number; page: Page }) {
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  function deleteItem() {
    db.object.pages[page.name].items.splice(i, 1);
  }

  function onCreate(item: Item) {
    const items = db.object.pages[page.name].items;
    const old = items[i];
    items[i] = item;
    items[i].history.push(old);
    setEditing(false);
  }

  return (
    <div className={styles.item}>
      <ItemDataComponent m={m} i={i} />
      {!editing && (
        <>
          {" "}
          <button onClick={() => setEditing(true)}>Edit</button>
          {" "}
        </>
      )}
      <button onClick={deleteItem}>Delete</button>
      {editing && (
        <>
          <ItemCreateForm
            onCreate={onCreate}
            types={page.types}
            btnName={"Save"}
            initialItem={m}
          />
          <button onClick={() => setEditing(false)}>Cancel</button>
        </>
      )} <button onClick={() => setShowHistory(s => !s)}>{showHistory ? "Hide" : "Show"} history</button>
      {showHistory && (
        <>
          <ul>
            {m.history.map((m, i2) => (
              <li key={JSON.stringify(m) + "--" + i2}>
                <ItemDataComponent m={{ ...m, history: [] }} i={i} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ItemCreateForm(
  { onCreate, types, btnName, initialItem }: {
    onCreate: (item: Item) => void;
    types: string[];
    btnName: string;
    initialItem?: Item;
  },
) {
  const typeSelectRef = useRef<HTMLSelectElement | null>(null);
  const isIncomeRef = useRef<HTMLInputElement | null>(null);
  const noteRef = useRef<HTMLInputElement | null>(null);
  const priceRef = useRef<HTMLInputElement | null>(null);

  function addItem() {
    const type = typeSelectRef.current?.value;
    const expense = !isIncomeRef.current?.checked;
    const note = noteRef.current?.value;
    const price = Number.parseFloat(priceRef.current?.value ?? "");
    if (!type || Number.isNaN(price)) return;
    if (typeSelectRef.current) typeSelectRef.current.value = "";
    if (isIncomeRef.current) isIncomeRef.current.checked = false;
    if (noteRef.current) noteRef.current.value = "";
    if (priceRef.current) priceRef.current.value = "";
    const item: Item = {
      id: initialItem?.id ?? randomId(64),
      type,
      timestamp: Date.now(),
      expense,
      note: note || null,
      price,
      history: initialItem?.history ?? [],
    };
    onCreate(item);
  }

  return (
    <div className={styles["item-form"]}>
      <select ref={typeSelectRef} defaultValue={initialItem?.type ?? ""}>
        <option value="">Select an item type.</option>
        {types.map((t, i) => <option key={`${i}-${t}`} value={t}>{t}</option>)}
      </select>
      <br />
      <label htmlFor="accounting-isincome-checkbox">Is income?</label>
      <input
        type="checkbox"
        id="accounting-isincome-checkbox"
        ref={isIncomeRef}
        defaultChecked={initialItem ? !initialItem.expense : false}
      />
      <br />
      <input type="text" placeholder="Optional note" ref={noteRef} defaultValue={initialItem?.note ?? ""} />
      <br />
      <input type="number" placeholder="Value/price" ref={priceRef} defaultValue={initialItem?.price} />
      <br />
      <button onClick={addItem}>{btnName}</button>
    </div>
  );
}

function PageStatistics({ page }: { page: Page }) {
  const total = useMemo(
    () => page?.items.map(item => item.expense ? -item.price : item.price).reduce((acc, cur) => acc + cur, 0),
    [page?.items],
  );

  return (
    <p className={styles["page-statistics"]}>
      Total:{" "}
      <span style={{ color: total === 0 ? "gray" : total > 0 ? "lime" : "red" }}>
        {total > 0 && "+"}
        {total}
      </span>
      <br />
    </p>
  );
}

function PageComponent({ name, back }: { name: string; back: () => void }) {
  const page = db.use<Page | undefined>(`pages.${name}`);
  const [ignoreOld, setIgnoreOld] = useState(false);
  const typesDialogRef = useRef<HTMLDialogElement | null>(null);
  const itemsRef = useRef<HTMLUListElement | null>(null);
  const dialog = useDialog();

  if (!page) {
    return (
      <div>
        Page not found. <button onClick={back}>Back</button>
      </div>
    );
  }

  async function backupAndContinue() {
    await fs.writeFile(`${appDir}/db.backup_${Date.now()}.json`, await fs.readTextFile(`${appDir}/db.json`));
    setIgnoreOld(true);
  }

  if (page.version < CURRENT_PAGE_VERSION && !ignoreOld) {
    return (
      <div>
        This page's version is older than the app.<br />
        <button onClick={back}>Back (recommended)</button>
        <br />
        <button onClick={backupAndContinue}>Backup and continue</button>
        <br />
        <button onClick={() => setIgnoreOld(true)}>Continue</button>
      </div>
    );
  }

  if (page.version > CURRENT_PAGE_VERSION) {
    return (
      <div>
        This page's version is newer than the app. Please upgrade your app from the app manager.{" "}
        <button onClick={back}>Back</button>
      </div>
    );
  }

  async function createType() {
    const name = await dialog?.prompt("Enter type name.");
    if (!name) return;
    if (db.object.pages[page!.name].types.includes(name)) return;
    db.object.pages[page!.name].types.push(name);
  }

  async function editType(i: number) {
    const newName = await dialog?.prompt("Enter new name.", undefined, db.object.pages[page!.name].types[i]);
    if (!newName) return;
    db.object.pages[page!.name].types[i] = newName;
  }

  function deleteType(i: number) {
    db.object.pages[page!.name].types.splice(i, 1);
  }

  async function deletePage() {
    if (await dialog?.confirm("Are you sure you want to delete this page?")) {
      delete db.object.pages[page!.name];
    }
  }

  useEffect(() => {
    setTimeout(() => {
      if (!itemsRef.current) return;
      itemsRef.current.scrollTop = itemsRef.current.scrollHeight;
    }, 50);
  }, [page.items]);

  return (
    <div className={styles.page}>
      <div className={styles.info}>
        <p className={styles.title}>{page.name}</p>
        <button onClick={back}>Back</button>
        <div className={styles["items-container"]}>
          Items:
          <ul className={styles.items} ref={itemsRef}>
            {page.items.map((m, i) => (
              <li key={m.id}>
                <ItemComponent m={m} i={i} page={page} />
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={styles.controls}>
        <ItemCreateForm
          onCreate={item => db.object.pages[page.name].items.push(item)}
          types={page.types}
          btnName={"Add"}
        />
        <PageStatistics page={page} />
        <div className={styles["page-footer"]}>
          <button onClick={() => typesDialogRef.current?.showModal()}>Open types</button>
          <br />
          <button onClick={deletePage}>Delete page</button>
          <p>
            Created at {formatTime(page.timestamp)}
          </p>
        </div>
      </div>
      <dialog ref={typesDialogRef}>
        <button style={{ float: "right" }} onClick={() => typesDialogRef.current?.close()}>X</button>
        <button onClick={createType}>Create type</button>
        <br />
        Types:
        <ul>
          {page.types.map((t, i) => (
            <li key={`${i}-${t}`}>
              {t} ({page.items.filter(item => item.type === t).length}){" "}
              <button onClick={() => editType(i)}>Edit</button>
              <button onClick={() => deleteType(i)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </dialog>
    </div>
  );
}

export default function Accounting() {
  const [name, setName] = useState<string | null>(null);

  if (!name) return <PageSelector setName={setName} />;
  return <PageComponent name={name} back={() => setName(null)} />;
}

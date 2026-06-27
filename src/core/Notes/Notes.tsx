import { useRef, useState } from "react";
import type { Sdk } from "../../sdk.ts";
import "./Notes.css";

const { fs, getAppDir }: Sdk = (window as any).$;

const appDir = await getAppDir("Notes");
const notesDir = `${appDir}/notes`;

if (!(await fs.isDir(notesDir))) await fs.mkdir(notesDir);

function NoteEditor({ note, back }: { note: string; back: () => void }) {
  const notePath = `${notesDir}/${note}.txt`;
  const text = fs.useTextFile(notePath);

  async function write(updated: string) {
    fs.writeFile(notePath, updated);
  }

  return (
    <div className="note-editor">
      <button onClick={() => back()}>Back</button>
      <textarea onChange={(e) => write(e.target.value)} value={text ?? "Note not found"}></textarea>
    </div>
  );
}

function NoteList({ setOpenNote }: { setOpenNote: (name: string) => void }) {
  const newNoteNameRef = useRef<HTMLInputElement | null>(null);
  const notes = fs.useDirListing(notesDir)?.map(x => x.replace(".txt", ""));

  async function createNote() {
    if (!newNoteNameRef.current) return;
    const newName = newNoteNameRef.current.value;
    await fs.writeFile(`${notesDir}/${newName}.txt`, "");
  }

  return (
    <div className="note-list">
      Create note: <input type="text" ref={newNoteNameRef} placeholder="name" />{" "}
      <button onClick={createNote}>Create</button>
      <br />
      Notes:
      <ul>
        {notes?.map(note => (
          <li key={note}>
            <button onClick={() => setOpenNote(note)}>{note}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Notes({ args }: { args: [] | [string] }) {
  const [openNote, setOpenNote] = useState<string | null>(args[0] ?? null);

  return (
    openNote
      ? <NoteEditor note={openNote} back={() => setOpenNote(null)} />
      : <NoteList setOpenNote={setOpenNote} />
  );
}

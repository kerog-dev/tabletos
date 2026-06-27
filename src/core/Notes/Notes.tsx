import { useRef, useState } from "react";
import type { Sdk } from "../../sdk.ts";

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
    <div>
      <button onClick={() => back()}>{"<--"}</button>
      <br />
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
    <div>
      Notes:
      <ul>
        {notes?.map(note => (
          <li key={note}>
            <button onClick={() => setOpenNote(note)}>{note}</button>
          </li>
        ))}
      </ul>
      Create note: <input type="text" ref={newNoteNameRef} placeholder="name" />{" "}
      <button onClick={createNote}>Create</button>
    </div>
  );
}

export default function Notes() {
  const [openNote, setOpenNote] = useState<string | null>(null);

  return (
    <div>
      {openNote
        ? <NoteEditor note={openNote} back={() => setOpenNote(null)} />
        : <NoteList setOpenNote={setOpenNote} />}
    </div>
  );
}

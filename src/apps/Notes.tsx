import { useEffect, useRef, useState } from "react";
import storage, { useStorage } from "../storage.ts";

function NoteEditor({ note }: { note: string }) {
  const [content, setContent] = useState<string>(storage.notes.contents[note]);

  useEffect(() => {
    const id = setTimeout(() => {
      storage.notes.contents[note] = content;
    }, 500);
    return () => clearTimeout(id);
  }, [content]);

  return (
    <div>
      <textarea onChange={(e) => setContent(e.target.value)} value={content}></textarea>
    </div>
  );
}

function NoteList({ setOpenNote }: { setOpenNote: (name: string) => void }) {
  const newNoteNameRef = useRef<HTMLInputElement | null>(null);
  const [notes, setNotes] = useStorage<string[]>("notes.list", []);

  function createNote() {
    if (!newNoteNameRef.current) return;
    const newName = newNoteNameRef.current.value;
    setNotes([...notes, newName]);
    storage.notes ??= {};
    storage.notes.contents ??= {};
    storage.notes.contents[newName] = "";
  }

  return (
    <div>
      Notes:
      <ul>
        {notes.map(note => (
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

  return <div>{openNote ? <NoteEditor note={openNote} /> : <NoteList setOpenNote={setOpenNote} />}</div>;
}

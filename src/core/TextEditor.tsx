import { useEffect, useState } from "react";
import { FilePicker } from "../components/FilePicker.tsx";
import { readTextFile, writeFile } from "../fs.ts";

export default function TextEditor({ args }: { args: [] | [string] }) {
  const [path, setPath] = useState<string | null>(args[0] ?? null);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setText(null);
      return;
    }
    let canceled = false;

    readTextFile(path).then(content => {
      if (!canceled) setText(content);
    });

    return () => {
      canceled = true;
    };
  }, [path]);

  useEffect(() => {
    if (!path || text === null) return;
    const id = setTimeout(() => {
      console.log("write!");
      writeFile(path, text);
    }, 500);
    return () => clearInterval(id);
  }, [text]);

  if (path === null) return <FilePicker setPath={setPath} />;
  if (text === null) return <p>Loading...</p>;

  return (
    <div>
      editing {path}
      <button onClick={() => setPath(null)}>Back</button>
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
    </div>
  );
}

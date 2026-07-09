import { useEffect, useMemo, useState } from "react";
import { FilePicker } from "../../components/FilePicker.tsx";
import "./TextEditor.css";
import { sdk } from "../../getsdk.ts";
import { debounce } from "../../utils.ts";

const { fs } = sdk();

export default function TextEditor({ args }: { args: [] | [string] }) {
  const [path, setPath] = useState<string | null>(args[0] ?? null);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setText(null);
      return;
    }
    let canceled = false;

    fs.readTextFile(path).then(content => {
      if (!canceled) setText(content);
    });

    return () => {
      canceled = true;
    };
  }, [path]);

  const debouncedWrite = useMemo(() => debounce((p: string, t: string) => fs.writeFile(p, t), 500), []);

  useEffect(() => {
    if (!path || text === null) return;
    debouncedWrite(path, text);
  }, [text]);

  if (path === null) return <FilePicker setPath={setPath} />;
  if (text === null) return <p>Loading...</p>;

  return (
    <div className="text-editor">
      <div className="editor-toolbar">
        <div>
          {path}
        </div>
        <div>
          <button onClick={() => setPath(null)}>Back</button>
        </div>
      </div>
      <textarea className="editor-textarea" value={text} onChange={(e) => setText(e.target.value)} />
    </div>
  );
}

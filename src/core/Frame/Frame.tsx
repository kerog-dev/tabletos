import { useState } from "react";
import { sdk } from "../../getsdk.ts";

interface DB {
  recent: string[];
}

const { jsonDB, getAppDir } = sdk();

const appDir = await getAppDir("Frame");
const db = await jsonDB<DB>(`${appDir}/db.json`);

db.object.recent ??= [];

export default function Frame({ args }: { args: [] | [string] }) {
  const [uri, setUri] = useState<string | null>(args[0] ?? null);
  const recent = db.use<string[]>("recent");
  const [value, setValue] = useState("");

  function go() {
    const i = db.object.recent.indexOf(value);
    if (i !== -1) {
      db.object.recent.splice(i, 1);
    }
    db.object.recent.push(value);
    setUri(value);
  }

  if (!uri) {
    return (
      <div>
        note: you should probably only enter sites you trust<br />
        recent:<br />
        <ul>
          {recent.map(entry => <li key={entry} onClick={() => setUri(entry)}>{entry} (click to go)</li>)}
        </ul>
        <br />
        <button onClick={() => db.object.recent = []}>clear recent</button>
        <br />
        enter URL:{" "}
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyUp={(e) => {
            if (e.code === "Enter") go();
          }}
        />
        <button onClick={() => go()}>
          Go
        </button>
      </div>
    );
  }

  return <iframe style={{ width: "99%", height: "99%" }} src={uri} />;
}

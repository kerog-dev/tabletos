import { useState } from "react";
import { useStorage } from "../storage.ts";

export default function Frame() {
  const [uri, setUri] = useState<string | null>(null);
  const [recent, setRecent] = useStorage<string[]>("frame.recent", []);
  const [value, setValue] = useState("");

  if (!uri) {
    return (
      <div>
        note: you should probably only enter sites you trust<br />
        recent:<br />
        <ul>
          {recent.map(entry => <li key={entry} onClick={() => setUri(entry)}>{entry} (click to go)</li>)}
        </ul>
        <br />
        <button onClick={() => setRecent([])}>clear recent</button>
        <br />
        enter URL:{" "}
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyUp={(e: any) => {
            if (e.code === "Enter") {
              setRecent([...recent.filter(x => x !== e.target.value), e.target.value]);
              setUri(e.target.value);
            }
          }}
        />
        <button
          onClick={() => {
            setUri(value);
          }}
        >
          Go
        </button>
      </div>
    );
  }

  return <iframe style={{ width: "99%", height: "99%" }} src={uri} />;
}

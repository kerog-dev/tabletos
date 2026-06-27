import { useState } from "react";
import type { Sdk } from "../../sdk.ts";

const { useStorage }: Sdk = (window as any).$;

export default function Frame({ args }: { args: [] | [string] }) {
  const [uri, setUri] = useState<string | null>(args[0] ?? null);
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
          onKeyUp={(e) => {
            if (e.code === "Enter") {
              const input = e.target as HTMLInputElement;
              setRecent([...recent.filter(x => x !== input.value), input.value]);
              setUri(input.value);
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

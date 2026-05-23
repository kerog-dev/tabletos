import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useState } from "react";
import storage from "../storage.ts";

storage.whiteboards ??= {};

export default function Whiteboard() {
  const [active, setActive] = useState<string | null>(null);

  if (!active)
    return (
      <div>
        <h2>Whiteboards</h2>
        <ul>
          {Object.keys(storage.whiteboards).map((name) => (
            <li key={name}>
              <button onClick={() => setActive(name)}>{name}</button>
              <button
                onClick={() => {
                  delete storage.whiteboards[name];
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <input
          placeholder="New whiteboard name"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const name = (e.target as HTMLInputElement).value.trim();
            if (!name) return;
            storage.whiteboards[name] ??= { elements: [], appState: {} };
            setActive(name);
          }}
        />
      </div>
    );

  return (
    <div style={{ position: "relative", height: "100vh" }}>
      <button
        onClick={() => setActive(null)}
        style={{ position: "absolute", top: 8, left: 8, zIndex: 10 }}
      >
        ← boards
      </button>
      <Excalidraw
        initialData={storage.whiteboards[active]}
        onChange={(elements, appState) => {
          storage.whiteboards[active] = { elements, appState };
        }}
      />
    </div>
  );
}

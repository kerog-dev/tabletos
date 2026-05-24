import { Excalidraw, serializeAsJSON, restore } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useMemo, useRef, useState } from "react";
import storage from "../storage.ts";

storage.whiteboards ??= {};

export default function Whiteboard() {
  const [active, setActive] = useState<string | null>(null);
  const initialized = useRef(false);

  const initialData = useMemo(() => {
    if (!active) return { elements: [], appState: {} };
    const saved = storage.whiteboards[active];
    return saved
      ? restore(JSON.parse(saved), null, null)
      : { elements: [], appState: {} };
  }, [active]);

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
            storage.whiteboards[name] ??= null;
            setActive(name);
          }}
        />
      </div>
    );

  return (
    <div
      style={{
        position: "absolute",
        width: "100vw",
        height: "100vh",
        top: 0,
        left: 0,
      }}
    >
      <button
        onClick={() => {
          initialized.current = false;
          setActive(null);
        }}
        style={{ position: "absolute", top: 22, left: 64, zIndex: 10 }}
      >
        ← boards
      </button>
      <Excalidraw
        key={active}
        initialData={initialData}
        onChange={(elements, appState, files) => {
          if (!initialized.current) {
            initialized.current = true;
            return;
          }
          storage.whiteboards[active] = serializeAsJSON(
            elements,
            appState,
            files,
            "local",
          );
        }}
      />
    </div>
  );
}

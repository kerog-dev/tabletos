import { useEffect, useRef, useState } from "react";
import type { Sdk } from "../../sdk.ts";
const { default: Atrament } = await import("atrament" as any); // eslint-disable-line @typescript-eslint/no-explicit-any

const { storage }: Sdk = (window as any).$;

storage.whiteboards ??= {};

type Tool = "draw" | "erase";

export default function Whiteboard() {
  const [active, setActive] = useState<string | null>(null);
  const [, rerender] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const atramentRef = useRef<typeof Atrament | null>(null);
  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#1a1a1a");
  const [weight, setWeight] = useState(4);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const saved = storage.whiteboards[active];
    if (saved) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = saved;
    }

    const at = new Atrament(canvas, { color, weight });
    at.smoothing = 0.85;
    atramentRef.current = at;

    const save = () => {
      storage.whiteboards[active] = canvas.toDataURL("image/webp", 0.92);
    };
    at.addEventListener("strokeend", save);
    return () => {
      at.removeEventListener("strokeend", save);
      at.destroy();
      atramentRef.current = null;
    };
  }, [active, color, weight]);

  useEffect(() => {
    const at = atramentRef.current;
    if (!at) return;
    at.mode = tool === "erase" ? "erase" : "draw";
  }, [tool]);

  useEffect(() => {
    if (atramentRef.current) atramentRef.current.color = color;
  }, [color]);
  useEffect(() => {
    if (atramentRef.current) atramentRef.current.weight = weight;
  }, [weight]);

  if (!active) {
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
                  rerender((n) => n + 1);
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
  }

  const toolbar: React.CSSProperties = {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#fff",
    padding: "6px 10px",
    borderRadius: 8,
    boxShadow: "0 2px 8px rgba(0,0,0,.15)",
  };

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={toolbar}>
        <button onClick={() => setActive(null)}>← boards</button>
        {(["draw", "erase"] as Tool[]).map((t) => (
          <button
            key={t}
            onClick={() => setTool(t)}
            style={{ outline: tool === t ? "2px solid #3b82f6" : "none", borderRadius: 4, padding: "2px 6px" }}
          >
            {t === "draw" ? "✏️draw" : "🧹erase"}
          </button>
        ))}
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          style={{ width: 32, height: 32, border: "none", padding: 0, cursor: "pointer" }}
        />
        <input
          type="range"
          min={1}
          max={60}
          value={weight}
          onChange={(e) => setWeight(Number(e.target.value))}
          style={{ width: 80 }}
        />
        <span style={{ fontSize: 12, minWidth: 28 }}>{weight}px</span>
      </div>

      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}

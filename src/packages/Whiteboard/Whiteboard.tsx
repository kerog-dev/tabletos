import { useEffect, useRef, useState } from "react";
import type { Sdk } from "../../sdk.ts";
const { default: Atrament } = await import("atrament" as any);

const { fs, getAppDir }: Sdk = (window as any).$;
const appDir = await getAppDir("Whiteboard");

if (!(await fs.isDir(`${appDir}/whiteboards`))) await fs.mkdir(`${appDir}/whiteboards`);

type Tool = "draw" | "erase";

export default function Whiteboard() {
  const [active, setActive] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const atramentRef = useRef<typeof Atrament | null>(null);
  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#1a1a1a");
  const [weight, setWeight] = useState(4);
  const whiteboards = fs.useDirListing(`${appDir}/whiteboards`);

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

    const whiteboardPath = `${appDir}/whiteboards/${active}`;
    fs.pathExists(whiteboardPath).then(exists =>
      exists
        ? (fs.readTextFile(whiteboardPath).then(saved => {
          const img = new Image();
          img.onload = () => ctx.drawImage(img, 0, 0);
          img.src = saved;
        }))
        : null
    );

    const at = new Atrament(canvas, { color, weight });
    at.smoothing = 0.85;
    atramentRef.current = at;

    const save = async () => {
      await fs.writeFile(whiteboardPath, canvas.toDataURL("image/webp", 0.92));
    };
    at.addEventListener("strokeend", save);
    return () => {
      at.removeEventListener("strokeend", save);
      at.destroy();
      atramentRef.current = null;
    };
  }, [active]);

  useEffect(() => {
    const at = atramentRef.current;
    if (!at) return;
    at.mode = tool;
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
          {whiteboards?.map((name) => (
            <li key={name}>
              <button onClick={() => setActive(name)}>{name}</button>
              <button onClick={() => fs.unlink(`${appDir}/whiteboards/${name}`)}>
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
            fs.writeFile(`${appDir}/whiteboards/${name}`, "").then(() => setActive(name));
          }}
        />
      </div>
    );
  }

  const toolbar: React.CSSProperties = {
    position: "absolute",
    positionAnchor: "--container",
    top: "anchor(top)",
    left: "50%",
    transform: "translate(-50%, 0)",
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
    <div style={{ width: "100%", height: "100%", anchorName: "--container" }}>
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

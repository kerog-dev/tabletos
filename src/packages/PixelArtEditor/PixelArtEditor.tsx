import { useEffect, useRef, useState } from "react";
import "./PixelArtEditor.css";
import { sdk } from "../../getsdk.ts";

type PixelData = {
  r: number;
  g: number;
  b: number;
} | null;

interface Drawing {
  width: number;
  height: number;
  data: PixelData[];
}

enum Tool {
  Pencil,
  Erase,
}

const { useDialog, fs } = sdk();

function parseColor(string: string): PixelData {
  return {
    r: Number.parseInt(string.slice(1, 3), 16),
    g: Number.parseInt(string.slice(3, 5), 16),
    b: Number.parseInt(string.slice(5, 7), 16),
  };
}

function exportPNG(drawing: Drawing): Promise<Blob> {
  return new Promise((res, rej) => {
    const canvas = document.createElement("canvas");
    canvas.width = drawing.width;
    canvas.height = drawing.height;

    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.createImageData(drawing.width, drawing.height);

    drawing.data.forEach((p, i) => {
      const offset = i * 4;
      if (p) {
        imageData.data[offset] = p.r;
        imageData.data[offset + 1] = p.g;
        imageData.data[offset + 2] = p.b;
        imageData.data[offset + 3] = 255;
      }
    });

    ctx.putImageData(imageData, 0, 0);
    canvas.toBlob(
      blob => (blob ? res(blob) : rej(new Error("toBlob returned null"))),
      "image/png",
    );
  });
}

function Toolbar(
  { tool, setTool, color, setColor, drawing }: {
    tool: Tool;
    setTool: (tool: Tool) => void;
    color: string;
    setColor: (color: string) => void;
    drawing: Drawing;
  },
) {
  const dialog = useDialog();

  async function exportDrawing() {
    const path = await dialog?.prompt(
      "Please enter the path you want to save the PNG to",
      "Export drawing",
      `/pixelart-${Date.now()}.png`,
    );
    if (!path) return;
    const blob = await exportPNG(drawing);
    await fs.writeFile(path, blob);
  }

  return (
    <div className="toolbar">
      <input type="color" value={color} onChange={e => setColor(e.target.value)} />
      {[Tool.Pencil, Tool.Erase].map(t => (
        <button key={t} onClick={() => setTool(t)}>{Tool[t]}{tool === t && <span>{" "}(selected)</span>}</button>
      ))}
      <button onClick={exportDrawing}>Export</button>
    </div>
  );
}

export default function PixelArtEditor() {
  const [tool, setTool] = useState(Tool.Pencil);
  const [color, setColor] = useState("#000000");
  const [drawing, setDrawing] = useState<Drawing>(() => ({
    width: 16,
    height: 16,
    data: Array(16 * 16).fill(null),
  }));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let down = false;

    const downListener = () => down = true;
    const upListener = () => down = false;

    const moveListener = (e: MouseEvent) => {
      if (!down) return;

      const dX = Math.floor((e.offsetX / canvasRef.current!.clientWidth) * drawing.width);
      const dY = Math.floor((e.offsetY / canvasRef.current!.clientHeight) * drawing.height);
      const dI = dY * drawing.width + dX;

      const setPixel = (pixel: PixelData) =>
        setDrawing(drawing => ({ ...drawing, data: drawing.data.map((p, i) => dI === i ? pixel : p) }));

      switch (tool) {
        case Tool.Pencil:
          setPixel(parseColor(color));
          break;

        case Tool.Erase:
          setPixel(null);
          break;

        default:
          tool satisfies never;
      }
    };

    canvasRef.current?.addEventListener("mousedown", downListener);
    canvasRef.current?.addEventListener("mouseup", upListener);
    canvasRef.current?.addEventListener("mousemove", moveListener);

    return () => {
      canvasRef.current?.removeEventListener("mousedown", downListener);
      canvasRef.current?.removeEventListener("mouseup", upListener);
      canvasRef.current?.removeEventListener("mousemove", moveListener);
    };
  }, [tool, color]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    drawing.data.forEach((p, i) => {
      const y = Math.floor(i / drawing.width);
      const x = i - (y * drawing.width);

      if (p) ctx.fillStyle = `rgb(${p.r}, ${p.g}, ${p.b})`;
      else ctx.fillStyle = (x + y) % 2 === 0 ? "grey" : "#eee";
      ctx.fillRect(x, y, 1, 1);
    });
  }, [drawing]);

  return (
    <div className="app">
      <Toolbar tool={tool} setTool={setTool} color={color} setColor={setColor} drawing={drawing} />
      <canvas ref={canvasRef} width={drawing.width} height={drawing.height} />
    </div>
  );
}

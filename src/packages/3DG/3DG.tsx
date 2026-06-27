import { useEffect, useRef, useState } from "react";
import MathWorker from "./worker.ts?worker&inline";

const worker = new MathWorker();

function valueToColor(value: number): string {
  const v = Math.floor(value) & 0xFFFFFF;
  const r = (v >> 16) & 0xFF;
  const g = (v >> 8) & 0xFF;
  const b = v & 0xFF;
  return `rgb(${r},${g},${b})`;
}

export default function ThreeDG() {
  const size = 200;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [equation, setEquation] = useState<string>("x * y");

  useEffect(() => {
    const listener = (e: MessageEvent) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      for (const [x, y, value] of e.data) {
        ctx.fillStyle = valueToColor(value);
        ctx.fillRect(x, y, 1, 1);
      }
    };
    worker.addEventListener("message", listener);
    return () => worker.removeEventListener("message", listener);
  }, []);

  useEffect(() => {
    worker.postMessage([size, equation]);
  }, [equation]);

  return (
    <div style={{ width: "100%", height: "100%", containerType: "size" }}>
      <input
        style={{ position: "absolute", bottom: "0", right: "0", margin: "20px", zIndex: "999" }}
        type="text"
        onBlur={e => setEquation(e.target.value)}
      />
      <canvas
        style={{ width: "100cqmin", height: "100cqmin" }}
        ref={canvasRef}
        width={size}
        height={size}
      />
    </div>
  );
}

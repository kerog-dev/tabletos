import { useEffect, useMemo, useRef, useState } from "react";
import MathWorker from "./worker.ts?worker&inline";
import { debounce } from "../../utils.ts";

const worker = new MathWorker();

export default function ThreeDG() {
  const size = 200;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [equation, setEquation] = useState<string>("x * y");

  useEffect(() => {
    let buffer: number[][] = [];
    const listener = (e: MessageEvent) => {
      if (!e.data) buffer = [];
      buffer.push(e.data);
      console.log(`got frame!`);
    };
    const ctx = canvasRef.current?.getContext("2d");
    let canceled = false;
    function animate() {
      if (!canceled) requestAnimationFrame(animate);
      if (!ctx) return;
      const data = buffer.shift();
      if (!data) return;
      const imageData = ctx.createImageData(size, size);
      const buf = imageData.data;

      for (let i = 0; i < data.length; i++) {
        const value = Math.floor(data[i]);
        const p = i * 4;
        buf[p] = (value >> 16) & 0xFF; // R
        buf[p + 1] = (value >> 8) & 0xFF; // G
        buf[p + 2] = value & 0xFF; // B
        buf[p + 3] = 255; // A
      }

      ctx.putImageData(imageData, 0, 0);
    }
    animate();
    worker.addEventListener("message", listener);
    return () => {
      worker.removeEventListener("message", listener);
      canceled = true;
    };
  }, []);

  const debouncedPost = useMemo(() => debounce((eq: string) => worker.postMessage([size, eq]), 500), []);

  useEffect(() => {
    debouncedPost(equation);
  }, [equation]);

  return (
    <div style={{ width: "100%", height: "100%", containerType: "size" }}>
      <input
        style={{ position: "absolute", bottom: "0", right: "0", margin: "20px", zIndex: "999" }}
        type="text"
        onChange={e => setEquation(e.target.value)}
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

import { useRef, useState } from "react";
import type { Sdk } from "../../sdk.ts";
import type { RpcObject } from "../JSServer/JSServer.tsx";

const { conn }: Sdk = (window as any).$;

export default function JSClient() {
  const [results, setResults] = useState<string[]>([]);

  const idInputRef = useRef<HTMLInputElement | null>(null);
  const scriptInputRef = useRef<HTMLTextAreaElement | null>(null);

  async function run() {
    if (!idInputRef.current || !scriptInputRef.current) return;
    const targetId = idInputRef.current.value;
    const script = scriptInputRef.current.value;
    const object = await conn.proxyObject<RpcObject>(targetId, "jsserver");
    const result = await object.run(script);
    setResults(results => [...results, result]);
  }

  return (
    <div>
      <label>Target ID</label>
      <input type="text" ref={idInputRef} />
      <br />
      <label>Code</label>
      <textarea style={{ width: "100%", height: "50px" }} ref={scriptInputRef} />
      <br />
      <button onClick={run}>Run!</button>
      <br />
      <label>Results</label>
      {results.map((result, i) => <p key={i}>{result}</p>)}
    </div>
  );
}

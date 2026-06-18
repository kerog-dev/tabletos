import { useEffect, useRef, useState } from "react";

const ws = new WebSocket("ws://192.168.1.31:8085/");

export default function JSClient() {
  const idInputRef = useRef<HTMLInputElement | null>(null);
  const codeInputRef = useRef<HTMLTextAreaElement | null>(null);

  const [results, setResults] = useState<string[]>([]);

  useEffect(() => {
    console.log("starting listener");
    const listener = (e: MessageEvent) => {
      console.log("received", e.data);
      const msg = JSON.parse(e.data.toString());
      if (msg.type === "js-server-result") {
        console.log(results);
        setResults(results => [...results, `${msg.id}: ${msg.result}`]);
      }
    };

    ws.addEventListener("message", listener);
    return () => ws.removeEventListener("message", listener);
  }, []);

  function run() {
    if (!idInputRef.current || !codeInputRef.current) return;
    ws.send(JSON.stringify({
      type: "js-server-run",
      targetId: idInputRef.current.value,
      code: codeInputRef.current.value,
    }));
  }

  return (
    <div>
      <span>{ws.readyState === ws.CLOSED ? "closed" : ws.readyState === ws.OPEN ? "open" : "idk"}</span>
      <br />
      <label>Target ID</label>
      <input type="text" ref={idInputRef} />
      <br />
      <label>Code</label>
      <textarea ref={codeInputRef} />
      <br />
      <button onClick={run}>Run!</button>
      <br />
      <label>Results</label>
      {results.map((result, i) => <p key={i}>{result}</p>)}
    </div>
  );
}

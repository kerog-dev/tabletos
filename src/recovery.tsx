import { type ComponentType, useRef, useState } from "react";

// TODO: remove error after finished developing

export const recoveryActions: [string, (setUI: (ui: ComponentType<{}> | null) => void) => void][] = [
  ["Reload", () => location.reload()],
  ["Reset", () => indexedDB.deleteDatabase("tabletos").addEventListener("success", () => location.reload())],
  ["Open JS Console", (setUI) =>
    setUI(function JSConsole() {
      const inputRef = useRef<HTMLInputElement | null>(null);
      const outputRef = useRef<HTMLPreElement | null>(null);

      function run() {
        const code = inputRef.current?.value ?? "'Nothing entered.'";
        let result;
        try {
          result = window.eval(code);
        } catch (e) {
          if (e instanceof Error) result = { name: e.name, message: e.message, cause: e.cause, stack: e.stack };
          else {
            result = e;
          }
        }
        outputRef.current!.textContent = JSON.stringify(result, undefined, 4);
      }

      return (
        <div>
          <button onClick={() => setUI(null)}>Back</button>
          <br />
          <input type="text" ref={inputRef} />
          <button onClick={run}>Run</button>
          <br />
          <pre ref={outputRef} />
        </div>
      );
    })],
  ["Start JS Server", (setUI) =>
    setUI(function JSServer() {
      const [serverAddr, setServerAddr] = useState("");
      const [connected, setConnected] = useState(false);
      const [myName, setMyName] = useState("");
      const [log, setLog] = useState<{ id: string; from: string; code: string; result: string; error: boolean }[]>([]);
      const wsRef = useRef<WebSocket | null>(null);

      function addLog(entry: typeof log[number]) {
        setLog(l => [entry, ...l].slice(0, 50));
      }

      function connect() {
        const name = "recovery-" + Math.random().toString(36).slice(2, 8);
        setMyName(name);
        const ws = new WebSocket(`${serverAddr.replace("http:", "ws:").replace("https:", "wss:")}/ws`);
        wsRef.current = ws;

        ws.addEventListener("open", () => {
          ws.send(JSON.stringify({ type: "connect", name, public_key: "" }));
          setConnected(true);
        });

        ws.addEventListener("close", () => setConnected(false));

        ws.addEventListener("message", e => {
          const msg = JSON.parse(e.data);
          if (msg.type !== "message" || msg.subtype !== "remote_recovery_js") return;
          const { id, code } = msg.data;
          const from = msg.from;

          let result: any;
          let error = false;
          try {
            result = window.eval(code);
          } catch (err) {
            error = true;
            result = err instanceof Error
              ? { name: err.name, message: err.message, stack: err.stack }
              : String(err);
          }

          const serialized = JSON.stringify(result, undefined, 2) ?? "undefined";
          ws.send(JSON.stringify({
            type: "message",
            subtype: "remote_recovery_js_result",
            to: from,
            data: { id, result: serialized, error },
          }));

          addLog({ id, from, code, result: serialized, error });
        });
      }

      function disconnect() {
        wsRef.current?.close();
        wsRef.current = null;
      }

      return (
        <div style={{ fontFamily: "monospace", padding: 8 }}>
          <button
            onClick={() => {
              disconnect();
              setUI(null);
            }}
          >
            Back
          </button>
          <h3 style={{ margin: "8px 0" }}>Remote JS Server</h3>

          {!connected
            ? (
              <div>
                <input
                  placeholder="http://192.168.x.x:8086"
                  value={serverAddr}
                  onChange={e => setServerAddr(e.target.value)}
                  style={{ width: "60%" }}
                />
                <button onClick={connect} disabled={!serverAddr}>Connect</button>
              </div>
            )
            : (
              <div>
                <span style={{ color: "lime" }}>● Connected</span>
                {" · "}
                <span style={{ opacity: 0.6 }}>
                  listening as <b>{myName}</b>
                </span>
                {" · "}
                <button onClick={disconnect}>Disconnect</button>
              </div>
            )}

          <hr style={{ margin: "8px 0" }} />

          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>
            Execution log ({log.length})
          </div>

          {log.length === 0 && <div style={{ opacity: 0.4 }}>No executions yet.</div>}

          {log.map(entry => (
            <div
              key={entry.id}
              style={{
                marginBottom: 8,
                padding: 6,
                borderLeft: `3px solid ${entry.error ? "red" : "lime"}`,
                background: "#111",
              }}
            >
              <div style={{ opacity: 0.5, fontSize: 11 }}>from {entry.from} · #{entry.id}</div>
              <div style={{ color: "#aaf" }}>→ {entry.code}</div>
              <pre style={{ margin: 0, color: entry.error ? "salmon" : "white", whiteSpace: "pre-wrap" }}>
              {entry.result}
              </pre>
            </div>
          ))}
        </div>
      );
    })],
];

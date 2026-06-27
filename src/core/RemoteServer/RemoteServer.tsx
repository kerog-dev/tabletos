import { useEffect, useState } from "react";
import type { Sdk } from "../../sdk.ts";

const { conn, sv }: Sdk = (window as any).$;

const serviceName = "Remote Server Service";

export default function RemoteServer() {
  const [running, setRunning] = useState(() => sv.isRunning(serviceName));

  useEffect(() => {
    const listener = (running: boolean) => setRunning(running);
    sv.onRunningStateChanged([serviceName], listener);
    return () => sv.removeRunningStateChangeListener(listener);
  }, []);

  return (
    <div>
      Server status: {running ? "running" : "stopped"}
      <br />
      Your client name: {conn.name}
      <br />
      <button onClick={() => sv.start(serviceName)}>Start</button>
      <button onClick={() => sv.stop(serviceName)}>Stop</button>
    </div>
  );
}

import { useEffect, useState } from "react";
import type { ServiceInfo } from "../../packages.ts";
import type { Sdk } from "../../sdk.ts";

const { sv }: Sdk = (window as any).$;

const services = sv.list();

function Service({ s }: { s: ServiceInfo }) {
  const [running, setRunning] = useState(() => sv.isRunning(s.name));

  useEffect(() => {
    const listener = (running: boolean) => setRunning(running);
    sv.onRunningStateChanged([s.name], listener);
    return () => sv.removeRunningStateChangeListener(listener);
  }, []);

  return (
    <div>
      {s.name}: {running ? "running" : "stopped"} (autostarts: {s.autostart ? "yes" : "no"}){" "}
      <button onClick={() => sv.start(s.name)}>Start</button>
      <button onClick={() => sv.stop(s.name)}>Stop</button>
    </div>
  );
}

export default function ServiceManager() {
  return <div>{services.map(s => <Service key={s.name} s={s} />)}</div>;
}

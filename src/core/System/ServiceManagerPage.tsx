import { useRouter } from "../../components/Router.tsx";
import type { ServiceInfo } from "../../packages.ts";
import type { Sdk } from "../../sdk.ts";

const { sv }: Sdk = (window as any).$;

const services = sv.list();

function Service({ s }: { s: ServiceInfo }) {
  const running = sv.useRunning(s.name);

  return (
    <div>
      {s.name}: {running ? "running" : "stopped"} (autostarts: {s.autostart ? "yes" : "no"}){" "}
      <button onClick={() => sv.start(s.name)}>Start</button>
      <button onClick={() => sv.stop(s.name)}>Stop</button>
    </div>
  );
}

export function ServiceManagerPage() {
  const router = useRouter();

  return (
    <div>
      <button onClick={() => router.navigate("Home")}>Back</button>
      <br />
      {services.map(s => <Service key={s.name} s={s} />)}
    </div>
  );
}

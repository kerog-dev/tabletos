import { useRouter } from "../../components/Router.tsx";
import { sdk } from "../../getsdk.ts";
import type { ServiceInfo } from "../../loader/loader.ts";

const { sv } = sdk();

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

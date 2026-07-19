import { useRouter } from "../../components/Router.tsx";
import { EventUrgency } from "../../eventlog.ts";
import { sdk } from "../../getsdk.ts";
import type { ServiceInfo } from "../../loader/loader.ts";

const { sv, fs, eventlog } = sdk();

const services = sv.list();

function Service({ s, autostart }: { s: ServiceInfo; autostart: boolean | undefined }) {
  const running = sv.useRunning(s.name);

  async function setAutostart(value: boolean | undefined) {
    const json = JSON.parse(await fs.readTextFile("/services.json"));
    json[s.name] = value;
    await fs.writeFile("/services.json", JSON.stringify(json));
    eventlog.add(
      "System Settings",
      `Updated autostart for service: ${s.name}: ${value === undefined ? "unset" : value ? "yes" : "no"}`,
      EventUrgency.Info,
    );
  }

  function start() {
    sv.start(s.name);
    eventlog.add(
      "System Settings",
      `Started service: ${s.name}`,
      EventUrgency.Info,
    );
  }

  function stop() {
    sv.stop(s.name);
    eventlog.add(
      "System Settings",
      `Stopped service: ${s.name}`,
      EventUrgency.Info,
    );
  }

  return (
    <div>
      {s.name}: {running ? "running" : "stopped"} (autostarts: {s.autostart ? "yes" : "no"}){" "}
      <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button>
      Autostart:
      <select
        value={autostart === undefined ? "unset" : autostart ? "yes" : "no"}
        onChange={e => setAutostart(({ "unset": undefined, "yes": true, "no": false })[e.target.value])}
      >
        <option value="unset">Unset</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );
}

export function ServiceManagerPage() {
  const router = useRouter();
  const autostarts: Record<string, boolean | undefined> = JSON.parse(fs.useTextFile("/services.json") ?? "{}");

  return (
    <div>
      <button onClick={() => router.navigate("Home")}>Back</button>
      <br />
      {services.map(s => <Service key={s.name} s={s} autostart={autostarts[s.name]} />)}
    </div>
  );
}

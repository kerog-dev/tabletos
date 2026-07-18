import { useRouter } from "../../components/Router.tsx";
import { sdk } from "../../getsdk.ts";
import type { ServiceInfo } from "../../loader/loader.ts";

const { sv, fs } = sdk();

const services = sv.list();

function Service({ s, autostart }: { s: ServiceInfo; autostart: boolean | undefined }) {
  const running = sv.useRunning(s.name);

  async function setAutostart(value: boolean | undefined) {
    const json = JSON.parse(await fs.readTextFile("/services.json"));
    json[s.name] = value;
    await fs.writeFile("/services.json", JSON.stringify(json));
  }

  return (
    <div>
      {s.name}: {running ? "running" : "stopped"} (autostarts: {s.autostart ? "yes" : "no"}){" "}
      <button onClick={() => sv.start(s.name)}>Start</button>
      <button onClick={() => sv.stop(s.name)}>Stop</button>
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

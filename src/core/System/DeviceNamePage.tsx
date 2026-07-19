import { useState } from "react";
import { useRouter } from "../../components/Router.tsx";
import { EventUrgency } from "../../eventlog.ts";
import { sdk } from "../../getsdk.ts";

const { fs, eventlog } = sdk();

export function DeviceNamePage() {
  const router = useRouter();
  const currentName = fs.useTextFile("/devicename.txt");
  const [name, setName] = useState(currentName ?? "");

  return (
    <div>
      <button onClick={() => router.navigate("Home")}>Back</button>
      <br />
      Current name: {currentName ?? "unset"}
      <br />
      <input type="text" value={name} onChange={e => setName(e.target.value)} />
      <button
        onClick={() => {
          fs.writeFile("/devicename.txt", name);
          eventlog.add("System Settings", `Device name set: ${name}`, EventUrgency.Info);
        }}
      >
        Set
      </button>
    </div>
  );
}

import { useState } from "react";
import type { Sdk } from "../../sdk.ts";

const { fs }: Sdk = (window as any).$;

export default function DeviceNamePage() {
  const currentName = fs.useTextFile("/devicename.txt");
  const [name, setName] = useState(currentName ?? "");

  return (
    <div>
      Current name: {currentName ?? "unset"}
      <br />
      <input type="text" value={name} onChange={e => setName(e.target.value)} />
      <button onClick={() => fs.writeFile("/devicename.txt", name)}>Set</button>
    </div>
  );
}

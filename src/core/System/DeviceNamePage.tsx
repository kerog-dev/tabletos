import { useState } from "react";
import { useRouter } from "../../components/Router.tsx";
import { sdk } from "../../getsdk.ts";

const { fs } = sdk();

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
      <button onClick={() => fs.writeFile("/devicename.txt", name)}>Set</button>
    </div>
  );
}

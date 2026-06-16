import { useRef, useState } from "react";
import { type App } from "../../apps.ts";
import { Launchpad } from "./Launchpad.tsx";
import { Window } from "./Window.tsx";
import "./WindowManager.css";
import * as fs from "../../fs.ts";
import storage from "../../storage.ts";

let wallpaper: string | null = null;
try {
  const content = await fs.readFile("/wallpaper.img");
  if (!(content instanceof Blob)) throw "Wallpaper file is not a blob";
  const uri = URL.createObjectURL(content);
  wallpaper = uri;
} catch (e) {}

export const windowTransparency = storage.windowTransparency ?? 0;

interface WindowDesc {
  id: number;
  app: App;
  initialPos: [number, number];
  initialSize: [number, number];
  z: number;
}

export default function WindowManager() {
  const [windows, setWindows] = useState<WindowDesc[]>([]);
  const curZ = useRef(0);
  const curId = useRef(0);

  function spawnWindow(app: App) {
    const newWindow: WindowDesc = {
      id: ++curId.current,
      app,
      initialPos: [Math.random() * window.innerWidth, Math.random() * window.innerHeight],
      initialSize: [window.innerWidth / 3, window.innerHeight / 3],
      z: ++curZ.current,
    };
    setWindows(windows => [...windows, newWindow]);
  }

  function killWindow(id: number) {
    setWindows(windows => windows.filter(w => w.id !== id));
  }

  function modifyWindow(updater: (w: WindowDesc) => WindowDesc, id: number) {
    setWindows(windows => windows.map(w => w.id === id ? updater(w) : w));
  }

  return (
    <div
      style={{
        margin: "0",
        padding: "0",
        width: "100vw",
        height: "100vh",
        position: "relative",
        backgroundImage: wallpaper == null ? undefined : `url(${wallpaper})`,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "50%, 50%",
      }}
    >
      <Launchpad spawnWindow={spawnWindow} killAll={() => setWindows([])} />
      {windows.map((w) => (
        <Window
          key={w.id}
          app={w.app}
          initialPos={w.initialPos}
          initialSize={w.initialSize}
          z={w.z}
          kill={() => killWindow(w.id)}
          bringToTop={() => modifyWindow(w => ({ ...w, z: ++curZ.current }), w.id)}
        />
      ))}
    </div>
  );
}

import { useRef, useState } from "react";
import { type App, apps } from "../../apps.ts";
import { Taskbar } from "./Taskbar.tsx";
import { Window } from "./Window.tsx";
import "./WindowManager.css";
import * as fs from "../../fs.ts";
import storage from "../../storage.ts";
import { Shortcuts } from "./Shortcuts.tsx";

let wallpaper: string | null = null;
try {
  const content = await fs.readFile("/wallpaper.img");
  if (!(content instanceof Blob)) throw "Wallpaper file is not a blob";
  const uri = URL.createObjectURL(content);
  wallpaper = uri;
} catch (e) {}

export const windowTransparency = storage.windowTransparency ?? 0;

export interface WindowDesc {
  id: number;
  app: App;
  initialPos: [number, number];
  initialSize: [number, number];
  z: number;
  minimized: boolean;
  args: any[];
}

let sSpawnWindow: (w: Omit<Partial<WindowDesc>, "app" | "id" | "z"> & { app: string }) => void;
export { sSpawnWindow as spawnWindow };

export default function WindowManager() {
  const [windows, setWindows] = useState<WindowDesc[]>([]);
  const curZ = useRef(0);
  const curId = useRef(0);

  function spawnWindow(
    app: App,
    minimized = false,
    initialPos: [number, number] | null = null,
    initialSize: [number, number] | null = null,
    args: any[] = [],
  ) {
    const posPcnt = Math.max(0, Math.min(0.95, curId.current / 15)) + 0.025;
    const newWindow: WindowDesc = {
      id: ++curId.current,
      app,
      initialPos: initialPos ?? [posPcnt * window.innerWidth, posPcnt * window.innerHeight],
      initialSize: initialSize ?? [window.innerWidth / 3, window.innerHeight / 3],
      z: ++curZ.current,
      minimized,
      args,
    };
    setWindows(windows => [...windows, newWindow]);
  }

  sSpawnWindow = w =>
    spawnWindow(apps.find(app => app.name === w.app)!, w.minimized, w.initialPos, w.initialSize, w.args);

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
      <Taskbar
        spawnWindow={spawnWindow}
        killAll={() => setWindows([])}
        windows={windows}
        toggleMinimized={id => modifyWindow(w => ({ ...w, minimized: !w.minimized }), id)}
        kill={killWindow}
      />
      <Shortcuts spawnWindow={spawnWindow} />
      {windows.map((w) => (
        <Window
          key={w.id}
          app={w.app}
          initialPos={w.initialPos}
          initialSize={w.initialSize}
          z={w.z}
          kill={() => killWindow(w.id)}
          bringToTop={() => modifyWindow(w => ({ ...w, z: ++curZ.current }), w.id)}
          minimized={w.minimized}
          toggleMinimized={() => modifyWindow(w => ({ ...w, minimized: !w.minimized }), w.id)}
          args={w.args}
        />
      ))}
    </div>
  );
}

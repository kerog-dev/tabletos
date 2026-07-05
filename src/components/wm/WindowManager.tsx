import { useRef, useState } from "react";
import { type App, apps } from "../../packages.ts";
import { Taskbar } from "./Taskbar.tsx";
import { Window } from "./Window.tsx";
import "./WindowManager.css";
import * as fs from "../../lib/fs.ts";
import { Shortcuts } from "./Shortcuts.tsx";

export interface WindowDesc {
  id: number;
  app: App;
  initialPos: [number, number];
  initialSize: [number, number];
  z: number;
  minimized: boolean;
  args: any[];
}

export default function WindowManager() {
  const [windows, setWindows] = useState<WindowDesc[]>([]);
  const curZ = useRef(0);
  const curId = useRef(0);
  const windowAreaRef = useRef<HTMLDivElement | null>(null);
  const wallpaperUrl = fs.useBlobFileUrl("/wallpaper.img");

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

  (window as any).$.spawnWindow = (w: any) =>
    spawnWindow(apps.find(app => app.name === w.app)!, w.minimized, w.initialPos, w.initialSize, w.args);

  function killWindow(id: number) {
    setWindows(windows => windows.filter(w => w.id !== id));
  }

  function modifyWindow(updater: (w: WindowDesc) => WindowDesc, id: number) {
    setWindows(windows => windows.map(w => w.id === id ? updater(w) : w));
  }

  return (
    <div
      className="window-manager"
      style={{
        backgroundImage: wallpaperUrl ? `url(${wallpaperUrl})` : undefined,
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
      <div className="window-area" ref={windowAreaRef}>
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
            getWindowAreaSize={() => [
              windowAreaRef.current!.clientWidth,
              windowAreaRef.current!.clientHeight,
            ]}
          />
        ))}
      </div>
    </div>
  );
}

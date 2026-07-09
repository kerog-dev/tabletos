import { useRef } from "react";
import { apps } from "../../loader/loader.ts";
import { Taskbar } from "./Taskbar.tsx";
import { Window } from "./Window.tsx";
import "./WindowManager.css";
import * as fs from "../../lib/fs.ts";
import { spawnWindow, useWindows } from "./windowsStore.ts";

export type { WindowDesc } from "./windowsStore.ts";

export default function WindowManager() {
  const windows = useWindows();
  const windowAreaRef = useRef<HTMLDivElement | null>(null);
  const wallpaperUrl = fs.useBlobFileUrl("/wallpaper.img");

  (window as any).$.spawnWindow = (w: any) =>
    spawnWindow(apps.find(app => app.name === w.app)!, w.minimized, w.initialPos, w.initialSize, w.args);

  return (
    <div
      className="window-manager"
      style={{
        backgroundImage: wallpaperUrl ? `url(${wallpaperUrl})` : undefined,
      }}
    >
      <Taskbar />
      <div className="window-area" ref={windowAreaRef}>
        {windows.map((w) => (
          <Window
            key={w.id}
            id={w.id}
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

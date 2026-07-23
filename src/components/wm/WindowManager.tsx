import { useEffect, useRef, useState } from "react";
import * as fs from "../../lib/fs.ts";
import { apps } from "../../loader/loader.ts";
import { Dialog, DialogProvider } from "./Dialog.tsx";
import { Taskbar } from "./Taskbar.tsx";
import { Window } from "./Window.tsx";
import styles from "./WindowManager.module.css";
import { spawnWindow, useWindows } from "./windowsStore.ts";

export type { WindowDesc } from "./windowsStore.ts";

export default function WindowManager() {
  const [focusedWorkspace, setFocusedWorkspace] = useState("1");
  const windows = useWindows();
  const windowAreaRef = useRef<HTMLDivElement | null>(null);
  const wallpaperUrl = fs.useBlobFileUrl("/wallpaper.img");

  useEffect(() => {
    (window as any).$.spawnWindow = (w: any) =>
      spawnWindow(apps.find(app => app.name === w.app)!, w.minimized, w.initialPos, w.initialSize, w.args);
  }, []);

  return (
    <div
      className={styles["window-manager"]}
      style={{
        backgroundImage: wallpaperUrl ? `url(${wallpaperUrl})` : undefined,
      }}
    >
      <Taskbar focusedWorkspace={focusedWorkspace} setFocusedWorkspace={setFocusedWorkspace} />
      <Dialog />
      <DialogProvider>
        <div className={styles["window-area"]} ref={windowAreaRef}>
          {windows.map((w) => (
            <Window
              key={w.id}
              id={w.id}
              focusedWorkspace={focusedWorkspace}
              getWindowAreaSize={() => [
                windowAreaRef.current!.clientWidth,
                windowAreaRef.current!.clientHeight,
              ]}
            />
          ))}
        </div>
      </DialogProvider>
    </div>
  );
}

import { useEffect, useState } from "react";
import { type App, useApps } from "../../packages.ts";
import "./Taskbar.css";
import closeIcon from "vfs:/vendor/icons/close.png?url";
import fullscreenIcon from "vfs:/vendor/icons/fullscreen.png?url";
import startIcon from "vfs:/vendor/icons/start.png?url";
import { useBlobFileUrl } from "../../lib/fs.ts";
import { Toasts } from "../../toast.tsx";
import { setTrayOpen, useTrayDescs } from "./tray.ts";
import type { WindowDesc } from "./WindowManager.tsx";

export function Launcher(
  { open, spawnWindow, killAll, setLauncherOpen }: {
    open: boolean;
    spawnWindow: (app: App) => void;
    killAll: () => void;
    setLauncherOpen: (open: boolean) => void;
  },
) {
  const apps = useApps();

  return (
    <div
      className="launcher"
      style={{
        display: open ? "unset" : "none",
      }}
    >
      <div>
        Apps:
        <ul className="launcher-app-list" style={{ margin: 0 }}>
          {apps.map(app => (
            <li key={app.name}>
              <button
                onClick={() => {
                  spawnWindow(app);
                  setLauncherOpen(false);
                }}
              >
                {app.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="launcher-quick-actions">
        <button onClick={() => document.body.requestFullscreen()}>
          <img src={fullscreenIcon} />
        </button>
        <button onClick={() => killAll()}>
          <img src={closeIcon} />
        </button>
      </div>
    </div>
  );
}

function TaskbarWindowCtx({ w, close, closeWindow }: { w: WindowDesc; close: () => void; closeWindow: () => void }) {
  return (
    <div className="taskbar-window-ctx" onClick={close}>
      {w.app.name}
      <br />
      <button onClick={closeWindow}>Close</button>
      <br />
    </div>
  );
}

export function Taskbar(
  { spawnWindow, killAll, windows, toggleMinimized, kill }: {
    spawnWindow: (app: App) => void;
    killAll: () => void;
    windows: WindowDesc[];
    toggleMinimized: (id: number) => void;
    kill: (id: number) => void;
  },
) {
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [contextMenuOpens, setContextMenuOpens] = useState(() => Object.fromEntries(windows.map(w => [w.id, false])));
  const trayDescs = useTrayDescs();
  const wallpaperBlobUrl = useBlobFileUrl("/wallpaper.img");

  useEffect(() => {
    const old = contextMenuOpens;
    for (const w of windows) if (!(w.id.toString() in old)) setContextMenuOpens(old => ({ [w.id]: false, ...old }));
  }, [windows]);

  return (
    <>
      <div className="taskbar">
        <button
          className="start-button"
          onClick={() => setLauncherOpen(open => !open)}
        >
          <img style={{ width: "100%", height: "100%", imageRendering: "pixelated" }} src={startIcon} />
        </button>
        <div className="window-list">
          {windows.map(w => (
            <div
              key={w.id}
              className="taskbar-window"
              onContextMenu={e => {
                e.preventDefault();
                setContextMenuOpens(contextMenuOpens => ({ ...contextMenuOpens, [w.id]: true }));
              }}
            >
              <button className="taskbar-window-btn" onClick={() => toggleMinimized(w.id)}>{w.app.name}</button>
              {contextMenuOpens[w.id] && (
                <TaskbarWindowCtx
                  w={w}
                  close={() => setContextMenuOpens(c => ({ ...c, [w.id]: false }))}
                  closeWindow={() => kill(w.id)}
                />
              )}
            </div>
          ))}
        </div>
        <div className="tray">
          {Object.values(trayDescs).map(t => (
            <div key={t.id} className="tray-entry">
              <img
                className="tray-entry-image"
                width={30}
                height={30}
                src={(t.iconUrl || wallpaperBlobUrl) ?? ""}
                title={t.name}
                onClick={() => setTrayOpen(t.id, true)}
                style={{ anchorName: `--tray-anchor-${t.id}` }}
              />
              <div
                className="tray-entry-popup"
                style={{ display: t.open ? "unset" : "none", positionAnchor: `--tray-anchor-${t.id}` }}
                onClick={() => setTrayOpen(t.id, false)}
              >
                <t.show />
              </div>
            </div>
          ))}
        </div>
      </div>
      <Toasts />
      <Launcher {...{ spawnWindow, open: launcherOpen, killAll, setLauncherOpen }} />
    </>
  );
}

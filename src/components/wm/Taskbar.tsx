import { useEffect, useState } from "react";
import { type App, apps } from "../../apps.ts";
import "./Taskbar.css";
import type { WindowDesc } from "./WindowManager.tsx";

export function Launcher(
  { open, spawnWindow, killAll, setLauncherOpen }: {
    open: boolean;
    spawnWindow: (app: App) => void;
    killAll: () => void;
    setLauncherOpen: (open: boolean) => void;
  },
) {
  return (
    <div
      style={{
        display: open ? "unset" : "none",
        position: "fixed",
        bottom: "80px",
        left: "10px",
        backgroundColor: "#aeaeae",
        padding: "10px",
        borderRadius: "8px",
        width: "10%",
      }}
    >
      <div>
        Apps:
        <ul style={{ margin: 0 }}>
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
      <div>
        <button onClick={() => document.body.requestFullscreen()}>Fullscreen</button>
        <br />
        <button onClick={() => killAll()}>Close all</button>
        <br />
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
  const [contextMenuOpens, setContextMenuOpens] = useState(Object.fromEntries(windows.map(w => [w.id, false])));

  useEffect(() => {
    const old = contextMenuOpens;
    for (const w of windows) if (!(w.id.toString() in old)) setContextMenuOpens(old => ({ [w.id]: false, ...old }));
  }, [windows]);

  return (
    <>
      <div className="taskbar">
        <button
          className="start-button"
          style={{ width: "60px", height: "60px", fontSize: "200%" }}
          onClick={() => setLauncherOpen(open => !open)}
        >
          {"<!>"}
        </button>
        <div className="window-list">
          {windows.map(w => (
            <div
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
        <div className="tray">tray</div>
      </div>
      <Launcher {...{ spawnWindow, open: launcherOpen, killAll, setLauncherOpen }} />
    </>
  );
}

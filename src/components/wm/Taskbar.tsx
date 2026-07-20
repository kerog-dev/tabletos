import { useEffect, useMemo, useState } from "react";
import { type App, apps, useApps } from "../../loader/loader.ts";
import "./Taskbar.css";
import closeIcon from "vfs:/vendor/icons/close.png?url";
import fullscreenIcon from "vfs:/vendor/icons/fullscreen.png?url";
import startIcon from "vfs:/vendor/icons/start.png?url";
import { readTextFile, useBlobFileUrl } from "../../lib/fs.ts";
import { toast, Toasts, Urgency } from "../../toast.tsx";
import { setTrayOpen, useTrayDescs } from "./tray.ts";
import { bringToTop, killAllWindows, killWindow, spawnWindow, useWindows, type WindowDesc } from "./windowsStore.ts";

interface ShortcutShared {
  name: string;
  iconUrl?: string;
}

interface AppTarget {
  targetType: "app";
  app: App | string;
}

interface ScriptTarget {
  targetType: "script";
  path?: string;
  script?: string;
}

type ShortcutDesc = ShortcutShared & (AppTarget | ScriptTarget);

async function loadAdditionalShortcuts(): Promise<ShortcutDesc[]> {
  try {
    const shortcuts = JSON.parse(await readTextFile("/additional_shortcuts.json"));
    return shortcuts;
  } catch {
    return [];
  }
}

const additionalShortcuts = await loadAdditionalShortcuts();

function getIconSrc(s: ShortcutDesc): string | null {
  const noIconUrl = useBlobFileUrl("/vendor/icons/noicon.png");
  const app: App | undefined = s.targetType !== "app"
    ? undefined
    : typeof s.app === "string"
    ? apps.find(app => app.name === s.app)
    : s.app;
  return app?.iconUrl ?? s.iconUrl ?? noIconUrl;
}

function Shortcut({ s, setLauncherOpen }: { s: ShortcutDesc; setLauncherOpen: (open: boolean) => void }) {
  const src = getIconSrc(s);

  function open() {
    switch (s.targetType) {
      case "app":
        const app: App | undefined = typeof s.app === "string" ? apps.find(app => app.name === s.app) : s.app;
        if (app) spawnWindow(app);
        else toast({ title: "Failed to open, app not found", urgency: Urgency.Error });
        break;

      case "script":
        function runScript(script: string) {
          try {
            window.eval(script);
          } catch (e) {
            toast({ title: "Error running script", desc: "Error: " + e, urgency: Urgency.Error });
          }
        }

        if (s.path) {
          readTextFile(s.path).then(script => {
            runScript(script);
          });
        } else if (s.script) runScript(s.script);
        else toast({ title: "Script shortcut with no path or script property.", urgency: Urgency.Error });
        break;
    }
    setLauncherOpen(false);
  }

  return (
    <div
      className="shortcut"
      onClick={open}
    >
      <div className="shortcut-inside">
        <img className="shortcut-icon" src={src ?? "about:blank"} />
        <div className="shortcut-name">{s.name}</div>
      </div>
    </div>
  );
}

function appsToShortcuts(apps: App[]): ShortcutDesc[] {
  return apps.map(app => ({ name: app.name, targetType: "app", app, iconFile: "/vendor/icons/noicon.png" }));
}

function Launcher({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const apps = useApps();
  (window as any).__Launcher_close_all = killAllWindows;
  const shortcuts = useMemo<ShortcutDesc[]>(
    () => [
      {
        targetType: "script",
        name: "Fullscreen",
        script: "document.body.requestFullscreen()",
        iconUrl: fullscreenIcon,
      },
      {
        targetType: "script",
        name: "Close all",
        script: "__Launcher_close_all()",
        iconUrl: closeIcon,
      },
      ...appsToShortcuts(apps),
      ...additionalShortcuts,
    ],
    [apps],
  );

  return (
    <div className="launcher" style={{ display: open ? undefined : "none" }}>
      {shortcuts.map((s, index) => <Shortcut key={index} s={s} setLauncherOpen={setOpen} />)}
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

export function Taskbar() {
  const windows = useWindows();
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [contextMenuOpens, setContextMenuOpens] = useState(() => Object.fromEntries(windows.map(w => [w.id, false])));
  const trayDescs = useTrayDescs();
  const noIconUrl = useBlobFileUrl("/vendor/icons/noicon.png");

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
              <button className="taskbar-window-btn" onClick={() => bringToTop(w.id)}>{w.app.name}</button>
              {contextMenuOpens[w.id] && (
                <TaskbarWindowCtx
                  w={w}
                  close={() => setContextMenuOpens(c => ({ ...c, [w.id]: false }))}
                  closeWindow={() => killWindow(w.id)}
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
                src={t.iconUrl ?? noIconUrl ?? ""}
                title={t.name}
                onClick={() => setTrayOpen(t.id, true)}
                style={{ anchorName: `--tray-anchor-${t.id}` }}
              />
              <div
                className="tray-entry-popup"
                style={{ display: t.open ? "unset" : "none", positionAnchor: `--tray-anchor-${t.id}` }}
                onClick={() => setTrayOpen(t.id, false)}
              >
                {t.open && <t.ui />}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Toasts />
      <Launcher open={launcherOpen} setOpen={setLauncherOpen} />
    </>
  );
}

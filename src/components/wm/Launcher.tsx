import { useMemo } from "react";
import closeIcon from "vfs:/vendor/icons/close.png?url";
import fullscreenIcon from "vfs:/vendor/icons/fullscreen.png?url";
import { readTextFile, useBlobFileUrl } from "../../lib/fs.ts";
import { type App, apps, useApps } from "../../loader/loader.ts";
import { toast, Urgency } from "../../toast.tsx";
import styles from "./Launcher.module.css";
import { killAllWindows, spawnWindow } from "./windowsStore.ts";

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
      className={styles.shortcut}
      onClick={open}
    >
      <div className={styles["shortcut-inside"]}>
        <img className={styles["shortcut-icon"]} src={src ?? "about:blank"} />
        <div className={styles["shortcut-name"]}>{s.name}</div>
      </div>
    </div>
  );
}

function appsToShortcuts(apps: App[]): ShortcutDesc[] {
  return apps.map(app => ({ name: app.name, targetType: "app", app, iconFile: "/vendor/icons/noicon.png" }));
}

export function Launcher({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
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
    <div className={styles.launcher} style={{ display: open ? undefined : "none" }}>
      {shortcuts.map((s, index) => <Shortcut key={index} s={s} setLauncherOpen={setOpen} />)}
    </div>
  );
}

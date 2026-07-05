import { useMemo } from "react";
import { readTextFile, useBlobFileUrl } from "../../lib/fs.ts";
import { type App, apps, useApps } from "../../packages.ts";
import "./Shortcuts.css";
import { toast, Urgency } from "../../toast.tsx";

interface ShortcutShared {
  name: string;
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
  if (s.targetType !== "app") return null;
  const app: App | undefined = typeof s.app === "string" ? apps.find(app => app.name === s.app) : s.app;
  if (!app) return null;
  return app.iconUrl ?? null;
}

function Shortcut({ s, spawnWindow }: { s: ShortcutDesc; spawnWindow: (app: App) => void }) {
  const noIconUrl = useBlobFileUrl("/vendor/icons/noicon.png");
  const src = getIconSrc(s) ?? noIconUrl;

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
  }

  return (
    <div
      className="shortcut"
      onDoubleClick={() => open()}
    >
      <div className="shortcut-inside">
        {src && <img className="shortcut-icon" src={src} />}
        <div className="shortcut-name">{s.name}</div>
      </div>
    </div>
  );
}

function appsToShortcuts(apps: App[]): ShortcutDesc[] {
  return apps.map(app => ({ name: app.name, targetType: "app", app, iconFile: "/vendor/icons/noicon.png" }));
}

export function Shortcuts({ spawnWindow }: { spawnWindow: (app: App) => void }) {
  const apps = useApps();
  const shortcuts = useMemo<ShortcutDesc[]>(
    () => [
      ...appsToShortcuts(apps),
      ...additionalShortcuts,
    ],
    [apps],
  );

  return (
    <div className="shortcuts">
      {shortcuts.map((s, index) => <Shortcut key={index} s={s} spawnWindow={spawnWindow} />)}
    </div>
  );
}

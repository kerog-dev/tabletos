import { useMemo } from "react";
import { type App, useApps } from "../../apps.ts";
import { useBlobFileUrl } from "../../fs.ts";
import "./Shortcuts.css";

interface ShortcutDesc {
  name: string;
  target: App;
  iconFile: string | null;
}

function Shortcut({ s, spawnWindow }: { s: ShortcutDesc; spawnWindow: (app: App) => void }) {
  const src = s.iconFile ? useBlobFileUrl(s.iconFile) : undefined;

  return (
    <div
      className="shortcut"
      onDoubleClick={() => spawnWindow(s.target)}
    >
      <div className="shortcut-inside">
        {src && <img className="shortcut-icon" src={src} />}
        <div className="shortcut-name">{s.name}</div>
      </div>
    </div>
  );
}

export function Shortcuts({ spawnWindow }: { spawnWindow: (app: App) => void }) {
  const apps = useApps();
  const shortcuts = useMemo<ShortcutDesc[]>(() => {
    return apps.map(app => ({ name: app.name, target: app, iconFile: "/wallpaper.img" }));
  }, [apps]);

  return (
    <div className="shortcuts">
      {shortcuts.map((s, index) => <Shortcut key={index} s={s} spawnWindow={spawnWindow} />)}
    </div>
  );
}

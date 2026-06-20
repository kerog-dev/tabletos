import { useMemo } from "react";
import { type App, useApps } from "../../apps.ts";
import { useBlobFileUrl } from "../../fs.ts";
import "./Shortcuts.css";

interface ShortcutDesc {
  name: string;
  target: App;
  iconFile: string | null;
  pos: [number, number];
}

// TODO: display: grid; instead of this current thing.
function Shortcut({ s, spawnWindow }: { s: ShortcutDesc; spawnWindow: (app: App) => void }) {
  const src = s.iconFile ? useBlobFileUrl(s.iconFile) : undefined;

  return (
    <div
      className="shortcut"
      style={{
        top: s.pos[1] + "px",
        left: s.pos[0] + "px",
        width: SHORTCUT_SIZE + "px",
        height: SHORTCUT_SIZE + "px",
      }}
      onDoubleClick={() => spawnWindow(s.target)}
    >
      <div className="shortcut-inside">
        {src && <img className="shortcut-icon" src={src} />}
        <div className="shortcut-name">{s.name}</div>
      </div>
    </div>
  );
}

const SHORTCUT_SIZE = 100;

export function Shortcuts({ spawnWindow }: { spawnWindow: (app: App) => void }) {
  const apps = useApps();
  const shortcuts = useMemo<ShortcutDesc[]>(() => {
    return apps.map((app, i) => {
      const pos: [number, number] = [i * SHORTCUT_SIZE, 0];
      while (pos[0] >= innerWidth - SHORTCUT_SIZE) {
        pos[0] -= innerWidth;
        pos[0] = Math.max(0, pos[0]);
        pos[1] += SHORTCUT_SIZE;
      }
      return ({ name: app.name, target: app, iconFile: "/wallpaper.img", pos });
    });
  }, [apps]);

  return (
    <div className="shortcuts">
      {shortcuts.map((s, index) => <Shortcut key={index} s={s} spawnWindow={spawnWindow} />)}
    </div>
  );
}

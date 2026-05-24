import type { App } from "../App.tsx";
import "./OverlayToolbar.css";

export default function OverlayToolbar({
  activeApp,
  setActiveApp,
  altPos,
}: {
  activeApp: App | null;
  setActiveApp: (app: App | null) => any;
  altPos: boolean;
}) {
  return (
    <div
      className={
        "overlay-toolbar" + (altPos ? " alternate-toolbar-position" : "")
      }
    >
      <button
        style={{ display: activeApp === null ? "none" : "unset" }}
        className="close-app-button"
        onClick={() => setActiveApp(null)}
      >
        X
      </button>
      <span>{__COMMIT_HASH__}</span>
      <span>{activeApp?.name}</span>
    </div>
  );
}

declare const __COMMIT_HASH__: string;

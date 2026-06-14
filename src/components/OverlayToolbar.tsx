import type { App } from "../App.tsx";
import "./OverlayToolbar.css";

export default function OverlayToolbar({
  isEmbedded = false,
  activeApp,
  setActiveApp,
  altPos,
}: {
  isEmbedded?: boolean;
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
      {activeApp !== null && !isEmbedded && (
        <button className="close-app-button" onClick={() => setActiveApp(null)}>
          X
        </button>
      )}
      <span>{__COMMIT_HASH__}</span>
      {activeApp !== null && <span>{activeApp?.name}</span>}
    </div>
  );
}

declare const __COMMIT_HASH__: string;

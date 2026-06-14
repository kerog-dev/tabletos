import type { App } from "../apps.ts";
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
      className={"overlay-toolbar" + (altPos ? " alternate-toolbar-position" : "")}
    >
      {activeApp !== null && (
        <button className="close-app-button" onClick={() => setActiveApp(null)}>
          X
        </button>
      )}
      {document.fullscreenElement === null
        ? <button onClick={() => document.body.requestFullscreen()}>Fullscreen</button>
        : ""}
      <span>{__COMMIT_HASH__}</span>
      {activeApp !== null && <span>{activeApp?.name}</span>}
    </div>
  );
}

declare const __COMMIT_HASH__: string;

import { useEffect, useState } from "react";
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
  const [isFullscreen, setIsFullscreen] = useState(document.fullscreenElement !== null);

  useEffect(() => {
    const listener = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };
    window.addEventListener("fullscreenchange", listener);
    return window.removeEventListener("fullscreenchange", listener);
  }, []);

  return (
    <div
      className={"overlay-toolbar" + (altPos ? " alternate-toolbar-position" : "")}
    >
      {activeApp !== null && (
        <button className="close-app-button" onClick={() => setActiveApp(null)}>
          X
        </button>
      )}
      {!isFullscreen
        ? <button onClick={() => document.body.requestFullscreen()}>Fullscreen</button>
        : ""}
      <span>{__COMMIT_HASH__}</span>
      {activeApp !== null && <span>{activeApp?.name}</span>}
    </div>
  );
}

declare const __COMMIT_HASH__: string;

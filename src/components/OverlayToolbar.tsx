import type { App } from "../App.tsx";
import "./OverlayToolbar.css";

export default function OverlayToolbar({
  setActiveApp,
  altPos,
}: {
  setActiveApp: (app: App | null) => any;
  altPos: boolean;
}) {
  return (
    <div
      className={
        "overlay-toolbar" + (altPos ? " alternate-toolbar-position" : "")
      }
    >
      <button className="close-app-button" onClick={() => setActiveApp(null)}>
        X
      </button>
    </div>
  );
}

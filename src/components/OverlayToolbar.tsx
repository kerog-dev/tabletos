import type { App } from "../App.tsx";
import "./OverlayToolbar.css";

export default function OverlayToolbar({
  setActiveApp,
}: {
  setActiveApp: (app: App | null) => any;
}) {
  return (
    <div className="overlay-toolbar">
      <button className="close-app-button" onClick={() => setActiveApp(null)}>
        X
      </button>
    </div>
  );
}

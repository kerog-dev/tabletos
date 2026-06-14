import { Suspense, useEffect, useState } from "react";
import { type App, getManifestKey } from "../apps.ts";
import OverlayToolbar from "./OverlayToolbar.tsx";

export default function AppWindow(
  { app, setActiveApp = () => {}, hidden = false, showToolbar = false }: {
    app: App;
    setActiveApp?: (app: App | null) => any;
    hidden?: boolean;
    showToolbar?: boolean;
  },
) {
  const [AppComponent, setComponent] = useState(() => app.component);

  const [altToolbarPos, setAltToolbarPos] = useState(false);
  useEffect(() => {
    (async () => {
      setAltToolbarPos(await getManifestKey(app, "alternateToolbarPosition"));
    })();
  }, []);

  useEffect(() => {
    setComponent(() => app.component);
  }, [app]);

  const toolbar = showToolbar
    ? <OverlayToolbar {...{ setActiveApp, altPos: altToolbarPos, activeApp: app }} />
    : null;

  return (
    <div
      style={{
        display: hidden ? "none" : "unset",
        margin: 0,
        padding: 0,
        width: "100%",
        height: "100%",
      }}
    >
      {showToolbar && toolbar}
      <Suspense fallback={<p>Loading app...</p>}>
        <AppComponent />
      </Suspense>
    </div>
  );
}

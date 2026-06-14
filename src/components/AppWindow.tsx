import { Suspense, useEffect, useState } from "react";
import { type App, getManifestKey } from "../apps.ts";
import OverlayToolbar from "./OverlayToolbar.tsx";

export default function AppWindow(
  { app, isEmbedded = true, setActiveApp = () => {}, hidden = false }: {
    app: App;
    isEmbedded?: boolean;
    setActiveApp?: (app: App) => any;
    hidden?: boolean;
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

  const toolbar = <OverlayToolbar {...{ isEmbedded, setActiveApp, altPos: altToolbarPos, activeApp: app }} />;

  return (
    <div style={{ display: hidden ? "none" : "unset", margin: 0, padding: 0, width: "100%", height: "100%" }}>
      {toolbar}
      <Suspense fallback={<p>Loading app...</p>}>
        <AppComponent />
      </Suspense>
    </div>
  );
}

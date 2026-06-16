import { Suspense, useEffect, useState } from "react";
import { type App, getManifestKey } from "../apps.ts";
import ErrorBoundary from "./ErrorBoundary.tsx";
import OverlayToolbar from "./OverlayToolbar.tsx";

export default function AppWindow(
  { app, setActiveApp = () => {}, hidden = false, showToolbar = false }: {
    app: App;
    setActiveApp?: (app: App | null) => any;
    hidden?: boolean;
    showToolbar?: boolean;
  },
) {
  const [errKey, setErrKey] = useState(0);
  const [altToolbarPos, setAltToolbarPos] = useState(false);

  useEffect(() => {
    (async () => {
      setAltToolbarPos(await getManifestKey(app, "alternateToolbarPosition"));
    })();
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
        overflow: "scroll",
      }}
    >
      {showToolbar && toolbar}
      <Suspense fallback={<p>Loading app...</p>}>
        <ErrorBoundary
          key={errKey}
          renderer={e => (
            <p>
              Error occured in app {app.name}: {String(e)}.{" "}
              <button
                onClick={() => setErrKey(n => n + 1)}
              >
                Refresh?
              </button>
            </p>
          )}
        >
          <app.component />
        </ErrorBoundary>
      </Suspense>
    </div>
  );
}

import { Suspense, useState } from "react";
import { type App } from "../apps.ts";
import ErrorBoundary from "./ErrorBoundary.tsx";

export default function AppWindow(
  { app, hidden = false }: {
    app: App;
    hidden?: boolean;
  },
) {
  const [errKey, setErrKey] = useState(0);

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

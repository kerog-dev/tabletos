import { type ComponentType, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import favicon from "./assets/favicon.svg";
import { boot } from "./boot.ts";
import styles from "./main.module.css";
import { recoveryActions } from "./recovery.tsx";

const faviconEl = document.createElement("link");
faviconEl.rel = "icon";
faviconEl.type = "image/svg+xml";
faviconEl.href = favicon;
document.head.appendChild(faviconEl);

type BootStatus =
  | { status: "booting" }
  | { status: "booted"; wm: typeof import("./components/wm/WindowManager.tsx").default }
  | { status: "failed"; reason: any };

const bootPromise = boot().then(() => import("./components/wm/WindowManager.tsx")).then((module) => module.default);

function renderError(error: any) {
  if (typeof error === "string") return <p style={{ whiteSpace: "pre-wrap" }}>{error}</p>;
  else if (error instanceof Error) {
    return (
      <div>
        {error.name}: {error.message}
        {error.cause ? ` (${String(error.cause)})` : undefined}
        {error.stack
          ? (
            <>
              <br />
              <pre>{error.stack}</pre>
            </>
          )
          : undefined}
      </div>
    );
  }
}

function BootingScreen() {
  return (
    <div className={styles.bootingScreen}>
      <div>
        <span>Booting tabletos...</span>
      </div>
    </div>
  );
}

function RecoveryScreen({ reason }: { reason: any }) {
  const [UI, setUI] = useState<ComponentType<{}> | null>(null);

  return (
    <div className={styles.recoveryScreen}>
      <div>
        <p style={{ textAlign: "center" }}>Fatal error while booting tabletos...</p>
        <div>{renderError(reason)}</div>
        {UI
          ? (
            <div>
              <UI />
            </div>
          )
          : (
            <div className={styles.recoveryActions}>
              {recoveryActions
                .map(([name, action], i) => <div key={i} onClick={() => action(ui => setUI(() => ui))}>{name}</div>)}
            </div>
          )}
      </div>
    </div>
  );
}

function Main() {
  const [status, setStatus] = useState<BootStatus>({ status: "booting" });

  useEffect(() => {
    bootPromise
      .then((wm) => setStatus({ status: "booted", wm }))
      .catch((reason) => setStatus({ status: "failed", reason }));
  }, []);

  if (status.status === "booting") return <BootingScreen />;
  else if (status.status === "failed") return <RecoveryScreen reason={status.reason} />;
  else if (status.status === "booted") return <status.wm />;
  status satisfies never;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Main />
  </StrictMode>,
);

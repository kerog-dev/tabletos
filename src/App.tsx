import type React from "react";
import { lazy, Suspense, useEffect, useState } from "react";
import OverlayToolbar from "./components/OverlayToolbar.tsx";

interface AppComponentParams {}

interface AppManifest {
  alternateToolbarPosition: boolean;
}

const defaultManifest: AppManifest = { alternateToolbarPosition: false };

export interface App {
  name: string;
  component: React.LazyExoticComponent<React.FC<AppComponentParams>>;
  manifest: Promise<Partial<AppManifest>>;
}

function loadApps(names: string[]): App[] {
  return names.map((name) => ({
    name,
    manifest: import(`./apps/${name}.json`).catch(() => defaultManifest),
    component: lazy(() => import(`./apps/${name}.tsx`)),
  }));
}

async function getManifestKey<T extends keyof AppManifest>(
  app: App,
  key: T,
): Promise<AppManifest[T]> {
  return (await app.manifest)[key] ?? defaultManifest[key];
}

const apps: App[] = loadApps([
  "Numbat",
  "Snap",
  "Counter",
  "MediaClient",
  "Whiteboard",
]);

function Main() {
  const [activeApp, setActiveApp] = useState<App | null>(null);
  const [altToolbarPos, setAltToolbarPos] = useState(false);

  useEffect(() => {
    if (!activeApp) return;
    getManifestKey(activeApp, "alternateToolbarPosition").then((x) => {
      setAltToolbarPos(x);
    });
  }, [activeApp]);

  if (activeApp === null)
    return (
      <>
        no app selected
        <ul>
          {apps.map((app, i) => (
            <li key={i}>
              <button onClick={() => setActiveApp(app)}>{app.name}</button>
            </li>
          ))}
        </ul>
      </>
    );

  const ActiveAppComponent = activeApp?.component;

  return (
    <>
      <OverlayToolbar {...{ setActiveApp, altPos: altToolbarPos }} />
      <Suspense fallback={<div>Loading...</div>}>
        <ActiveAppComponent />
      </Suspense>
    </>
  );
}

export default Main;

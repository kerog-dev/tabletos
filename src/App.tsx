import type React from "react";
import { lazy, Suspense, useState } from "react";
import OverlayToolbar from "./components/OverlayToolbar.tsx";

interface AppComponentParams {}

export interface App {
  name: string;
  component: React.LazyExoticComponent<React.FC<AppComponentParams>>;
  manifest: {};
}

function loadApps(names: string[]): App[] {
  return names.map((name) => ({
    name,
    manifest: {},
    component: lazy(() => import(`./apps/${name}.tsx`)),
  }));
}

const apps: App[] = loadApps(["Numbat"]);

function Main() {
  const [activeApp, setActiveApp] = useState<App | null>(null);

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
      <OverlayToolbar {...{ setActiveApp }} />
      <Suspense fallback={<div>Loading...</div>}>
        <ActiveAppComponent />
      </Suspense>
    </>
  );
}

export default Main;

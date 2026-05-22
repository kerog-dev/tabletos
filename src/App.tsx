import type React from "react";
import { useState } from "react";
import OverlayToolbar from "./components/OverlayToolbar.tsx";

interface AppComponentParams {}

export interface App {
  name: string;
  component: React.FunctionComponent<AppComponentParams>;
  manifest: {};
}

async function loadApps(names: string[]): Promise<App[]> {
  const apps = [];
  for (const name of names) {
    apps.push({
      name,
      manifest: {},
      component: (await import(`./apps/${name}.tsx`)).default,
    });
  }
  return apps;
}

const apps: App[] = await loadApps(["Test"]);

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
      <ActiveAppComponent />
    </>
  );
}

export default Main;

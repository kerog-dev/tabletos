import { useEffect, useState } from "react";
import { type App, apps } from "./apps.ts";
import AppWindow from "./components/AppWindow.tsx";

function Main() {
  const [activeApp, setActiveApp] = useState<App | null>(() => {
    const hash = window.location.hash.slice(1);
    return apps.find(app => app.name === hash) ?? null;
  });

  useEffect(() => {
    document.title = `${activeApp?.name ?? "Home"} - tabletos`;
    window.location.hash = activeApp?.name ?? "";
  }, [activeApp]);

  useEffect(() => {
    window.addEventListener("hashchange", () => {
      const hash = window.location.hash.slice(1);
      setActiveApp(apps.find(app => app.name === hash) ?? null);
    });
  }, []);

  if (activeApp === null) {
    // todo: show toolbar?
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
  }

  return (
    <>
      <AppWindow app={activeApp} isEmbedded={false} setActiveApp={setActiveApp} />
    </>
  );
}

export default Main;

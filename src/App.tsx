import { useEffect, useState } from "react";
import { type App, apps } from "./apps.ts";
import AppWindow from "./components/AppWindow.tsx";
import { Toasts } from "./toast.tsx";

// TODO: consider forcing WM?
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
    const listener = () => {
      const hash = window.location.hash.slice(1);
      setActiveApp(apps.find(app => app.name === hash) ?? null);
    };
    window.addEventListener("hashchange", listener);
    return window.removeEventListener("hashchange", listener);
  }, []);

  if (activeApp === null) {
    // todo: show toolbar?
    return (
      <>
        no app selected
        <ul>
          {apps.map(app => (
            <li key={app.name}>
              <button onClick={() => setActiveApp(app)}>{app.name}</button>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <>
      <Toasts />
      <AppWindow app={activeApp} showToolbar={true} setActiveApp={setActiveApp} />
    </>
  );
}

export default Main;

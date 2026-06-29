import type { JSX } from "react";
import { Router, RouterProvider, useRouter } from "../../components/Router.tsx";
import { setTray } from "../../components/wm/tray.ts";
import { AppearanceSettingsPage } from "./AppearanceSettingsPage.tsx";
import { AppManagerPage } from "./AppManagerPage.tsx";
import { ServiceManagerPage } from "./ServiceManagerPage.tsx";
import { StoragePage } from "./StoragePage.tsx";
import "./System.css";

setInterval(() => {
  setTray({
    id: "system",
    name: "System",
    iconUrl: "",
    show() {
      return <p>hi</p>;
    },
  });
}, 500);

const pages: Record<string, JSX.Element> = {
  "Home": <HomePage />,
  "AppearanceSettings": <AppearanceSettingsPage />,
  "Storage": <StoragePage />,
  "ServiceManager": <ServiceManagerPage />,
  "AppManager": <AppManagerPage />,
};

function HomePage() {
  const router = useRouter();

  return (
    <div>
      Welcome to the system settings app.
      <ul>
        {Object.keys(pages).filter(p => p !== "Home").map(p => (
          <li key={p}>
            <button onClick={() => router.navigate(p)}>{p}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function System() {
  return (
    <RouterProvider initialPage="Home">
      <Router
        pages={pages}
      />
    </RouterProvider>
  );
}

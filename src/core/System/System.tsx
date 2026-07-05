import type { JSX } from "react";
import { Router, RouterProvider, useRouter } from "../../components/Router.tsx";
import { setTray } from "../../components/wm/tray.ts";
import { AppearanceSettingsPage } from "./AppearanceSettingsPage.tsx";
import { AppManagerPage } from "./AppManagerPage.tsx";
import DeviceNamePage from "./DeviceNamePage.tsx";
import { ServiceManagerPage } from "./ServiceManagerPage.tsx";
import "./System.css";
import type { Sdk } from "../../sdk.ts";

const { sv }: Sdk = (window as any).$;

setTray({
  id: "system",
  name: "System",
  show() {
    const runningServices = sv.useRunningServices();
    return (
      <p>
        services running: {runningServices.length}
        <br />
      </p>
    );
  },
});

const pages: Record<string, JSX.Element> = {
  "Home": <HomePage />,
  "Appearance Settings": <AppearanceSettingsPage />,
  "Service Manager": <ServiceManagerPage />,
  "App Manager": <AppManagerPage />,
  "Device Name": <DeviceNamePage />,
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

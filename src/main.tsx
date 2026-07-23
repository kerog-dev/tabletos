import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import favicon from "./assets/favicon.svg";
import { boot } from "./boot.ts";

await boot().catch(() => {
  // TODO: show the error, and show a recovery screen
});

const { default: WindowManager } = await import("./components/wm/WindowManager.tsx");

const faviconEl = document.createElement("link");
faviconEl.rel = "icon";
faviconEl.type = "image/svg+xml";
faviconEl.href = favicon;
document.head.appendChild(faviconEl);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WindowManager />
  </StrictMode>,
);

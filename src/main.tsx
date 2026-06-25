import "./earlyinit.ts";
import "./sdk.ts";
import "./vendorfs.ts";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import React from "react";
import * as JSXRuntime from "react/jsx-runtime";
import favicon from "./assets/favicon.svg";
import WindowManager from "./components/wm/WindowManager.tsx";
import { toast, Urgency } from "./toast.tsx";

Object.assign(window as any, {
  __React: React,
  __ReactJsxRuntime: JSXRuntime,
});

window.addEventListener("error", (e) => {
  try {
    toast({ title: "Error", desc: String(e.error), urgency: Urgency.Error });
  } catch {
    alert(String(e.error));
  }
});

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

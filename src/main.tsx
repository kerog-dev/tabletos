import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import React from "react";
import * as JSXRuntime from "react/jsx-runtime";
import Main from "./App.tsx";
import favicon from "./assets/favicon.svg";
import "./sdk.ts";

Object.assign(window as any, {
  __React: React,
  __ReactJsxRuntime: JSXRuntime,
});

window.addEventListener("error", (e) => {
  alert(e.error);
});

const faviconEl = document.createElement("link");
faviconEl.rel = "icon";
faviconEl.type = "image/svg+xml";
faviconEl.href = favicon;
document.head.appendChild(faviconEl);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Main />
  </StrictMode>,
);

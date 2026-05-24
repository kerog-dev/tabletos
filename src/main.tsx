import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import favicon from "./assets/favicon.svg";
import Main from "./App.tsx";

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

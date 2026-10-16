import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import "./index.css";
import { getData } from "./lib/store";

if (getData().settings.theme === "light") document.documentElement.classList.add("theme-light");

// Web / iPhone version: work offline and ask the browser not to clear the list's storage
if (!Capacitor.isNativePlatform() && location.protocol === "https:") {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  (navigator as any).storage?.persist?.().catch?.(() => {});
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

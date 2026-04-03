"use client";

import { useEffect } from "react";

export function PwaServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => {
        if (process.env.NODE_ENV === "development") {
          console.info("[pwa] service worker registered");
        }
      })
      .catch((err) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[pwa] service worker registration failed", err);
        }
      });
  }, []);

  return null;
}
